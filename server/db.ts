import { createPool } from 'mysql2/promise'
import { DATABASE_URL } from './config.js'

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required.')
}

export const pool = createPool(DATABASE_URL)

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trips (
      trip_id VARCHAR(255) PRIMARY KEY,
      data TEXT NOT NULL,
      revision INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
}
