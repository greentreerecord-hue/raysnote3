import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

const allowedStatuses = [
  "pending_review",
  "needs_information",
  "eligible",
  "filing_submitted",
  "completed",
  "ineligible",
  "refunded",
];

function isAuthorized(request: Request) {
  const suppliedPassword =
    request.headers.get("x-admin-password") || "";

  const adminPassword = process.env.ADMIN_PASSWORD || "";

  return (
    adminPassword.length > 0 &&
    suppliedPassword === adminPassword
  );
}

function getDatabase() {
  const connectionString =
    process.env.RAYSSTREAM_DB_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "RAYSSTREAM_DB_DATABASE_URL is missing."
    );
  }

  return postgres(connectionString, {
    ssl: "require",
  });
}

async function ensureTable(
  sql: ReturnType<typeof postgres>
) {
  await sql`
    CREATE TABLE IF NOT EXISTS group_filing_requests (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      stripe_session_id TEXT NOT NULL UNIQUE,
      author_name TEXT NOT NULL,
      claimant_name TEXT NOT NULL,
      citizenship TEXT NOT NULL,
      work_for_hire TEXT NOT NULL,
      song_titles JSONB NOT NULL,
      deposit_files JSONB NOT NULL DEFAULT '[]'::jsonb,
      authorship_type TEXT NOT NULL,
      notes TEXT,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      mailing_address TEXT NOT NULL,
      electronic_signature TEXT NOT NULL,
      eligibility_confirmed BOOLEAN NOT NULL,
      authorization_confirmed BOOLEAN NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE group_filing_requests
    ADD COLUMN IF NOT EXISTS deposit_files JSONB
    NOT NULL DEFAULT '[]'::jsonb
  `;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const sql = getDatabase();

  try {
    await ensureTable(sql);

    const requests = await sql`
      SELECT
        id,
        reference,
        author_name,
        claimant_name,
        citizenship,
        work_for_hire,
        song_titles,
        deposit_files,
        authorship_type,
        notes,
        email,
        phone,
        mailing_address,
        eligibility_confirmed,
        authorization_confirmed,
        status,
        created_at
      FROM group_filing_requests
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Admin group filings GET error:", error);

    return NextResponse.json(
      { error: "Filing requests could not be loaded." },
      { status: 500 }
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const sql = getDatabase();

  try {
    const body = await request.json();
    const reference = String(body.reference || "").trim();
    const status = String(body.status || "").trim();

    if (
      !reference ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { error: "A valid reference and status are required." },
        { status: 400 }
      );
    }

    await ensureTable(sql);

    const updated = await sql<
      { reference: string; status: string }[]
    >`
      UPDATE group_filing_requests
      SET status = ${status}
      WHERE reference = ${reference}
      RETURNING reference, status
    `;

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Filing request was not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request: updated[0],
    });
  } catch (error) {
    console.error("Admin group filings PATCH error:", error);

    return NextResponse.json(
      { error: "The filing status could not be updated." },
      { status: 500 }
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
} 
