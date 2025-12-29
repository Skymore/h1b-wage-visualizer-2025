"use server";

import { NextRequest, NextResponse } from "next/server";
import { recordChatMessages } from "@/lib/metrics";

type IncomingTokenUsage = {
  prompt?: unknown;
  completion?: unknown;
  total?: unknown;
  costUSD?: unknown;
};

const toFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function coerceTokenUsage(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as IncomingTokenUsage;
  const prompt = toFiniteNumber(raw.prompt) ?? 0;
  const completion = toFiniteNumber(raw.completion) ?? 0;
  const total = toFiniteNumber(raw.total) ?? prompt + completion;
  const costUSD = toFiniteNumber(raw.costUSD) ?? 0;
  return { prompt, completion, total, costUSD };
}

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
    const usage = coerceTokenUsage(body?.usage);

    await recordChatMessages(count, visitorId, usage);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record chat messages", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
