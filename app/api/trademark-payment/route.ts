import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensureTrademarkTables,
  getApplicationAccount,
  getDatabase,
  TRADEMARK_PREPARATION_CENTS,
  TRADEMARK_PRODUCT_CODE,
} from "../../lib/trademark-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json(
        {
          paid: false,
          error: "Please sign in to verify your payment.",
        },
        401
      );
    }

    const applicationId =
      request.nextUrl.searchParams.get("application_id");

    const sessionId =
      request.nextUrl.searchParams.get("session_id");

    if (!applicationId || !ID_PATTERN.test(applicationId)) {
      return json(
        {
          paid: false,
          error: "A valid trademark application is required.",
        },
        400
      );
    }

    if (
      !sessionId ||
      !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) ||
      sessionId.length > 255
    ) {
      return json(
        {
          paid: false,
          error: "A valid payment session is required.",
        },
        400
      );
    }

    await ensureTrademarkTables();

    const sql = getDatabase();

    const applications = await sql<
      { id: string; paid: boolean }[]
    >`
      SELECT
        id,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_trademark_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    if (!applications[0]) {
      return json(
        {
          paid: false,
          error: "Trademark application was not found.",
        },
        404
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json(
        {
          paid: false,
          error: "Payment verification is not configured.",
        },
        500
      );
    }

    const stripe = new Stripe(secretKey);

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError
      ) {
        return json(
          {
            paid: false,
            error: "The payment session could not be found.",
          },
          400
        );
      }

      throw error;
    }

    const matchesApplication =
      session.mode === "payment" &&
      session.client_reference_id === applicationId &&
      session.metadata?.product_code === TRADEMARK_PRODUCT_CODE &&
      session.metadata?.application_id === applicationId &&
      session.metadata?.account_id === account.id;

    if (!matchesApplication) {
      return json(
        {
          paid: false,
          error:
            "This payment does not match your trademark application.",
        },
        403
      );
    }

    if (
      session.currency !== "usd" ||
      session.amount_total !== TRADEMARK_PREPARATION_CENTS
    ) {
      return json(
        {
          paid: false,
          error:
            "This payment does not match the $24.99 preparation price.",
        },
        400
      );
    }

    if (
      session.status !== "complete" ||
      session.payment_status !== "paid"
    ) {
      return json({
        paid: false,
        applicationId,
        message:
          "Payment is not confirmed yet. If you just paid, please check again shortly.",
      });
    }

    const payments = await sql<
      { id: string; paid: boolean }[]
    >`
      UPDATE raysnotes_trademark_applications
      SET
        stripe_session_id = ${session.id},
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
        AND paid_at IS NULL
        AND (
          stripe_session_id IS NULL
          OR stripe_session_id = ${session.id}
        )
      RETURNING
        id,
        paid_at IS NOT NULL AS paid
    `;

    if (!payments[0]) {
      const existing = await sql<
        { id: string; paid: boolean }[]
      >`
        SELECT
          id,
          paid_at IS NOT NULL AS paid
        FROM raysnotes_trademark_applications
        WHERE id = ${applicationId}
          AND account_id = ${account.id}
        LIMIT 1
      `;

      if (!existing[0]?.paid) {
        return json(
          {
            paid: false,
            error:
              "Payment was received, but the draft could not be updated. Please try verification again.",
          },
          409
        );
      }
    }

    return json({
      paid: true,
      applicationId,
      message:
        "Your trademark preparation payment is confirmed.",
    });
  } catch (error) {
    console.error(
      "Trademark payment verification failed:",
      error
    );

    return json(
      {
        paid: false,
        error:
          "Payment could not be verified. Please try again.",
      },
      500
    );
  }
} 
