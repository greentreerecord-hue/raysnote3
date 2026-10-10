import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { GET as verifyPayment } from
  "../assisted-copyright-payment/route";

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
    const body = await request.json();

    if (
      typeof body.sessionId !== "string" ||
      typeof body.summary !== "string" ||
      !body.summary.trim() ||
      body.summary.length > 50000
    ) {
      return failure("Invalid download request.", 400);
    }

    const verificationUrl = new URL(
      "/api/assisted-copyright-payment",
      request.url
    );

    verificationUrl.searchParams.set(
      "session_id",
      body.sessionId
    );

    const verification = await verifyPayment(
      new Request(verificationUrl)
    );

    const result = await verification.json();

    if (!verification.ok || !result.paid) {
      return failure(
        result.error || "Payment verification required.",
        verification.status
      );
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(
      StandardFonts.Helvetica
    );

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

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    // Standard Helvetica supports these printable characters.
    const safeText = body.summary
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
          font.widthOfTextAtSize(candidate, fontSize) >
            textWidth
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

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="raysnotes-copyright-application-summary.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return failure(
      "The PDF could not be generated. Please try again.",
      500
    );
  }
} 
