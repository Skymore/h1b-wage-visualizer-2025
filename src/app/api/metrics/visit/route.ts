"use server";

import { NextRequest, NextResponse } from "next/server";
import { recordVisit } from "@/lib/metrics";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const visitorId =
      typeof body?.visitorId === "string" && body.visitorId.length > 0
        ? body.visitorId
        : undefined;

    await recordVisit(visitorId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record visit", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
