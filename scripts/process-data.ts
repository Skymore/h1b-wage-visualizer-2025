
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const INPUT_DIR = path.join(process.cwd(), 'data_source');
const OUTPUT_DIR = path.join(process.cwd(), 'public/data');
const WAGES_DIR = path.join(OUTPUT_DIR, 'wages');

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(WAGES_DIR)) fs.mkdirSync(WAGES_DIR, { recursive: true });

async function processData() {
    console.log('Reading ALC_Export.csv...');
    const csvContent = fs.readFileSync(path.join(INPUT_DIR, 'ALC_Export.csv'));

    // Parse CSV
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    console.log(`Parsed ${records.length} records.`);

    const occupations = new Map();
    const areas = new Map();
    const wagesBySoc = new Map();

    // Load SOC definitions if available (optional, or extract from main file)
    // The ALC_Export has "SocCode" but maybe not Title in every row? 
    // Wait, let's check headers from earlier: "Area","SocCode","GeoLvl","Level1","Level2","Level3","Level4","Average","Label"
    // It doesn't have Title!
    // I need oes_soc_occs.csv for Titles.

    console.log('Reading oes_soc_occs.csv...');
    const socContent = fs.readFileSync(path.join(INPUT_DIR, 'oes_soc_occs.csv'));
    const socRecords = parse(socContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    // socRecords headers: "soccode","Title","Description"
    socRecords.forEach(r => {
        occupations.set(r.soccode, r.Title);
    });

    // Also need Geography.csv for Area Names
    console.log('Reading Geography.csv...');
    const geoContent = fs.readFileSync(path.join(INPUT_DIR, 'Geography.csv'));
    const geoRecords = parse(geoContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });

    // Geography headers: "Area","AreaName","StateAb","State","CountyTownName"
    geoRecords.forEach(r => {
        // Some Areas might be duplicated for multiple counties, we just need unique Area -> Name mapping
        if (!areas.has(r.Area)) {
            areas.set(r.Area, {
                id: r.Area,
                name: r.AreaName,
                state: r.StateAb
            });
        }
    });

    console.log('Processing wages...');

    // Keep track of unique SOCs found in wage data
    const usedSocs = new Set();

    for (const record of records) {
        // Record keys: Area, SocCode, GeoLvl, Level1, Level2, Level3, Level4, Average
        const { Area, SocCode, Level1, Level2, Level3, Level4 } = record;

        if (!SocCode || !Area) continue;

        if (!wagesBySoc.has(SocCode)) {
            wagesBySoc.set(SocCode, []);
        }

        usedSocs.add(SocCode);

        wagesBySoc.get(SocCode).push({
            area_id: Area,
            l1: Level1 ? parseFloat(Level1) : 0,
            l2: Level2 ? parseFloat(Level2) : 0,
            l3: Level3 ? parseFloat(Level3) : 0,
            l4: Level4 ? parseFloat(Level4) : 0
        });
    }

    // 1. Write occupations.json
    const occupationsList = Array.from(usedSocs).map(code => ({
        code,
        title: occupations.get(code) || "Unknown Occupation"
    })).sort((a, b) => a.title.localeCompare(b.title));

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'occupations.json'),
        JSON.stringify(occupationsList, null, 2)
    );
    console.log(`Written ${occupationsList.length} occupations.`);

    // 2. Write areas.json
    const areasList = Array.from(areas.values()).sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'areas.json'),
        JSON.stringify(areasList, null, 2)
    );
    console.log(`Written ${areasList.length} areas.`);

    // 3. Write wage files
    let count = 0;
    for (const [soc, wages] of wagesBySoc) {
        // Sort wages by L2 descending for easier viewing default?
        // wages.sort((a, b) => b.l2 - a.l2); 
        // Wait, better to let frontend sort.

        fs.writeFileSync(
            path.join(WAGES_DIR, `${soc}.json`),
            JSON.stringify({ soc, wages }, null, 0) // Minified
        );
        count++;
    }
    console.log(`Written ${count} wage files.`);
}

processData().catch(console.error);
