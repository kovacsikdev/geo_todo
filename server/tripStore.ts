import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { randomUUID } from 'node:crypto'
import { pool } from './db.js'
import type { TripRecord } from './types.js'

const connectionsByTrip = new Map<string, Set<string>>()

type TripRow = RowDataPacket & {
  trip_id: string
  owner_id: string
  guest_id: string
  data: string
  revision: number
}

function asTripRecord(row: TripRow): TripRecord {
  const activeConnections = connectionsByTrip.get(row.trip_id)
  return {
    tripId: row.trip_id,
    ownerId: row.owner_id,
    guestId: row.guest_id,
    data: row.data,
    revision: row.revision,
    connectionIds: activeConnections ? [...activeConnections] : [],
  }
}

// Generates a unique code in the format xxxx-xxxx with numbers, lowercase and uppercase letters
async function generateUniqueAccessId(): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  
  // Try up to 10 times to generate a unique ID
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    for (let i = 0; i < 8; i++) {
      code += alphabet[bytes[i] % alphabet.length]
      if (i === 3) code += '-'
    }
    
    // Check if this ID already exists in the database
    const [rows] = await pool.query<TripRow[]>(
      `SELECT COUNT(*) as count FROM trips WHERE owner_id = ? OR guest_id = ?`,
      [code, code],
    )
    
    if ((rows[0] as any)?.count === 0) {
      return code
    }
  }
  
  throw new Error('Failed to generate unique access ID after 10 attempts.')
}

// Generates a unique trip ID in the format xxxx-xxxx
async function generateUniqueTripId(): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  
  // Try up to 10 times to generate a unique ID
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    for (let i = 0; i < 8; i++) {
      code += alphabet[bytes[i] % alphabet.length]
      if (i === 3) code += '-'
    }
    
    // Check if this ID already exists in the database
    const [rows] = await pool.query<TripRow[]>(
      `SELECT COUNT(*) as count FROM trips WHERE trip_id = ?`,
      [code],
    )
    
    if ((rows[0] as any)?.count === 0) {
      return code
    }
  }
  
  throw new Error('Failed to generate unique trip ID after 10 attempts.')
}

export async function createTrip(connectionId: string | null, data: string): Promise<TripRecord> {
  const tripId = await generateUniqueTripId()
  const activeConnections = connectionId ? new Set<string>([connectionId]) : new Set<string>()
  const ownerId = await generateUniqueAccessId()
  const guestId = await generateUniqueAccessId()

  try {
    await pool.query(
      `INSERT INTO trips (trip_id, owner_id, guest_id, data, revision) VALUES (?, ?, ?, ?, 0)`,
      [tripId, ownerId, guestId, data],
    )

    const [rows] = await pool.query<TripRow[]>(
      `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE trip_id = ?`,
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
    `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  if (rows.length === 0) {
    return null
  }

  return asTripRecord(rows[0])
}

export async function resolveTripByAccessId(accessId: string): Promise<{ record: TripRecord; role: 'owner' | 'guest' } | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE owner_id = ? OR guest_id = ? LIMIT 1`,
    [accessId, accessId],
  )

  if (rows.length === 0) {
    return null
  }

  const row = rows[0]
  const role = row.owner_id === accessId ? 'owner' : 'guest'
  return { record: asTripRecord(row), role }
}

export async function joinTrip(tripId: string, connectionId: string): Promise<TripRecord | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE trip_id = ?`,
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

export async function joinTripByAccessId(
  accessId: string,
  connectionId: string,
): Promise<{ record: TripRecord; role: 'owner' | 'guest' } | null> {
  const result = await resolveTripByAccessId(accessId)
  if (!result) {
    return null
  }

  const activeConnections = connectionsByTrip.get(result.record.tripId) ?? new Set<string>()
  activeConnections.add(connectionId)
  connectionsByTrip.set(result.record.tripId, activeConnections)

  return {
    record: await resolveTrip(result.record.tripId).then((record) => record ?? result.record),
    role: result.role,
  }
}

export async function canWriteTrip(tripId: string, ownerId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM trips WHERE trip_id = ? AND owner_id = ? LIMIT 1`,
    [tripId, ownerId],
  )

  return rows.length > 0
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
    `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE trip_id = ?`,
    [tripId],
  )

  return asTripRecord(rows[0])
}

export async function deleteTrip(tripId: string): Promise<TripRecord | null> {
  const [rows] = await pool.query<TripRow[]>(
    `SELECT trip_id, owner_id, guest_id, data, revision FROM trips WHERE trip_id = ?`,
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
