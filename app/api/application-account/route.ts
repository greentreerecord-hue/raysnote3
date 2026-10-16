import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import {
  ACCOUNT_COOKIE,
  SESSION_SECONDS,
  allowAuthentication,
  ensureApplicationTables,
  getApplicationAccount,
  getDatabase,
  hashToken,
  isSameOrigin,
} from "../../lib/application-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function makePasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derivePassword(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function checkPassword(password: string, stored: string) {
  const [salt, encoded] = stored.split(":");

  if (
    !salt ||
    !encoded ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(encoded)
  ) {
    return false;
  }

  const supplied = await derivePassword(password, salt);
  const expected = Buffer.from(encoded, "hex");
  return timingSafeEqual(supplied, expected);
}

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);
    return json({ account });
  } catch (error) {
    console.error("Application account GET failed:", error);
    return json({ error: "Your account could not be loaded." }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Please sign in from this website." }, 403);
  }

  try {
    const body = await request.json();
    const action = body.action;
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (
      !["register", "login"].includes(action) ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      password.length > 128
    ) {
      return json(
        {
          error:
            "Enter a valid email and a password between 12 and 128 characters.",
        },
        400
      );
    }

    if (!(await allowAuthentication(email))) {
      return json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        429
      );
    }

    const sql = getDatabase();
    let account: { id: string; email: string };

    if (action === "register") {
      const passwordHash = await makePasswordHash(password);
      const accounts = await sql<{ id: string; email: string }[]>`
        INSERT INTO raysnotes_application_accounts (
          id, email, password_hash
        )
        VALUES (${randomUUID()}, ${email}, ${passwordHash})
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email
      `;

      if (!accounts[0]) {
        return json(
          { error: "An account already exists for this email. Please sign in." },
          409
        );
      }

      account = accounts[0];
    } else {
      const accounts = await sql<
        { id: string; email: string; password_hash: string }[]
      >`
        SELECT id, email, password_hash
        FROM raysnotes_application_accounts
        WHERE email = ${email}
        LIMIT 1
      `;

      const found = accounts[0];

      // Perform password work even when the email does not exist.
      const stored =
        found?.password_hash ||
        `${"0".repeat(32)}:${"0".repeat(128)}`;

      const matches = await checkPassword(password, stored);

      if (!found || !matches) {
        return json({ error: "Email or password is incorrect." }, 401);
      }

      account = { id: found.id, email: found.email };
    }

    const oldToken = request.cookies.get(ACCOUNT_COOKIE)?.value;

    if (oldToken) {
      await sql`
        DELETE FROM raysnotes_application_sessions
        WHERE token_hash = ${hashToken(oldToken)}
      `;
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);

    await sql`
      INSERT INTO raysnotes_application_sessions (
        token_hash, account_id, expires_at
      )
      VALUES (
        ${hashToken(token)}, ${account.id}, ${expiresAt}
      )
    `;

    const response = json({ account });

    response.cookies.set(ACCOUNT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Application account POST failed:", error);
    return json(
      { error: "Your account request could not be completed. Please try again." },
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Please sign out from this website." }, 403);
  }

  try {
    const token = request.cookies.get(ACCOUNT_COOKIE)?.value;

    if (token) {
      await ensureApplicationTables();
      const sql = getDatabase();

      await sql`
        DELETE FROM raysnotes_application_sessions
        WHERE token_hash = ${hashToken(token)}
      `;
    }

    const response = json({ success: true });

    response.cookies.set(ACCOUNT_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Application account DELETE failed:", error);
    return json({ error: "Sign-out failed. Please try again." }, 500);
  }
} 
