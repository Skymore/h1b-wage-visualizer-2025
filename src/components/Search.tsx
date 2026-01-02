
'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTranslations } from 'next-intl';

interface Occupation {
    code: string;
    title: string;
}

interface OccupationOption extends Occupation {
    titleLower: string;
}

interface SearchProps {
    onSelectOccupation: (soc: string) => void;
    selectedSoc?: string | null;
}

export function Search({ onSelectOccupation, selectedSoc }: SearchProps) {
    const t = useTranslations('HomePage');
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState<string | null>(selectedSoc ?? null);
    const [searchQuery, setSearchQuery] = React.useState(""); // Track search query
    const [occupations, setOccupations] = React.useState<OccupationOption[]>([]);
    const [isExpanded, setIsExpanded] = React.useState(false);

    React.useEffect(() => {
        fetch('/data/occupations.json')
            .then(res => res.json() as Promise<Occupation[]>)
            .then(data => {
                setOccupations(
                    data.map((occ) => ({
                        ...occ,
                        titleLower: occ.title.toLowerCase(),
                    }))
                );
            })
            .catch((error) => console.error('Failed to load occupations', error));
    }, []);

    React.useEffect(() => {
        setValue(selectedSoc ?? null);
    }, [selectedSoc]);

    const deferredQuery = React.useDeferredValue(searchQuery);
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    // manual filtering logic
    const filteredOccupations = React.useMemo(() => {
        if (!normalizedQuery) {
            return isExpanded ? occupations : occupations.slice(0, 20);
        }

        // Simple case-insensitive inclusion search
        return occupations.filter(occ =>
            occ.titleLower.includes(normalizedQuery) ||
            occ.code.includes(normalizedQuery)
        ); // if searching, show all matches
    }, [occupations, normalizedQuery, isExpanded]);

    return (
        <div className="w-full">
            <Popover open={open} onOpenChange={(val) => {
                setOpen(val);
                if (!val) {
                    setIsExpanded(false); // Reset expand on close
                    setSearchQuery("");
                }
            }}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost" // Changed from outline to ghost, manual styling below
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-12 text-base px-4 bg-background shadow-lg shadow-black/5 hover:bg-background/80 transition-all border-0 ring-1 ring-black/5"
                    >
                        <span className="truncate">
                            {value
                                ? occupations.find((occ) => occ.code === value)?.title
                                : t('search_placeholder')}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" avoidCollisions={false}>
                    {/* shouldFilter={false} to disable cmdk internal filtering since we do it manually */}
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder={t('search_placeholder')}
                            className="h-9"
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                        <CommandList>
                            <CommandEmpty>No occupation found.</CommandEmpty>
                            <CommandGroup>
                                {filteredOccupations.map((occ) => (
                                    <CommandItem
                                        key={occ.code}
                                        value={occ.title}
                                        onSelect={() => {
                                            setValue(occ.code);
                                            onSelectOccupation(occ.code);
                                            setOpen(false);
                                            setSearchQuery(""); // clear search on select
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === occ.code ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {occ.title}
                                        <span className="ml-2 text-xs text-muted-foreground">{occ.code}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>

                        {/* Expand Toggle (Only show if not searching and list is truncated) */}
                        {!searchQuery && (
                            <div className="p-2 border-t flex justify-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-8 text-xs"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                >
                                    {isExpanded ? (
                                        <><ChevronUp className="mr-2 h-3 w-3" /> {t('show_less')}</>
                                    ) : (
                                        <><ChevronDown className="mr-2 h-3 w-3" /> {t('show_all', { count: occupations.length - 20 })}</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
