
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShareDialog } from "./ShareDialog";

interface WageRecord {
    area_id: string;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
}

interface Area {
    id: string;
    name: string;
    state: string;
}

type SortKey = 'area' | 'l1' | 'l2' | 'l3' | 'l4';
type SortDirection = 'asc' | 'desc';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function WageDashboard({
    socCode,
    socTitle,
    wageData,
    areas
}: {
    socCode: string,
    socTitle?: string,
    wageData: WageRecord[],
    areas: Area[]
}) {
    const t = useTranslations('HomePage');
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Parse URL params or default
    const urlSort = (searchParams.get('sort') as SortKey) || 'l2';
    const urlOrder = (searchParams.get('order') as SortDirection) || 'desc';
    const urlSelectedRaw = searchParams.get('selected');
    const urlSelected = urlSelectedRaw ? new Set(urlSelectedRaw.split(',')) : new Set<string>();

    // Local state (that syncs from URL initially, but we will drive from URL now ideally,
    // or keep local state and sync to URL. Let's sync local state to URL updates or just use URL as truth?
    // Using URL as truth avoids double state. But lets keep local wrappers for easier set logic.
    // Actually best pattern: Derived from URL, setters update URL.

    // We will use URL as Single Source of Truth for Sort/Order/Selected
    // But for 'isExpanded' and 'isShareOpen' we keep local.

    const sortKey = urlSort;
    const sortDirection = urlOrder;
    const selectedAreas = urlSelected;

    // UI Local State
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Helper to update URL
    const updateUrl = (newParams: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(newParams).forEach(([k, v]) => {
            if (v) params.set(k, v);
            else params.delete(k);
        });
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // Create a map of Area ID to Name for easy lookup
    const areaMap = useMemo(() => new Map(areas.map(a => [a.id, `${a.name}, ${a.state}`])), [areas]);

    const handleSort = (key: SortKey) => {
        let newDirection: SortDirection = 'desc';
        if (sortKey === key) {
            newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        }
        updateUrl({ sort: key, order: newDirection });
    };

    const toggleSelection = (areaId: string) => {
        const newSet = new Set(selectedAreas);
        if (newSet.has(areaId)) {
            newSet.delete(areaId);
        } else {
            if (newSet.size >= 4) return; // Limit to 4
            newSet.add(areaId);
        }

        const selectedStr = newSet.size > 0 ? Array.from(newSet).join(',') : null;
        updateUrl({ selected: selectedStr });
    };

    const clearSelection = () => {
        updateUrl({ selected: null });
    };

    const selectedWageData = useMemo(() => {
        return wageData.filter(w => selectedAreas.has(w.area_id));
    }, [wageData, selectedAreas]);

    const sortedData = useMemo(() => {
        return [...wageData].sort((a, b) => {
            let valA: any = a[sortKey as keyof WageRecord];
            let valB: any = b[sortKey as keyof WageRecord];

            if (sortKey === 'area') {
                valA = areaMap.get(a.area_id) || a.area_id;
                valB = areaMap.get(b.area_id) || b.area_id;
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            // Numeric Sort
            valA = a[sortKey as keyof WageRecord];
            valB = b[sortKey as keyof WageRecord];
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
    }, [wageData, sortKey, sortDirection, areaMap]);

    const displayData = isExpanded ? sortedData : sortedData.slice(0, 20);

    const SortIcon = ({ active }: { active: boolean }) => (
        <ArrowUpDown className={`ml-2 h-4 w-4 ${active ? 'opacity-100' : 'opacity-30'}`} />
    );

    const formatWageK = (hourly: number) => {
        const annual = Math.round(hourly * 2080);
        return `$${Math.round(annual / 1000)}k`;
    };

    const formatWageFull = (hourly: number) => {
        return `$${Math.round(hourly * 2080).toLocaleString()}`;
    };

    const WageCell = ({ hourly }: { hourly: number }) => (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
                    {formatWageK(hourly)}
                </TooltipTrigger>
                <TooltipContent>
                    <p>{formatWageFull(hourly)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    if (!wageData) return null; // Accept empty array

    return (
        <div className="space-y-6 relative pb-16">
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span className="text-lg">{t('wages_for', { soc: socTitle ? `${socTitle} (${socCode})` : socCode, area: 'US' }).split(' in ')[0]}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                            {t('records_found', { count: wageData.length })}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex justify-center items-center h-full w-full cursor-help hover:bg-muted/50 rounded-md transition-colors">
                                                    <ListChecks className="h-4 w-4 opacity-50" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{t('select_to_compare')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableHead>
                                <TableHead onClick={() => handleSort('area')} className="cursor-pointer hover:bg-muted/50 transition-colors w-[20%] min-w-[150px] text-sm">
                                    <div className="flex items-center">{t('area')} <SortIcon active={sortKey === 'area'} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l1')} className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap text-sm">
                                    <div className="flex items-center">{t('level_1')} <SortIcon active={sortKey === 'l1'} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l2')} className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap text-sm">
                                    <div className="flex items-center">{t('level_2')} <SortIcon active={sortKey === 'l2'} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l3')} className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap text-sm">
                                    <div className="flex items-center">{t('level_3')} <SortIcon active={sortKey === 'l3'} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l4')} className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap text-sm">
                                    <div className="flex items-center">{t('level_4')} <SortIcon active={sortKey === 'l4'} /></div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayData.map((row) => (
                                <TableRow key={row.area_id} data-state={selectedAreas.has(row.area_id) ? "selected" : ""}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-primary cursor-pointer align-middle"
                                            checked={selectedAreas.has(row.area_id)}
                                            onChange={() => toggleSelection(row.area_id)}
                                            disabled={!selectedAreas.has(row.area_id) && selectedAreas.size >= 4}
                                        />
                                    </TableCell>
                                    <TableCell className={`font-medium text-sm ${sortKey === 'area' ? "font-bold bg-muted/20" : ""}`}>{areaMap.get(row.area_id) || row.area_id}</TableCell>
                                    <TableCell className={sortKey === 'l1' ? "font-bold bg-muted/20" : ""}><WageCell hourly={row.l1} /></TableCell>
                                    <TableCell className={sortKey === 'l2' ? "font-bold bg-muted/20" : ""}><WageCell hourly={row.l2} /></TableCell>
                                    <TableCell className={sortKey === 'l3' ? "font-bold bg-muted/20" : ""}><WageCell hourly={row.l3} /></TableCell>
                                    <TableCell className={sortKey === 'l4' ? "font-bold bg-muted/20" : ""}><WageCell hourly={row.l4} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {wageData.length > 20 && (
                        <div className="mt-4 flex justify-center">
                            <Button variant="outline" onClick={() => setIsExpanded(!isExpanded)} className="w-full max-w-xs">
                                {isExpanded ? (
                                    <><ChevronUp className="mr-2 h-4 w-4" /> {t('show_less')}</>
                                ) : (
                                    <><ChevronDown className="mr-2 h-4 w-4" /> {t('show_all', { count: wageData.length - 20 })}</>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedAreas.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-full shadow-xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
                    <span className="text-sm font-medium whitespace-nowrap">
                        {t('selected_count', { count: selectedAreas.size })}
                    </span>
                    <Button
                        size="sm"
                        onClick={() => setIsShareOpen(true)}
                        className="rounded-full bg-background text-foreground hover:bg-background/90"
                    >
                        {t('generate_comparison')}
                    </Button>
                    <button
                        onClick={clearSelection}
                        className="ml-2 text-xs opacity-70 hover:opacity-100"
                    >
                        {t('clear')}
                    </button>
                </div>
            )}

            <ShareDialog
                open={isShareOpen}
                onOpenChange={setIsShareOpen}
                selectedData={selectedWageData}
                areas={areas}
                socCode={socCode}
                socTitle={socTitle}
            />
        </div>
    );
}
