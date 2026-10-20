import {
  ensureApplicationTables,
  getDatabase,
} from "./application-store";

export {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "./application-store";

export const TRADEMARK_PREPARATION_CENTS = 2499;

export const TRADEMARK_PRODUCT_CODE =
  "trademark-preparation";

export const TRADEMARK_PRODUCT_NAME =
  "Ray'sNotes Trademark Preparation Package";

export const TRADEMARK_PAGE_PATH =
  "/filing-center/trademark";

export const emptyTrademarkForm = {
  packageTitle: "",
  ownerName: "",
  ownerType: "",
  email: "",
  mailingAddress: "",
  markType: "",
  brandName: "",
  logoDescription: "",
  goodsServices: "",
  useStatus: "",
  firstUseDate: "",
  website: "",
  supportingNotes: "",
};

export type TrademarkForm = typeof emptyTrademarkForm;

export type TrademarkField = keyof TrademarkForm;

export type TrademarkApplicationRow = {
  id: string;
  title: string;
  form: TrademarkForm;
  paid: boolean;
  updatedAt: Date;
};

let initialization: Promise<void> | undefined;

export async function ensureTrademarkTables() {
  if (!initialization) {
    initialization = createTrademarkTables().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }

  await initialization;
}

async function createTrademarkTables() {
  await ensureApplicationTables();

  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_trademark_applications (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL
        REFERENCES raysnotes_application_accounts(id)
        ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Trademark',
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      stripe_session_id TEXT UNIQUE,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      raysnotes_trademark_applications_account
    ON raysnotes_trademark_applications(account_id)
  `;
}

export function normalizeTrademarkForm(
  value: unknown
): TrademarkForm {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid trademark draft.");
  }

  const source = value as Record<string, unknown>;
  const form = { ...emptyTrademarkForm };

  for (
    const field of Object.keys(emptyTrademarkForm) as TrademarkField[]
  ) {
    const entry = source[field];

    if (entry === undefined) {
      continue;
    }

    if (typeof entry !== "string" || entry.length > 5000) {
      throw new Error(
        "A trademark field is too long or has an invalid value."
      );
    }

    form[field] = entry;
  }

  if (form.packageTitle.trim().length > 300) {
    throw new Error(
      "The draft title must be 300 characters or fewer."
    );
  }

  if (form.brandName.trim().length > 500) {
    throw new Error(
      "The brand name must be 500 characters or fewer."
    );
  }

  if (JSON.stringify(form).length > 80000) {
    throw new Error("This trademark draft is too long.");
  }

  return form;
} 
