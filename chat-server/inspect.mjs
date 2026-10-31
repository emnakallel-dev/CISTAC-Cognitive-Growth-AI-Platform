import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('db/demo.db')
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
  console.log('\n##', name, db.prepare(`SELECT COUNT(*) c FROM ${name}`).get().c, 'rows')
  console.log(db.prepare(`PRAGMA table_info(${name})`).all().map(c => c.name).join(', '))
  console.log(db.prepare(`SELECT * FROM ${name} LIMIT 1`).all())
}