import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const suppliedPassword =
    request.headers.get("x-admin-password") || "";

  const adminPassword = process.env.ADMIN_PASSWORD || "";

  return (
    adminPassword.length > 0 &&
    suppliedPassword === adminPassword
  );
}

function safeDownloadName(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .trim()
      .slice(0, 150) || "song-file"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    const pathname = String(
      searchParams.get("pathname") || ""
    ).trim();

    const requestedName = safeDownloadName(
      String(searchParams.get("name") || "")
    );

    if (
      !pathname ||
      !pathname.startsWith("group-filing/")
    ) {
      return NextResponse.json(
        { error: "A valid private song path is required." },
        { status: 400 }
      );
    }

    const result = await get(pathname, {
      access: "private",
      useCache: false,
    });

    if (
      !result ||
      result.statusCode !== 200 ||
      !result.stream
    ) {
      return NextResponse.json(
        { error: "The private song file was not found." },
        { status: 404 }
      );
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type":
          result.blob.contentType ||
          "application/octet-stream",
        "Content-Disposition": `attachment; filename="${requestedName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Private group filing download error:",
      error
    );

    return NextResponse.json(
      { error: "The private file could not be downloaded." },
      { status: 500 }
    );
  }
} 
