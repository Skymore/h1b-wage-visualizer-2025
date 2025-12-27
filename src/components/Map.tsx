'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Token should be in .env.local
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type WageData = { area_id: string, l1: number, l2: number, l3: number, l4: number };

export default function MapView({
    wageData
}: {
    wageData?: WageData[]
}) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [lng, setLng] = useState(-95.7129);
    const [lat, setLat] = useState(37.0902);
    const [zoom, setZoom] = useState(3);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

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

    return (
        <div className="h-[600px] w-full rounded-md border overflow-hidden relative">
            <div ref={mapContainer} className="w-full h-full" />
            <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs z-10 font-mono">
                Lng: {lng} | Lat: {lat} | Zoom: {zoom}
            </div>
        </div>
    );
}
