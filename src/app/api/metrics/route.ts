"use server";

import { NextResponse } from "next/server";
import { getMetricsSummary } from "@/lib/metrics";

export async function GET() {
  try {
    const summary = await getMetricsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch metrics", error);
    return NextResponse.json(
      { error: "Unable to load metrics" },
      { status: 500 }
    );
  }
}
