import { Pool } from 'pg'
import type { PoolClient } from 'pg'

export function createPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const pool = new Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  })
  pool.on('error', () => console.error('The database pool lost an idle connection.'))
  return pool
}

export async function transaction<Result>(
  pool: Pool,
  work: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect()
  let releaseError: Error | undefined
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      releaseError = new Error('Could not roll back transaction')
    }
    throw error
  } finally {
    client.release(releaseError)
  }
}
