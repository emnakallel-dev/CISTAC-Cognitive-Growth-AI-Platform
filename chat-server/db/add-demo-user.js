import { DatabaseSync } from 'node:sqlite'
const d = new DatabaseSync('db/demo.db')
d.prepare("INSERT OR IGNORE INTO users (id) VALUES ('demo-user')").run()
console.log(d.prepare('SELECT * FROM users').all())