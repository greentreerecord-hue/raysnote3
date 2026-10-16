import { NextResponse } from "next/server";
import { verifyGroupFilingPayment } from
  "../../lib/group-filing-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json(
        {
          paid: false,
          error: "A valid payment session is required.",
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const { session, applicationId } =
      await verifyGroupFilingPayment(request, sessionId);

    return NextResponse.json(
      {
        paid: true,
        applicationId,
        customerEmail:
          session.customer_details?.email ?? "",
        customerName:
          session.customer_details?.name ?? "",
        customerPhone:
          session.customer_details?.phone ?? "",
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error(
      "Group filing payment verification failed:",
      error
    );

    return NextResponse.json(
      {
        paid: false,
        error:
          "Payment could not be verified. If you purchased an upgrade, sign in to the account used for that purchase.",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
} 
