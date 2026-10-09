import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_CENTS = 999;
const PRODUCT_CODE = "hawaii-bankruptcy-organizer";
const COOKIE_NAME = "raysnotes-organizer-browser";
const PAGE_PATH = "/filing-center/bankruptcy";

function getSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("Stripe is not configured.");
  }

  return key;
}

function getStripe() {
  return new Stripe(getSecretKey());
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function validSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    /^cs_[A-Za-z0-9_]+$/.test(value)
  );
}

function paymentIsValid(session: Stripe.Checkout.Session) {
  return (
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.mode === "payment" &&
    session.amount_total === PRICE_CENTS &&
    session.currency === "usd" &&
    session.metadata?.product === PRODUCT_CODE
  );
}

function recoverySignature(sessionId: string) {
  // A separate persistent key can be configured later.
  // With the fallback, rotating the Stripe key invalidates old codes.
  const key =
    process.env.ORGANIZER_RECOVERY_SECRET || getSecretKey();

  return createHmac("sha256", key)
    .update(`${PRODUCT_CODE}:recovery:v1:${sessionId}`)
    .digest("hex");
}

function createRecoveryCode(sessionId: string) {
  return `RN1.${sessionId}.${recoverySignature(sessionId)}`;
}

function readRecoveryCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 400) {
    return null;
  }

  const parts = value.trim().split(".");

  if (parts.length !== 3) return null;

  const [version, sessionId, signature] = parts;

  if (
    version !== "RN1" ||
    !validSessionId(sessionId) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  const supplied = Buffer.from(signature, "hex");
  const expected = Buffer.from(
    recoverySignature(sessionId),
    "hex"
  );

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  return sessionId;
}

function setBrowserCookie(
  response: NextResponse,
  browserId: string
) {
  response.cookies.set(COOKIE_NAME, browserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function validOrigin(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const allowedOrigins = [
    "https://raysnotes.com",
    "https://www.raysnotes.com",
  ];

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000");
  }

  return (
    allowedOrigins.includes(origin) &&
    request.headers.get("origin") === origin
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!validOrigin(request)) {
      return json({ error: "Invalid request origin." }, 403);
    }

    const rawBody = await request.text();

    if (rawBody.length > 2000) {
      return json({ error: "Request is too long." }, 413);
    }

    let body: {
      action?: unknown;
      recoveryCode?: unknown;
    } = {};

    if (rawBody.trim()) {
      let parsed: unknown;

      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return json({ error: "Invalid request." }, 400);
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return json({ error: "Invalid request." }, 400);
      }

      body = parsed as typeof body;
    }

    const stripe = getStripe();

    if (body.action === "recover") {
      const sessionId = readRecoveryCode(body.recoveryCode);

      if (!sessionId) {
        return json(
          {
            paid: false,
            error:
              "Invalid recovery code. Paste the complete private code.",
          },
          400
        );
      }

      const session =
        await stripe.checkout.sessions.retrieve(sessionId);

      if (
        !paymentIsValid(session) ||
        !session.client_reference_id
      ) {
        return json(
          {
            paid: false,
            error: "This code could not unlock the organizer.",
          },
          403
        );
      }

      const response = json({
        paid: true,
        sessionId,
        recoveryCode: createRecoveryCode(sessionId),
      });

      setBrowserCookie(
        response,
        session.client_reference_id
      );

      return response;
    }

    if (
      body.action !== undefined &&
      body.action !== "checkout"
    ) {
      return json({ error: "Invalid request action." }, 400);
    }

    const origin = request.nextUrl.origin;
    const browserId =
      request.cookies.get(COOKIE_NAME)?.value || randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: browserId,
      metadata: {
        product: PRODUCT_CODE,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PRICE_CENTS,
            product_data: {
              name: "Ray'sNotes Hawaii Bankruptcy Organizer",
              description:
                "Personal information organizer and checklist. " +
                "Does not include official court forms, filing, " +
                "legal advice, or attorney representation.",
            },
          },
        },
      ],
      success_url:
        `${origin}${PAGE_PATH}` +
        "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `${origin}${PAGE_PATH}?cancelled=1`,
    });

    if (!session.url) {
      return json(
        { error: "Checkout could not be opened." },
        500
      );
    }

    const response = json({ url: session.url });
    setBrowserCookie(response, browserId);

    return response;
  } catch {
    return json(
      {
        error:
          "Unable to complete this request. Please try again.",
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId =
      request.nextUrl.searchParams.get("session_id");
    const browserId =
      request.cookies.get(COOKIE_NAME)?.value;

    if (!validSessionId(sessionId) || !browserId) {
      return json(
        {
          paid: false,
          error:
            "Use your private recovery code or return with the browser used to pay.",
        },
        400
      );
    }

    const stripe = getStripe();
    const session =
      await stripe.checkout.sessions.retrieve(sessionId);

    if (
      !paymentIsValid(session) ||
      session.client_reference_id !== browserId
    ) {
      return json(
        {
          paid: false,
          error:
            "Payment has not been verified for this organizer.",
        },
        403
      );
    }

    return json({
      paid: true,
      recoveryCode: createRecoveryCode(sessionId),
    });
  } catch {
    return json(
      {
        paid: false,
        error:
          "Unable to verify payment. Please try again.",
      },
      500
    );
  }
} 
