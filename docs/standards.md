# Project Standards and Guidelines

## Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Hooks / Context (Zustand if needed)
- **Maps**: react-map-gl (Mapbox)
- **i18n**: next-intl

## Coding Standards

### 1. Git & Commits
- **Conventional Commits**: Use conventional commit messages.
  - `feat: add map component`
  - `fix: correct wage calculation`
  - `docs: update readme`
  - `style: formatting`
  - `refactor: simplify data parsing`
- **Branching**: Feature branches should be used (`feat/map-view`, `fix/parsing-error`).

### 2. TypeScript
- **Strict Mode**: Enabled. No `any` unless absolutely necessary and documented.
- **Interfaces**: Define interfaces for all data structures (especially the parsed CSV data).
- **Props**: Explicitly type component props.

### 3. Component Structure
- **Server vs Client**: Default to Server Components. Use `'use client'` only when interaction (hooks, event listeners) is required.
- **Colocation**: Keep related styles/tests/types close to the component if possible, or in `src/types`.

### 4. Styling (Tailwind + shadcn/ui)
- Use standard Tailwind utility classes.
- Use `cn()` utility for conditional class merging.
- **Design System**: Follow the `shadcn/ui` variable-based theming (CSS variables in `globals.css`).

### 5. i18n
- All user-facing text must be wrapped in `t()` calls from `next-intl`.
- Translation keys should be nested and descriptive: `HomePage.search_placeholder`.

### 6. File Naming
- **Components**: PascalCase (`WageCard.tsx`)
- **Utilities/Hooks**: camelCase (`useWageData.ts`, `parseCsv.ts`)
- **Constants**: UPPER_SNAKE_CASE (inside files)

## Project Structure
```
src/
  app/          # Routes
  components/   # Reusable UI components
    ui/         # shadcn primitives
  lib/          # Utilities (parsers, aggregators)
  hooks/        # Custom React hooks
  types/        # Shared TypeScript interfaces
  messages/     # i18n JSON files
public/
  data/         # Generated static JSON data
```
