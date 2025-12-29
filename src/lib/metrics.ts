"use server";

import { promises as fs } from "fs";
import * as path from "path";
import crypto from "crypto";

const METRICS_PATH = path.join(process.cwd(), "data_source", "metrics.json");

type MetricsFile = {
  totalVisits: number;
  uniqueVisitors: string[];
  chatMessages: number;
};

async function ensureMetricsFile(): Promise<MetricsFile> {
  try {
    const raw = await fs.readFile(METRICS_PATH, "utf-8");
    return JSON.parse(raw) as MetricsFile;
  } catch {
    const initial: MetricsFile = {
      totalVisits: 0,
      uniqueVisitors: [],
      chatMessages: 0,
    };
    await fs.mkdir(path.dirname(METRICS_PATH), { recursive: true });
    await fs.writeFile(METRICS_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

async function saveMetrics(data: MetricsFile) {
  await fs.writeFile(METRICS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function hashVisitorId(visitorId?: string | null) {
  if (!visitorId) return null;
  return crypto.createHash("sha256").update(visitorId).digest("hex");
}

export async function recordVisit(visitorId?: string) {
  const metrics = await ensureMetricsFile();
  metrics.totalVisits += 1;

  const hashed = hashVisitorId(visitorId);
  if (hashed && !metrics.uniqueVisitors.includes(hashed)) {
    metrics.uniqueVisitors.push(hashed);
  }

  await saveMetrics(metrics);
}

export async function recordChatMessages(count: number, visitorId?: string) {
  const metrics = await ensureMetricsFile();
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  metrics.chatMessages += safeCount;

  const hashed = hashVisitorId(visitorId);
  if (hashed && !metrics.uniqueVisitors.includes(hashed)) {
    metrics.uniqueVisitors.push(hashed);
  }

  await saveMetrics(metrics);
}

export async function getMetricsSummary() {
  const metrics = await ensureMetricsFile();
  return {
    totalVisits: metrics.totalVisits,
    uniqueVisitors: metrics.uniqueVisitors.length,
    chatMessages: metrics.chatMessages,
  };
}
