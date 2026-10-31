import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const db = new DatabaseSync(fileURLToPath(new URL('./demo.db', import.meta.url)))
db.exec('PRAGMA foreign_keys = ON')
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))