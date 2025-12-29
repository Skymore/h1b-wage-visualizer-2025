"use server";

import { NextRequest, NextResponse } from "next/server";
import { recordChatMessages } from "@/lib/metrics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const count =
      typeof body?.count === "number" && Number.isFinite(body.count)
        ? body.count
        : 1;
    const visitorId =
      typeof body?.visitorId === "string" && body.visitorId.length > 0
        ? body.visitorId
        : undefined;

    await recordChatMessages(count, visitorId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record chat messages", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
