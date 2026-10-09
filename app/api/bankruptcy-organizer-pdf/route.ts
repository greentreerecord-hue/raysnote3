import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";
import { GET as verifyPayment } from
  "../bankruptcy-organizer-payment/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = [
  ["name", "Full legal name"],
  ["address", "Mailing address"],
  ["household", "Household information"],
  ["income", "Income"],
  ["expenses", "Monthly expenses"],
  ["property", "Property and assets"],
  ["debts", "Debts and creditors"],
  ["history", "Financial history and previous bankruptcy cases"],
  ["questions", "Questions for an attorney"],
];

const checklist = [
  "Income records",
  "Tax returns",
  "Bank statements",
  "Debt statements and creditor addresses",
  "Property and vehicle records",
  "Monthly expense records",
  "Previous bankruptcy documents, if applicable",
];

function failure(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

function wrap(text: string, font: PDFFont, size: number) {
  const lines: string[] = [];

  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";

    for (const character of paragraph.replace(/\t/g, "    ")) {
      if (font.widthOfTextAtSize(line + character, size) > 504) {
        const space = line.lastIndexOf(" ");

        if (space > 0) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }

      line += character;
    }

    lines.push(line);
  }

  return lines;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return failure("Invalid request origin.", 403);
    }

    const rawBody = await request.text();

    if (rawBody.length > 120000) {
      return failure("Your answers are too long.", 413);
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return failure("Invalid request.", 400);
    }

    if (
      !body ||
      typeof body.sessionId !== "string" ||
      !body.answers ||
      typeof body.answers !== "object" ||
      Array.isArray(body.answers) ||
      !body.checked ||
      typeof body.checked !== "object" ||
      Array.isArray(body.checked)
    ) {
      return failure("Invalid organizer information.", 400);
    }

    const verificationUrl = new URL(
      "/api/bankruptcy-organizer-payment",
      request.url
    );
    verificationUrl.searchParams.set("session_id", body.sessionId);

    const verification = await verifyPayment(
      new NextRequest(verificationUrl, {
        headers: request.headers,
      })
    );

    if (!verification.ok) {
      return failure(
        "Payment could not be verified. Return to the organizer page.",
        verification.status
      );
    }

    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);

    document.setTitle("Hawaii Bankruptcy Preparation Organizer");
    document.setAuthor("Ray'sNotes");

    const answers: Record<string, string> = {};

    for (const [key] of fields) {
      const value = body.answers[key] ?? "";

      if (typeof value !== "string" || value.length > 10000) {
        return failure("An answer is invalid or too long.", 400);
      }

      try {
        regular.encodeText(value.replace(/[\r\n\t]/g, " "));
      } catch {
        return failure(
          "An answer contains characters this PDF font cannot display. " +
          "Remove emojis or unsupported symbols and try again.",
          400
        );
      }

      answers[key] = value;
    }

    let page = document.addPage([612, 792]);
    let y = 728;

    function newPage() {
      page = document.addPage([612, 792]);
      y = 728;
    }

    function write(
      text: string,
      size = 11,
      font: PDFFont = regular
    ) {
      const lineHeight = size + 5;

      for (const line of wrap(text, font, size)) {
        if (y < 70) newPage();

        page.drawText(line, {
          x: 54,
          y,
          size,
          font,
          color: rgb(0.12, 0.12, 0.12),
        });

        y -= lineHeight;
      }

      y -= 8;
    }

    function heading(text: string) {
      if (y < 120) newPage();
      write(text, 13, bold);
    }

    write("Hawaii Bankruptcy", 22, bold);
    write("Preparation Organizer", 22, bold);
    write(
      "Personal notes and checklist. Not official court forms, " +
      "legal advice, or a filed bankruptcy case."
    );
    write(
      "This organizer does not determine eligibility, select a chapter, " +
      "or replace the court's required disclosures."
    );

    for (const [key, label] of fields) {
      heading(label);
      write(answers[key] || "Not entered");
    }

    heading("Documents to Gather for Review");
    write(
      "Keep records in your own secure storage. " +
      "This checklist does not replace court requirements."
    );

    for (const item of checklist) {
      write(
        `${body.checked[item] === true ? "Gathered" : "Still to gather"}: ${item}`
      );
    }

    heading("Official Court Resources");
    write("https://www.hib.uscourts.gov/filing");
    write("https://www.hib.uscourts.gov/chapter-7-filing-requirements");
    write("https://www.hib.uscourts.gov/chapter-13-filing-requirements");

    const pages = document.getPages();

    pages.forEach((pdfPage, index) => {
      pdfPage.drawText(
        `Ray'sNotes organizer - not filed | Page ${index + 1} of ${pages.length}`,
        {
          x: 54,
          y: 35,
          size: 9,
          font: regular,
          color: rgb(0.4, 0.4, 0.4),
        }
      );
    });

    const bytes = await document.save();

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="raysnotes-hawaii-bankruptcy-organizer.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return failure(
      "Unable to create your PDF. Your answers remain on the page.",
      500
    );
  }
} 
