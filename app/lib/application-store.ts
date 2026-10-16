import postgres from "postgres";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export const ACCOUNT_COOKIE = "raysnotes-application-session";
export const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type ApplicationAccount = {
  id: string;
  email: string;
};

let database: ReturnType<typeof postgres> | undefined;
let initialization: Promise<void> | undefined;

export function getDatabase() {
  const connectionString =
    process.env.RAYSSTREAM_DB_DATABASE_URL;

  if (!connectionString) {
    throw new Error("The applications database is not configured.");
  }

  if (!database) {
    database = postgres(connectionString, {
      ssl: "require",
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return database;
}

export async function ensureApplicationTables() {
  if (!initialization) {
    initialization = createTables().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }

  await initialization;
}

async function createTables() {
  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_application_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_application_sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL
        REFERENCES raysnotes_application_accounts(id)
        ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS raysnotes_application_sessions_account
    ON raysnotes_application_sessions(account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_applications (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL
        REFERENCES raysnotes_application_accounts(id)
        ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled application',
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      stripe_session_id TEXT UNIQUE,
      paid_at TIMESTAMPTZ,
      summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS raysnotes_applications_account
    ON raysnotes_applications(account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_application_auth_attempts (
      identifier_hash TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 1,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getApplicationAccount(
  request: NextRequest
): Promise<ApplicationAccount | null> {
  const token = request.cookies.get(ACCOUNT_COOKIE)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  await ensureApplicationTables();
  const sql = getDatabase();

  const accounts = await sql<ApplicationAccount[]>`
    SELECT accounts.id, accounts.email
    FROM raysnotes_application_sessions AS sessions
    JOIN raysnotes_application_accounts AS accounts
      ON accounts.id = sessions.account_id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > NOW()
    LIMIT 1
  `;

  return accounts[0] || null;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  return origin === new URL(request.url).origin;
}

export async function allowAuthentication(email: string) {
  await ensureApplicationTables();
  const sql = getDatabase();

  const identifier = hashToken(`application-auth:${email}`);

  const rows = await sql<{ attempts: number }[]>`
    INSERT INTO raysnotes_application_auth_attempts (
      identifier_hash,
      attempts,
      window_started_at
    )
    VALUES (${identifier}, 1, NOW())
    ON CONFLICT (identifier_hash)
    DO UPDATE SET
      attempts = CASE
        WHEN raysnotes_application_auth_attempts.window_started_at
          < NOW() - INTERVAL '15 minutes'
        THEN 1
        ELSE raysnotes_application_auth_attempts.attempts + 1
      END,
      window_started_at = CASE
        WHEN raysnotes_application_auth_attempts.window_started_at
          < NOW() - INTERVAL '15 minutes'
        THEN NOW()
        ELSE raysnotes_application_auth_attempts.window_started_at
      END
    RETURNING attempts
  `;

  return rows[0].attempts <= 10;
} 
