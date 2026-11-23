import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'
import { createPool, transaction } from './db.ts'

export async function migrate(pool: Pool): Promise<string[]> {
  const directory = new URL('../migrations/', import.meta.url)
  const filenames = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
  const applied: string[] = []

  await transaction(pool, async (client) => {
    // Only one instance may migrate when rolling deployments overlap.
    await client.query('SELECT pg_advisory_xact_lock(2011403837)')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const existing = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')
    const history = new Set(existing.rows.map((row) => row.filename))
    for (const filename of filenames) {
      if (history.has(filename)) continue
      await client.query(await readFile(new URL(filename, directory), 'utf8'))
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
      applied.push(filename)
    }
  })

  return applied
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let pool: Pool | undefined
  try {
    pool = createPool()
    const applied = await migrate(pool)
    console.log(applied.length ? `Applied ${applied.join(', ')}` : 'Schema is up to date.')
  } catch {
    console.error('Migration failed. Check the database connection and schema permissions.')
    process.exitCode = 1
  } finally {
    await pool?.end()
  }
}
