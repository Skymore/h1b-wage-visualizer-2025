
// Disable AI SDK warnings - must be set before any AI SDK imports
type GlobalWithAiSDK = typeof globalThis & { AI_SDK_LOG_WARNINGS?: boolean };

if (typeof globalThis !== 'undefined') {
    (globalThis as GlobalWithAiSDK).AI_SDK_LOG_WARNINGS = false;
}

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { rateLimit } from '@/lib/rate-limit';

type OccupationRecord = {
    code: string;
    title: string;
    count: number;
    isPopular?: boolean;
};

type AreaRecord = {
    id: string;
    name: string;
    state: string;
    tier?: number;
};

type WageEntry = {
    area_id: string;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
};

type WageFile = {
    soc: string;
    wages: WageEntry[];
};

type WageSnapshot = {
    hourly: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
    annual: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
};

type WageLookupSuccess = WageSnapshot & {
    socCode: string;
    areaId?: string;
    state?: string;
};

type WageLookupError = {
    socCode: string;
    areaId?: string;
    state?: string;
    error: string;
};

type WageLookupResult = WageLookupSuccess | WageLookupError;

type AreaLevelInfo = {
    areaId: string;
    name: string;
    state: string;
    cityTier: number;
    yourLevel: number;
    thresholds: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
};

type OccupationSearchResult = {
    code: string;
    title: string;
    count: number;
    query: string;
};

type AreaSearchResult = {
    id: string;
    name: string;
    state: string;
    query: string;
};

type MessagePart = {
    type: string;
    text?: string;
    toolInvocation?: {
        toolCallId?: string;
        toolName?: string;
        args?: Record<string, unknown>;
        state?: string;
    };
};

type IncomingMessage = {
    role: 'user' | 'assistant' | 'tool' | 'system';
    content?: unknown;
    parts?: MessagePart[];
};

type TextContent = { type: 'text'; text: string };
type ToolCall = {
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
};

type CoreUserMessage = {
    role: 'user';
    content: string | TextContent[];
};

type CoreAssistantMessage = {
    role: 'assistant';
    content: TextContent[];
    toolCalls?: ToolCall[];
};

type CoreMessage = CoreUserMessage | CoreAssistantMessage;

interface ChatPayload {
    messages: IncomingMessage[];
}

// Configure OpenRouter
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Helper to read JSON files
async function readJsonFile<T>(relativePath: string): Promise<T | null> {
    const filePath = path.join(process.cwd(), 'public/data', relativePath);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
        return null;
    }
}

// Custom converter to handle UIMessage -> CoreMessage
function convertToCoreMessages(messages: IncomingMessage[]): CoreMessage[] {
    return messages.map((m): CoreMessage | null => {
        // If it's already a CoreMessage (has strictly string/array content and no parts), return it.
        // But UIMessages usually have parts.

        // 1. Handle User Messages
        if (m.role === 'user') {
            // Map parts to CoreMessage content
            // UIMessage parts: { type: 'text', text: string } | { type: 'file' ... }
            // CoreMessage content: string | Array<{ type: 'text', text: string } | ...>
            if (m.parts) {
                const content = m.parts
                    .map((part) => {
                        if (part.type === 'text' && part.text) {
                            return { type: 'text', text: part.text } as TextContent;
                        }
                        return null;
                    })
                    .filter((part): part is TextContent => Boolean(part));
                return { role: 'user', content };
            }
            // Fallback if content string exists
            if (typeof m.content === 'string') {
                return { role: 'user', content: m.content };
            }
            if (Array.isArray(m.content)) {
                const content = m.content
                    .map((part) => {
                        if (typeof part === 'object' && part && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
                            return { type: 'text', text: (part as { text: string }).text };
                        }
                        return null;
                    })
                    .filter((part): part is TextContent => Boolean(part));
                if (content.length > 0) {
                    return { role: 'user', content };
                }
            }
            return { role: 'user', content: '' };
        }

        // 2. Handle Assistant Messages
        if (m.role === 'assistant') {
            const content: TextContent[] = [];
            const toolCalls: ToolCall[] = [];

            if (m.parts) {
                m.parts.forEach((part) => {
                    if (part.type === 'text' && part.text) {
                        content.push({ type: 'text', text: part.text });
                    } else if (part.type.startsWith('tool-')) {
                        // Extract tool call info
                        if (part.toolInvocation) {
                            toolCalls.push({
                                toolCallId: part.toolInvocation.toolCallId,
                                toolName: part.toolInvocation.toolName,
                                args: part.toolInvocation.args,
                            });
                        }
                    }
                });
            }

            const message: CoreAssistantMessage = { role: 'assistant', content };
            if (toolCalls.length > 0) {
                message.toolCalls = toolCalls;
            }
            return message;
        }

        // 3. Handle Tool Messages
        if (m.role === 'tool') {
            return null;
        }

        return null;
    }).filter((msg): msg is CoreMessage => Boolean(msg));
}

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

    const lastIncoming = messages[messages.length - 1];
    if (lastIncoming) {
        console.log('[Chat] Last message:', JSON.stringify(lastIncoming, null, 2));
    }

    // Custom conversion
    const coreMessages = convertToCoreMessages(messages);
    const lastConverted = coreMessages[coreMessages.length - 1];
    if (lastConverted) {
        console.log('[Chat] Last converted:', JSON.stringify(lastConverted, null, 2));
    }

    // 2. Stream Text with Tools
    const modelName = 'google/gemini-3-flash-preview';
    const maxSteps = 10;
    console.log('[Chat] Using model:', modelName);

    // Load popular occupations for context
    const occupationsData = await readJsonFile<OccupationRecord[]>('occupations.json');
    const occupationsList = occupationsData
        ? occupationsData
            .filter((o) => o.isPopular)
            .map((o) => `- ${o.code}: ${o.title}`).join('\n')
        : '';

    const result = streamText({
        model: openrouter(modelName),
        stopWhen: stepCountIs(maxSteps),
        onStepFinish: (step) => {
            console.log(`[Step] Finished step. Tool Calls: ${step.toolCalls?.length || 0}`);
            console.log(`[Step] Text: "${step.text}"`);
            if (step.toolCalls && step.toolCalls.length > 0) {
                step.toolCalls.forEach(tc => {
                    console.log(`[Step] Tool: ${tc.toolName}, Call:`, tc);
                });
            }
        },
        system: `You are an H1B wage data assistant. You ONLY answer questions about H1B wages, occupations, locations, and FY2027 lottery policy.

CRITICAL RULES:
1. Be CONCISE. Present data as bullet points.
2. **NO MARKDOWN TABLES**. Tables render poorly on mobile. Use lists or key-value pairs.
3. ALWAYS use tools.
4. Support BATCH queries. If user asks "Seattle and NY", search for BOTH.
5. **USE BATCH MODE**: Call \`getWageData\` with ARRAYS (socCodes, areaIds) to get multiple results in ONE call. Never call it multiple times for the same query.
6. **PRIORITIZE ANNUAL WAGES**. The tool returns both. Display Annual (Yearly) wage by default. Hourly is secondary.
7. **NO HALLUCINATIONS**. You MUST call \`getWageData\` to fetch real numbers. Never guess wages or levels. If you suggest cities, you MUST verify their data first.

**MASTER OCCUPATION LIST (SOC Code: Title)**:
Reference this list for valid SOC codes.
- IF user's job title matches an entry here (e.g., "Software Engineer" -> "15-1252"): Use the provided SOC code. Do NOT call \`searchOccupations\`.
- IF NOT found here: call \`searchOccupations\`.
- NOTE: You still need an \`areaId\`. Call \`searchAreas\` if needed.
- FINAL STEP: Once you have BOTH \`socCode\` and \`areaId\`, you MUST call \`getWageData\`. Do not stop until you get the wages.
${occupationsList}

H-1B FY2027 POLICY (Effective Oct 1, 2026):
**LOTTERY:** Wage-based weighted lottery (Level 4=4x ... Level 1=1x).
**$100K FEE:** For new petitions seeking entry. F-1 COS exempt if no travel.
**ONE ENTRY:** Per passport.

Answer in user's language.`,
        messages: coreMessages,
        tools: {
            searchOccupations: tool({
                description: 'Search for occupation codes (SOC) by job title keywords. Accepts a list of queries.',
                inputSchema: z.object({
                    queries: z.array(z.string()).describe('List of job titles to search for, e.g., ["Software Engineer", "Data Scientist"]'),
                }),
                execute: async ({ queries }) => {
                    console.log(`[Tool Execute] searchOccupations queries:`, queries);
                    const occupations = await readJsonFile<OccupationRecord[]>('occupations.json');
                    if (!occupations) return [];

                    const allResults: OccupationSearchResult[] = [];
                    const seen = new Set<string>();

                    const searchTerms = Array.isArray(queries) ? queries : [queries];

                    for (const query of searchTerms) {
                        const lowerQuery = String(query).toLowerCase();
                        const matches = occupations
                            .filter((occ) => occ.title.toLowerCase().includes(lowerQuery))
                            .slice(0, 5);

                        matches.forEach((match) => {
                            if (!seen.has(match.code)) {
                                seen.add(match.code);
                                allResults.push({ code: match.code, title: match.title, count: match.count, query });
                            }
                        });
                    }
                    return allResults.slice(0, 15);
                },
            }),
            searchAreas: tool({
                description: 'Search for area IDs by location name (city or state). Accepts a list of queries.',
                inputSchema: z.object({
                    queries: z.array(z.string()).describe('List of locations to search for, e.g., ["New York", "CA"]'),
                }),
                execute: async ({ queries }) => {
                    console.log(`[Tool] searchAreas queries:`, queries);
                    const areas = await readJsonFile<AreaRecord[]>('areas.json');
                    if (!areas) return [];

                    const allResults: AreaSearchResult[] = [];
                    const seen = new Set<string>();
                    const searchTerms = Array.isArray(queries) ? queries : [queries];

                    for (const query of searchTerms) {
                        const lowerQuery = String(query).toLowerCase();
                        // Smart matching: split "Austin, TX" -> ["austin", "tx"]
                        const queryTokens = lowerQuery.replace(/,/g, ' ').split(/\s+/).filter(t => t.length > 1);

                        // Exactish match first
                        let matches = areas.filter((area) => {
                            const areaStr = `${area.name} ${area.state}`.toLowerCase();
                            return queryTokens.every(token => areaStr.includes(token));
                        }).slice(0, 5);

                        // Fallback: if no matches, try matching just the first token (city name)
                        if (matches.length === 0 && queryTokens.length > 0) {
                            matches = areas.filter((area) => {
                                const areaStr = `${area.name} ${area.state}`.toLowerCase();
                                return areaStr.includes(queryTokens[0]);
                            }).slice(0, 3);
                        }

                        matches.forEach((area) => {
                            if (!seen.has(area.id)) {
                                seen.add(area.id);
                                allResults.push({ id: area.id, name: area.name, state: area.state, query });
                            }
                        });
                    }
                    return allResults.slice(0, 15);
                },
            }),
            getWageData: tool({
                description: 'Get wage data for occupation(s) and area(s). SUPPORTS BATCH: pass arrays to get all combinations (n×m) in one call. Much faster than multiple calls.',
                inputSchema: z.object({
                    socCodes: z.array(z.string()).describe('SOC codes to query, e.g., ["15-1252", "13-2011"]'),
                    areaIds: z.array(z.string()).optional().describe('Area IDs to query, e.g., ["41860", "35620"]. If omitted, returns top areas.'),
                    state: z.string().optional().describe('State abbreviation to filter by (alternative to areaIds), e.g., "CA"'),
                }),
                execute: async ({ socCodes, areaIds, state }) => {
                    const results: WageLookupResult[] = [];

                    for (const socCode of socCodes) {
                        const wageFile = `wages/${socCode}.json`;
                        const data = await readJsonFile<WageFile>(wageFile);

                        if (!data || !data.wages) {
                            results.push({ socCode, error: `No wage data found for SOC code ${socCode}` });
                            continue;
                        }

                        const formatWageSnapshot = (entry: WageEntry): WageSnapshot => ({
                            hourly: { l1: entry.l1, l2: entry.l2, l3: entry.l3, l4: entry.l4 },
                            annual: {
                                l1: Math.round(entry.l1 * 2080),
                                l2: Math.round(entry.l2 * 2080),
                                l3: Math.round(entry.l3 * 2080),
                                l4: Math.round(entry.l4 * 2080)
                            }
                        });

                        const wages = [...data.wages];

                        // Case 1: Specific area IDs (n×m)
                        if (areaIds && areaIds.length > 0) {
                            for (const areaId of areaIds) {
                                const specificArea = wages.find((w) => w.area_id === areaId);
                                if (specificArea) {
                                    results.push({ socCode, areaId, ...formatWageSnapshot(specificArea) });
                                } else {
                                    results.push({ socCode, areaId, error: `No data for area ${areaId}` });
                                }
                            }
                        }
                        // Case 2: State filter
                        else if (state) {
                            const areas = await readJsonFile<AreaRecord[]>('areas.json');
                            if (!areas) {
                                results.push({ socCode, state, error: `Area lookup failed for state ${state}` });
                                continue;
                            }
                            const stateAreas = new Set(areas.filter((a) => a.state === state).map((a) => a.id));

                            const stateWages = wages.filter((w) => stateAreas.has(w.area_id));
                            stateWages.sort((a, b) => b.l4 - a.l4);

                            stateWages.slice(0, 5).forEach((entry) => {
                                results.push({ socCode, areaId: entry.area_id, state, ...formatWageSnapshot(entry) });
                            });
                        }
                        // Case 3: Top areas nationally
                        else {
                            wages.sort((a, b) => b.l4 - a.l4);
                            wages.slice(0, 5).forEach((entry) => {
                                results.push({ socCode, areaId: entry.area_id, ...formatWageSnapshot(entry) });
                            });
                        }
                    }

                    return results;
                },
            }),
            findOptimalAreas: tool({
                description: 'Find cities where a given salary achieves a target wage level. Perfect for optimizing H-1B lottery odds. Returns paginated results (50 per page). City tiers: 1=Top metros (NYC/SF), 2=Major cities (Austin/Denver), 3=Normal metros, 4=Small/rural, 5=Puerto Rico.',
                inputSchema: z.object({
                    socCode: z.string().describe('The occupation SOC code, e.g., "15-1252"'),
                    annualSalary: z.number().describe('User\'s annual salary in USD, e.g., 117000'),
                    minLevel: z.number().optional().describe('Minimum wage level to filter (1-4). e.g., 2 means only show cities where salary reaches at least Level 2'),
                    minCityTier: z.number().optional().describe('Minimum city tier (1-5). Lower number = bigger city. e.g., 2 shows only top metros and major cities. Default: 2'),
                    state: z.string().optional().describe('Filter by state abbreviation, e.g., "TX"'),
                    page: z.number().optional().describe('Page number for pagination (default: 1)'),
                }),
                execute: async ({ socCode, annualSalary, minLevel, minCityTier = 2, state, page = 1 }) => {
                    const wageFile = `wages/${socCode}.json`;
                    const data = await readJsonFile<WageFile>(wageFile);

                    if (!data || !data.wages) {
                        return { error: `No wage data found for SOC code ${socCode}` };
                    }

                    // Load areas for name mapping
                    const areas = await readJsonFile<AreaRecord[]>('areas.json');
                    const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));

                    // Calculate level for each area
                    const areasWithLevel: AreaLevelInfo[] = data.wages.map((entry) => {
                        let level = 0;
                        if (annualSalary >= Math.round(entry.l4 * 2080)) level = 4;
                        else if (annualSalary >= Math.round(entry.l3 * 2080)) level = 3;
                        else if (annualSalary >= Math.round(entry.l2 * 2080)) level = 2;
                        else if (annualSalary >= Math.round(entry.l1 * 2080)) level = 1;

                        const areaInfo = areaMap.get(entry.area_id);
                        const info: AreaLevelInfo = {
                            areaId: entry.area_id,
                            name: areaInfo?.name || 'Unknown',
                            state: areaInfo?.state || 'Unknown',
                            cityTier: areaInfo?.tier || 3,
                            yourLevel: level,
                            thresholds: {
                                l1: Math.round(entry.l1 * 2080),
                                l2: Math.round(entry.l2 * 2080),
                                l3: Math.round(entry.l3 * 2080),
                                l4: Math.round(entry.l4 * 2080)
                            }
                        };
                        return info;
                    });

                    // Filter by minLevel
                    let filtered = areasWithLevel;
                    if (minLevel) {
                        filtered = filtered.filter((area) => area.yourLevel >= minLevel);
                    }

                    // Filter by cityTier
                    if (minCityTier) {
                        filtered = filtered.filter((area) => area.cityTier <= minCityTier);
                    }

                    // Filter by state
                    if (state) {
                        filtered = filtered.filter((area) => area.state === state.toUpperCase());
                    }

                    // Sort by level (descending), then by L1 threshold (ascending for easier targets)
                    filtered.sort((a, b) => {
                        if (b.yourLevel !== a.yourLevel) return b.yourLevel - a.yourLevel;
                        return a.thresholds.l1 - b.thresholds.l1;
                    });

                    // Pagination
                    const pageSize = 50;
                    const totalCount = filtered.length;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    const start = (page - 1) * pageSize;
                    const end = start + pageSize;
                    const results = filtered.slice(start, end);

                    return {
                        results,
                        totalCount,
                        currentPage: page,
                        totalPages,
                        hasMore: page < totalPages
                    };
                },
            }),
        },
    });

    return result.toUIMessageStreamResponse();
}
