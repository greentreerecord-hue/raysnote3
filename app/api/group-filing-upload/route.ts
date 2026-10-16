import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { verifyGroupFilingPayment } from
  "../../lib/group-filing-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

        if (
          !sessionId.startsWith("cs_") ||
          sessionId.length > 300
        ) {
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

        await verifyGroupFilingPayment(request, sessionId);

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

    return NextResponse.json(jsonResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Group filing upload error:", error);

    return NextResponse.json(
      {
        error:
          "The secure upload could not be started. Verify your payment and sign in if you purchased an upgrade.",
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
} 
