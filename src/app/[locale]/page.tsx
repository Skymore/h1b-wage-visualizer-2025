
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { WelcomeDialog } from '@/components/FTUE/WelcomeDialog';
import { TourGuide } from '@/components/FTUE/TourGuide';

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
  const [selectedTiers, setSelectedTiers] = useState<number[]>([1, 2, 3]); // Default: Tier 1-3

  // FTUE State
  const [showWelcome, setShowWelcome] = useState(false);
  const [startTour, setStartTour] = useState(false);

  useEffect(() => {
    // Debug: Reset FTUE if query param present
    if (searchParams.get('reset-ftue') === 'true') {
      localStorage.removeItem('hasSeenFTUE');
      // Clean URL without reloading
      const params = new URLSearchParams(searchParams.toString());
      params.delete('reset-ftue');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      // Force state update to show welcome
      setShowWelcome(true);
      return;
    }

    // Check if user has seen FTUE
    const hasSeen = localStorage.getItem('hasSeenFTUE');
    if (!hasSeen) {
      // Small delay to ensure loading is done
      const timer = setTimeout(() => setShowWelcome(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleStartTour = () => {
    setShowWelcome(false);
    // Wait for dialog exit animation
    setTimeout(() => {
      setStartTour(true);
    }, 500);
    localStorage.setItem('hasSeenFTUE', 'true');
  };

  const handleSkipWelcome = (open: boolean) => {
    if (!open) {
      setShowWelcome(false);
      localStorage.setItem('hasSeenFTUE', 'true');
    }
  };

  const handleTourEnd = () => {
    setStartTour(false);
    localStorage.setItem('hasSeenFTUE', 'true');
  };

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

    // 3. Filter by City Tier
    if (selectedTiers.length > 0 && selectedTiers.length < 5) {
      filtered = filtered.filter(row => {
        const area = areaMap.get(row.area_id);
        return area && area.tier && selectedTiers.includes(area.tier);
      });
    }

    return filtered;
  }, [wageData, searchQuery, selectedState, selectedTiers, areaMap]);

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

  const handleTierToggle = (tier: number) => {
    setSelectedTiers(prev =>
      prev.includes(tier)
        ? prev.filter(t => t !== tier)
        : [...prev, tier].sort()
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 space-y-6">
      <WelcomeDialog
        isOpen={showWelcome}
        onOpenChange={handleSkipWelcome}
        onStartTour={handleStartTour}
      />
      <TourGuide
        startTour={startTour}
        onTourEnd={handleTourEnd}
      />

      <header className="w-full max-w-7xl flex justify-end items-center py-4 px-4 space-x-2">
        <ThemeToggle />
        <LanguageSelector />
      </header>

      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div id="search-bar" className="w-full max-w-xl z-10">
        <Search onSelectOccupation={handleSocSelect} />
      </div>

      {selectedSoc && (
        <div id="location-filters" className="w-full max-w-7xl bg-card border rounded-lg p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <Input
              placeholder={t('search_locations')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedState} onValueChange={handleStateChange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('all_states')}</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">
              Showing {filteredWageData.length} locations
            </div>
          </div>

          {/* City Tier Filter */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
            <span className="text-sm font-medium">{t('city_size')}</span>
            {[
              { tier: 1, label: t('tier_1') },
              { tier: 2, label: t('tier_2') },
              { tier: 3, label: t('tier_3') },
              { tier: 4, label: t('tier_4') },
              { tier: 5, label: t('tier_5') }
            ].map(({ tier, label }) => (
              <label key={tier} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedTiers.includes(tier)}
                  onCheckedChange={() => handleTierToggle(tier)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        <div id="map-view" className="w-full">
          <MapView wageData={filteredWageData} areas={areas} wageScale={wageScale} />
        </div>

        <div id="wage-dashboard" className="w-full">
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
