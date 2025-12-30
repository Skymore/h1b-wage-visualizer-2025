export type OccupationRecord = {
    code: string;
    title: string;
    count: number;
    isPopular?: boolean;
};

export type AreaRecord = {
    id: string;
    name: string;
    state: string;
    tier?: number;
};

export type WageEntry = {
    area_id: string;
    l1: number;
    l2: number;
    l3: number;
    l4: number;
};

export type WageFile = {
    soc: string;
    wages: WageEntry[];
};

export type WageSnapshot = {
    hourly: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
    annual: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
};

export type WageLookupSuccess = WageSnapshot & {
    socCode: string;
    areaId?: string;
    state?: string;
};

export type WageLookupError = {
    socCode: string;
    areaId?: string;
    state?: string;
    error: string;
};

export type WageLookupResult = WageLookupSuccess | WageLookupError;

export type AreaLevelInfo = {
    areaId: string;
    name: string;
    state: string;
    cityTier: number;
    yourLevel: number;
    thresholds: {
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
};

export type OccupationSearchResult = {
    code: string;
    title: string;
    count: number;
    query: string;
};

export type AreaSearchResult = {
    id: string;
    name: string;
    state: string;
    query: string;
};

export type OpenRouterUsageDetails = {
    cost?: number;
    costDetails?: {
        upstreamInferenceCost?: number;
    };
};

export type OpenRouterMetadata = {
    openrouter?: {
        usage?: OpenRouterUsageDetails;
    };
};
