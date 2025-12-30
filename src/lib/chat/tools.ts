import { tool } from 'ai';
import { z } from 'zod';
import { readPublicDataJson } from './data';
import type {
    AreaLevelInfo,
    AreaRecord,
    AreaSearchResult,
    OccupationRecord,
    OccupationSearchResult,
    WageEntry,
    WageFile,
    WageLookupResult,
    WageSnapshot,
} from './types';

export function createChatTools() {
    return {
        searchOccupations: tool({
            description: 'Search for occupation codes (SOC) by job title keywords. Accepts a list of queries.',
            inputSchema: z.object({
                queries: z.array(z.string()).describe('List of job titles to search for, e.g., ["Software Engineer", "Data Scientist"]'),
            }),
            execute: async ({ queries }) => {
                console.log(`[Tool Execute] searchOccupations queries:`, queries);
                const occupations = await readPublicDataJson<OccupationRecord[]>('occupations.json');
                if (!occupations) return [];

                const allResults: OccupationSearchResult[] = [];
                const seen = new Set<string>();

                const searchTerms = Array.isArray(queries) ? queries : [queries];

                for (const query of searchTerms) {
                    const lowerQuery = String(query).toLowerCase();
                    const matches = occupations
                        .filter((occupation) => occupation.title.toLowerCase().includes(lowerQuery))
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
                const areas = await readPublicDataJson<AreaRecord[]>('areas.json');
                if (!areas) return [];

                const allResults: AreaSearchResult[] = [];
                const seen = new Set<string>();
                const searchTerms = Array.isArray(queries) ? queries : [queries];

                for (const query of searchTerms) {
                    const lowerQuery = String(query).toLowerCase();
                    // Smart matching: split "Austin, TX" -> ["austin", "tx"]
                    const queryTokens = lowerQuery.replace(/,/g, ' ').split(/\s+/).filter((token) => token.length > 1);

                    // Exactish match first
                    let matches = areas.filter((area) => {
                        const areaStr = `${area.name} ${area.state}`.toLowerCase();
                        return queryTokens.every((token) => areaStr.includes(token));
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
                    const data = await readPublicDataJson<WageFile>(wageFile);

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
                            l4: Math.round(entry.l4 * 2080),
                        },
                    });

                    const wages = [...data.wages];

                    // Case 1: Specific area IDs (n×m)
                    if (areaIds && areaIds.length > 0) {
                        for (const areaId of areaIds) {
                            const specificArea = wages.find((wage) => wage.area_id === areaId);
                            if (specificArea) {
                                results.push({ socCode, areaId, ...formatWageSnapshot(specificArea) });
                            } else {
                                results.push({ socCode, areaId, error: `No data for area ${areaId}` });
                            }
                        }
                    }
                    // Case 2: State filter
                    else if (state) {
                        const areas = await readPublicDataJson<AreaRecord[]>('areas.json');
                        if (!areas) {
                            results.push({ socCode, state, error: `Area lookup failed for state ${state}` });
                            continue;
                        }
                        const stateAreas = new Set(areas.filter((area) => area.state === state).map((area) => area.id));

                        const stateWages = wages.filter((wage) => stateAreas.has(wage.area_id));
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
                const data = await readPublicDataJson<WageFile>(wageFile);

                if (!data || !data.wages) {
                    return { error: `No wage data found for SOC code ${socCode}` };
                }

                // Load areas for name mapping
                const areas = await readPublicDataJson<AreaRecord[]>('areas.json');
                const areaMap = new Map((areas ?? []).map((area) => [area.id, area]));

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
                            l4: Math.round(entry.l4 * 2080),
                        },
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
                    hasMore: page < totalPages,
                };
            },
        }),
    };
}

export type ChatTools = ReturnType<typeof createChatTools>;
