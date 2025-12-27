# H1B Wage Visualization 2025-2026

An interactive web application to explore and visualize H1B wage data for the 2025-2026 fiscal year across the United States. Built with Next.js, Mapbox, and Tailwind CSS.

## 🌟 Features

*   **Interactive Map**: Visualize wage data on a dynamic map. Markers are color-coded based on wage levels relative to the national average for the selected occupation (Heatmap style).
*   **Wage Dashboard**: Detailed list view of wages by area, with sorting and filtering capabilities.
*   **Smart Search**: Easily search for occupations (SOC codes) and filter by specific locations or states.
*   **Data Visualization**: Wages are displayed in a clean `$XXXk` format with tooltips revealing exact figures.
*   **Internationalization (i18n)**: Fully localized interface in English, Chinese (中文), Japanese (日本語), Korean (한국어), Spanish (Español), French (Français), German (Deutsch), and Hindi (हिन्दी).
*   **Responsive Design**: Optimized for both desktop and mobile devices using a modern UI components library.

## 🛠️ Tech Stack

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
*   **Language**: TypeScript
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
*   **Maps**: [Mapbox GL JS](https://www.mapbox.com/)
*   **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later)
*   npm

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
    Create a `.env.local` file in the root directory and add your Mapbox token:
    ```env
    NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbH...
    ```
    *Note: You need to sign up for a [Mapbox](https://www.mapbox.com/) account to get a token.*

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

5.  **Open the app**:
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Data Processing

The application uses pre-processed JSON data derived from OFLC wage data.
*   Original data scripts are located in `scripts/`.
*   Processed data is stored in `public/data/`.

## 🚢 Deployment

### Deploy to Vercel

1.  Push your code to a GitHub repository.
2.  Import the project into [Vercel](https://vercel.com/).
3.  Add the `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable in the Vercel project settings.
4.  Deploy!

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
