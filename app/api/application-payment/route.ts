import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "../../lib/application-store";

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
    return json({ error: "Please use the application page." }, 403);
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in to verify your payment." }, 401);
    }

    const body = await request.json();

    if (
      typeof body.applicationId !== "string" ||
      !body.applicationId ||
      body.applicationId.length > 100 ||
      typeof body.sessionId !== "string" ||
      !body.sessionId.startsWith("cs_") ||
      body.sessionId.length > 300
    ) {
      return json({ error: "A valid application and payment are required." }, 400);
    }

    const sql = getDatabase();

    const applications = await sql<
      { id: string; stripe_session_id: string | null }[]
    >`
      SELECT id, stripe_session_id
      FROM raysnotes_applications
      WHERE id = ${body.applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = applications[0];

    if (!application) {
      return json({ error: "Application was not found." }, 404);
    }

    if (
      application.stripe_session_id &&
      application.stripe_session_id !== body.sessionId
    ) {
      return json(
        { error: "This application already has a different payment." },
        409
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json({ error: "Payment verification is not configured." }, 500);
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.retrieve(body.sessionId, {
      expand: ["line_items"],
    });

    const correctPayment =
      session.mode === "payment" &&
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.amount_total === 2499 &&
      session.currency === "usd" &&
      session.client_reference_id === application.id &&
      session.metadata?.product_code === "assisted-copyright-application" &&
      session.metadata?.application_id === application.id &&
      session.metadata?.account_id === account.id &&
      session.line_items?.data.length === 1 &&
      session.line_items.data[0].quantity === 1 &&
      session.line_items.data[0].description ===
        "Ray'sNotes Assisted Copyright Application";

    if (!correctPayment) {
      return json(
        {
          paid: false,
          error: "This payment does not unlock this application.",
        },
        403
      );
    }

    const updated = await sql<{ id: string }[]>`
      UPDATE raysnotes_applications
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
      return json({ error: "The application payment has changed." }, 409);
    }

    return json({ paid: true, applicationId: application.id });
  } catch (error) {
    console.error("Application payment verification failed:", error);

    return json(
      {
        paid: false,
        error: "Payment could not be verified. Please try again.",
      },
      500
    );
  }
} 
