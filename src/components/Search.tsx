
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
    const [value, setValue] = React.useState("");
    const [occupations, setOccupations] = React.useState<Occupation[]>([]);

    React.useEffect(() => {
        fetch('/data/occupations.json')
            .then(res => res.json())
            .then(data => setOccupations(data));
    }, []);

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
                    <Command>
                        <CommandInput placeholder={t('search_placeholder')} />
                        <CommandList>
                            <CommandEmpty>No occupation found.</CommandEmpty>
                            <CommandGroup>
                                {occupations.map((occ) => (
                                    <CommandItem
                                        key={occ.code}
                                        value={occ.title}
                                        onSelect={(currentValue) => {
                                            // CommandItem value is lowercase usually, need to match back
                                            // But here we use title as value for filtering.
                                            // We need to find the code.
                                            // Note: cmdk usually normalizes values.

                                            // A safer way:
                                            setValue(occ.code);
                                            onSelectOccupation(occ.code);
                                            setOpen(false);
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
