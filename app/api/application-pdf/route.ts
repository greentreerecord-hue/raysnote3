import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Stripe from "stripe";
import {
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
} from "../../lib/application-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return failure("Please use the application page.", 403);
    }

    const account = await getApplicationAccount(request);

    if (!account) {
      return failure("Please sign in to download your application.", 401);
    }

    const body = await request.json();

    if (
      typeof body.applicationId !== "string" ||
      !body.applicationId ||
      body.applicationId.length > 100 ||
      body.certified !== true
    ) {
      return failure(
        "An application and accuracy confirmation are required.",
        400
      );
    }

    const sql = getDatabase();

    const rows = await sql<
      {
        id: string;
        form_data: Record<string, string>;
        stripe_session_id: string | null;
        paid: boolean;
      }[]
    >`
      SELECT
        id,
        form_data,
        stripe_session_id,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_applications
      WHERE id = ${body.applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return failure("Application was not found.", 404);
    }

    if (!application.paid || !application.stripe_session_id) {
      return failure("Payment is required for this application.", 403);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return failure("Payment verification is not configured.", 500);
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(
      application.stripe_session_id
    );

    if (
      session.mode !== "payment" ||
      session.status !== "complete" ||
      session.payment_status !== "paid" ||
      session.amount_total !== 2499 ||
      session.currency !== "usd" ||
      session.client_reference_id !== application.id ||
      session.metadata?.product_code !==
        "assisted-copyright-application" ||
      session.metadata?.application_id !== application.id ||
      session.metadata?.account_id !== account.id
    ) {
      return failure("Payment could not be verified for this application.", 403);
    }

    const form = application.form_data;

    const requiredFields = [
      "workType",
      "title",
      "creationYear",
      "authorName",
      "claimantName",
      "citizenship",
      "email",
      "address",
    ];

    if (
      requiredFields.some(
        (field) =>
          typeof form[field] !== "string" || !form[field].trim()
      )
    ) {
      return failure("Complete the required application fields first.", 400);
    }

    if (
      form.published === "Yes" &&
      (!form.publicationDate?.trim() ||
        !form.publicationCountry?.trim())
    ) {
      return failure("Complete the first publication details.", 400);
    }

    if (
      form.previousRegistration === "Yes" &&
      !form.previousNumber?.trim()
    ) {
      return failure("Enter the previous registration number.", 400);
    }

    const value = (field: string, fallback = "Not stated") =>
      form[field]?.trim() || fallback;

    const summary = `RAY'SNOTES ASSISTED COPYRIGHT APPLICATION SUMMARY

Application reference: ${application.id}

This is an application-preparation summary.
It is not a copyright registration and has not been submitted
to the U.S. Copyright Office.

WORK INFORMATION

Work type: ${value("workType")}
Title: ${value("title")}
Year completed: ${value("creationYear")}
Published: ${value("published")}
First publication date: ${
      form.published === "Yes"
        ? value("publicationDate")
        : "Not applicable or not confirmed"
    }
First publication country: ${
      form.published === "Yes"
        ? value("publicationCountry")
        : "Not applicable or not confirmed"
    }

AUTHOR AND CLAIMANT

Author's legal name: ${value("authorName")}
Pseudonym or stage name: ${value("pseudonym", "None stated")}
Copyright claimant: ${value("claimantName")}
Citizenship or domicile: ${value("citizenship")}
Work made for hire: ${value("workForHire")}

PREVIOUS WORK AND NEW MATERIAL

Previously registered: ${value("previousRegistration")}
Previous registration number: ${
      form.previousRegistration === "Yes"
        ? value("previousNumber")
        : "Not applicable or not confirmed"
    }
Preexisting material excluded: ${value("preexistingMaterial", "None stated")}
New material included: ${value("newMaterial")}

CONTACT INFORMATION

Email: ${value("email")}
Phone: ${value("phone", "Not provided")}
Mailing address: ${value("address")}

REVIEW CONFIRMATION

The customer confirmed that they reviewed the information
and that it is accurate to the best of their knowledge.

NEXT STEPS

1. Review every answer carefully.
2. Choose the appropriate Copyright Office application type.
3. Visit the official Copyright Office registration portal.
4. Enter the information, provide the required deposit,
   pay the separate government fee, and submit the application.

Official portal: https://www.copyright.gov/registration/

Ray'sNotes does not guarantee registration or provide legal advice.
`;

    const pdf = await PDFDocument.create();
    pdf.setTitle("Ray'sNotes Application Preparation Summary");

    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const margin = 48;
    const fontSize = 11;
    const lineHeight = 16;
    const width = 612;
    const height = 792;
    const textWidth = width - margin * 2;

    let page = pdf.addPage([width, height]);
    let y = height - margin;

    function drawLine(line: string) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([width, height]);
        y = height - margin;
      }

      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }

      y -= lineHeight;
    }

    const safeText = summary
      .replace(/\r\n?/g, "\n")
      .replace(/[^\x20-\x7E\n]/g, "?");

    for (const paragraph of safeText.split("\n")) {
      if (!paragraph.trim()) {
        drawLine("");
        continue;
      }

      let line = "";

      for (const character of paragraph) {
        const candidate = line + character;

        if (
          line &&
          font.widthOfTextAtSize(candidate, fontSize) > textWidth
        ) {
          drawLine(line);
          line = character;
        } else {
          line = candidate;
        }
      }

      drawLine(line);
    }

    const bytes = await pdf.save();

    await sql`
      UPDATE raysnotes_applications
      SET summary = ${summary}
      WHERE id = ${application.id}
        AND account_id = ${account.id}
    `;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="raysnotes-copyright-application-summary.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Application PDF failed:", error);

    return failure(
      "The PDF could not be generated. Please try again.",
      500
    );
  }
} 
