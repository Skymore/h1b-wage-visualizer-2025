'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SnowContextType {
    isSnowing: boolean;
    toggleSnow: () => void;
    setSnow: (snowing: boolean) => void;
}

const SnowContext = createContext<SnowContextType | undefined>(undefined);

export function SnowProvider({ children }: { children: ReactNode }) {
    const [isSnowing, setIsSnowing] = useState(false);

    const toggleSnow = () => setIsSnowing(prev => !prev);
    const setSnow = (val: boolean) => setIsSnowing(val);

    return (
        <SnowContext.Provider value={{ isSnowing, toggleSnow, setSnow }}>
            {children}
        </SnowContext.Provider>
    );
}

export function useSnow() {
    const context = useContext(SnowContext);
    if (context === undefined) {
        throw new Error('useSnow must be used within a SnowProvider');
    }
    return context;
}
