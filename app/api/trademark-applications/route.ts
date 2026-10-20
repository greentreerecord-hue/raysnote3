import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureTrademarkTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  normalizeTrademarkForm,
  type TrademarkForm,
} from "../../lib/trademark-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

type ApplicationRow = {
  id: string;
  title: string;
  form: TrademarkForm;
  paid: boolean;
  updatedAt: Date;
};

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in to view drafts." }, 401);
    }

    const applicationId =
      request.nextUrl.searchParams.get("application_id");

    if (applicationId !== null && !ID_PATTERN.test(applicationId)) {
      return json({ error: "Invalid trademark application ID." }, 400);
    }

    await ensureTrademarkTables();

    const sql = getDatabase();

    if (applicationId) {
      const rows = await sql<ApplicationRow[]>`
        SELECT
          id,
          title,
          form_data AS form,
          paid_at IS NOT NULL AS paid,
          updated_at AS "updatedAt"
        FROM raysnotes_trademark_applications
        WHERE id = ${applicationId}
          AND account_id = ${account.id}
        LIMIT 1
      `;

      if (!rows[0]) {
        return json(
          { error: "Trademark application was not found." },
          404
        );
      }

      return json({ application: rows[0] });
    }

    const applications = await sql<
      Omit<ApplicationRow, "form">[]
    >`
      SELECT
        id,
        title,
        paid_at IS NOT NULL AS paid,
        updated_at AS "updatedAt"
      FROM raysnotes_trademark_applications
      WHERE account_id = ${account.id}
      ORDER BY updated_at DESC, id DESC
      LIMIT 100
    `;

    return json({ applications });
  } catch (error) {
    console.error("Trademark drafts could not be loaded:", error);

    return json(
      { error: "Drafts could not be loaded. Please try again." },
      500
    );
  }
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
      return json({ error: "Please sign in before saving." }, 401);
    }

    let body: unknown;

    try {
      const raw = await request.text();

      if (new TextEncoder().encode(raw).length > 350000) {
        return json({ error: "This draft is too large." }, 413);
      }

      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid draft request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid draft request." }, 400);
    }

    const source = body as Record<string, unknown>;
    const applicationId = source.applicationId;

    if (
      applicationId !== undefined &&
      applicationId !== null &&
      (typeof applicationId !== "string" ||
        !ID_PATTERN.test(applicationId))
    ) {
      return json({ error: "Invalid trademark application ID." }, 400);
    }

    let form: TrademarkForm;

    try {
      form = normalizeTrademarkForm(source.form);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid trademark draft.",
        },
        400
      );
    }

    const title =
      form.packageTitle.trim() ||
      form.brandName.trim().slice(0, 300) ||
      "Untitled Trademark";

    await ensureTrademarkTables();

    const sql = getDatabase();
    const formData = JSON.stringify(form);

    if (typeof applicationId === "string") {
      const rows = await sql<ApplicationRow[]>`
        UPDATE raysnotes_trademark_applications
        SET
          title = ${title},
          form_data = ${formData}::jsonb,
          updated_at = NOW()
        WHERE id = ${applicationId}
          AND account_id = ${account.id}
        RETURNING
          id,
          title,
          form_data AS form,
          paid_at IS NOT NULL AS paid,
          updated_at AS "updatedAt"
      `;

      if (!rows[0]) {
        return json(
          { error: "Trademark application was not found." },
          404
        );
      }

      return json({ application: rows[0] });
    }

    const id = randomUUID();

    const rows = await sql<ApplicationRow[]>`
      INSERT INTO raysnotes_trademark_applications (
        id,
        account_id,
        title,
        form_data
      )
      VALUES (
        ${id},
        ${account.id},
        ${title},
        ${formData}::jsonb
      )
      RETURNING
        id,
        title,
        form_data AS form,
        paid_at IS NOT NULL AS paid,
        updated_at AS "updatedAt"
    `;

    return json({ application: rows[0] }, 201);
  } catch (error) {
    console.error("Trademark draft could not be saved:", error);

    return json(
      { error: "Your draft could not be saved. Please try again." },
      500
    );
  }
} 
