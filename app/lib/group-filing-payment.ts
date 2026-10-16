import { NextRequest } from "next/server";
import { getStripe } from "./stripe";
import {
  ensureApplicationUpgradeTable,
  getApplicationAccount,
  getDatabase,
} from "./application-store";

export const GROUP_FILING_PRODUCT =
  "Ray'sNotes Full-Service Group Copyright Filing";

export const UPGRADE_PRODUCT_CODE =
  "assisted-copyright-group-upgrade";

export const PREPARATION_PRODUCT_CODE =
  "assisted-copyright-application";

export const FULL_PRICE_CENTS = 15900;
export const PREPARATION_CREDIT_CENTS = 2499;
export const UPGRADE_PRICE_CENTS =
  FULL_PRICE_CENTS - PREPARATION_CREDIT_CENTS;

type UpgradeRow = {
  id: string;
  application_id: string;
  preparation_session_id: string;
  stripe_session_id: string | null;
  credit_cents: number;
  amount_due_cents: number;
  account_id: string;
  application_session_id: string | null;
  application_paid_at: Date | null;
};

export async function verifyGroupFilingPayment(
  request: Request,
  sessionId: string
) {
  if (
    !sessionId.startsWith("cs_") ||
    sessionId.length > 300
  ) {
    throw new Error("A valid payment session is required.");
  }

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    {
      expand: ["line_items"],
    }
  );

  const lineItems = session.line_items?.data ?? [];

  const correctProduct =
    session.line_items?.has_more === false &&
    lineItems.length === 1 &&
    lineItems[0].quantity === 1 &&
    lineItems[0].description === GROUP_FILING_PRODUCT;

  if (
    session.mode !== "payment" ||
    session.status !== "complete" ||
    session.payment_status !== "paid" ||
    session.currency !== "usd" ||
    !correctProduct
  ) {
    throw new Error(
      "Payment could not be verified for group filing."
    );
  }

  const isUpgrade =
    session.metadata?.product_code === UPGRADE_PRODUCT_CODE;

  if (!isUpgrade) {
    if (session.amount_total !== FULL_PRICE_CENTS) {
      throw new Error(
        "The full-service payment amount is incorrect."
      );
    }

    return {
      session,
      upgradeId: null as string | null,
      applicationId: null as string | null,
    };
  }

  if (session.amount_total !== UPGRADE_PRICE_CENTS) {
    throw new Error("The upgrade payment amount is incorrect.");
  }

  // Read only the headers: this also works after a route
  // has already read its request body.
  const accountRequest = new NextRequest(request.url, {
    headers: request.headers,
  });

  const account = await getApplicationAccount(accountRequest);

  if (!account) {
    throw new Error(
      "Sign in to the account that purchased this upgrade."
    );
  }

  await ensureApplicationUpgradeTable();
  const sql = getDatabase();

  const upgrades = await sql<UpgradeRow[]>`
    SELECT
      upgrades.id,
      upgrades.application_id,
      upgrades.preparation_session_id,
      upgrades.stripe_session_id,
      upgrades.credit_cents,
      upgrades.amount_due_cents,
      applications.account_id,
      applications.stripe_session_id
        AS application_session_id,
      applications.paid_at AS application_paid_at
    FROM raysnotes_application_upgrades AS upgrades
    JOIN raysnotes_applications AS applications
      ON applications.id = upgrades.application_id
    WHERE upgrades.id = ${session.metadata?.upgrade_id || ""}
      AND applications.account_id = ${account.id}
    LIMIT 1
  `;

  const upgrade = upgrades[0];

  if (
    !upgrade ||
    !upgrade.application_paid_at ||
    upgrade.stripe_session_id !== session.id ||
    upgrade.application_session_id !==
      upgrade.preparation_session_id ||
    upgrade.credit_cents !== PREPARATION_CREDIT_CENTS ||
    upgrade.amount_due_cents !== UPGRADE_PRICE_CENTS ||
    session.client_reference_id !== upgrade.application_id ||
    session.metadata?.application_id !==
      upgrade.application_id ||
    session.metadata?.account_id !== account.id ||
    session.metadata?.preparation_session_id !==
      upgrade.preparation_session_id
  ) {
    throw new Error(
      "This upgrade does not match your preparation credit."
    );
  }

  const preparation =
    await stripe.checkout.sessions.retrieve(
      upgrade.preparation_session_id
    );

  if (
    preparation.mode !== "payment" ||
    preparation.status !== "complete" ||
    preparation.payment_status !== "paid" ||
    preparation.amount_total !== PREPARATION_CREDIT_CENTS ||
    preparation.currency !== "usd" ||
    preparation.client_reference_id !==
      upgrade.application_id ||
    preparation.metadata?.product_code !==
      PREPARATION_PRODUCT_CODE ||
    preparation.metadata?.application_id !==
      upgrade.application_id ||
    preparation.metadata?.account_id !== account.id
  ) {
    throw new Error(
      "The original preparation payment could not be verified."
    );
  }

  await sql`
    UPDATE raysnotes_application_upgrades
    SET
      paid_at = COALESCE(paid_at, NOW()),
      updated_at = NOW()
    WHERE id = ${upgrade.id}
      AND stripe_session_id = ${session.id}
  `;

  return {
    session,
    upgradeId: upgrade.id,
    applicationId: upgrade.application_id,
  };
} 
