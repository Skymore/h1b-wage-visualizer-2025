# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

H1B Wage Visualization web application for FY 2025-2026. Built with Next.js 16 (App Router), TypeScript, Mapbox GL, and next-intl for internationalization. Features an interactive map showing wage data across the US, a searchable occupation database, and an AI chat assistant powered by OpenRouter.

## Common Commands

### Development
```bash
npm run dev           # Start development server at localhost:3000
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint
npm run translate     # AI-translate all locales from strings.json
npm run validate-i18n # Check translation quality and consistency
```

### Data Processing
```bash
npx tsx scripts/process-data.ts      # Process raw OFLC CSV data into JSON
npx tsx scripts/enrich-areas.ts      # Add lat/lon to areas.json
```

## Commit Guidelines

Follow **Conventional Commits** (Angular style). **STRICT ADHERENCE REQUIRED.**

```
<type>(<scope>): <description>
```

- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`
- **Scope**: Required - `chat`, `map`, `api`, `i18n`, etc.
- **Description**: Lowercase, imperative mood, no period, ≤50 chars
- **Breaking changes**: Add `!` after type, e.g., `feat(api)!: remove old endpoint`

**Examples:**
```
feat(chat): add message history persistence
fix(map): correct marker color interpolation
docs: add CLAUDE.md architecture guide
chore(deps): update dependencies
```

## Architecture Overview

### Data Flow
1. **Raw Data** (`data_source/`): OFLC CSV files containing wage data, occupations, and geography
2. **Processing Scripts** (`scripts/`): Transform CSV → JSON for web consumption
3. **Public Data** (`public/data/`):
   - `occupations.json`: All SOC codes with titles and counts (~850 occupations)
   - `areas.json`: Geographic areas with lat/lon for mapping (~2600 areas)
   - `wages/[socCode].json`: Per-occupation wage files (L1-L4 hourly wages by area)

### Next.js Structure
- **App Router** (`src/app/[locale]/`): Locale-based routing (8 languages)
- **Middleware** (`src/middleware.ts`): Handles i18n routing via next-intl
- **Page Component** (`src/app/[locale]/page.tsx`): Main client component coordinating all UI
  - Manages URL state (soc, q, state params)
  - Fetches occupation/area/wage data
  - Filters data based on search/state selection
  - Renders Map + WageDashboard side-by-side

### Key Components
- **Search** (`src/components/Search.tsx`): Occupation search with cmdk command palette
- **Map** (`src/components/Map.tsx`): Mapbox GL map with markers colored by wage scale
- **WageDashboard** (`src/components/WageDashboard.tsx`): Sortable table of wage data
- **ChatWidget** (`src/components/ChatWidget.tsx`): AI assistant sidebar (hidden by default)
- **ThemeToggle/ThemeProvider**: Dark mode support using next-themes
- **LanguageSelector**: Switches between 8 locales (en/zh/ja/ko/es/fr/de/hi)

### API Routes
- **`/api/chat`** (`src/app/api/chat/route.ts`): Streaming AI chat endpoint
  - Uses OpenRouter with `google/gemini-3-flash-preview`
  - Implements rate limiting (`src/lib/rate-limit.ts`)
  - Provides 3 tools: `searchOccupations`, `searchAreas`, `getWageData`
  - Custom message converter for AI SDK compatibility
  - Returns both hourly and annual wages (annual = hourly × 2080)

- **`/api/og`** (`src/app/api/og/route.tsx`): Dynamic OG image generation with @vercel/og

### Internationalization
- **next-intl**: 8 supported locales
- **Message Files** (`messages/[locale].json`): Translations for UI strings
- **AI Scripts**:
  - `scripts/build-translations.js`: Auto-translates `strings.json` to 8 languages using Gemini
  - `scripts/validate-translations.js`: Checks for missing placeholders and inconsistencies
- **Request Config** (`src/i18n/request.ts`): Loads messages per locale

## Important Patterns

### URL State Management
The main page syncs UI state (selected occupation, search query, state filter) with URL params for shareable links. Use the `updateUrl()` helper to modify params without full page reload.

### Data Loading
- Areas and occupations load once on mount
- Wage data loads dynamically when SOC is selected (`/data/wages/[soc].json`)
- All data is pre-processed and static (no database)

### Wage Scale Calculation
Map markers are colored based on relative wage position within the selected occupation's full dataset (not filtered). Uses min/max of L2 wages for scale bounds.

### Tool Calling in Chat
The AI assistant uses function calling with 3 tools. The chat route handles UIMessage → CoreMessage conversion due to AI SDK compatibility. Tool results are displayed as expandable JSON in the chat UI.

### Dark Mode
Uses next-themes with Tailwind dark: classes. Map markers adapt to theme using CSS variables.

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx...        # Mapbox GL access token
OPENROUTER_API_KEY=sk-or-v1-xxx...       # OpenRouter API key (Required for Chat & Translations)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

## Data Schema

### Occupation
```json
{
  "code": "15-1252",
  "title": "Software Developers",
  "count": 2500,
  "isPopular": true
}
```

### Area
```json
{
  "id": "M0031080",
  "name": "San Francisco-Oakland-Hayward",
  "state": "CA",
  "lat": 37.7749,
  "lon": -122.4194
}
```

### Wage Entry
```json
{
  "area_id": "M0031080",
  "l1": 45.67,  // Level 1 hourly
  "l2": 60.12,  // Level 2 hourly (most common)
  "l3": 75.89,  // Level 3 hourly
  "l4": 95.23   // Level 4 hourly
}
```

## Dependencies Notes

- **Mapbox GL**: Dynamically imported with SSR disabled (`dynamic(() => import(...), { ssr: false })`)
- **AI SDK**: Uses `@ai-sdk/react` for chat UI, `@openrouter/ai-sdk-provider` for OpenRouter
- **shadcn/ui**: Component library built on Radix UI primitives
- **next-intl**: Handles both routing middleware and translations
- **Legacy Peer Deps**: `.npmrc` contains `legacy-peer-deps=true` for deployment compatibility

## Testing Notes

This project currently has no automated tests. When adding features, consider the user workflows:
1. Search occupation → view map + dashboard → filter by state/location
2. Chat with AI → get wage comparisons → click to explore on map
3. Share URL → recipient sees same occupation/filters
4. Switch language → all UI updates, data unchanged

## Development Guidelines

### Component Standards
- **Always use shadcn/ui components** instead of native HTML elements
  - Use `<Checkbox>` not `<input type="checkbox">`
  - Use `<Select>` not `<select>` (run `npx shadcn@latest add [component]` if missing)
- **Use theme variables** (`bg-primary`, `text-muted-foreground`) instead of hardcoded colors

### Internationalization
- **All user-facing strings must be translated**
  - **Source of Truth**: `messages/strings.json`. (Ideally start by editing `messages/en.json` then copy to `strings.json`)
  - **Workflow** (**IMPORTANT**):
    1. Add/modify keys in `messages/en.json` (Development)
    2. **Copy content to `messages/strings.json`** (Source of Truth)
    3. Run `npm run translate` to auto-generate all other languages (zh, ja, ko, es, fr, de, hi)
       - **DO NOT** manually edit `zh.json`, `es.json`, etc. The script will overwrite them.
    4. Run `npm run validate-i18n` to check for quality/consistency
  - **Environment**: Ensure `OPENROUTER_API_KEY` is set in `.env.local`
  - Use `useTranslations()` hook, never hardcode text
- **Supported locales**: en, zh, ja, ko, es, fr, de, hi

### Design System
- **Theme**: New York / Neutral (grayscale, no color accents)
