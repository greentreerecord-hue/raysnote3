import { NextResponse } from "next/server";
import postgres from "postgres";
import { head } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { verifyGroupFilingPayment } from
  "../../lib/group-filing-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DepositFile = {
  name: string;
  pathname: string;
  url: string;
  contentType: string;
};

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const connectionString =
    process.env.RAYSSTREAM_DB_DATABASE_URL;

  if (!connectionString) {
    return json(
      { error: "Database connection is unavailable." },
      500
    );
  }

  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    prepare: false,
  });

  try {
    const body = await request.json();

    const sessionId = String(body.sessionId || "");
    const authorName = String(body.authorName || "").trim();
    const claimantName = String(body.claimantName || "").trim();
    const citizenship = String(body.citizenship || "").trim();
    const workForHire = String(body.workForHire || "").trim();
    const authorshipType = String(body.authorshipType || "").trim();
    const notes = String(body.notes || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const signature = String(body.signature || "").trim();

    const songTitles: string[] = Array.isArray(body.songTitles)
      ? body.songTitles
          .map((title: unknown) => String(title).trim())
          .filter(Boolean)
      : [];

    const depositFiles: DepositFile[] =
      Array.isArray(body.depositFiles)
        ? body.depositFiles.map((file: DepositFile) => ({
            name: String(file.name || "").trim(),
            pathname: String(file.pathname || "").trim(),
            url: String(file.url || "").trim(),
            contentType: String(file.contentType || "").trim(),
          }))
        : [];

    if (
      !sessionId.startsWith("cs_") ||
      sessionId.length > 300
    ) {
      return json(
        { error: "A valid payment session is required." },
        400
      );
    }

    if (
      !authorName ||
      !claimantName ||
      !citizenship ||
      !workForHire ||
      !authorshipType ||
      !email ||
      !phone ||
      !address ||
      !signature
    ) {
      return json(
        { error: "Please complete every required field." },
        400
      );
    }

    if (
      songTitles.length < 1 ||
      songTitles.length > 10 ||
      songTitles.some((title) => title.length > 500)
    ) {
      return json(
        { error: "Enter between 1 and 10 song titles, each under 501 characters." },
        400
      );
    }

    if (depositFiles.length !== songTitles.length) {
      return json(
        {
          error:
            "One private song file is required for every song title.",
        },
        400
      );
    }

    if (
      new Set(depositFiles.map((file) => file.pathname)).size !==
      depositFiles.length
    ) {
      return json(
        { error: "Provide a separate upload for each song." },
        400
      );
    }

    if (
      body.eligibilityConfirmed !== true ||
      body.authorizationConfirmed !== true
    ) {
      return json(
        { error: "Both confirmations are required." },
        400
      );
    }

    if (
      signature.toLowerCase() !== authorName.toLowerCase()
    ) {
      return json(
        {
          error:
            "The electronic signature must match the author's legal name.",
        },
        400
      );
    }

    let upgradeId: string | null;

    try {
      const payment = await verifyGroupFilingPayment(
        request,
        sessionId
      );

      upgradeId = payment.upgradeId;
    } catch {
      return json(
        {
          error:
            "Payment could not be verified. Sign in to the purchasing account if you used preparation credit.",
        },
        403
      );
    }

    for (const file of depositFiles) {
      let uploadUrl: URL;

      try {
        uploadUrl = new URL(file.url);
      } catch {
        return json(
          { error: "A private song upload is invalid." },
          400
        );
      }

      if (
        !file.name ||
        !file.pathname.startsWith(
          `group-filing/${sessionId}/`
        ) ||
        uploadUrl.protocol !== "https:" ||
        !uploadUrl.hostname.endsWith(
          ".private.blob.vercel-storage.com"
        )
      ) {
        return json(
          { error: "A private song upload is invalid." },
          400
        );
      }

      const blobDetails = await head(file.url);

      if (blobDetails.pathname !== file.pathname) {
        return json(
          { error: "A song upload could not be verified." },
          400
        );
      }
    }

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

    const result = await sql.begin(async (transaction) => {
      if (upgradeId) {
        const upgrades = await transaction<
          { group_filing_reference: string | null }[]
        >`
          SELECT group_filing_reference
          FROM raysnotes_application_upgrades
          WHERE id = ${upgradeId}
            AND stripe_session_id = ${sessionId}
            AND paid_at IS NOT NULL
          FOR UPDATE
        `;

        if (!upgrades[0]) {
          throw new Error("The paid upgrade was not found.");
        }

        if (upgrades[0].group_filing_reference) {
          return {
            reference: upgrades[0].group_filing_reference,
            existing: true,
          };
        }
      }

      const reference =
        `RN-GF-${randomUUID().toUpperCase()}`;

      const inserted = await transaction<
        { reference: string }[]
      >`
        INSERT INTO group_filing_requests (
          reference,
          stripe_session_id,
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
          electronic_signature,
          eligibility_confirmed,
          authorization_confirmed,
          status
        )
        VALUES (
          ${reference},
          ${sessionId},
          ${authorName},
          ${claimantName},
          ${citizenship},
          ${workForHire},
          ${JSON.stringify(songTitles)}::jsonb,
          ${JSON.stringify(depositFiles)}::jsonb,
          ${authorshipType},
          ${notes || null},
          ${email},
          ${phone},
          ${address},
          ${signature},
          ${true},
          ${true},
          ${"pending_review"}
        )
        ON CONFLICT (stripe_session_id) DO NOTHING
        RETURNING reference
      `;

      let savedReference = inserted[0]?.reference;

      if (!savedReference) {
        const existing = await transaction<
          { reference: string }[]
        >`
          SELECT reference
          FROM group_filing_requests
          WHERE stripe_session_id = ${sessionId}
          LIMIT 1
        `;

        savedReference = existing[0]?.reference;
      }

      if (!savedReference) {
        throw new Error("The filing request could not be saved.");
      }

      if (upgradeId) {
        await transaction`
          UPDATE raysnotes_application_upgrades
          SET
            group_filing_reference = ${savedReference},
            updated_at = NOW()
          WHERE id = ${upgradeId}
            AND stripe_session_id = ${sessionId}
        `;
      }

      return {
        reference: savedReference,
        existing: inserted.length === 0,
      };
    });

    return json({
      success: true,
      reference: result.reference,
      existing: result.existing,
    });
  } catch (error) {
    console.error("Group filing request error:", error);

    return json(
      {
        error:
          "The filing request could not be submitted. Please try again.",
      },
      500
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
} 
