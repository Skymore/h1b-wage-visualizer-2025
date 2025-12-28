
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from '@/components/Search';
import dynamic from 'next/dynamic';
import { WageDashboard } from '@/components/WageDashboard';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from "@/components/ui/input";

const MapView = dynamic(() => import('@/components/Map'), {
  loading: () => <div className="h-[600px] w-full rounded-md border bg-muted flex items-center justify-center">Loading Map...</div>,
  ssr: false
});

export default function Home() {
  const t = useTranslations('HomePage');
  // Search Params
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [wageData, setWageData] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  // Initialize state from URL or defaults
  const [selectedSoc, setSelectedSoc] = useState<string | null>(searchParams.get('soc'));
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedState, setSelectedState] = useState(searchParams.get('state') || 'ALL');

  // Update URL wrapper
  const updateUrl = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Fetch areas on mount
  useEffect(() => {
    fetch('/data/areas.json')
      .then(res => res.json())
      .then(setAreas);
  }, []);

  const [selectedSocTitle, setSelectedSocTitle] = useState<string>('');

  // Fetch wages when SOC is selected
  useEffect(() => {
    if (selectedSoc) {
      fetch(`/data/wages/${selectedSoc}.json`)
        .then(res => res.json())
        .then(data => setWageData(data.wages))
        .catch(err => console.error("Failed to load wages", err));
    }
  }, [selectedSoc]);

  const [occupations, setOccupations] = useState<any[]>([]);
  useEffect(() => {
    fetch('/data/occupations.json')
      .then(res => res.json())
      .then(data => {
        setOccupations(data);
      });
  }, []);

  useEffect(() => {
    if (selectedSoc && occupations.length > 0) {
      const occ = occupations.find(o => o.code === selectedSoc);
      if (occ) setSelectedSocTitle(occ.title);
    }
  }, [selectedSoc, occupations]);

  // Derived State: Filtered Wages
  const uniqueStates = useMemo(() => {
    const states = new Set(areas.map(a => a.state));
    return Array.from(states).sort();
  }, [areas]);

  const areaMap = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);

  const filteredWageData = useMemo(() => {
    if (!wageData) return [];

    let filtered = wageData;

    // 1. Filter by Search Query (Area Name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(row => {
        const area = areaMap.get(row.area_id);
        const name = area ? `${area.name}, ${area.state}` : row.area_id;
        return name.toLowerCase().includes(query);
      });
    }

    // 2. Filter by State
    if (selectedState !== 'ALL') {
      filtered = filtered.filter(row => {
        const area = areaMap.get(row.area_id);
        return area && area.state === selectedState;
      });
    }

    return filtered;
  }, [wageData, searchQuery, selectedState, areaMap]);

  // Calculate Min/Max wages for consistent coloring (using full dataset)
  const wageScale = useMemo(() => {
    if (!wageData || wageData.length === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    wageData.forEach(w => {
      // w.l2 is hourly, convert to annual approx for bounds or keep hourly.
      // Let's use hourly since that's what's in data, but map will likely show relative.
      if (w.l2 > 0) { // filter out zero
        if (w.l2 < min) min = w.l2;
        if (w.l2 > max) max = w.l2;
      }
    });
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [wageData]);

  // Handlers
  const handleSocSelect = (soc: string) => {
    setSelectedSoc(soc);
    updateUrl('soc', soc);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    updateUrl('q', val);
  };

  const handleStateChange = (val: string) => {
    setSelectedState(val);
    updateUrl('state', val);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 space-y-6">
      <header className="w-full max-w-7xl flex justify-end items-center py-4 px-4 space-x-2">
        <ThemeToggle />
        <LanguageSelector />
      </header>

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="w-full max-w-xl z-10">
        <Search onSelectOccupation={handleSocSelect} />
      </div>

      {selectedSoc && (
        <div className="w-full max-w-7xl bg-card border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center">
          <Input
            placeholder={t('search_locations')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="flex h-10 w-full md:w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
          >
            <option value="ALL">All States</option>
            {uniqueStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          <div className="text-sm text-muted-foreground ml-auto">
            Showing {filteredWageData.length} locations
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        <div className="w-full">
          <MapView wageData={filteredWageData} areas={areas} wageScale={wageScale} />
        </div>

        <div className="w-full">
          {selectedSoc && (
            <WageDashboard
              socCode={selectedSoc}
              socTitle={selectedSocTitle}
              wageData={filteredWageData}
              areas={areas}
            />
          )}
          {!selectedSoc && (
            <div className="flex bg-muted/30 h-[600px] items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">Select an occupation to view wages</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
