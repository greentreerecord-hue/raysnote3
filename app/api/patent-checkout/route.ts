import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  ensurePatentTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  PATENT_PREPARATION_CENTS,
  PATENT_PRODUCT_CODE,
  PATENT_PRODUCT_NAME,
  PATENT_PAGE_PATH,
} from "../../lib/patent-store";

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
      { error: "Please use the patent organizer page." },
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
      return json(
        { error: "Invalid checkout request." },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json(
        { error: "Invalid checkout request." },
        400
      );
    }

    const { applicationId } =
      body as Record<string, unknown>;

    if (
      typeof applicationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        applicationId
      )
    ) {
      return json(
        { error: "A valid patent draft is required." },
        400
      );
    }

    await ensurePatentTables();

    const sql = getDatabase();

    const rows = await sql<
      { id: string; title: string; paid: boolean }[]
    >`
      SELECT
        id,
        title,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_patent_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return json(
        { error: "Patent draft was not found." },
        404
      );
    }

    if (application.paid) {
      return json(
        {
          error:
            "Preparation for this patent draft is already paid.",
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
          product_code: PATENT_PRODUCT_CODE,
          application_id: application.id,
          account_id: account.id,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: PATENT_PREPARATION_CENTS,
              product_data: {
                name: PATENT_PRODUCT_NAME,
                description:
                  "Preparation summary and checklist for one invention using information you provide. Does not include patent searches, patentability opinions, patent application or claim drafting, government filing, government fees, or legal representation. Does not establish a filing date or create patent protection.",
              },
            },
          },
        ],
        success_url:
          `${origin}${PATENT_PAGE_PATH}` +
          `?application_id=${encodedId}` +
          "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url:
          `${origin}${PATENT_PAGE_PATH}` +
          `?application_id=${encodedId}`,
      },
      {
        idempotencyKey:
          `raysnotes-patent-preparation-${application.id}` +
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
    console.error("Patent checkout failed:", error);

    return json(
      {
        error:
          "Checkout could not be started. Please try again.",
      },
      500
    );
  }
} 
