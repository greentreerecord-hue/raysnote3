import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  ensureTrademarkTables,
  getApplicationAccount,
  getDatabase,
  normalizeTrademarkForm,
  type TrademarkForm,
} from "../../lib/trademark-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const fields: [keyof TrademarkForm, string][] = [
  ["packageTitle", "Draft title"],
  ["ownerName", "Owner's legal name"],
  ["ownerType", "Owner type"],
  ["email", "Contact email"],
  ["mailingAddress", "Mailing address"],
  ["markType", "Mark type"],
  ["brandName", "Brand name or wording"],
  ["logoDescription", "Logo or design description"],
  ["goodsServices", "Products or services"],
  ["useStatus", "Current use"],
  ["firstUseDate", "First-use date supplied by customer"],
  ["website", "Website or store link"],
  ["supportingNotes", "Supporting materials and questions"],
];

function failure(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// Standard PDF fonts cannot display every writing system.
// Unsupported characters are visibly marked instead of
// causing the entire download to fail.
function printable(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

export async function GET(request: NextRequest) {
  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return failure(
        "Please sign in to download your preparation PDF.",
        401
      );
    }

    const applicationId =
      request.nextUrl.searchParams.get("application_id");

    if (!applicationId || !ID_PATTERN.test(applicationId)) {
      return failure(
        "A valid trademark application is required.",
        400
      );
    }

    await ensureTrademarkTables();

    const sql = getDatabase();

    const rows = await sql<
      {
        id: string;
        title: string;
        form: unknown;
        paid: boolean;
      }[]
    >`
      SELECT
        id,
        title,
        form_data AS form,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_trademark_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return failure(
        "Trademark application was not found.",
        404
      );
    }

    if (!application.paid) {
      return failure(
        "The $24.99 preparation payment must be verified before downloading.",
        403
      );
    }

    const form = normalizeTrademarkForm(application.form);

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(
      StandardFonts.Helvetica
    );
    const bold = await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

    pdf.setTitle("Trademark Preparation Summary");
    pdf.setAuthor("Ray'sNotes");
    pdf.setSubject(
      "Customer-supplied trademark preparation information"
    );

    const width = 612;
    const height = 792;
    const margin = 50;
    const contentWidth = width - margin * 2;

    let page = pdf.addPage([width, height]);
    let y = height - margin;

    function ensureSpace(required: number) {
      if (y - required < 60) {
        page = pdf.addPage([width, height]);
        y = height - margin;
      }
    }

    function paragraph(
      value: string,
      strong = false,
      size = 11
    ) {
      const font = strong ? bold : regular;
      const lineHeight = size + 5;
      const paragraphs = printable(value).split("\n");

      for (const text of paragraphs) {
        if (!text.trim()) {
          ensureSpace(lineHeight);
          y -= lineHeight;
          continue;
        }

        const words = text.trim().split(/\s+/);
        let line = "";

        function drawLine() {
          if (!line) return;

          ensureSpace(lineHeight);

          page.drawText(line, {
            x: margin,
            y,
            font,
            size,
            color: rgb(0.12, 0.12, 0.12),
          });

          y -= lineHeight;
          line = "";
        }

        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;

          if (
            font.widthOfTextAtSize(candidate, size) <=
            contentWidth
          ) {
            line = candidate;
            continue;
          }

          drawLine();

          // Split long URLs or words so they stay on the page.
          for (const character of word) {
            if (
              line &&
              font.widthOfTextAtSize(
                line + character,
                size
              ) > contentWidth
            ) {
              drawLine();
            }

            line += character;
          }
        }

        drawLine();
      }

      y -= 7;
    }

    paragraph("Ray'sNotes", true, 18);
    paragraph("Trademark Preparation Summary", true, 16);

    paragraph(
      `Prepared: ${new Date().toISOString().slice(0, 10)}`
    );

    paragraph(`Draft reference: ${application.id}`);

    paragraph(
      "This document organizes information supplied by the customer. It is not a government application, legal opinion, trademark search, or confirmation of trademark eligibility. No government filing has been submitted by generating this PDF."
    );

    paragraph(
      "Preparation payment: $24.99 USD. Government fees and legal representation are not included."
    );

    paragraph(
      "Character display: this PDF uses a basic Latin font. Unsupported characters appear as ?. Check names and wording against your original saved draft."
    );

    for (const [field, label] of fields) {
      ensureSpace(65);
      paragraph(label, true, 12);
      paragraph(form[field].trim() || "Not provided");
    }

    ensureSpace(80);
    paragraph("Preparation checklist", true, 14);

    const checklist = [
      "Review the owner's legal name and contact information.",
      "Check the exact spelling of the proposed brand wording.",
      "Gather your logo or design files, if applicable.",
      "Review your description of the products or services.",
      "Gather supporting materials and any known use dates.",
      "Discuss searches, eligibility, filing options, and fees with a qualified trademark professional as needed.",
    ];

    for (const item of checklist) {
      paragraph(`- ${item}`);
    }

    paragraph(
      "This summary does not register a trademark, reserve a name, or guarantee approval. Ray'sNotes does not provide legal advice."
    );

    const pages = pdf.getPages();

    pages.forEach((currentPage, index) => {
      currentPage.drawText(
        `Ray'sNotes | Preparation only | Page ${index + 1} of ${pages.length}`,
        {
          x: margin,
          y: 30,
          font: regular,
          size: 9,
          color: rgb(0.4, 0.4, 0.4),
        }
      );
    });

    const bytes = await pdf.save();

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="trademark-preparation.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Trademark PDF failed:", error);

    return failure(
      "Your preparation PDF could not be generated. Please try again.",
      500
    );
  }
} 
