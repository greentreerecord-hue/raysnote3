import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "../../lib/application-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  title: string;
  paid: boolean;
  form: Record<string, string>;
  updatedAt: Date;
};

const fields = [
  "workType",
  "title",
  "authorName",
  "pseudonym",
  "claimantName",
  "citizenship",
  "creationYear",
  "workForHire",
  "published",
  "publicationDate",
  "publicationCountry",
  "previousRegistration",
  "previousNumber",
  "preexistingMaterial",
  "newMaterial",
  "email",
  "phone",
  "address",
];

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in to your applications." }, 401);
    }

    const sql = getDatabase();
    const id = request.nextUrl.searchParams.get("application_id");

    if (id) {
      const rows = await sql<ApplicationRow[]>`
        SELECT
          id,
          title,
          paid_at IS NOT NULL AS paid,
          form_data AS form,
          updated_at AS "updatedAt"
        FROM raysnotes_applications
        WHERE id = ${id}
          AND account_id = ${account.id}
        LIMIT 1
      `;

      if (!rows[0]) {
        return json({ error: "Application was not found." }, 404);
      }

      return json({ application: rows[0] });
    }

    const applications = await sql`
      SELECT
        id,
        title,
        paid_at IS NOT NULL AS paid,
        updated_at AS "updatedAt"
      FROM raysnotes_applications
      WHERE account_id = ${account.id}
      ORDER BY updated_at DESC, id
    `;

    return json({ applications });
  } catch (error) {
    console.error("My applications GET failed:", error);
    return json({ error: "Applications could not be loaded." }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Please use the applications page." }, 403);
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in to your applications." }, 401);
    }

    const body = await request.json();

    if (
      typeof body.title !== "string" ||
      body.title.trim().length > 300
    ) {
      return json({ error: "Enter a title of up to 300 characters." }, 400);
    }

    const title = body.title.trim() || "Untitled application";
    const sql = getDatabase();

    const rows = await sql<ApplicationRow[]>`
      INSERT INTO raysnotes_applications (
        id,
        account_id,
        title
      )
      VALUES (
        ${randomUUID()},
        ${account.id},
        ${title}
      )
      RETURNING
        id,
        title,
        paid_at IS NOT NULL AS paid,
        form_data AS form,
        updated_at AS "updatedAt"
    `;

    return json({ application: rows[0] }, 201);
  } catch (error) {
    console.error("My applications POST failed:", error);
    return json({ error: "Application could not be created." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Please use the applications page." }, 403);
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json({ error: "Please sign in to your applications." }, 401);
    }

    const body = await request.json();

    if (
      typeof body.applicationId !== "string" ||
      !body.applicationId ||
      body.applicationId.length > 100 ||
      !body.form ||
      typeof body.form !== "object" ||
      Array.isArray(body.form)
    ) {
      return json({ error: "Invalid application draft." }, 400);
    }

    const form: Record<string, string> = {};

    for (const field of fields) {
      const value = body.form[field];

      if (value === undefined) {
        continue;
      }

      if (typeof value !== "string" || value.length > 5000) {
        return json({ error: "An application field is too long or invalid." }, 400);
      }

      form[field] = value;
    }

    if (JSON.stringify(form).length > 40000) {
      return json({ error: "This application draft is too long." }, 400);
    }

    const title = (form.title || "").trim();

    if (title.length > 300) {
      return json({ error: "The title must be 300 characters or fewer." }, 400);
    }

    const sql = getDatabase();

    const rows = await sql<ApplicationRow[]>`
      UPDATE raysnotes_applications
      SET
        title = ${title || "Untitled application"},
        form_data = ${sql.json(form)},
        updated_at = NOW()
      WHERE id = ${body.applicationId}
        AND account_id = ${account.id}
      RETURNING
        id,
        title,
        paid_at IS NOT NULL AS paid,
        form_data AS form,
        updated_at AS "updatedAt"
    `;

    if (!rows[0]) {
      return json({ error: "Application was not found." }, 404);
    }

    return json({ application: rows[0] });
  } catch (error) {
    console.error("My applications PATCH failed:", error);
    return json({ error: "Your draft could not be saved." }, 500);
  }
} 
