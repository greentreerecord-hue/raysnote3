import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStripe } from "../../lib/stripe";
import {
  ensureApplicationUpgradeTable,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "../../lib/application-store";
import {
  GROUP_FILING_PRODUCT,
  PREPARATION_PRODUCT_CODE,
  PREPARATION_CREDIT_CENTS,
  UPGRADE_PRODUCT_CODE,
  UPGRADE_PRICE_CENTS,
} from "../../lib/group-filing-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  title: string;
  stripe_session_id: string | null;
  paid_at: Date | null;
  form_data: Record<string, string>;
};

type UpgradeRow = {
  id: string;
  preparation_session_id: string;
  stripe_session_id: string | null;
  group_filing_reference: string | null;
};

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Invalid request origin." }, 403);
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in first." }, 401);
    }

    const body = await request.json();
    const applicationId = body.applicationId;

    if (
      typeof applicationId !== "string" ||
      !applicationId ||
      applicationId.length > 100
    ) {
      return json(
        { error: "A valid application is required." },
        400
      );
    }

    await ensureApplicationUpgradeTable();
    const sql = getDatabase();

    const applications = await sql<ApplicationRow[]>`
      SELECT
        id,
        title,
        stripe_session_id,
        paid_at,
        form_data
      FROM raysnotes_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = applications[0];

    if (!application) {
      return json({ error: "Application not found." }, 404);
    }

    const preparationSessionId =
      application.stripe_session_id;

    if (!application.paid_at || !preparationSessionId) {
      return json(
        {
          error:
            "A verified $24.99 preparation payment is required.",
        },
        403
      );
    }

    if (application.form_data.published !== "No") {
      return json(
        {
          error:
            "This upgrade is for unpublished works. Save your publication answer before continuing.",
        },
        400
      );
    }

    const stripe = getStripe();

    const preparation =
      await stripe.checkout.sessions.retrieve(
        preparationSessionId
      );

    if (
      preparation.mode !== "payment" ||
      preparation.status !== "complete" ||
      preparation.payment_status !== "paid" ||
      preparation.amount_total !==
        PREPARATION_CREDIT_CENTS ||
      preparation.currency !== "usd" ||
      preparation.client_reference_id !== application.id ||
      preparation.metadata?.product_code !==
        PREPARATION_PRODUCT_CODE ||
      preparation.metadata?.application_id !== application.id ||
      preparation.metadata?.account_id !== account.id
    ) {
      return json(
        {
          error:
            "The preparation payment could not be verified.",
        },
        403
      );
    }

    await sql`
      INSERT INTO raysnotes_application_upgrades (
        id,
        application_id,
        preparation_session_id,
        credit_cents,
        amount_due_cents
      )
      VALUES (
        ${randomUUID()},
        ${application.id},
        ${preparationSessionId},
        ${PREPARATION_CREDIT_CENTS},
        ${UPGRADE_PRICE_CENTS}
      )
      ON CONFLICT (application_id) DO NOTHING
    `;

    const origin = request.nextUrl.origin;

    const result = await sql.begin(async (transaction) => {
      const upgrades = await transaction<UpgradeRow[]>`
        SELECT
          id,
          preparation_session_id,
          stripe_session_id,
          group_filing_reference
        FROM raysnotes_application_upgrades
        WHERE application_id = ${application.id}
        FOR UPDATE
      `;

      const upgrade = upgrades[0];

      if (
        !upgrade ||
        upgrade.preparation_session_id !==
          preparationSessionId
      ) {
        throw new Error("Preparation credit does not match.");
      }

      const filingUrl = (sessionId: string) => {
        const url = new URL(
          "/copyright/group-filing",
          origin
        );

        url.searchParams.set(
          "application_id",
          application.id
        );
        url.searchParams.set("session_id", sessionId);

        return url.toString();
      };

      if (upgrade.stripe_session_id) {
        const existing =
          await stripe.checkout.sessions.retrieve(
            upgrade.stripe_session_id
          );

        if (existing.status === "complete") {
          return {
            url: filingUrl(existing.id),
          };
        }

        if (upgrade.group_filing_reference) {
          throw new Error(
            "This credit has already been used for a filing."
          );
        }

        if (existing.status === "open" && existing.url) {
          return { url: existing.url };
        }

        if (existing.status !== "expired") {
          throw new Error(
            "The previous checkout is still being processed."
          );
        }
      }

      const successUrl = new URL(
        "/copyright/group-filing",
        origin
      );

      successUrl.searchParams.set(
        "application_id",
        application.id
      );

      const cancelUrl = new URL(
        "/copyright/apply",
        origin
      );

      cancelUrl.searchParams.set(
        "application_id",
        application.id
      );

      const checkout =
        await stripe.checkout.sessions.create(
          {
            mode: "payment",
            customer_email: account.email,
            client_reference_id: application.id,
            metadata: {
              product_code: UPGRADE_PRODUCT_CODE,
              upgrade_id: upgrade.id,
              application_id: application.id,
              account_id: account.id,
              preparation_session_id:
                preparationSessionId,
            },
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: UPGRADE_PRICE_CENTS,
                  product_data: {
                    name: GROUP_FILING_PRODUCT,
                    description:
                      "$159 package less $24.99 preparation credit. For the same work, subject to eligibility review.",
                  },
                },
              },
            ],
            success_url:
              `${successUrl.toString()}` +
              "&session_id={CHECKOUT_SESSION_ID}",
            cancel_url: cancelUrl.toString(),
          },
          {
            idempotencyKey:
              `rn-upgrade-${upgrade.id}-` +
              (upgrade.stripe_session_id || "initial"),
          }
        );

      if (!checkout.url) {
        throw new Error("Checkout could not be opened.");
      }

      await transaction`
        UPDATE raysnotes_application_upgrades
        SET
          stripe_session_id = ${checkout.id},
          updated_at = NOW()
        WHERE id = ${upgrade.id}
      `;

      return { url: checkout.url };
    });

    return json(result);
  } catch (error) {
    console.error("Application upgrade checkout error:", error);

    return json(
      {
        error:
          "The upgrade checkout could not be opened. Please try again.",
      },
      500
    );
  }
} 
