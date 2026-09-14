import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getStripe } from "../../lib/stripe";

export const dynamic = "force-dynamic";

const EXPECTED_AMOUNT = 15900;
const EXPECTED_PRODUCT =
  "Ray'sNotes Full-Service Group Copyright Filing";

export async function POST(
  request: Request
): Promise<NextResponse> {
  try {
    const body =
      (await request.json()) as HandleUploadPresignedBody;

    const jsonResponse = await handleUploadPresigned({
      body,
      request,

      getSignedToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || "{}");
        const sessionId = String(payload.sessionId || "");

        if (!sessionId.startsWith("cs_")) {
          throw new Error(
            "A valid payment session is required."
          );
        }

        if (
          !pathname.startsWith(
            `group-filing/${sessionId}/`
          )
        ) {
          throw new Error("Invalid upload location.");
        }

        const stripe = getStripe();

        const session =
          await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["line_items.data.price.product"],
          });

        const correctProduct =
          session.line_items?.data.some((item) => {
            const product = item.price?.product;

            return (
              typeof product === "object" &&
              product !== null &&
              "name" in product &&
              product.name === EXPECTED_PRODUCT
            );
          });

        if (
          session.payment_status !== "paid" ||
          session.amount_total !== EXPECTED_AMOUNT ||
          session.currency?.toLowerCase() !== "usd" ||
          !correctProduct
        ) {
          throw new Error(
            "Payment could not be verified for this upload."
          );
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: [
            "audio/*",
            "application/pdf",
            "text/plain",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024,
          validUntil: Date.now() + 60 * 60 * 1000,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: [
              "audio/*",
              "application/pdf",
              "text/plain",
            ],
            maximumSizeInBytes: 500 * 1024 * 1024,
            validUntil: Date.now() + 15 * 60 * 1000,
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The secure upload could not be started.";

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
} 
