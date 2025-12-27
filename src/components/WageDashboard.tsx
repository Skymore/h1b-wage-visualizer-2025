
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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
    const [sortKey, setSortKey] = useState<SortKey>('l2');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [isExpanded, setIsExpanded] = useState(false);
    // internal search removed, logic handled in parent

    // Create a map of Area ID to Name for easy lookup
    const areaMap = useMemo(() => new Map(areas.map(a => [a.id, `${a.name}, ${a.state}`])), [areas]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    const sortedData = useMemo(() => {
        // wageData is already filtered by parent
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
        <div className="space-y-6">
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
                                <TableRow key={row.area_id}>
                                    <TableCell className="font-medium text-sm">{areaMap.get(row.area_id) || row.area_id}</TableCell>
                                    <TableCell><WageCell hourly={row.l1} /></TableCell>
                                    <TableCell className="font-bold bg-muted/20"><WageCell hourly={row.l2} /></TableCell>
                                    <TableCell><WageCell hourly={row.l3} /></TableCell>
                                    <TableCell><WageCell hourly={row.l4} /></TableCell>
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
        </div>
    );
}
