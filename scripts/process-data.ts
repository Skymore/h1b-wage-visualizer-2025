
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
    interface AlcExportRecord {
        Area: string;
        SocCode: string;
        GeoLvl: string;
        Level1: string;
        Level2: string;
        Level3: string;
        Level4: string;
        Average: string;
        Label: string;
    }

    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as AlcExportRecord[];

    console.log(`Parsed ${records.length} records.`);

    const occupations = new Map<string, string>();
    const areas = new Map<string, { id: string; name: string; state: string }>();
    type WageEntry = {
        area_id: string;
        l1: number;
        l2: number;
        l3: number;
        l4: number;
    };
    const wagesBySoc = new Map<string, WageEntry[]>();

    // Load SOC definitions if available (optional, or extract from main file)
    // The ALC_Export has "SocCode" but maybe not Title in every row? 
    // Wait, let's check headers from earlier: "Area","SocCode","GeoLvl","Level1","Level2","Level3","Level4","Average","Label"
    // It doesn't have Title!
    // I need oes_soc_occs.csv for Titles.

    console.log('Reading oes_soc_occs.csv...');
    const socContent = fs.readFileSync(path.join(INPUT_DIR, 'oes_soc_occs.csv'));
    interface SocRecord {
        soccode: string;
        Title: string;
        Description?: string;
    }

    const socRecords = parse(socContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    }) as SocRecord[];

    // socRecords headers: "soccode","Title","Description"
    socRecords.forEach((record) => {
        occupations.set(record.soccode, record.Title);
    });

    // Also need Geography.csv for Area Names
    console.log('Reading Geography.csv...');
    const geoContent = fs.readFileSync(path.join(INPUT_DIR, 'Geography.csv'));
    interface GeographyRecord {
        Area: string;
        AreaName: string;
        StateAb: string;
        State?: string;
        CountyTownName?: string;
    }

    const geoRecords = parse(geoContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    }) as GeographyRecord[];

    // Geography headers: "Area","AreaName","StateAb","State","CountyTownName"
    geoRecords.forEach((record) => {
        // Some Areas might be duplicated for multiple counties, we just need unique Area -> Name mapping
        if (!areas.has(record.Area)) {
            areas.set(record.Area, {
                id: record.Area,
                name: record.AreaName,
                state: record.StateAb
            });
        }
    });

    console.log('Processing wages...');

    // Keep track of unique SOCs found in wage data and their counts
    const socCounts = new Map<string, number>();

    for (const record of records) {
        // Record keys: Area, SocCode, GeoLvl, Level1, Level2, Level3, Level4, Average
        const { Area, SocCode, Level1, Level2, Level3, Level4 } = record;

        if (!SocCode || !Area) continue;

        if (!wagesBySoc.has(SocCode)) {
            wagesBySoc.set(SocCode, []);
        }

        socCounts.set(SocCode, (socCounts.get(SocCode) || 0) + 1);

        wagesBySoc.get(SocCode).push({
            area_id: Area,
            l1: Level1 ? parseFloat(Level1) : 0,
            l2: Level2 ? parseFloat(Level2) : 0,
            l3: Level3 ? parseFloat(Level3) : 0,
            l4: Level4 ? parseFloat(Level4) : 0
        });
    }

    // List of popular H1B/PERM occupations to boost to the top
    const POPULAR_SOCS = new Set([
        "15-1252", // Software Developers
        "17-2171", // Petroleum Engineers
        "15-1253", // Software Quality Assurance Analysts and Testers
        "15-2051", // Data Scientists
        "15-1211", // Computer Systems Analysts
        "15-1231", // Computer Network Support Specialists
        "15-1241", // Computer Network Architects
        "17-2051", // Civil Engineers
        "17-2071", // Electrical Engineers
        "17-2072", // Electronics Engineers, Except Computer
        "17-2141", // Mechanical Engineers
        "29-1141", // Registered Nurses
        "13-2011", // Accountants and Auditors
        "13-1111", // Management Analysts
        "15-1299", // Computer Occupations, All Other
        "15-2031", // Operations Research Analysts
        "15-2041", // Statisticians
        "11-3021", // Computer and Information Systems Managers
        "11-2021", // Marketing Managers
        "13-2051", // Financial Analysts
    ]);
    // 1. Write occupations.json
    // Sort by: 
    // 1. Is Popular (Boosted) -> Descending
    // 2. Count (Popularity in data) -> Descending
    // 3. Alphabetical -> Ascending
    const occupationsList = Array.from(socCounts.keys()).map(code => ({
        code,
        title: occupations.get(code) || "Unknown Occupation",
        count: socCounts.get(code),
        isPopular: POPULAR_SOCS.has(code)
    })).sort((a, b) => {
        // Priority 1: Manual Popular List
        if (a.isPopular && !b.isPopular) return -1;
        if (!a.isPopular && b.isPopular) return 1;

        // Priority 2: Data Count (if we have variation)
        if (b.count !== a.count) return b.count - a.count;

        // Priority 3: Alphabetical
        return a.title.localeCompare(b.title);
    });

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'occupations.json'),
        JSON.stringify(occupationsList, null, 2)
    );
    console.log(`Written ${occupationsList.length} occupations (with manual popularity boost).`);

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
