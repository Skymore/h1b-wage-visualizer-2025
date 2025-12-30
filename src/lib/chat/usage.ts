import type { LanguageModelUsage, ProviderMetadata } from 'ai';
import type { OpenRouterMetadata } from './types';

const toFiniteNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readRawNumber = (
    raw: Record<string, unknown> | undefined,
    ...keys: string[]
) => {
    if (!raw) return undefined;
    for (const key of keys) {
        const candidate = toFiniteNumber(raw[key]);
        if (typeof candidate === 'number') {
            return candidate;
        }
    }
    return undefined;
};

export function summarizeTokenCounts(usage?: LanguageModelUsage) {
    if (!usage) {
        return { prompt: 0, completion: 0, total: 0 };
    }
    const raw = usage.raw as Record<string, unknown> | undefined;

    const prompt =
        toFiniteNumber(usage.inputTokens) ??
        readRawNumber(raw, 'promptTokens') ??
        0;

    const completion =
        toFiniteNumber(usage.outputTokens) ??
        readRawNumber(raw, 'completionTokens') ??
        0;

    const total =
        toFiniteNumber(usage.totalTokens) ??
        readRawNumber(raw, 'totalTokens') ??
        prompt +
            completion;

    return { prompt, completion, total };
}

export function extractCostUSD(metadata?: ProviderMetadata, usage?: LanguageModelUsage) {
    const openrouterUsage = (metadata as OpenRouterMetadata | undefined)?.openrouter?.usage;
    const raw = usage?.raw as Record<string, unknown> | undefined;

    return (
        toFiniteNumber(openrouterUsage?.cost) ??
        toFiniteNumber(openrouterUsage?.costDetails?.upstreamInferenceCost) ??
        readRawNumber(raw, 'cost', 'costUSD') ??
        0
    );
}
