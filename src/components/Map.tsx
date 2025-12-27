'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Token should be in .env.local
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type WageData = { area_id: string, l1: number, l2: number, l3: number, l4: number };
type Area = { id: string, name: string, lat?: number, lng?: number };

export default function MapView({
    wageData,
    areas = []
}: {
    wageData?: WageData[],
    areas?: Area[]
}) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markers = useRef<mapboxgl.Marker[]>([]);
    const [lng, setLng] = useState(-95.7129);
    const [lat, setLat] = useState(37.0902);
    const [zoom, setZoom] = useState(3);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN || "";

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [lng, lat],
            zoom: zoom
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

    // Update markers when wageData or areas change
    useEffect(() => {
        if (!map.current || !wageData || !areas) return;

        // Clear existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Create a lookup for areas
        const areaMap = new Map(areas.map(a => [a.id, a]));

        wageData.forEach(wage => {
            const area = areaMap.get(wage.area_id);
            if (area && area.lat && area.lng) {
                // Create custom marker element if needed, or use default
                const popup = new mapboxgl.Popup({ offset: 25 })
                    .setHTML(`
                        <div class="p-2">
                            <h3 class="font-bold text-sm">${area.name}</h3>
                            <div class="text-xs pt-1">
                                <div class="grid grid-cols-2 gap-x-2">
                                    <span>Level 1:</span> <span class="font-mono text-right">$${Math.round(wage.l1 * 2080).toLocaleString()}</span>
                                    <span>Level 2:</span> <span class="font-mono text-right">$${Math.round(wage.l2 * 2080).toLocaleString()}</span>
                                    <span>Level 3:</span> <span class="font-mono text-right">$${Math.round(wage.l3 * 2080).toLocaleString()}</span>
                                    <span>Level 4:</span> <span class="font-mono text-right">$${Math.round(wage.l4 * 2080).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    `);

                const marker = new mapboxgl.Marker({ color: '#0F172A', scale: 0.6 })
                    .setLngLat([area.lng, area.lat])
                    .setPopup(popup)
                    .addTo(map.current!);

                markers.current.push(marker);
            }
        });

    }, [wageData, areas]);

    return (
        <div className="h-[600px] w-full rounded-md border overflow-hidden relative">
            <div ref={mapContainer} className="w-full h-full" />
            <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs z-10 font-mono">
                Lng: {lng} | Lat: {lat} | Zoom: {zoom}
            </div>
        </div>
    );
}
