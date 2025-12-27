# H1B Wage Visualization Project Plan

## User Review Required

> [!IMPORTANT]
> **Tech Stack Confirmation**:
> - **Framework**: Next.js 14 (App Router) - Modern, fast, SEO-friendly.
> - **Styling**: Tailwind CSS + **shadcn/ui** - Requested by user.
> - **Maps**: Mapbox GL JS (`react-map-gl`).
> - **Languages**: English, Chinese, Korean, Japanese, French, Spanish, German, Hindi, Portuguese (Auto-translated via LLM).

## Proposed Changes

### Data Processing Strategy
The dataset is large (~30MB). To ensure fast loading without a backend:
1.  **Pre-process CSVs**: Write a Node.js script to parse `ALC_Export.csv`.
2.  **Generate Static JSONs**:
    -   `public/data/occupations.json`: List of all occupations (Code, Title) for search.
    -   `public/data/areas.json`: List of all areas (ID, Name, Coordinates) for map.
    -   `public/data/wages/[soc_code].json`: Wage data for a specific occupation across all areas.
3.  **Client-Side**: Fetch specific JSONs based on user selection.

### Directory Structure
```
/
├── public/
│   └── data/           # Generated JSONs
├── src/
│   ├── app/            # Next.js App Router
│   ├── components/     # UI Components
│   │   ├── Map.tsx
│   │   ├── Search.tsx
│   │   └── WageCard.tsx
│   └── lib/            # Utilities
├── scripts/            # Data processing scripts
└── ...
```

### Key Components

#### [NEW] [Map.tsx]
Interactive map showing wage hotspots or selected area.

#### [NEW] [Search.tsx]
Autocomplete search for Job Titles (SOC Codes) and Locations.

#### [NEW] [WageDashboard.tsx]
Displays the Level 1-4 wages, comparisons using charts or clean tables.

## Verification Plan

### Automated Tests
-   Verify JSON generation script output against original CSV sample rows.
-   Check file sizes of generated JSONs.

### Manual Verification
-   **Search**: Try searching "Software Developer" and verify correct SOC code is selected.
-   **Map**: Click on "Austin" and verify wages match the Report.
-   **Language**: Switch to "Chinese" and verify UI text changes.
-   **Theme**: Toggle Dark Mode and check map style/colors.
