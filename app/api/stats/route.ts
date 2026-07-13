import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

function getRedis() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Redis database is not connected.");
  }

  return new Redis({
    url,
    token,
  });
}

async function getStats() {
  const redis = getRedis();

  const [views, subscribers] = await Promise.all([
    redis.get<number>("raysnotes:views"),
    redis.get<number>("raysnotes:subscribers"),
  ]);

  return {
    views: Number(views ?? 0),
    subscribers: Number(subscribers ?? 0),
  };
}

export async function GET() {
  try {
    const stats = await getStats();

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not load stats:", error);

    return NextResponse.json(
      {
        views: 0,
        subscribers: 0,
        error: "Database is not connected.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action !== "view" && action !== "subscribe") {
      return NextResponse.json(
        {
          error: "Invalid action.",
        },
        {
          status: 400,
        }
      );
    }

    const redis = getRedis();

    if (action === "view") {
      await redis.incr("raysnotes:views");
    }

    if (action === "subscribe") {
      await redis.incr("raysnotes:subscribers");
    }

    const stats = await getStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Could not update stats:", error);

    return NextResponse.json(
      {
        error: "Database request failed.",
      },
      {
        status: 500,
      }
    );
  }
} 
