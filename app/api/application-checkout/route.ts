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
      return json({ error: "Please sign in before purchasing." }, 401);
    }

    const body = await request.json();

    if (
      typeof body.applicationId !== "string" ||
      !body.applicationId ||
      body.applicationId.length > 100
    ) {
      return json({ error: "A valid application is required." }, 400);
    }

    const sql = getDatabase();

    const rows = await sql<
      { id: string; title: string; paid: boolean }[]
    >`
      SELECT id, title, paid_at IS NOT NULL AS paid
      FROM raysnotes_applications
      WHERE id = ${body.applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return json({ error: "Application was not found." }, 404);
    }

    if (application.paid) {
      return json({ error: "This application is already paid." }, 409);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json({ error: "Payments are not configured." }, 500);
    }

    const stripe = new Stripe(secretKey);
    const origin = request.nextUrl.origin;
    const applicationId = encodeURIComponent(application.id);

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: account.email,
        client_reference_id: application.id,
        metadata: {
          product_code: "assisted-copyright-application",
          application_id: application.id,
          account_id: account.id,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 2499,
              product_data: {
                name: "Ray'sNotes Assisted Copyright Application",
                description:
                  "Preparation of one downloadable application summary. Does not include filing, legal advice, government fees, or guaranteed registration.",
              },
            },
          },
        ],
        success_url:
          `${origin}/copyright/apply?application_id=${applicationId}` +
          "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          `${origin}/copyright/apply?application_id=${applicationId}`,
      },
      {
        idempotencyKey: `raysnotes-application-${application.id}`,
      }
    );

    if (!session.url) {
      return json({ error: "Checkout could not be opened." }, 500);
    }

    return json({ url: session.url });
  } catch (error) {
    console.error("Application checkout failed:", error);

    return json(
      { error: "Checkout could not be started. Please try again." },
      500
    );
  }
} 
