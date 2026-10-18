import {
  ensureApplicationTables,
  getDatabase,
} from "./application-store";

export {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "./application-store";

export const LLC_PREPARATION_CENTS = 2499;
export const LLC_FULL_SERVICE_CENTS = 14900;

export const LLC_UPGRADE_SERVICE_CENTS =
  LLC_FULL_SERVICE_CENTS - LLC_PREPARATION_CENTS;

// Government fees are separate from these service prices.

export const LLC_PRODUCT_CODE = "hawaii-llc-preparation";

export const LLC_PRODUCT_NAME =
  "Ray'sNotes Hawaii LLC Preparation Package";

export const LLC_PAGE_PATH = "/filing-center/hawaii-llc";

export const emptyLLCForm = {
  companyName: "",
  mailingAddress: "",
  officeAddress: "",
  agentType: "",
  agentName: "",
  agentJurisdiction: "",
  agentAddress: "",
  organizers: "",
  duration: "",
  endDate: "",
  management: "",
  memberCount: "",
  managers: "",
  members: "",
  liability: "",
  liabilityDetails: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

export type LLCForm = typeof emptyLLCForm;
export type LLCField = keyof LLCForm;

export type LLCApplicationRow = {
  id: string;
  title: string;
  form: LLCForm;
  paid: boolean;
  updatedAt: Date;
};

let initialization: Promise<void> | undefined;

export async function ensureLLCTables() {
  if (!initialization) {
    initialization = createLLCTables().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }

  await initialization;
}

async function createLLCTables() {
  await ensureApplicationTables();

  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_llc_applications (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL
        REFERENCES raysnotes_application_accounts(id)
        ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled LLC',
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      stripe_session_id TEXT UNIQUE,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS raysnotes_llc_applications_account
    ON raysnotes_llc_applications(account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_llc_upgrades (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL UNIQUE
        REFERENCES raysnotes_llc_applications(id),
      preparation_session_id TEXT NOT NULL UNIQUE,
      stripe_session_id TEXT UNIQUE,
      credit_cents INTEGER NOT NULL DEFAULT 2499
        CHECK (credit_cents = 2499),
      service_total_cents INTEGER NOT NULL DEFAULT 14900
        CHECK (service_total_cents = 14900),
      service_due_cents INTEGER NOT NULL DEFAULT 12401
        CHECK (service_due_cents = 12401),
      government_fee_cents INTEGER NOT NULL DEFAULT 0
        CHECK (government_fee_cents >= 0),
      paid_at TIMESTAMPTZ,
      filing_reference TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function normalizeLLCForm(value: unknown): LLCForm {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid LLC draft.");
  }

  const source = value as Record<string, unknown>;
  const form = { ...emptyLLCForm };

  for (const field of Object.keys(emptyLLCForm) as LLCField[]) {
    const entry = source[field];

    if (entry === undefined) {
      continue;
    }

    if (typeof entry !== "string" || entry.length > 10000) {
      throw new Error(
        "An LLC field is too long or has an invalid value."
      );
    }

    form[field] = entry;
  }

  if (form.companyName.trim().length > 300) {
    throw new Error(
      "The LLC name must be 300 characters or fewer."
    );
  }

  if (JSON.stringify(form).length > 80000) {
    throw new Error("This LLC draft is too long.");
  }

  return form;
} 
