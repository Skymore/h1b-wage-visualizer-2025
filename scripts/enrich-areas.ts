
import fs from 'fs';
import path from 'path';

// 1. Get Token
const envPath = path.join(process.cwd(), '.env.local');
let token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!token && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/NEXT_PUBLIC_MAPBOX_TOKEN=(.*)/);
    if (match) {
        token = match[1].trim();
    }
}

if (!token) {
    console.error("Error: NEXT_PUBLIC_MAPBOX_TOKEN not found in .env.local or environment.");
    process.exit(1);
}

const AREAS_PATH = path.join(process.cwd(), 'public/data/areas.json');

async function enrichAreas() {
    if (!fs.existsSync(AREAS_PATH)) {
        console.error(`Error: ${AREAS_PATH} not found.`);
        process.exit(1);
    }

    const areas = JSON.parse(fs.readFileSync(AREAS_PATH, 'utf-8'));
    let updatedCount = 0;

    console.log(`Processing ${areas.length} areas...`);

    for (let i = 0; i < areas.length; i++) {
        const area = areas[i];

        // Skip if already has coordinates
        if (area.lat && area.lng) continue;

        const query = area.name;
        console.log(`[${i + 1}/${areas.length}] Fetching coordinates for: ${query}`);

        try {
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=US&types=place,region,district&limit=1`;
            const res = await fetch(url);

            if (!res.ok) {
                console.error(`Failed to fetch ${query}: ${res.status} ${res.statusText}`);
                continue;
            }

            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center;
                area.lat = lat;
                area.lng = lng;
                updatedCount++;
            } else {
                console.warn(`No results for: ${query}`);
            }

        } catch (error) {
            console.error(`Error fetching ${query}:`, error);
        }

        // Rate limit kindness (approx 20 req/sec max usually, but let's be safe with 50ms = 20/sec)
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (updatedCount > 0) {
        fs.writeFileSync(AREAS_PATH, JSON.stringify(areas, null, 2));
        console.log(`Successfully updated ${updatedCount} areas with coordinates.`);
    } else {
        console.log("No areas needed updating.");
    }
}

enrichAreas().catch(console.error);
