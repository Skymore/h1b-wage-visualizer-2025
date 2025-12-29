const fs = require('fs');
const path = require('path');

const areasPath = path.join(__dirname, '../public/data/areas.json');
const areas = JSON.parse(fs.readFileSync(areasPath, 'utf-8'));

// Tier 1: Top 10 major metros (超一线)
const tier1 = new Set([
    'New York-Newark-Jersey City, NY-NJ',
    'Los Angeles-Long Beach-Anaheim, CA',
    'San Francisco-Oakland-Fremont, CA',
    'San Jose-Sunnyvale-Santa Clara, CA',
    'Chicago-Naperville-Elgin, IL-IN',
    'Washington-Arlington-Alexandria, DC-VA-MD-WV',
    'Boston-Cambridge-Newton, MA-NH',
    'Seattle-Tacoma-Bellevue, WA',
    'Dallas-Fort Worth-Arlington, TX',
    'Houston-Pasadena-The Woodlands, TX',
]);

// Tier 2: Major tech/economic hubs (一线)
const tier2 = new Set([
    'Atlanta-Sandy Springs-Roswell, GA',
    'Austin-Round Rock-San Marcos, TX',
    'Phoenix-Mesa-Chandler, AZ',
    'Denver-Aurora-Centennial, CO',
    'San Diego-Chula Vista-Carlsbad, CA',
    'Miami-Fort Lauderdale-West Palm Beach, FL',
    'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD',
    'Minneapolis-St. Paul-Bloomington, MN-WI',
    'Tampa-St. Petersburg-Clearwater, FL',
    'Portland-Vancouver-Hillsboro, OR-WA',
    'Raleigh-Cary, NC',
    'Charlotte-Concord-Gastonia, NC-SC',
    'Salt Lake City-Murray, UT',
    'Nashville-Davidson--Murfreesboro--Franklin, TN',
    'Detroit-Warren-Dearborn, MI',
    'Orlando-Kissimmee-Sanford, FL',
    'Sacramento-Roseville-Folsom, CA',
    'Pittsburgh, PA',
    'Las Vegas-Henderson-North Las Vegas, NV',
    'Riverside-San Bernardino-Ontario, CA',
    'Baltimore-Columbia-Towson, MD',
    'St. Louis, MO-IL',
    'San Antonio-New Braunfels, TX',
    'Columbus, OH',
    'Indianapolis-Carmel-Greenwood, IN',
    'Durham-Chapel Hill, NC',
    'Richmond, VA',
    'Milwaukee-Waukesha, WI',
    'Kansas City, MO-KS',
    'Cleveland, OH',
]);

// Process each area
const updatedAreas = areas.map(area => {
    let tier;

    // Check state
    if (area.state === 'PR') {
        tier = 5; // Puerto Rico
    }
    // Check if nonmetropolitan
    else if (area.name.toLowerCase().includes('nonmetropolitan')) {
        tier = 4;
    }
    // Check Tier 1
    else if (tier1.has(area.name)) {
        tier = 1;
    }
    // Check Tier 2
    else if (tier2.has(area.name)) {
        tier = 2;
    }
    // Default: Tier 3 (normal metro areas)
    else {
        tier = 3;
    }

    return { ...area, tier };
});

// Write back
fs.writeFileSync(areasPath, JSON.stringify(updatedAreas, null, 2));

console.log(`✅ Updated ${updatedAreas.length} areas with tier classifications`);
console.log(`Tier 1: ${updatedAreas.filter(a => a.tier === 1).length}`);
console.log(`Tier 2: ${updatedAreas.filter(a => a.tier === 2).length}`);
console.log(`Tier 3: ${updatedAreas.filter(a => a.tier === 3).length}`);
console.log(`Tier 4: ${updatedAreas.filter(a => a.tier === 4).length}`);
console.log(`Tier 5: ${updatedAreas.filter(a => a.tier === 5).length}`);

// Verification: print tier 1 and 2
console.log('\n=== Tier 1 Cities ===');
updatedAreas.filter(a => a.tier === 1).forEach(a => console.log(a.name));
console.log('\n=== Tier 2 Cities ===');
updatedAreas.filter(a => a.tier === 2).forEach(a => console.log(a.name));
