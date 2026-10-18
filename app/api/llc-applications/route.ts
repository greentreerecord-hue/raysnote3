import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  ensureLLCTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  normalizeLLCForm,
  type LLCApplicationRow,
} from "../../lib/llc-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json(
        { error: "Please sign in to your applications." },
        401
      );
    }

    await ensureLLCTables();

    const sql = getDatabase();
    const id = request.nextUrl.searchParams.get("application_id");

    if (id !== null) {
      if (!validId(id)) {
        return json({ error: "A valid LLC application is required." }, 400);
      }

      const rows = await sql<LLCApplicationRow[]>`
        SELECT
          id,
          title,
          form_data AS form,
          paid_at IS NOT NULL AS paid,
          updated_at AS "updatedAt"
        FROM raysnotes_llc_applications
        WHERE id = ${id}
          AND account_id = ${account.id}
        LIMIT 1
      `;

      if (!rows[0]) {
        return json(
          { error: "LLC application was not found." },
          404
        );
      }

      return json({
        application: {
          ...rows[0],
          form: normalizeLLCForm(rows[0].form),
        },
      });
    }

    const applications = await sql`
      SELECT
        id,
        title,
        paid_at IS NOT NULL AS paid,
        updated_at AS "updatedAt"
      FROM raysnotes_llc_applications
      WHERE account_id = ${account.id}
      ORDER BY updated_at DESC, id
    `;

    return json({ applications });
  } catch (error) {
    console.error("LLC applications GET failed:", error);

    return json(
      { error: "LLC applications could not be loaded." },
      500
    );
  }
}

export async function POST(request: NextRequest) {
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
        { error: "Please sign in to your applications." },
        401
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid application request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid application request." }, 400);
    }

    const value = body as Record<string, unknown>;

    if (
      typeof value.title !== "string" ||
      value.title.trim().length > 300
    ) {
      return json(
        { error: "Enter an LLC name of up to 300 characters." },
        400
      );
    }

    const title = value.title.trim() || "Untitled LLC";
    const form = normalizeLLCForm({
      companyName: value.title.trim(),
    });

    await ensureLLCTables();

    const sql = getDatabase();

    const rows = await sql<LLCApplicationRow[]>`
      INSERT INTO raysnotes_llc_applications (
        id,
        account_id,
        title,
        form_data
      )
      VALUES (
        ${randomUUID()},
        ${account.id},
        ${title},
        ${sql.json(form)}
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
    console.error("LLC applications POST failed:", error);

    return json(
      { error: "LLC application could not be created." },
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
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
        { error: "Please sign in to your applications." },
        401
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid LLC draft." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json({ error: "Invalid LLC draft." }, 400);
    }

    const value = body as Record<string, unknown>;

    if (!validId(value.applicationId)) {
      return json(
        { error: "A valid LLC application is required." },
        400
      );
    }

    let form;

    try {
      form = normalizeLLCForm(value.form);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid LLC draft.",
        },
        400
      );
    }

    const title = form.companyName.trim() || "Untitled LLC";

    await ensureLLCTables();

    const sql = getDatabase();

    const rows = await sql<LLCApplicationRow[]>`
      UPDATE raysnotes_llc_applications
      SET
        title = ${title},
        form_data = ${sql.json(form)},
        updated_at = NOW()
      WHERE id = ${value.applicationId}
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
        { error: "LLC application was not found." },
        404
      );
    }

    return json({ application: rows[0] });
  } catch (error) {
    console.error("LLC applications PATCH failed:", error);

    return json(
      { error: "Your LLC draft could not be saved." },
      500
    );
  }
} 
