
'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search as SearchIcon } from 'lucide-react';
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

interface SearchProps {
    onSelectOccupation: (soc: string) => void;
}

export function Search({ onSelectOccupation }: SearchProps) {
    const t = useTranslations('HomePage');
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState("15-1252"); // Default to Software Developers (15-1252)
    const [searchQuery, setSearchQuery] = React.useState(""); // Track search query
    const [occupations, setOccupations] = React.useState<Occupation[]>([]);

    React.useEffect(() => {
        fetch('/data/occupations.json')
            .then(res => res.json())
            .then(data => {
                setOccupations(data);
                // Trigger initial selection
                onSelectOccupation("15-1252");
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Limit to top 20 for performance and UI cleanliness, let CommandInput handle filtering logic if needed,
    // but standard Command component filters based on rendered items. 
    // To support "search finds others", all items should be in CommandList but we might want to lazy render or just rely on cmdk's virtualization if available.
    // However, user specifically asked: "Default 20... remaining expand or search". 
    // Standard cmdk is client-side filtering. If we pass all items to CommandItem, it might be heavy.
    // Let's pass all items but styling might be the issue.
    // Actually, cmdk filters automatically. The user wants to *see* only 20 initially?
    // CommandList usually shows all matches.
    // Let's fix the overlap first by adding `pt-10` or similar to CommandList or checking CommandInput positioning.

    // Fix overlap: standard shadcn CommandInput is inside Command, which is inside PopoverContent.
    // The overlap usually happens if CommandList doesn't have offset. 
    // shadcn/ui generic Command usually handles this, but let's check styles.
    // We will slice to 20 initially if no search? 
    // Actually, Command handles filtering. If we slice 20, search won't find the rest unless we handle filtering manually.
    // Strategy: Render ALL items (cmdk is fast) but maybe limit height?
    // User said: "default 20 occupations... remaining search".
    // This implies he wants to see a short list initially.
    // But for Search to work on client-side, we need the data there.
    // Let's stick to standard behavior but fix the CSS overlap which is critical.

    // manual filtering logic
    const filteredOccupations = React.useMemo(() => {
        if (!searchQuery) return occupations.slice(0, 20); // Default 20

        // Simple case-insensitive inclusion search
        const lowerQuery = searchQuery.toLowerCase();
        return occupations.filter(occ =>
            occ.title.toLowerCase().includes(lowerQuery) ||
            occ.code.includes(lowerQuery)
        );
    }, [occupations, searchQuery]);

    return (
        <div className="w-full max-w-sm">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {value
                            ? occupations.find((occ) => occ.code === value)?.title
                            : t('search_placeholder')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
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
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
