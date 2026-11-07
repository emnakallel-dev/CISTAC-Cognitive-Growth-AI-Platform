import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
for name, sql in db.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('sessions','task_results','questions','users')"):
    print(sql, "\n")
print("questions:", db.execute("select count(*) from questions").fetchone())
