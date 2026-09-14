import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const EXPECTED_AMOUNT = 2499;
const EXPECTED_PRODUCT =
  "Ray'sNotes Assisted Copyright Application";

export async function GET(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        {
          paid: false,
          error:
            "Stripe payment verification is not configured.",
        },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (
      !sessionId ||
      !sessionId.startsWith("cs_")
    ) {
      return NextResponse.json(
        {
          paid: false,
          error:
            "A valid payment session is required.",
        },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secretKey);

    const session =
      await stripe.checkout.sessions.retrieve(
        sessionId,
        {
          expand: ["line_items"],
        }
      );

    const correctProduct =
      session.line_items?.data.some(
        (item) =>
          item.description === EXPECTED_PRODUCT
      ) ?? false;

    const correctAmount =
      session.amount_total === EXPECTED_AMOUNT &&
      session.currency === "usd";

    const paymentCompleted =
      session.payment_status === "paid";

    if (
      !paymentCompleted ||
      !correctAmount ||
      !correctProduct
    ) {
      return NextResponse.json(
        {
          paid: false,
          error:
            "This payment does not unlock the assisted copyright application.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      paid: true,
    });
  } catch (error) {
    console.error(
      "Assisted copyright payment verification failed:",
      error
    );

    return NextResponse.json(
      {
        paid: false,
        error:
          "The payment could not be verified.",
      },
      { status: 500 }
    );
  }
} 
