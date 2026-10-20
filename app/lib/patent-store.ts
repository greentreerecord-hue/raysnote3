import {
  ensureApplicationTables,
  getDatabase,
} from "./application-store";

export {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "./application-store";

export const PATENT_PREPARATION_CENTS = 2499;

export const PATENT_PRODUCT_CODE =
  "patent-preparation";

export const PATENT_PRODUCT_NAME =
  "Ray'sNotes Patent Preparation Organizer";

export const PATENT_PAGE_PATH =
  "/filing-center/patent";

export const emptyPatentForm = {
  packageTitle: "",
  inventorNames: "",
  contactEmail: "",
  inventionTitle: "",
  inventionCategory: "",
  problem: "",
  description: "",
  components: "",
  operation: "",
  differences: "",
  variations: "",
  developmentStatus: "",
  drawingsNotes: "",
  disclosureHistory: "",
  existingApplications: "",
  professionalQuestions: "",
};

export type PatentForm = typeof emptyPatentForm;

export type PatentField = keyof PatentForm;

export type PatentApplicationRow = {
  id: string;
  title: string;
  form: PatentForm;
  paid: boolean;
  updatedAt: Date;
};

let initialization: Promise<void> | undefined;

export async function ensurePatentTables() {
  if (!initialization) {
    initialization = createPatentTables().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }

  await initialization;
}

async function createPatentTables() {
  await ensureApplicationTables();

  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS raysnotes_patent_applications (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL
        REFERENCES raysnotes_application_accounts(id)
        ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled Patent',
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      stripe_session_id TEXT UNIQUE,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS
      raysnotes_patent_applications_account
    ON raysnotes_patent_applications(account_id)
  `;
}

export function normalizePatentForm(
  value: unknown
): PatentForm {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Invalid patent draft.");
  }

  const source = value as Record<string, unknown>;
  const form = { ...emptyPatentForm };

  for (
    const field of Object.keys(emptyPatentForm) as PatentField[]
  ) {
    const entry = source[field];

    if (entry === undefined) {
      continue;
    }

    if (
      typeof entry !== "string" ||
      entry.length > 5000
    ) {
      throw new Error(
        "A patent field is too long or has an invalid value."
      );
    }

    form[field] = entry;
  }

  if (form.packageTitle.trim().length > 300) {
    throw new Error(
      "The draft title must be 300 characters or fewer."
    );
  }

  if (form.inventionTitle.trim().length > 500) {
    throw new Error(
      "The invention title must be 500 characters or fewer."
    );
  }

  if (JSON.stringify(form).length > 80000) {
    throw new Error("This patent draft is too long.");
  }

  return form;
} 
