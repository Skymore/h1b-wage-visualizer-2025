'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

// Token should be in .env.local
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type WageData = { area_id: string, l1: number, l2: number, l3: number, l4: number };
type Area = { id: string, name: string, lat?: number, lng?: number };

export default function MapView({
    wageData,
    areas = [],
    wageScale
}: {
    wageData?: WageData[],
    areas?: Area[],
    wageScale?: { min: number, max: number }
}) {
    const t = useTranslations('HomePage');
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<mapboxgl.Marker[]>([]);
    const [lng, setLng] = useState(-95.7129);
    const [lat, setLat] = useState(37.0902);
    const [zoom, setZoom] = useState(2);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN || "";

        const isDesktop = window.innerWidth >= 768;
        const initialZoom = isDesktop ? 3 : 2;

        // Sync state immediately so UI label is correct
        setZoom(initialZoom);

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
            center: [lng, lat],
            zoom: initialZoom,
            cooperativeGestures: true // Allows page scrolling with one finger, map panning with two
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        map.current.on('move', () => {
            if (!map.current) return;
            setLng(parseFloat(map.current.getCenter().lng.toFixed(4)));
            setLat(parseFloat(map.current.getCenter().lat.toFixed(4)));
            setZoom(parseFloat(map.current.getZoom().toFixed(2)));
        });

    }, []);

    // Update map style when theme changes
    useEffect(() => {
        if (!map.current) return;
        const style = resolvedTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
        map.current.setStyle(style);
    }, [resolvedTheme]);

    const getColor = (wage: number, min: number, max: number) => {
        if (!wage || min === max) return '#3b82f6'; // Default blue
        const range = max - min;
        const normalized = (wage - min) / range;

        if (normalized < 0.25) return '#22c55e'; // Green (Low)
        if (normalized < 0.5) return '#eab308';  // Yellow (Medium)
        if (normalized < 0.75) return '#f97316'; // Orange (High)
        return '#ef4444';                         // Red (Very High)
    };

    const getSize = (wage: number, min: number, max: number) => {
        if (!wage || min === max) return 0.6;
        const range = max - min;
        const normalized = (wage - min) / range;
        // Scale from 0.5 to 0.8
        return 0.5 + (normalized * 0.3);
    };

    // Update markers when wageData or areas change
    useEffect(() => {
        if (!map.current || !wageData || !areas) return;

        // Clear existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Create a lookup for areas
        const areaMap = new Map(areas.map(a => [a.id, a]));

        // Determine min/max for CURRENT view if not provided, OR use global wageScale prop?
        // User asked for "consistent" coloring based on global data for that occupation.
        // So we use wageScale prop.
        const min = wageScale?.min || 0;
        const max = wageScale?.max || 100; // default avoid div by zero

        wageData.forEach(wage => {
            const area = areaMap.get(wage.area_id);
            if (area && area.lat && area.lng) {
                // Create custom marker popup
                const formatWageK = (hourly: number) => {
                    const annual = Math.round(hourly * 2080);
                    return `$${Math.round(annual / 1000)}k`;
                };

                const formatWageFull = (hourly: number) => {
                    return `$${Math.round(hourly * 2080).toLocaleString()}`;
                };

                const popup = new mapboxgl.Popup({ offset: 25 })
                    .setHTML(`
                        <div class="p-2 text-foreground bg-background rounded-md">
                            <h3 class="font-bold text-sm">${area.name}</h3>
                            <div class="text-xs pt-1">
                                <div class="grid grid-cols-2 gap-x-2">
                                    <span>${t('level_1')}:</span> <span class="font-mono text-right" title="${formatWageFull(wage.l1)}">${formatWageK(wage.l1)}</span>
                                    <span>${t('level_2')}:</span> <span class="font-mono text-right" title="${formatWageFull(wage.l2)}">${formatWageK(wage.l2)}</span>
                                    <span>${t('level_3')}:</span> <span class="font-mono text-right" title="${formatWageFull(wage.l3)}">${formatWageK(wage.l3)}</span>
                                    <span>${t('level_4')}:</span> <span class="font-mono text-right" title="${formatWageFull(wage.l4)}">${formatWageK(wage.l4)}</span>
                                </div>
                            </div>
                        </div>
                    `);

                const color = getColor(wage.l2, min, max);
                const scale = getSize(wage.l2, min, max);

                const marker = new mapboxgl.Marker({ color: color, scale: scale })
                    .setLngLat([area.lng, area.lat])
                    .setPopup(popup)
                    .addTo(map.current!);

                markers.current.push(marker);
            }
        });

    }, [wageData, areas, wageScale, resolvedTheme, t]);

    return (
        <div className="h-full w-full rounded-md border overflow-hidden relative">
            <div ref={mapContainer} className="w-full h-full" />

            {/* Legend */}
            {wageScale && wageScale.max > 0 && (
                <div className="absolute bottom-6 right-2 bg-background/90 p-2 rounded-md shadow-md text-xs border">
                    <div className="font-bold mb-1">{t('level_2_annual_wage')}</div>
                    <div className="space-y-1">
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#ef4444] mr-2"></span> {t('high')} ({`>$${Math.round((wageScale.min + (wageScale.max - wageScale.min) * 0.75) * 2080 / 1000)}k`})</div>
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#f97316] mr-2"></span> {t('med_high')}</div>
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#eab308] mr-2"></span> {t('medium')}</div>
                        <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[#22c55e] mr-2"></span> {t('low')} ({`<$${Math.round((wageScale.min + (wageScale.max - wageScale.min) * 0.25) * 2080 / 1000)}k`})</div>
                    </div>
                </div>
            )}


        </div>
    );
}
