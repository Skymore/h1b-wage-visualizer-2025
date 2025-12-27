
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from '@/components/Search';
import dynamic from 'next/dynamic';
import { WageDashboard } from '@/components/WageDashboard';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';

const MapView = dynamic(() => import('@/components/Map'), {
  loading: () => <div className="h-[600px] w-full rounded-md border bg-muted flex items-center justify-center">Loading Map...</div>,
  ssr: false
});

export default function Home() {
  const t = useTranslations('HomePage');
  const [selectedSoc, setSelectedSoc] = useState<string | null>(null);
  const [wageData, setWageData] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  // Fetch areas on mount
  useEffect(() => {
    fetch('/data/areas.json')
      .then(res => res.json())
      .then(setAreas);
  }, []);

  // Fetch wages when SOC is selected
  useEffect(() => {
    if (selectedSoc) {
      fetch(`/data/wages/${selectedSoc}.json`)
        .then(res => res.json())
        .then(data => setWageData(data.wages))
        .catch(err => console.error("Failed to load wages", err));
    }
  }, [selectedSoc]);

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
        <Search onSelectOccupation={setSelectedSoc} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        <div className="w-full">
          <MapView wageData={wageData} />
        </div>

        <div className="w-full">
          {selectedSoc && (
            <WageDashboard
              socCode={selectedSoc}
              wageData={wageData}
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
