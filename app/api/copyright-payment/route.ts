import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { paid: false, error: "A valid payment session is required." },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { paid: false, error: "Stripe is not configured." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    const purchasedCreationRecord =
      session.line_items?.data.some(
        (item) =>
          item.description === "Ray'sNotes Creation Record" &&
          item.amount_total === 999 &&
          item.currency.toLowerCase() === "usd"
      ) ?? false;

    if (session.payment_status !== "paid" || !purchasedCreationRecord) {
      return NextResponse.json(
        { paid: false, error: "Payment was not verified." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      paid: true,
      customerEmail: session.customer_details?.email ?? "",
    });
  } catch {
    return NextResponse.json(
      { paid: false, error: "Payment could not be verified." },
      { status: 500 }
    );
  }
} 
