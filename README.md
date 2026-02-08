# Kettei / Coin

The Decision Mirror — a ritual for clarity. Next.js App Router + Vercel-ready backend.

## Stack

- Next.js App Router + TypeScript
- Vercel Postgres
- Auth: Email + Password (try first, create account after first ritual)
- Rate limit: Upstash Redis
- LLM: OpenAI (10 free calls per user)

## Flow

1. **Use first** — Create a session and run the ritual with no login
2. **Then register** — After your first ritual, you'll be prompted to create an account (email + password)
3. **Sign in** — Returning users sign in at `/login`

## Setup

### 1. Create Vercel project

```bash
vercel
```

### 2. Add Vercel Postgres

- Vercel Dashboard → Storage → Create Database → Postgres
- Copy `POSTGRES_URL` to your env

### 3. Upstash Redis

- Create Redis database at [upstash.com](https://upstash.com)
- Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 4. OpenAI

- Create API key at [platform.openai.com](https://platform.openai.com)
- Set `OPENAI_API_KEY`

### 5. Env vars

Copy `.env.local.example` to `.env.local` and fill in:

```
APP_BASE_URL=http://localhost:3000
POSTGRES_URL=...
AUTH_TOKEN_SECRET=<generate with: openssl rand -hex 32>
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
OPENAI_API_KEY=...
```

### 6. Run DB schema

**Option A: Vercel SQL Console**

- Vercel Dashboard → Storage → Your Postgres → Query
- Paste contents of `db/schema.sql` and run

**Option B: Local psql**

```bash
psql $POSTGRES_URL -f db/schema.sql
```

### 7. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, create a session, complete the ritual, then create an account when prompted.

## Routes

- `/` — Home: create session, list sessions
- `/login` — Email + password sign in (for returning users)
- `/session/[id]` — Run ritual, Reflect with AI, create account (if guest)
