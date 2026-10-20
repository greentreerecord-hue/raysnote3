import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  ensurePatentTables,
  getApplicationAccount,
  getDatabase,
  normalizePatentForm,
  type PatentForm,
} from "../../lib/patent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const fields: [keyof PatentForm, string][] = [
  ["packageTitle", "Draft title"],
  ["inventorNames", "Inventor names supplied by customer"],
  ["contactEmail", "Contact email"],
  ["inventionTitle", "Invention title"],
  ["inventionCategory", "General field or category"],
  ["problem", "Problem the invention addresses"],
  ["description", "Invention description"],
  ["components", "Main parts, materials, or process steps"],
  ["operation", "How the invention works"],
  ["differences", "Customer's observations about differences"],
  ["variations", "Possible alternatives or variations"],
  ["developmentStatus", "Development stage"],
  ["drawingsNotes", "Drawings and supporting records"],
  ["disclosureHistory", "Sharing, publication, and sales history"],
  ["existingApplications", "Related applications or assistance"],
  ["professionalQuestions", "Questions for a patent professional"],
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
        "Please sign in to download your organizer PDF.",
        401
      );
    }

    const applicationId =
      request.nextUrl.searchParams.get("application_id");

    if (
      !applicationId ||
      !ID_PATTERN.test(applicationId)
    ) {
      return failure(
        "A valid patent draft is required.",
        400
      );
    }

    await ensurePatentTables();

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
      FROM raysnotes_patent_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return failure("Patent draft was not found.", 404);
    }

    if (!application.paid) {
      return failure(
        "The $24.99 organizer payment must be verified before downloading.",
        403
      );
    }

    const form = normalizePatentForm(application.form);

    const pdf = await PDFDocument.create();

    const regular = await pdf.embedFont(
      StandardFonts.Helvetica
    );

    const bold = await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

    pdf.setTitle("Patent Preparation Organizer");
    pdf.setAuthor("Ray'sNotes");
    pdf.setSubject(
      "Customer-supplied invention preparation information"
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
          const candidate = line
            ? `${line} ${word}`
            : word;

          if (
            font.widthOfTextAtSize(candidate, size) <=
            contentWidth
          ) {
            line = candidate;
            continue;
          }

          drawLine();

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
    paragraph("Patent Preparation Organizer", true, 16);

    paragraph(
      `Prepared: ${new Date().toISOString().slice(0, 10)}`
    );

    paragraph(`Draft reference: ${application.id}`);

    paragraph(
      "This organizer records information supplied by the customer. It is not a patent application, patentability opinion, prior-art search, or determination of legal inventorship."
    );

    paragraph(
      "Generating this document does not submit a government filing, establish a patent filing date, create patent protection, or guarantee approval."
    );

    paragraph(
      "Organizer payment: $24.99 USD. Patent searches, patent application or claim drafting, government fees, and legal representation are not included."
    );

    paragraph(
      "Character display: this PDF uses a basic Latin font. Unsupported characters appear as ?. Check names and technical wording against your original saved draft."
    );

    for (const [field, label] of fields) {
      ensureSpace(65);
      paragraph(label, true, 12);
      paragraph(form[field].trim() || "Not provided");
    }

    ensureSpace(80);
    paragraph("Preparation checklist", true, 14);

    const checklist = [
      "Review the invention title and inventor information supplied.",
      "Check the description, components, and operation notes.",
      "Gather your existing drawings, photos, and prototype records.",
      "Review recorded sharing, publication, and sales history.",
      "Gather references for any related applications.",
      "Prepare questions about searches, filing options, deadlines, fees, and representation for a qualified patent professional.",
      "Keep this organizer and supporting invention records in a location you control.",
    ];

    for (const item of checklist) {
      paragraph(`- ${item}`);
    }

    paragraph(
      "Blank fields remain unfinished. This organizer does not assess novelty, patentability, ownership, inventorship, or filing eligibility. Ray'sNotes does not provide legal advice."
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
          'attachment; filename="patent-preparation.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Patent PDF failed:", error);

    return failure(
      "Your organizer PDF could not be generated. Please try again.",
      500
    );
  }
} 
