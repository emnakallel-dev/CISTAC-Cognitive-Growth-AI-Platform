CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- Clerk user id (or 'demo-user')
  input_mode TEXT DEFAULT 'standard',  -- standard | camera | voice
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
type TEXT NOT NULL,                  
  granted INTEGER NOT NULL,
  policy_version TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);-- data_processing | ai_coach | camera | voice
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dimension TEXT NOT NULL,             
  difficulty INTEGER NOT NULL,         
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,        
  bias_notes TEXT
);-- visual | numerical | spatial | verbal-- 1..5-- never sent to the browser
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS task_results (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  answer_given TEXT,
  is_correct INTEGER NOT NULL,
  response_ms INTEGER,
  retries INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_snapshots (   -- the Brain Twin history
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  taken_at TEXT NOT NULL,
  visual REAL, visual_low REAL, visual_high REAL, visual_n INTEGER,
  numerical REAL, numerical_low REAL, numerical_high REAL, numerical_n INTEGER,
spatial REAL, spatial_low REAL, spatial_high REAL, spatial_n INTEGER,
  verbal REAL, verbal_low REAL, verbal_high REAL, verbal_n INTEGER,
  scoring_version TEXT DEFAULT 'v1'
);
CREATE TABLE IF NOT EXISTS collaboration_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id INTEGER REFERENCES profile_snapshots(id) ON DELETE CASCADE,
  taken_at TEXT NOT NULL,
  total REAL NOT NULL,                 -- 0..100
  clarification REAL, critical_verification REAL, iteration REAL,
  autonomy REAL, responsible_use REAL,
  formula_version TEXT DEFAULT 'v1'
);
CREATE TABLE IF NOT EXISTS learning_plans (      -- adaptive difficulty
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  current_difficulty INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
PRIMARY KEY (user_id, dimension)
);
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  dimension TEXT,
text TEXT NOT NULL,
  rationale TEXT NOT NULL,             -- the "why" (explainability)
status TEXT DEFAULT 'new'
);
CREATE TABLE IF NOT EXISTS coach_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
role TEXT NOT NULL,                  -- user | assistant
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS goals (               -- designed, not wired in this guide
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension TEXT, metric TEXT, target REAL,
start_date TEXT, end_date TEXT, status TEXT DEFAULT 'active'
);  