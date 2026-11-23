# Cognitive Growth Agent

A non-clinical AI agent that profiles how a person thinks, explains the result with honest uncertainty, coaches them with their own data, and tracks growth over time.

Assess: profile across visual, numerical, spatial and verbal reasoning.
Understand: every score is a percentage with an uncertainty range (for example 45%, likely 36–54%).
Coach: an AI coach answers from the user's stored results. It explains its advice and never diagnoses.
Improve: the Brain Twin dashboard shows the profile, score curves, heatmap and goals. An AI Collaboration Score (0–100) measures how well the user works with the AI.
Architecture
React + Vite (frontend)  --/api-->  Express (chat-server, :8787)  -->  SQLite (db/demo.db)
                                                                  -->  LLM (OpenAI-compatible API)
frontend/ React, Vite and the shadcn-admin template. Pages: Brain Twin dashboard and Coach chat. Vite proxies /api to the backend.
chat-server/ Express API. It owns data access, scoring, the collaboration formula and the LLM call. The API key never reaches the browser.
chat-server/db/ SQLite schema, seed script and (generated, git-ignored) demo.db.

## API Endpoints 
GET/ api/history profile snapshots with scores (Brain Twin)
GET /api/collabration AI Collaboration Score history
POST /api/chat Send one message, get the AI coach's reply and the updated collabroation score
GET /api/chat/history

## Getting started
### 1. Backend
cd chat-server
pnpm install
cp .env.example .env        # then fill in the values below
node db/seed.js             # builds db/demo.db with demo data
pnpm dev                    # http://localhost:8787

### 2. Frontend (second terminal)
cd frontend
pnpm install
pnpm dev

## How scoring works
Per question (score out of 1) : T_max is 45 s (easy), 90 s (medium) or 120 s (hard).
Correct and on time: 0.7 + 0.3 × (T_max − T_user) / T_max
Correct but late: 0.30
Incorrect: 0

Adaptive difficulty. Score ≥ 0.75 moves up a level, 0.31–0.74 stays, ≤ 0.30 moves down.

Category score : weighted average of question scores, with weights 10 (easy), 20 (medium), 30 (hard). The overall score is the mean of the category scores.

AI Collaboration Score : rule-based on the user's chat messages, so it is deterministic and explainable. It needs at least 3 user messages.
Clarification 20%, critical verification 25%, iteration 20%, autonomy 20%, responsible use 15%

## Team
Emna Kallel
Nour Teffehi
Chaima Kharrat
