import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  ensureLLCTables,
  getApplicationAccount,
  getDatabase,
  isSameOrigin,
  normalizeLLCForm,
  type LLCField,
} from "../../lib/llc-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields: [LLCField, string][] = [
  ["companyName", "Proposed LLC name"],
  ["mailingAddress", "Principal office mailing address"],
  ["officeAddress", "Principal office physical address"],
  ["agentType", "Registered agent type"],
  ["agentName", "Registered agent name"],
  ["agentJurisdiction", "Agent entity formation jurisdiction"],
  ["agentAddress", "Registered agent Hawaii street address"],
  ["organizers", "Organizers and addresses"],
  ["duration", "Company duration"],
  ["endDate", "Specified term expiration date"],
  ["management", "Management structure"],
  ["memberCount", "Number of initial members"],
  ["managers", "Initial managers and addresses"],
  ["members", "Initial members and addresses"],
  ["liability", "Intended member liability selection"],
  ["liabilityDetails", "Liability details and consent notes"],
  ["contactName", "Contact name"],
  ["email", "Contact email"],
  ["phone", "Contact phone"],
  ["notes", "Questions and additional notes"],
];

function json(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

// Standard PDF fonts cannot display every Unicode character.
// Unsupported characters are marked instead of failing the download.
function printable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json("Please use the LLC application page.", 403);
  }

  try {
    const account = await getApplicationAccount(request);

    if (!account) {
      return json("Please sign in to download your summary.", 401);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json("Invalid download request.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return json("Invalid download request.", 400);
    }

    const { applicationId, certified } =
      body as Record<string, unknown>;

    if (
      typeof applicationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        applicationId
      ) ||
      certified !== true
    ) {
      return json(
        "A valid LLC application and review confirmation are required.",
        400
      );
    }

    await ensureLLCTables();

    const sql = getDatabase();

    const rows = await sql<
      {
        id: string;
        title: string;
        form: Record<string, string>;
        paid: boolean;
      }[]
    >`
      SELECT
        id,
        title,
        form_data AS form,
        paid_at IS NOT NULL AS paid
      FROM raysnotes_llc_applications
      WHERE id = ${applicationId}
        AND account_id = ${account.id}
      LIMIT 1
    `;

    const application = rows[0];

    if (!application) {
      return json("LLC application was not found.", 404);
    }

    if (!application.paid) {
      return json(
        "Payment is required to download this LLC summary.",
        403
      );
    }

    const form = normalizeLLCForm(application.form);
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    pdf.setTitle("Hawaii LLC Preparation Summary");
    pdf.setAuthor("Ray'sNotes");
    pdf.setSubject("Preparation summary - not a state filing");

    const margin = 48;
    const width = 612;
    const height = 792;
    const usableWidth = width - margin * 2;

    let page = pdf.addPage([width, height]);
    let y = height - margin;

    function write(
      value: string,
      options: {
        bold?: boolean;
        size?: number;
      } = {}
    ) {
      const font = options.bold ? bold : regular;
      const size = options.size || 11;
      const lineHeight = size * 1.45;
      const text = printable(value);

      function drawLine(line: string) {
        if (y - lineHeight < 54) {
          page = pdf.addPage([width, height]);
          y = height - margin;
        }

        page.drawText(line, {
          x: margin,
          y,
          size,
          font,
          color: rgb(0.08, 0.12, 0.2),
        });

        y -= lineHeight;
      }

      for (const paragraph of text.split("\n")) {
        let line = "";

        // Character wrapping also handles long URLs and addresses.
        for (const character of paragraph) {
          const candidate = line + character;

          if (
            line &&
            font.widthOfTextAtSize(candidate, size) > usableWidth
          ) {
            drawLine(line);
            line = character;
          } else {
            line = candidate;
          }
        }

        drawLine(line);
      }

      y -= 6;
    }

    write("Ray'sNotes", { bold: true, size: 14 });
    write("Hawaii LLC Preparation Summary", {
      bold: true,
      size: 19,
    });

    write(`Prepared: ${new Date().toISOString().slice(0, 10)}`);
    write(`Application reference: ${application.id}`);

    write(
      "PREPARATION ONLY - NOT FILED WITH THE STATE",
      { bold: true }
    );

    write(
      "This document organizes customer-provided information. " +
        "It is not the official Articles of Organization, proof " +
        "of formation, legal advice, or tax advice. Payment for " +
        "preparation does not submit a filing or include government fees."
    );

    write(
      "Blank answers are marked Not provided. Review the current " +
        "Hawaii form and instructions before filing. Some characters " +
        "may be simplified or shown as ? in this PDF; check names " +
        "and addresses against your saved draft."
    );

    for (const [field, label] of fields) {
      write(label, { bold: true });
      write(form[field].trim() || "Not provided");
    }

    write("Preparation checklist", { bold: true, size: 15 });

    const checklist = [
      "Check the proposed name with Hawaii's Business Registration Division. This summary does not reserve a name.",
      "Review the current Form LLC-1 and its instructions.",
      "Confirm principal office addresses and registered agent information.",
      "Confirm the agent's availability and eligibility to serve in Hawaii.",
      "Review organizer, management, member, duration, and liability information.",
      "Resolve unanswered questions before signing state documents.",
      "Arrange the required organizer signature and certification.",
      "Review current government fees and submit through the official state process or a separately authorized filing service.",
      "Keep the state's acceptance documents when received.",
    ];

    for (let index = 0; index < checklist.length; index++) {
      write(`${index + 1}. ${checklist[index]}`);
    }

    write("Preparation credit", { bold: true, size: 15 });
    write(
      "The $24.99 preparation payment is associated with this LLC " +
        "application and account. It may be applied once toward " +
        "the $149 Ray'sNotes full-service fee for the same LLC, " +
        "leaving $124.01 in service charges. Government fees are " +
        "separate. An upgrade must be purchased separately; this " +
        "summary does not authorize filing."
    );

    write("Official resources", { bold: true });
    write("https://cca.hawaii.gov/breg/registration/dllc/");

    const pages = pdf.getPages();

    pages.forEach((pdfPage, index) => {
      pdfPage.drawText(
        `Ray'sNotes preparation only | Page ${index + 1} of ${pages.length}`,
        {
          x: margin,
          y: 28,
          size: 8,
          font: regular,
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
          'attachment; filename="raysnotes-hawaii-llc-preparation.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("LLC PDF generation failed:", error);

    return json(
      "Your LLC PDF could not be generated. Please try again.",
      500
    );
  }
} 
