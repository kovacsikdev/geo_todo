import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from './db.js'
import type { TripRecord } from './types.js'

const connectionsByTrip = new Map<string, Set<string>>()

type TripRow = RowDataPacket & {
  trip_id: string
  data: string
  revision: number
}

function asTripRecord(row: TripRow): TripRecord {
  const activeConnections = connectionsByTrip.get(row.trip_id)
  return {
    tripId: row.trip_id,
    data: row.data,
    revision: row.revision,
    connectionIds: activeConnections ? [...activeConnections] : [],
  }
}

export async function createTrip(tripId: string, connectionId: string | null, data: string): Promise<TripRecord> {
  const activeConnections = connectionId ? new Set<string>([connectionId]) : new Set<string>()

  try {
    await pool.query(
      `INSERT INTO trips (trip_id, data, revision) VALUES (?, ?, 0)`,
      [tripId, data],
    )

    const [rows] = await pool.query<TripRow[]>(
      `SELECT trip_id, data, revision FROM trips WHERE trip_id = ?`,
      [tripId],
    )

    connectionsByTrip.set(tripId, activeConnections)
    return asTripRecord(rows[0])
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ER_DUP_ENTRY'
    ) {
      throw new Error('Trip already exists.')
    }

    throw error
  }
}

export async function resolveTrip(tripId: string): Promise<TripRecord | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  if (rows.length === 0) {
    return null
  }

  return asTripRecord(rows[0])
}

export async function joinTrip(tripId: string, connectionId: string): Promise<TripRecord | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  if (rows.length === 0) {
    return null
  }

  const activeConnections = connectionsByTrip.get(tripId) ?? new Set<string>()
  activeConnections.add(connectionId)
  connectionsByTrip.set(tripId, activeConnections)

  return asTripRecord(rows[0])
}

export async function removeConnectionId(tripId: string, connectionId: string): Promise<void> {
  const activeConnections = connectionsByTrip.get(tripId)
  if (!activeConnections) {
    return
  }

  activeConnections.delete(connectionId)
  if (activeConnections.size === 0) {
    connectionsByTrip.delete(tripId)
  }
}

export async function updateTripData(tripId: string, data: string): Promise<TripRecord | null> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE trips SET data = ?, revision = revision + 1, updated_at = NOW() WHERE trip_id = ?`,
    [data, tripId],
  )

  if (result.affectedRows === 0) {
    return null
  }

  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  return asTripRecord(rows[0])
}

export async function deleteTrip(tripId: string): Promise<TripRecord | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  if (rows.length === 0) {
    return null
  }

  // Get the trip record BEFORE deleting from the connections map
  // so that emitTripDeleted() can notify all connected guests
  const record = asTripRecord(rows[0])

  await pool.query(`DELETE FROM trips WHERE trip_id = ?`, [tripId])
  connectionsByTrip.delete(tripId)

  return record
}
