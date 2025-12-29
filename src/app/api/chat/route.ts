
// Disable AI SDK warnings - must be set before any AI SDK imports
if (typeof globalThis !== 'undefined') {
    (globalThis as any).AI_SDK_LOG_WARNINGS = false;
}

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { rateLimit } from '@/lib/rate-limit';

// Configure OpenRouter
const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

// Helper to read JSON files
async function readJsonFile(relativePath: string) {
    const filePath = path.join(process.cwd(), 'public/data', relativePath);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading file ${relativePath}:`, error);
        return null;
    }
}

// Custom converter to handle UIMessage -> CoreMessage
function convertToCoreMessages(messages: any[]): any[] {
    return messages.map((m) => {
        // If it's already a CoreMessage (has strictly string/array content and no parts), return it.
        // But UIMessages usually have parts.

        // 1. Handle User Messages
        if (m.role === 'user') {
            // Map parts to CoreMessage content
            // UIMessage parts: { type: 'text', text: string } | { type: 'file' ... }
            // CoreMessage content: string | Array<{ type: 'text', text: string } | ...>
            if (m.parts) {
                const content = m.parts.map((part: any) => {
                    if (part.type === 'text') return { type: 'text', text: part.text };
                    // Handle other parts if needed (files, etc) - for now just text
                    return null;
                }).filter(Boolean);
                return { role: 'user', content };
            }
            // Fallback if content string exists
            return { role: 'user', content: m.content || '' };
        }

        // 2. Handle Assistant Messages
        if (m.role === 'assistant') {
            const content: any[] = [];
            const toolCalls: any[] = [];

            if (m.parts) {
                m.parts.forEach((part: any) => {
                    if (part.type === 'text') {
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

            const message: any = { role: 'assistant', content };
            if (toolCalls.length > 0) {
                message.toolCalls = toolCalls;
            }
            return message;
        }

        // 3. Handle Tool Messages
        if (m.role === 'tool') {
            // UIMessage for tool results might differ. 
            // CoreToolMessage: { role: 'tool', content: [ { type: 'tool-result', toolCallId, result } ] }
            // Let's assume input messages might contain tool results. 
            // However, useChat usually keeps a flat list where assistant has toolCalls, and subsequent messages are tool results.
            // In UIMessage, tool results are often embedded or separate.
            // If standard UIMessage has tool parts with 'result', we might need to look at that.
            // BUT, the error was on a USER message. 
            // Let's focus on passing mostly user/assistant text correctly. 

            // If m.content is array of tool results:
            return { role: 'tool', content: m.content };
        }

        return m;
    });
}

export async function POST(req: Request) {
    // 1. Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (!rateLimit.check(ip)) {
        return new Response('Too Many Requests', { status: 429 });
    }

    const payload = await req.json();
    const { messages } = payload;

    console.log('[Chat] Last message:', JSON.stringify(messages[messages.length - 1], null, 2));

    // Custom conversion
    const coreMessages = convertToCoreMessages(messages);
    console.log('[Chat] Last converted:', JSON.stringify(coreMessages[coreMessages.length - 1], null, 2));

    // 2. Stream Text with Tools
    const modelName = 'google/gemini-3-flash-preview';
    const maxSteps = 10;
    console.log('[Chat] Using model:', modelName);

    // Load popular occupations for context
    const occupationsData = await readJsonFile('occupations.json');
    const occupationsList = occupationsData
        ? occupationsData
            .filter((o: any) => o.isPopular)
            .map((o: any) => `- ${o.code}: ${o.title}`).join('\n')
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
5. Call getWageData in PARALLEL if needed.
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
                    const occupations = await readJsonFile('occupations.json');
                    if (!occupations) return [];

                    let allResults: any[] = [];
                    const seen = new Set();

                    // Handle single string case just in case
                    const searchTerms = Array.isArray(queries) ? queries : [queries];

                    for (const q of searchTerms) {
                        const lowerQuery = String(q).toLowerCase();
                        const matches = occupations
                            .filter((occ: any) => occ.title.toLowerCase().includes(lowerQuery))
                            .slice(0, 5);

                        matches.forEach((m: any) => {
                            if (!seen.has(m.code)) {
                                seen.add(m.code);
                                allResults.push({ code: m.code, title: m.title, count: m.count, query: q });
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
                    const areas = await readJsonFile('areas.json');
                    if (!areas) return [];

                    let allResults: any[] = [];
                    const seen = new Set();
                    const searchTerms = Array.isArray(queries) ? queries : [queries];

                    for (const q of searchTerms) {
                        const lowerQuery = String(q).toLowerCase();
                        // Smart matching: split "Austin, TX" -> ["austin", "tx"]
                        const queryTokens = lowerQuery.replace(/,/g, ' ').split(/\s+/).filter(t => t.length > 1);

                        // Exactish match first
                        let matches = areas.filter((area: any) => {
                            const areaStr = `${area.name} ${area.state}`.toLowerCase();
                            return queryTokens.every(token => areaStr.includes(token));
                        }).slice(0, 5);

                        // Fallback: if no matches, try matching just the first token (city name)
                        if (matches.length === 0 && queryTokens.length > 0) {
                            matches = areas.filter((area: any) => {
                                const areaStr = `${area.name} ${area.state}`.toLowerCase();
                                return areaStr.includes(queryTokens[0]);
                            }).slice(0, 3);
                        }

                        matches.forEach((a: any) => {
                            if (!seen.has(a.id)) {
                                seen.add(a.id);
                                allResults.push({ id: a.id, name: a.name, state: a.state, query: q });
                            }
                        });
                    }
                    return allResults.slice(0, 15);
                },
            }),
            getWageData: tool({
                description: 'Get wage data for a specific occupation code (SOC). Returns both hourly and calculated ANNUAL wages.',
                inputSchema: z.object({
                    socCode: z.string().describe('The occupation SOC code, e.g., "15-1132"'),
                    areaId: z.string().optional().describe('Specific Area ID to filter by'),
                    state: z.string().optional().describe('State abbreviation to filter by, e.g., "CA"'),
                }),
                execute: async ({ socCode, areaId, state }) => {
                    const wageFile = `wages/${socCode}.json`;
                    const data = await readJsonFile(wageFile);

                    if (!data || !data.wages) {
                        return { error: `No wage data found for SOC code ${socCode}` };
                    }

                    // Helper to enrich with annual data
                    const enrich = (w: any) => ({
                        area_id: w.area_id,
                        hourly: { l1: w.l1, l2: w.l2, l3: w.l3, l4: w.l4 },
                        annual: {
                            l1: Math.round(w.l1 * 2080),
                            l2: Math.round(w.l2 * 2080),
                            l3: Math.round(w.l3 * 2080),
                            l4: Math.round(w.l4 * 2080)
                        }
                    });

                    let wages = data.wages;

                    if (areaId) {
                        const specificArea = wages.find((w: any) => w.area_id === areaId);
                        return specificArea ? { ...enrich(specificArea), socCode } : { error: `No data for area ${areaId} in SOC ${socCode}` };
                    }

                    if (state) {
                        const areas = await readJsonFile('areas.json');
                        const stateAreas = new Set(areas.filter((a: any) => a.state === state).map((a: any) => a.id));

                        wages = wages.filter((w: any) => stateAreas.has(w.area_id));
                        wages.sort((a: any, b: any) => b.l4 - a.l4);
                        return {
                            socCode,
                            state,
                            count: wages.length,
                            top_wages: wages.slice(0, 5).map(enrich),
                            note: "Showing top 5 paying areas in this state"
                        };
                    }

                    wages.sort((a: any, b: any) => b.l4 - a.l4);
                    return {
                        socCode,
                        count: wages.length,
                        top_national_wages: wages.slice(0, 5).map(enrich),
                        note: "Showing top 5 paying areas nationally"
                    };
                },
            }),
        },
    });

    return result.toUIMessageStreamResponse();
}
