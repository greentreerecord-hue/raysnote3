import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import {
  ensureLLCTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  LLC_PREPARATION_CENTS,
  LLC_FULL_SERVICE_CENTS,
  LLC_UPGRADE_SERVICE_CENTS,
  LLC_PAGE_PATH,
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

type Upgrade = {
  id: string;
  preparation_session_id: string;
  stripe_session_id: string | null;
  paid: boolean;
  credit_cents: number;
  service_total_cents: number;
  service_due_cents: number;
  government_fee_cents: number;
};

export async function POST(request: NextRequest) {
  if (process.env.LLC_UPGRADE_CHECKOUT_ENABLED !== "true") {
    return json(
      {
        error:
          "Full-service upgrade checkout is coming soon. Preparation purchases and saved drafts remain available.",
      },
      503
    );
  }

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

    if (!validId(applicationId)) {
      return json(
        { error: "A valid LLC application is required." },
        400
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return json(
        { error: "Payments are not configured." },
        500
      );
    }

    await ensureLLCTables();

    const sql = getDatabase();

    const applications = await sql<
      {
        id: string;
        stripe_session_id: string | null;
        paid: boolean;
      }[]
    >`
      SELECT
        id,
        stripe_session_id,
        paid_at IS NOT NULL AS paid
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

    if (!application.paid || !application.stripe_session_id) {
      return json(
        {
          error:
            "A verified preparation payment for this LLC is required before upgrading.",
        },
        409
      );
    }

    await sql`
      INSERT INTO raysnotes_llc_upgrades (
        id,
        application_id,
        preparation_session_id,
        credit_cents,
        service_total_cents,
        service_due_cents,
        government_fee_cents
      )
      VALUES (
        ${randomUUID()},
        ${application.id},
        ${application.stripe_session_id},
        ${LLC_PREPARATION_CENTS},
        ${LLC_FULL_SERVICE_CENTS},
        ${LLC_UPGRADE_SERVICE_CENTS},
        0
      )
      ON CONFLICT (application_id) DO NOTHING
    `;

    const upgrades = await sql<Upgrade[]>`
      SELECT
        id,
        preparation_session_id,
        stripe_session_id,
        paid_at IS NOT NULL AS paid,
        credit_cents,
        service_total_cents,
        service_due_cents,
        government_fee_cents
      FROM raysnotes_llc_upgrades
      WHERE application_id = ${application.id}
      LIMIT 1
    `;

    const upgrade = upgrades[0];

    if (!upgrade) {
      return json(
        { error: "The upgrade record could not be created." },
        500
      );
    }

    if (upgrade.paid) {
      return json(
        { error: "The upgrade for this LLC is already paid." },
        409
      );
    }

    if (
      upgrade.preparation_session_id !==
        application.stripe_session_id ||
      upgrade.credit_cents !== LLC_PREPARATION_CENTS ||
      upgrade.service_total_cents !== LLC_FULL_SERVICE_CENTS ||
      upgrade.service_due_cents !== LLC_UPGRADE_SERVICE_CENTS ||
      upgrade.government_fee_cents !== 0
    ) {
      return json(
        {
          error:
            "This upgrade requires review before checkout. Please contact Ray'sNotes.",
        },
        409
      );
    }

    const stripe = new Stripe(secretKey);
    const origin = request.nextUrl.origin;
    const encodedId = encodeURIComponent(application.id);

    const successUrl =
      `${origin}${LLC_PAGE_PATH}?application_id=${encodedId}` +
      "&upgrade_session_id={CHECKOUT_SESSION_ID}";

    if (upgrade.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        upgrade.stripe_session_id
      );

      if (
        existing.status === "complete" ||
        existing.payment_status === "paid"
      ) {
        return json({
          url:
            `${origin}${LLC_PAGE_PATH}?application_id=${encodedId}` +
            `&upgrade_session_id=${encodeURIComponent(existing.id)}`,
        });
      }

      if (existing.status === "open" && existing.url) {
        return json({ url: existing.url });
      }

      if (existing.status !== "expired") {
        return json(
          {
            error:
              "Your previous checkout needs review. Do not pay again if charged.",
          },
          409
        );
      }
    }

    // Concurrent requests reuse the same Stripe session.
    // A new session is created only after the previous one expires.
    const attempt = upgrade.stripe_session_id || "initial";

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: account.email,
        client_reference_id: application.id,
        metadata: {
          product_code: PRODUCT_CODE,
          application_id: application.id,
          account_id: account.id,
          upgrade_id: upgrade.id,
          preparation_session_id:
            application.stripe_session_id,
          credit_cents: String(LLC_PREPARATION_CENTS),
          service_total_cents: String(LLC_FULL_SERVICE_CENTS),
          service_due_cents: String(LLC_UPGRADE_SERVICE_CENTS),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: LLC_UPGRADE_SERVICE_CENTS,
              product_data: {
                name: PRODUCT_NAME,
                description:
                  "Remaining service fee for the same Hawaii LLC after a $24.99 preparation credit toward the $149 service total. Government fees and registered-agent service are excluded. Payment does not itself form an LLC or confirm a state filing.",
              },
            },
          },
        ],
        success_url: successUrl,
        cancel_url:
          `${origin}${LLC_PAGE_PATH}?application_id=${encodedId}`,
      },
      {
        idempotencyKey:
          `raysnotes-llc-upgrade-${upgrade.id}-${attempt}`,
      }
    );

    if (!session.url) {
      return json(
        { error: "Checkout could not be opened." },
        500
      );
    }

    const updated = await sql<{ id: string }[]>`
      UPDATE raysnotes_llc_upgrades
      SET
        stripe_session_id = ${session.id},
        updated_at = NOW()
      WHERE id = ${upgrade.id}
        AND paid_at IS NULL
        AND stripe_session_id IS NOT DISTINCT FROM
          ${upgrade.stripe_session_id}
      RETURNING id
    `;

    if (!updated[0]) {
      const current = await sql<
        { stripe_session_id: string | null; paid: boolean }[]
      >`
        SELECT
          stripe_session_id,
          paid_at IS NOT NULL AS paid
        FROM raysnotes_llc_upgrades
        WHERE id = ${upgrade.id}
        LIMIT 1
      `;

      if (
        current[0]?.paid ||
        current[0]?.stripe_session_id !== session.id
      ) {
        return json(
          {
            error:
              "The upgrade record changed. Reload your application before continuing.",
          },
          409
        );
      }
    }

    return json({ url: session.url });
  } catch (error) {
    console.error("LLC upgrade checkout failed:", error);

    return json(
      {
        error:
          "Upgrade checkout could not be started. If charged, do not pay again.",
      },
      500
    );
  }
} 
