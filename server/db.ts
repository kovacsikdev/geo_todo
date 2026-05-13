import type { RowDataPacket } from 'mysql2'
import { createPool } from 'mysql2/promise'
import { DATABASE_URL } from './config.js'

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required.')
}

export const pool = createPool(DATABASE_URL)

type ColumnPresenceRow = RowDataPacket & {
  count: number
}

async function ensureColumnExists(tableName: string, columnName: string, definition: string): Promise<void> {
  const [rows] = await pool.query<ColumnPresenceRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  )

  if (rows[0]?.count > 0) {
    return
  }

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      trip_id VARCHAR(255) PRIMARY KEY,
      owner_id VARCHAR(255) NOT NULL,
      guest_id VARCHAR(255) NOT NULL,
      data TEXT NOT NULL,
      revision INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  await ensureColumnExists('trips', 'owner_id', 'VARCHAR(255) NULL')
  await ensureColumnExists('trips', 'guest_id', 'VARCHAR(255) NULL')

  await pool.query(`
    UPDATE trips
    SET
      owner_id = COALESCE(NULLIF(owner_id, ''), REPLACE(UUID(), '-', '')),
      guest_id = COALESCE(NULLIF(guest_id, ''), REPLACE(UUID(), '-', ''))
    WHERE owner_id IS NULL OR owner_id = '' OR guest_id IS NULL OR guest_id = ''
  `)

  await pool.query(`ALTER TABLE trips MODIFY COLUMN owner_id VARCHAR(255) NOT NULL`)
  await pool.query(`ALTER TABLE trips MODIFY COLUMN guest_id VARCHAR(255) NOT NULL`)

  try {
    await pool.query(`ALTER TABLE trips ADD UNIQUE INDEX trips_owner_id_unique (owner_id)`)
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined

    if (code !== 'ER_DUP_KEYNAME' && code !== 'ER_DUP_ENTRY') {
      throw error
    }
  }

  try {
    await pool.query(`ALTER TABLE trips ADD UNIQUE INDEX trips_guest_id_unique (guest_id)`)
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined

    if (code !== 'ER_DUP_KEYNAME' && code !== 'ER_DUP_ENTRY') {
      throw error
    }
  }
}
