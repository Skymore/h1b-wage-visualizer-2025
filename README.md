# H1B Wage Visualization 2025-2026

An interactive web application to explore and visualize H1B wage data for the 2025-2026 fiscal year across the United States. Built with Next.js, Mapbox, and AI-powered assistance.

## 🌟 Features

*   **Interactive Map**: Visualize wage data on a dynamic, theme-aware map. Markers are color-coded based on wage levels with smart clustering.
*   **Wage Dashboard**: Detailed table view with sortable columns, multi-area comparison (up to 4), and shareable comparison reports.
*   **AI Chat Assistant**: Ask questions about wages, locations, and H1B policies. Get instant answers with built-in tools for searching occupations, areas, and fetching wage data.
*   **Smart Search**: Fuzzy search for 800+ occupations with deferred filtering for lag-free typing.
*   **Advanced Filtering**: Filter by state, city tier (Tier 1-5), and location name with real-time updates.
*   **Comparison & Sharing**: Select multiple locations, generate comparison images, and share via URL or download.
*   **Internationalization (i18n)**: Fully localized interface in 8 languages: English, Chinese (中文), Japanese (日本語), Korean (한국어), Spanish (Español), French (Français), German (Deutsch), and Hindi (हिन्दी).
*   **AI-Powered Translations**: Automated translation workflow using Gemini for maintaining multi-language support.
*   **Responsive Design**: Optimized for desktop and mobile with touch-specific interactions (popovers instead of tooltips on touch devices).
*   **Interactive Tour**: First-time user experience (FTUE) with guided tour using driver.js.

## 🛠️ Tech Stack

*   **Framework**: [Next.js 16](https://nextjs.org/) (App Router with Turbopack)
*   **Language**: TypeScript (with comprehensive type safety)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) with dark mode support
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives)
*   **Maps**: [Mapbox GL JS](https://www.mapbox.com/) with theme-aware styling
*   **AI**: [AI SDK](https://sdk.vercel.ai/) + [OpenRouter](https://openrouter.ai/) (Gemini 2.0 Flash)
*   **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/)
*   **FTUE**: [driver.js](https://driverjs.com/) for interactive tours

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   npm or pnpm
*   Mapbox API token (free tier available)
*   OpenRouter API key (for AI chat features)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Skymore/h1b-wage-visualizer-2025.git
    cd h1b-wage-visualizer-2025
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbH...
    OPENROUTER_API_KEY=sk-or-v1-...
    OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
    ```
    *   Get a Mapbox token: [Mapbox Sign Up](https://www.mapbox.com/)
    *   Get OpenRouter API key: [OpenRouter](https://openrouter.ai/)

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

5.  **Open the app**:
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Translation Workflow

We use AI-powered translation for maintaining multi-language support:

```bash
# Update translations from source (strings.json)
npm run translate

# Validate translation quality and consistency
npm run validate-i18n
```

**Workflow**:
1. Edit `messages/en.json` with new UI strings
2. Copy content to `messages/strings.json`
3. Run `npm run translate` to auto-generate all 8 languages
4. Run `npm run validate-i18n` to check for issues

See [CLAUDE.md](./CLAUDE.md) for detailed developer documentation.

## 📦 Data Processing

The application uses pre-processed JSON data derived from OFLC wage data.
*   Processing scripts are located in `scripts/` (TypeScript)
*   Processed data is stored in `public/data/`
*   Data includes ~850 occupations across ~2,600 geographic areas

## 🎨 Features in Detail

### AI Chat Assistant
- **Natural language queries**: "What's the salary for software engineers in Seattle?"
- **Batch comparisons**: "Compare wages in NYC, SF, and Austin"
- **Optimal location finder**: "Where can I reach Level 3 with $120k salary?"
- **H1B policy info**: Ask about FY2027 lottery changes, fees, etc.

### Multi-Area Comparison
- Select up to 4 locations from the table
- Generate a shareable comparison image
- Copy image to clipboard or download as PNG
- Share via URL with selected filters

### Smart Filtering
- **City Tiers**: Tier 1 (NYC, SF), Tier 2 (Austin, Denver), Tier 3-5
- **State filter**: Select from all US states
- **Location search**: Real-time filtering by city/area name
- All filters sync with URL for easy sharing

## 🚢 Deployment

### Deploy to Vercel

1.  Push your code to a GitHub repository
2.  Import the project into [Vercel](https://vercel.com/)
3.  Add environment variables in Vercel project settings:
    - `NEXT_PUBLIC_MAPBOX_TOKEN`
    - `OPENROUTER_API_KEY`
    - `OPENROUTER_BASE_URL`
4.  Deploy!

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
