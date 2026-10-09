import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_CENTS = 999;
const PRODUCT_CODE = "hawaii-bankruptcy-organizer";
const COOKIE_NAME = "raysnotes-organizer-browser";
const PAGE_PATH = "/filing-center/bankruptcy";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Stripe is not configured.");
  }

  return new Stripe(key);
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const allowedOrigins = [
      "https://raysnotes.com",
      "https://www.raysnotes.com",
    ];

    if (process.env.NODE_ENV !== "production") {
      allowedOrigins.push("http://localhost:3000");
    }

    if (
      !allowedOrigins.includes(origin) ||
      request.headers.get("origin") !== origin
    ) {
      return json({ error: "Invalid request origin." }, 403);
    }

    const browserId =
      request.cookies.get(COOKIE_NAME)?.value || randomUUID();

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: browserId,
      metadata: {
        product: PRODUCT_CODE,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PRICE_CENTS,
            product_data: {
              name: "Ray'sNotes Hawaii Bankruptcy Organizer",
              description:
                "Personal information organizer and checklist. " +
                "Does not include official court forms, filing, " +
                "legal advice, or attorney representation.",
            },
          },
        },
      ],
      success_url:
        `${origin}${PAGE_PATH}` +
        "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `${origin}${PAGE_PATH}?cancelled=1`,
    });

    if (!session.url) {
      return json({ error: "Checkout could not be opened." }, 500);
    }

    const response = json({ url: session.url });

    response.cookies.set(COOKIE_NAME, browserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown checkout error";

    console.error(
      "Organizer checkout failed:",
      message.replace(
        /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_]+/g,
        "[REDACTED]"
      )
    );

    return json(
      { error: "Unable to start checkout. Please try again." },
      500
    );
  } 

}

export async function GET(request: NextRequest) {
  try {
    const sessionId =
      request.nextUrl.searchParams.get("session_id");
    const browserId = request.cookies.get(COOKIE_NAME)?.value;

    if (
      !sessionId ||
      !/^cs_[A-Za-z0-9_]+$/.test(sessionId) ||
      sessionId.length > 255 ||
      !browserId
    ) {
      return json(
        {
          paid: false,
          error: "A payment from this browser is required.",
        },
        400
      );
    }

    const stripe = getStripe();
    const session =
      await stripe.checkout.sessions.retrieve(sessionId);

    const paid =
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.mode === "payment" &&
      session.amount_total === PRICE_CENTS &&
      session.currency === "usd" &&
      session.metadata?.product === PRODUCT_CODE &&
      session.client_reference_id === browserId;

    if (!paid) {
      return json(
        {
          paid: false,
          error: "Payment has not been verified for this organizer.",
        },
        403
      );
    }

    return json({ paid: true });
  } catch {
    return json(
      {
        paid: false,
        error: "Unable to verify payment. Please try again.",
      },
      500
    );
  }
} 
