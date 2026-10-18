import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensureLLCTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  LLC_PREPARATION_CENTS,
  LLC_PRODUCT_CODE,
  LLC_PRODUCT_NAME,
} from "../../lib/llc-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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
      typeof applicationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        applicationId
      ) ||
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

    const applications = await sql<
      {
        id: string;
        stripe_session_id: string | null;
      }[]
    >`
      SELECT id, stripe_session_id
      FROM raysnotes_llc_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = applications[0];

    if (!application) {
      return json(
        { error: "LLC application was not found." },
        404
      );
    }

    if (
      application.stripe_session_id &&
      application.stripe_session_id !== sessionId
    ) {
      return json(
        {
          error:
            "This LLC application already has a different payment. Do not pay again.",
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

    const item = session.line_items?.data[0];

    const correctPayment =
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.amount_total === LLC_PREPARATION_CENTS &&
      session.currency === "usd" &&
      session.client_reference_id === application.id &&
      session.metadata?.product_code === LLC_PRODUCT_CODE &&
      session.metadata?.application_id === application.id &&
      session.metadata?.account_id === account.id &&
      session.line_items?.data.length === 1 &&
      session.line_items.has_more === false &&
      item?.quantity === 1 &&
      item.description === LLC_PRODUCT_NAME;

    if (!correctPayment) {
      return json(
        {
          paid: false,
          error:
            "This payment does not unlock this LLC application. Do not pay again if you were charged.",
        },
        403
      );
    }

    const updated = await sql<{ id: string }[]>`
      UPDATE raysnotes_llc_applications
      SET
        stripe_session_id = ${session.id},
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
      WHERE id = ${application.id}
        AND account_id = ${account.id}
        AND (
          stripe_session_id IS NULL
          OR stripe_session_id = ${session.id}
        )
      RETURNING id
    `;

    if (!updated[0]) {
      return json(
        {
          error:
            "The LLC payment record has changed. Do not pay again.",
        },
        409
      );
    }

    return json({
      paid: true,
      applicationId: application.id,
      creditCents: LLC_PREPARATION_CENTS,
    });
  } catch (error) {
    console.error("LLC payment verification failed:", error);

    return json(
      {
        paid: false,
        error:
          "Payment could not be verified. Please try again. If you were charged, do not pay again.",
      },
      500
    );
  }
} 
