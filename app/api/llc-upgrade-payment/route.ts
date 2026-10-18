import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensureLLCTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  LLC_PREPARATION_CENTS,
  LLC_FULL_SERVICE_CENTS,
  LLC_UPGRADE_SERVICE_CENTS,
} from "../../lib/llc-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCT_CODE = "hawaii-llc-full-service-upgrade";
const PRODUCT_NAME =
  "Ray'sNotes Hawaii LLC Full-Service Upgrade";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value
    )
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json(
      { error: "Please use the LLC application page." },
      403
    );
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json(
        { error: "Please sign in to verify your payment." },
        401
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid payment request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid payment request." }, 400);
    }

    const { applicationId, sessionId } =
      body as Record<string, unknown>;

    if (
      !validId(applicationId) ||
      typeof sessionId !== "string" ||
      !sessionId.startsWith("cs_") ||
      sessionId.length > 300
    ) {
      return json(
        {
          error:
            "A valid LLC application and payment session are required.",
        },
        400
      );
    }

    await ensureLLCTables();

    const sql = getDatabase();

    const rows = await sql<
      {
        id: string;
        application_id: string;
        preparation_session_id: string;
        stripe_session_id: string | null;
        application_preparation_session: string | null;
        preparation_paid: boolean;
        credit_cents: number;
        service_total_cents: number;
        service_due_cents: number;
        government_fee_cents: number;
      }[]
    >`
      SELECT
        u.id,
        u.application_id,
        u.preparation_session_id,
        u.stripe_session_id,
        a.stripe_session_id AS application_preparation_session,
        a.paid_at IS NOT NULL AS preparation_paid,
        u.credit_cents,
        u.service_total_cents,
        u.service_due_cents,
        u.government_fee_cents
      FROM raysnotes_llc_upgrades u
      JOIN raysnotes_llc_applications a
        ON a.id = u.application_id
      WHERE a.id = ${applicationId}
        AND a.account_id = ${account.id}
      LIMIT 1
    `;

    const upgrade = rows[0];

    if (!upgrade) {
      return json(
        { error: "The LLC upgrade was not found." },
        404
      );
    }

    if (
      !upgrade.preparation_paid ||
      upgrade.application_preparation_session !==
        upgrade.preparation_session_id ||
      upgrade.stripe_session_id !== sessionId ||
      upgrade.credit_cents !== LLC_PREPARATION_CENTS ||
      upgrade.service_total_cents !== LLC_FULL_SERVICE_CENTS ||
      upgrade.service_due_cents !== LLC_UPGRADE_SERVICE_CENTS ||
      upgrade.government_fee_cents !== 0
    ) {
      return json(
        {
          paid: false,
          error:
            "This payment does not match the LLC upgrade record. If charged, do not pay again.",
        },
        409
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json(
        { error: "Payment verification is not configured." },
        500
      );
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      { expand: ["line_items"] }
    );

    const items = session.line_items;
    const item = items?.data[0];

    const correctPayment =
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.amount_total === LLC_UPGRADE_SERVICE_CENTS &&
      session.currency === "usd" &&
      session.client_reference_id === applicationId &&
      session.metadata?.product_code === PRODUCT_CODE &&
      session.metadata?.application_id === applicationId &&
      session.metadata?.account_id === account.id &&
      session.metadata?.upgrade_id === upgrade.id &&
      session.metadata?.preparation_session_id ===
        upgrade.preparation_session_id &&
      session.metadata?.credit_cents ===
        String(LLC_PREPARATION_CENTS) &&
      session.metadata?.service_total_cents ===
        String(LLC_FULL_SERVICE_CENTS) &&
      session.metadata?.service_due_cents ===
        String(LLC_UPGRADE_SERVICE_CENTS) &&
      items?.data.length === 1 &&
      items?.has_more === false &&
      item?.quantity === 1 &&
      item?.description === PRODUCT_NAME &&
      item?.amount_total === LLC_UPGRADE_SERVICE_CENTS;

    if (!correctPayment) {
      return json(
        {
          paid: false,
          error:
            "Stripe has not confirmed the expected upgrade payment. If charged, do not pay again.",
        },
        403
      );
    }

    const updated = await sql<{ id: string }[]>`
      UPDATE raysnotes_llc_upgrades u
      SET
        paid_at = COALESCE(u.paid_at, NOW()),
        updated_at = NOW()
      WHERE u.id = ${upgrade.id}
        AND u.application_id = ${applicationId}
        AND u.stripe_session_id = ${session.id}
        AND u.preparation_session_id =
          ${upgrade.preparation_session_id}
        AND u.credit_cents = ${LLC_PREPARATION_CENTS}
        AND u.service_total_cents = ${LLC_FULL_SERVICE_CENTS}
        AND u.service_due_cents = ${LLC_UPGRADE_SERVICE_CENTS}
        AND u.government_fee_cents = 0
        AND EXISTS (
          SELECT 1
          FROM raysnotes_llc_applications a
          WHERE a.id = u.application_id
            AND a.account_id = ${account.id}
            AND a.paid_at IS NOT NULL
            AND a.stripe_session_id = u.preparation_session_id
        )
      RETURNING u.id
    `;

    if (!updated[0]) {
      return json(
        {
          paid: false,
          error:
            "The upgrade record changed. Reload your application. Do not pay again.",
        },
        409
      );
    }

    return json({
      paid: true,
      upgradePaid: true,
      applicationId,
      creditCents: LLC_PREPARATION_CENTS,
      serviceTotalCents: LLC_FULL_SERVICE_CENTS,
      upgradePaidCents: LLC_UPGRADE_SERVICE_CENTS,
      governmentFeesIncluded: false,
      message:
        "Upgrade payment verified. Payment does not confirm submission or state approval.",
    });
  } catch (error) {
    console.error("LLC upgrade verification failed:", error);

    return json(
      {
        paid: false,
        error:
          "Upgrade payment could not be verified. Please try again. If charged, do not pay again.",
      },
      500
    );
  }
} 
