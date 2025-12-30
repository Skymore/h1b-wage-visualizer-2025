
// Disable AI SDK warnings - must be set before any AI SDK imports
type GlobalWithAiSDK = typeof globalThis & { AI_SDK_LOG_WARNINGS?: boolean };

if (typeof globalThis !== 'undefined') {
    (globalThis as GlobalWithAiSDK).AI_SDK_LOG_WARNINGS = false;
}

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import type { UIMessage } from 'ai';
import { rateLimit } from '@/lib/rate-limit';
import { recordChatMessages } from '@/lib/metrics';
import { readPublicDataJson } from '@/lib/chat/data';
import { buildSystemPrompt } from '@/lib/chat/prompt';
import { createChatTools } from '@/lib/chat/tools';
import { extractCostUSD, summarizeTokenCounts } from '@/lib/chat/usage';
import type { OccupationRecord } from '@/lib/chat/types';

interface ChatPayload {
    messages: UIMessage[];
    visitorId?: string;
}

// Configure OpenRouter
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
    // 1. Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!rateLimit.check(ip)) {
        return new Response('Too Many Requests', { status: 429 });
    }

    const payload = (await req.json()) as Partial<ChatPayload>;
    if (!payload.messages || !Array.isArray(payload.messages)) {
        return new Response('Invalid payload', { status: 400 });
    }
    const messages = payload.messages;
    const visitorId = typeof payload.visitorId === 'string' && payload.visitorId.length > 0
        ? payload.visitorId
        : undefined;

    // 2. Stream Text with Tools
    const modelName = 'google/gemini-3-flash-preview';
    const maxSteps = 10;

    // Load popular occupations for context
    const occupationsData = await readPublicDataJson<OccupationRecord[]>('occupations.json');
    const occupationsList = occupationsData
        ? occupationsData
            .filter((o) => o.isPopular)
            .map((o) => `- ${o.code}: ${o.title}`).join('\n')
        : '';

    const tools = createChatTools();

    const messagesWithoutId = messages.map((message) => {
        const { id, ...rest } = message;
        void id;
        return rest;
    });
    const modelMessages = await convertToModelMessages(messagesWithoutId, {
        tools,
        ignoreIncompleteToolCalls: true,
    });

    const result = streamText({
        model: openrouter(modelName, {
            usage: { include: true },
        }),
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: undefined,
        system: buildSystemPrompt(occupationsList),
        messages: modelMessages,
        tools,
    });

    const usageLoggingPromise = Promise.all([
        Promise.resolve(result.totalUsage).catch((error) => {
            console.error('[Chat] Failed to resolve total usage', error);
            return undefined;
        }),
        Promise.resolve(result.providerMetadata).catch((error) => {
            console.error('[Chat] Failed to resolve provider metadata', error);
            return undefined;
        }),
    ])
        .then(async ([usage, metadata]) => {
            const tokens = summarizeTokenCounts(usage);
            const costUSD = extractCostUSD(metadata, usage);
            await recordChatMessages(1, visitorId, {
                ...tokens,
                costUSD,
            });
        })
        .catch((error) => {
            console.error('Failed to log chat usage', error);
        });
    void usageLoggingPromise;

    return result.toUIMessageStreamResponse();
}
