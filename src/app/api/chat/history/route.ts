import { NextRequest } from "next/server";
import { saveChat, getChat } from "@/lib/chat/storage";
import type { UIMessage } from "ai";

interface HistorySyncPayload {
    visitorId: string;
    messages: UIMessage[];
}

/**
 * GET /api/chat/history?visitorId=xxx
 * Fetch chat history from Redis
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const visitorId = searchParams.get("visitorId");

    if (!visitorId || typeof visitorId !== "string") {
        return new Response(
            JSON.stringify({ error: "visitorId is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const messages = await getChat(visitorId);
        return new Response(JSON.stringify({ messages }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[chat/history] GET error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to fetch history" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

/**
 * POST /api/chat/history
 * Sync chat history to Redis (used for migration and clearing)
 * - Migration: User has localStorage data, server has none → upload
 * - Clearing: User clears chat → POST empty array
 */
export async function POST(req: NextRequest) {
    try {
        const payload = (await req.json()) as Partial<HistorySyncPayload>;

        if (!payload.visitorId || typeof payload.visitorId !== "string") {
            return new Response(
                JSON.stringify({ error: "visitorId is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!Array.isArray(payload.messages)) {
            return new Response(
                JSON.stringify({ error: "messages must be an array" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        await saveChat(payload.visitorId, payload.messages);

        return new Response(
            JSON.stringify({ success: true, count: payload.messages.length }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[chat/history] POST error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to save history" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
