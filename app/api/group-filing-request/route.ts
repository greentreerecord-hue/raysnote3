import { NextResponse } from "next/server";
import postgres from "postgres";
import { head } from "@vercel/blob";
import { getStripe } from "../../lib/stripe";

export const dynamic = "force-dynamic";

const EXPECTED_AMOUNT = 15900;
const EXPECTED_PRODUCT =
  "Ray'sNotes Full-Service Group Copyright Filing";

type DepositFile = {
  name: string;
  pathname: string;
  url: string;
  contentType: string;
};

export async function POST(request: Request) {
  const connectionString =
    process.env.RAYSSTREAM_DB_DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json(
      { error: "Database connection is unavailable." },
      { status: 500 }
    );
  }

  const sql = postgres(connectionString, {
    ssl: "require",
  });

  try {
    const body = await request.json();

    const sessionId = String(body.sessionId || "");
    const authorName = String(body.authorName || "").trim();
    const claimantName = String(
      body.claimantName || ""
    ).trim();
    const citizenship = String(
      body.citizenship || ""
    ).trim();
    const workForHire = String(
      body.workForHire || ""
    ).trim();
    const authorshipType = String(
      body.authorshipType || ""
    ).trim();
    const notes = String(body.notes || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone || "").trim();
    const address = String(body.address || "").trim();
    const signature = String(body.signature || "").trim();

    const songTitles = Array.isArray(body.songTitles)
      ? body.songTitles
          .map((title: unknown) => String(title).trim())
          .filter(Boolean)
      : [];

    const depositFiles: DepositFile[] = Array.isArray(
      body.depositFiles
    )
      ? body.depositFiles.map((file: DepositFile) => ({
          name: String(file.name || "").trim(),
          pathname: String(file.pathname || "").trim(),
          url: String(file.url || "").trim(),
          contentType: String(
            file.contentType || ""
          ).trim(),
        }))
      : [];

    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { error: "A valid payment session is required." },
        { status: 400 }
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
      return NextResponse.json(
        { error: "Please complete every required field." },
        { status: 400 }
      );
    }

    if (songTitles.length < 1 || songTitles.length > 10) {
      return NextResponse.json(
        { error: "Enter between 1 and 10 song titles." },
        { status: 400 }
      );
    }

    if (depositFiles.length !== songTitles.length) {
      return NextResponse.json(
        {
          error:
            "One private song file is required for every song title.",
        },
        { status: 400 }
      );
    }

    if (
      body.eligibilityConfirmed !== true ||
      body.authorizationConfirmed !== true
    ) {
      return NextResponse.json(
        { error: "Both confirmations are required." },
        { status: 400 }
      );
    }

    if (
      signature.toLowerCase() !==
      authorName.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error:
            "The electronic signature must match the author's legal name.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session =
      await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items.data.price.product"],
      });

    const correctProduct = session.line_items?.data.some(
      (item) => {
        const product = item.price?.product;

        return (
          typeof product === "object" &&
          product !== null &&
          "name" in product &&
          product.name === EXPECTED_PRODUCT
        );
      }
    );

    if (
      session.payment_status !== "paid" ||
      session.amount_total !== EXPECTED_AMOUNT ||
      session.currency?.toLowerCase() !== "usd" ||
      !correctProduct
    ) {
      return NextResponse.json(
        {
          error:
            "Payment could not be verified for this filing request.",
        },
        { status: 403 }
      );
    }

    for (const file of depositFiles) {
      if (
        !file.name ||
        !file.pathname.startsWith(
          `group-filing/${sessionId}/`
        ) ||
        !file.url.startsWith("https://") ||
        !file.url.includes(
          ".private.blob.vercel-storage.com/"
        )
      ) {
        return NextResponse.json(
          { error: "A private song upload is invalid." },
          { status: 400 }
        );
      }

      const blobDetails = await head(file.url);

      if (blobDetails.pathname !== file.pathname) {
        return NextResponse.json(
          { error: "A song upload could not be verified." },
          { status: 400 }
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

    const existing = await sql<
      { reference: string }[]
    >`
      SELECT reference
      FROM group_filing_requests
      WHERE stripe_session_id = ${sessionId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        reference: existing[0].reference,
        existing: true,
      });
    }

    const reference = `RN-GF-${Date.now()
      .toString(36)
      .toUpperCase()}`;

    await sql`
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
    `;

    return NextResponse.json({
      success: true,
      reference,
    });
  } catch (error) {
    console.error("Group filing request error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The filing request could not be submitted.",
      },
      { status: 500 }
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
} 
