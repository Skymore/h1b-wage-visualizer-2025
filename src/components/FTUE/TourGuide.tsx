
'use client';

import { useEffect, useRef } from 'react';
import { driver, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

interface TourGuideProps {
    startTour: boolean;
    onTourEnd: () => void;
}

export function TourGuide({ startTour, onTourEnd }: TourGuideProps) {
    const t = useTranslations('Tour');
    const { theme } = useTheme();
    const driverObj = useRef<Driver | null>(null);

    useEffect(() => {
        // Initialize driver
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: t('done'),
            nextBtnText: t('next'),
            prevBtnText: t('prev'),
            onDestroyed: () => {
                onTourEnd();
            },
            steps: [
                {
                    element: '#search-bar',
                    popover: {
                        title: t('search_title'),
                        description: t('search_desc'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#location-filters',
                    popover: {
                        title: t('filters_title'),
                        description: t('filters_desc'),
                        side: "bottom",
                        align: 'start'
                    }
                },
                {
                    element: '#map-view',
                    popover: {
                        title: t('map_title'),
                        description: t('map_desc'),
                        side: "top",
                        align: 'start'
                    }
                },
                {
                    element: '#wage-dashboard',
                    popover: {
                        title: t('wages_title'),
                        description: t('wages_desc'),
                        side: "top",
                        align: 'start'
                    }
                },
                {
                    element: '#chat-widget-trigger',
                    popover: {
                        title: t('chat_title'),
                        description: t('chat_desc'),
                        side: "left",
                        align: 'center'
                    }
                }
            ]
        });
    }, [t, onTourEnd]);

    useEffect(() => {
        if (startTour && driverObj.current) {
            // Small timeout to ensure elements are rendered
            setTimeout(() => {
                driverObj.current?.drive();
            }, 100);
        }
    }, [startTour]);

    // Handle Theme Changes for Driver.js
    useEffect(() => {
        // Driver.js uses its own CSS, but we might want to adjust colors based on theme if needed.
        // Ideally we override CSS variables in globals.css for .driver-popover etc.
        // For now base styles are fine.
    }, [theme]);

    return null; // Logic only component
}
