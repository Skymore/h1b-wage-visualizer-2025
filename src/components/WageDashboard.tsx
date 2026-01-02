
'use client';

import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState, useMemo, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ListChecks, ChevronUp, ChevronDown } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShareDialog } from "./ShareDialog";
import Link from 'next/link';
import { toSlug } from '@/lib/utils';

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
type WageLevelKey = Exclude<SortKey, 'area'>;

import { useSearchParams, usePathname, useRouter } from 'next/navigation';

const formatWageK = (hourly: number) => {
    const annual = Math.round(hourly * 2080);
    return `$${Math.round(annual / 1000)}k`;
};

const formatWageFull = (hourly: number) => {
    return `$${Math.round(hourly * 2080).toLocaleString()}`;
};

const coarsePointerQuery = "(pointer: coarse)";

const detectTouchDevice = () => {
    if (typeof window === "undefined") return false;
    const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    if (typeof window.matchMedia !== "function") {
        return hasTouchPoints;
    }
    const mediaQuery = window.matchMedia(coarsePointerQuery);
    return hasTouchPoints || mediaQuery.matches;
};

const useIsTouchDevice = () => {
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const updateTouchStatus = () => {
            setIsTouchDevice(detectTouchDevice());
        };

        updateTouchStatus();

        if (typeof window.matchMedia !== "function") {
            return;
        }

        const mediaQuery = window.matchMedia(coarsePointerQuery);
        const handleChange = (event: MediaQueryListEvent) => {
            const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
            setIsTouchDevice(event.matches || hasTouchPoints);
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange);
        } else if (typeof mediaQuery.addListener === "function") {
            mediaQuery.addListener(handleChange);
        }

        return () => {
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", handleChange);
            } else if (typeof mediaQuery.removeListener === "function") {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    return isTouchDevice;
};

const SortIcon = ({ active, direction }: { active: boolean, direction?: SortDirection }) => {
    if (!active) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return direction === 'asc'
        ? <ArrowUp className="ml-2 h-4 w-4 text-primary" />
        : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

const WageCell = ({ hourly, usePopover = false }: { hourly: number, usePopover?: boolean }) => {
    const triggerClassName = "inline-flex cursor-help underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm";

    if (usePopover) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <span
                        className={triggerClassName}
                        tabIndex={0}
                        role="button"
                        aria-haspopup="dialog"
                    >
                        {formatWageK(hourly)}
                    </span>
                </PopoverTrigger>
                <PopoverContent
                    align="center"
                    side="top"
                    className="w-auto px-3 py-2 text-sm"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                >
                    <p>{formatWageFull(hourly)}</p>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={triggerClassName}
                        tabIndex={0}
                        role="button"
                    >
                        {formatWageK(hourly)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{formatWageFull(hourly)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

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
    const isTouchDevice = useIsTouchDevice();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Parse URL params or default
    const urlSort = (searchParams.get('sort') as SortKey) || 'l2';
    const urlOrder = (searchParams.get('order') as SortDirection) || 'desc';
    const urlSelectedRaw = searchParams.get('selected');
    const selectedAreaIds = useMemo(() => {
        if (!urlSelectedRaw) return [] as string[];
        return urlSelectedRaw.split(',').filter(Boolean);
    }, [urlSelectedRaw]);

    // Local state (that syncs from URL initially, but we will drive from URL now ideally,
    // or keep local state and sync to URL. Let's sync local state to URL updates or just use URL as truth?
    // Using URL as truth avoids double state. But lets keep local wrappers for easier set logic.
    // Actually best pattern: Derived from URL, setters update URL.

    // We will use URL as Single Source of Truth for Sort/Order/Selected
    // But for 'isExpanded' and 'isShareOpen' we keep local.

    const sortKey = urlSort;
    const sortDirection = urlOrder;
    const selectedAreas = useMemo(() => new Set<string>(selectedAreaIds), [selectedAreaIds]);

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
        if (selectedAreaIds.length === 0) return [];
        const selection = new Set(selectedAreaIds);
        return wageData.filter(w => selection.has(w.area_id));
    }, [wageData, selectedAreaIds]);

    const sortedData = useMemo(() => {
        return [...wageData].sort((a, b) => {
            if (sortKey === 'area') {
                const areaA = areaMap.get(a.area_id) || a.area_id;
                const areaB = areaMap.get(b.area_id) || b.area_id;
                return sortDirection === 'asc' ? areaA.localeCompare(areaB) : areaB.localeCompare(areaA);
            }

            const numericKey = sortKey as WageLevelKey;
            const valA = a[numericKey];
            const valB = b[numericKey];
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });
    }, [wageData, sortKey, sortDirection, areaMap]);

    const displayData = isExpanded ? sortedData : sortedData.slice(0, 20);

    if (!wageData) return null; // Accept empty array

    return (
        <div className="space-y-6 relative pb-16">
            <Card className="border-0 shadow-none bg-transparent">
                {selectedAreas.size > 0 && (
                    <div className="mb-4">
                        {/* Placeholder for potential future controls or just empty if not needed */}
                    </div>
                )
                }

                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/40 sticky top-0 z-10 backdrop-blur-sm">
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead id="compare-col-header" className="w-[50px] text-center">
                                    <TooltipProvider delayDuration={50}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex justify-center items-center h-full w-full cursor-help opacity-50 hover:opacity-100 transition-opacity">
                                                    <ListChecks className="h-4 w-4" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p>{t('select_to_compare')}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </TableHead>
                                <TableHead onClick={() => handleSort('area')} className="cursor-pointer hover:text-primary transition-colors py-4 whitespace-nowrap">
                                    <div className={`flex items-center gap-1 font-semibold flex-nowrap ${sortKey === 'area' ? 'text-primary' : ''}`}>{t('area')} <SortIcon active={sortKey === 'area'} direction={sortDirection as SortDirection} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l1')} className="cursor-pointer hover:text-primary transition-colors text-right py-4 whitespace-nowrap px-2">
                                    <div className={`flex items-center justify-end gap-1 font-semibold flex-nowrap ${sortKey === 'l1' ? 'text-primary' : ''}`} title={t('level_1')}>L1 <SortIcon active={sortKey === 'l1'} direction={sortDirection as SortDirection} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l2')} className="cursor-pointer hover:text-primary transition-colors text-right py-4 whitespace-nowrap px-2">
                                    <div className={`flex items-center justify-end gap-1 font-semibold flex-nowrap ${sortKey === 'l2' ? 'text-primary' : ''}`} title={t('level_2')}>L2 <SortIcon active={sortKey === 'l2'} direction={sortDirection as SortDirection} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l3')} className="cursor-pointer hover:text-primary transition-colors text-right py-4 whitespace-nowrap px-2">
                                    <div className={`flex items-center justify-end gap-1 font-semibold flex-nowrap ${sortKey === 'l3' ? 'text-primary' : ''}`} title={t('level_3')}>L3 <SortIcon active={sortKey === 'l3'} direction={sortDirection as SortDirection} /></div>
                                </TableHead>
                                <TableHead onClick={() => handleSort('l4')} className="cursor-pointer hover:text-primary transition-colors text-right py-4 whitespace-nowrap px-2">
                                    <div className={`flex items-center justify-end gap-1 font-semibold flex-nowrap ${sortKey === 'l4' ? 'text-primary' : ''}`} title={t('level_4')}>L4 <SortIcon active={sortKey === 'l4'} direction={sortDirection as SortDirection} /></div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayData.map((row) => (
                                <TableRow
                                    key={row.area_id}
                                    data-state={selectedAreas.has(row.area_id) ? "selected" : ""}
                                    className="transition-colors hover:bg-muted/40 data-[state=selected]:bg-primary/5"
                                >
                                    <TableCell className="text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-primary cursor-pointer align-middle rounded border-gray-300"
                                            checked={selectedAreas.has(row.area_id)}
                                            onChange={() => toggleSelection(row.area_id)}
                                            disabled={!selectedAreas.has(row.area_id) && selectedAreas.size >= 4}
                                        />
                                    </TableCell>
                                    <TableCell className={`font-medium ${sortKey === 'area' ? "text-primary font-bold bg-muted/10" : "text-foreground"}`}>
                                        {socTitle ? (
                                            <Link
                                                href={`/${pathname.split('/').filter(Boolean)[0] || 'en'}/salary/${toSlug(socTitle)}/${toSlug(areaMap.get(row.area_id) || row.area_id)}`}
                                                className="hover:underline hover:text-primary transition-colors block py-1"
                                                title={`View salary details for ${socTitle} in ${areaMap.get(row.area_id) || row.area_id}`}
                                            >
                                                {areaMap.get(row.area_id) || row.area_id}
                                            </Link>
                                        ) : (
                                            areaMap.get(row.area_id) || row.area_id
                                        )}
                                    </TableCell>
                                    <TableCell className={`text-right ${sortKey === 'l1' ? "font-bold bg-muted/10" : ""}`}><WageCell hourly={row.l1} usePopover={isTouchDevice} /></TableCell>
                                    <TableCell className={`text-right ${sortKey === 'l2' ? "font-bold bg-muted/10" : ""}`}><WageCell hourly={row.l2} usePopover={isTouchDevice} /></TableCell>
                                    <TableCell className={`text-right ${sortKey === 'l3' ? "font-bold bg-muted/10" : ""}`}><WageCell hourly={row.l3} usePopover={isTouchDevice} /></TableCell>
                                    <TableCell className={`text-right ${sortKey === 'l4' ? "font-bold bg-muted/10" : ""}`}><WageCell hourly={row.l4} usePopover={isTouchDevice} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {wageData.length > 20 && (
                        <div className="p-4 flex justify-center border-t bg-muted/10">
                            <Button variant="ghost" onClick={() => setIsExpanded(!isExpanded)} className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? (
                                    <><ChevronUp className="mr-2 h-4 w-4" /> {t('show_less')}</>
                                ) : (
                                    <><ChevronDown className="mr-2 h-4 w-4" /> {t('show_all', { count: wageData.length - 20 })}</>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </Card >

            {
                selectedAreas.size > 0 && (
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
                )
            }

            < ShareDialog
                open={isShareOpen}
                onOpenChange={setIsShareOpen}
                selectedData={selectedWageData}
                areas={areas}
                socCode={socCode}
                socTitle={socTitle}
            />
        </div >
    );
}
