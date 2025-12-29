
'use client';

import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from '@/components/Search';
import dynamic from 'next/dynamic';
import { WageDashboard } from '@/components/WageDashboard';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from 'next/link';
import { Github, Linkedin, Activity, Briefcase } from 'lucide-react';
import { getOrCreateVisitorId } from '@/lib/visitor.client';

import { WelcomeDialog } from '@/components/FTUE/WelcomeDialog';
import { TourGuide } from '@/components/FTUE/TourGuide';

type WageRow = {
  area_id: string;
  l1: number;
  l2: number;
  l3: number;
  l4: number;
};

type Area = {
  id: string;
  name: string;
  state: string;
  lat?: number;
  lon?: number;
  tier?: number;
};

type Occupation = {
  code: string;
  title: string;
  count: number;
  isPopular?: boolean;
};

const MapView = dynamic(() => import('@/components/Map'), {
  loading: () => <div className="h-[600px] w-full rounded-md border bg-muted flex items-center justify-center">Loading Map...</div>,
  ssr: false
});

export default function HomePage() {
  const t = useTranslations('HomePage');
  // Search Params
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const localeSegment = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments[0] ?? 'en';
  }, [pathname]);
  const metricsHref = `/${localeSegment}/metrics`;

  const [wageData, setWageData] = useState<WageRow[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Initialize state from URL or defaults
  const [selectedSoc, setSelectedSoc] = useState<string | null>(searchParams.get('soc'));
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const deferredLocationQuery = useDeferredValue(searchQuery);
  const externalLinks = [
    {
      href: 'https://github.com/Skymore/h1b-wage-visualizer-2025',
      label: 'GitHub',
      icon: Github,
    },
    {
      href: 'https://www.linkedin.com/in/ruit/',
      label: 'LinkedIn',
      icon: Linkedin,
    },
    {
      href: 'https://ruit.me/',
      label: 'Portfolio',
      icon: Briefcase,
    },
  ] as const;
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
      const frameId = requestAnimationFrame(() => setShowWelcome(true));
      return () => cancelAnimationFrame(frameId);
    }

    // Check if user has seen FTUE
    const hasSeen = localStorage.getItem('hasSeenFTUE');
    if (!hasSeen) {
      // Small delay to ensure loading is done
      const timer = setTimeout(() => setShowWelcome(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const id = getOrCreateVisitorId();
    if (!id) return;

    fetch('/api/metrics/visit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ visitorId: id })
    }).catch((error) => console.error('Failed to record visit', error));
  }, []);

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
  const updateUrl = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const urlLocationQuery = searchParams.get('q') || '';

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSearchQuery(urlLocationQuery));
    return () => cancelAnimationFrame(frame);
  }, [urlLocationQuery]);

  useEffect(() => {
    if (searchQuery === urlLocationQuery) return;
    const timeout = window.setTimeout(() => {
      updateUrl('q', searchQuery ? searchQuery : null);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, urlLocationQuery, updateUrl]);

  // Fetch areas on mount
  useEffect(() => {
    fetch('/data/areas.json')
      .then(res => res.json() as Promise<Area[]>)
      .then(setAreas)
      .catch((error) => console.error('Failed to load areas', error));
  }, []);

  // Fetch wages when SOC is selected
  useEffect(() => {
    if (!selectedSoc) {
      const frameId = requestAnimationFrame(() => setWageData([]));
      return () => cancelAnimationFrame(frameId);
    }

    let isCancelled = false;
    fetch(`/data/wages/${selectedSoc}.json`)
      .then(res => res.json() as Promise<{ wages: WageRow[] }>)
      .then(data => {
        if (!isCancelled) {
          setWageData(data.wages || []);
        }
      })
      .catch(err => console.error("Failed to load wages", err));

    return () => {
      isCancelled = true;
    };
  }, [selectedSoc]);

  const [occupations, setOccupations] = useState<Occupation[]>([]);
  useEffect(() => {
    fetch('/data/occupations.json')
      .then(res => res.json() as Promise<Occupation[]>)
      .then(data => {
        setOccupations(data);
      })
      .catch((error) => console.error('Failed to load occupations', error));
  }, []);

  const selectedSocTitle = useMemo(() => {
    if (!selectedSoc) return undefined;
    return occupations.find(o => o.code === selectedSoc)?.title;
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
    if (deferredLocationQuery) {
      const query = deferredLocationQuery.toLowerCase();
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
  }, [wageData, deferredLocationQuery, selectedState, selectedTiers, areaMap]);

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
    if (selectedSoc === soc) return;
    setSelectedSoc(soc);
    updateUrl('soc', soc);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
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

      <header className="w-full max-w-7xl px-4 py-4">
        <div className="flex items-center gap-2 overflow-x-auto md:hidden">
          {externalLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/70 text-foreground transition hover:bg-muted"
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="sr-only">{label}</span>
            </Link>
          ))}
          <Button
            asChild
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <Link href={metricsHref} aria-label={t('metrics_link')}>
              <Activity className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <ThemeToggle />
          <LanguageSelector />
        </div>
        <div className="hidden md:flex md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {externalLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/70 text-foreground transition hover:bg-muted"
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="sr-only">{label}</span>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="icon"
            >
              <Link href={metricsHref} aria-label={t('metrics_link')}>
                <Activity className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </div>
      </header>

      <div className="w-full flex flex-col items-center space-y-6 mb-8 px-4">
        <div className="w-full max-w-5xl bg-gradient-to-b from-muted/20 to-transparent rounded-2xl md:rounded-3xl p-5 md:p-12 flex flex-col items-start text-left space-y-6 md:items-center md:text-center md:space-y-8">
          <div className="space-y-4 w-full max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 pb-1">
              {t('title')}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
              {t('subtitle')}
            </p>
          </div>


        </div>
      </div>

      <div id="location-filters" className="w-full max-w-7xl px-4 py-2 space-y-5">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-[350px] z-20 shadow-sm rounded-md">
            <Search onSelectOccupation={handleSocSelect} />
          </div>

          {selectedSoc && (
            <>
              <div className="flex-1 w-full flex flex-col md:flex-row gap-4">
                <Input
                  placeholder={t('search_locations')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="max-w-sm bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 h-12 shadow-sm"
                />
                <Select value={selectedState} onValueChange={handleStateChange}>
                  <SelectTrigger className="w-full md:w-[200px] bg-muted/50 border-0 focus:ring-1 focus:ring-primary/20 h-12 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('all_states')}</SelectItem>
                    {uniqueStates.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm font-medium text-muted-foreground whitespace-nowrap bg-muted/30 px-3 py-1 rounded-full">
                Showing {filteredWageData.length} locations
              </div>
            </>
          )}
        </div>

        {selectedSoc && (
          /* City Tier Filter - Chips Style */
          <div className="flex flex-col gap-3 pt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">{t('city_size')}</span>
            <div className="flex flex-wrap gap-2">
              {[
                { tier: 1, label: t('tier_1') },
                { tier: 2, label: t('tier_2') },
                { tier: 3, label: t('tier_3') },
                { tier: 4, label: t('tier_4') },
                { tier: 5, label: t('tier_5') }
              ].map(({ tier, label }) => {
                const isSelected = selectedTiers.includes(tier);
                return (
                  <button
                    key={tier}
                    onClick={() => handleTierToggle(tier)}
                    className={`
                      inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                      ${isSelected
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }
                    `}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        <div id="map-view" className="w-full h-[320px] md:h-[600px] rounded-xl overflow-hidden border shadow-sm bg-card">
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
