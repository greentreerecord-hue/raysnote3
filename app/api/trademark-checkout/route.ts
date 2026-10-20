import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensureTrademarkTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  TRADEMARK_PREPARATION_CENTS,
  TRADEMARK_PRODUCT_CODE,
  TRADEMARK_PRODUCT_NAME,
  TRADEMARK_PAGE_PATH,
} from "../../lib/trademark-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json(
      { error: "Please use the trademark preparation page." },
      403
    );
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json(
        { error: "Please sign in before purchasing." },
        401
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid checkout request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid checkout request." }, 400);
    }

    const { applicationId } = body as Record<string, unknown>;

    if (
      typeof applicationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        applicationId
      )
    ) {
      return json(
        { error: "A valid trademark application is required." },
        400
      );
    }

    await ensureTrademarkTables();

    const sql = getDatabase();

    const rows = await sql<
      { id: string; title: string; paid: boolean }[]
    >`
      SELECT
        id,
        title,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_trademark_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return json(
        { error: "Trademark application was not found." },
        404
      );
    }

    if (application.paid) {
      return json(
        {
          error:
            "Preparation for this trademark is already paid.",
        },
        409
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json(
        { error: "Payments are not configured." },
        500
      );
    }

    const stripe = new Stripe(secretKey);
    const origin = request.nextUrl.origin;
    const encodedId = encodeURIComponent(application.id);

    const checkoutWindow = Math.floor(
      Date.now() / (30 * 60 * 1000)
    );

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: account.email,
        client_reference_id: application.id,
        metadata: {
          product_code: TRADEMARK_PRODUCT_CODE,
          application_id: application.id,
          account_id: account.id,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: TRADEMARK_PREPARATION_CENTS,
              product_data: {
                name: TRADEMARK_PRODUCT_NAME,
                description:
                  "Preparation summary for one proposed trademark using information you provide. Does not include trademark searches, legal opinions, government filing, government fees, or legal representation. Does not register a trademark or guarantee approval.",
              },
            },
          },
        ],
        success_url:
          `${origin}${TRADEMARK_PAGE_PATH}` +
          `?application_id=${encodedId}` +
          "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          `${origin}${TRADEMARK_PAGE_PATH}` +
          `?application_id=${encodedId}`,
      },
      {
        idempotencyKey:
          `raysnotes-trademark-preparation-${application.id}` +
          `-${checkoutWindow}`,
      }
    );

    if (!session.url) {
      return json(
        { error: "Checkout could not be opened." },
        500
      );
    }

    return json({ url: session.url });
  } catch (error) {
    console.error("Trademark checkout failed:", error);

    return json(
      {
        error:
          "Checkout could not be started. Please try again.",
      },
      500
    );
  }
} 
