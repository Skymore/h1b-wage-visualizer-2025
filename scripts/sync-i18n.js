const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../messages');
const SOURCE_FILE = 'en.json';

// Helper to recursively order keys based on a source object
function orderKeys(source, target) {
    const ordered = {};

    // 1. Add keys present in source
    Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            // Nested object
            ordered[key] = orderKeys(source[key], target[key] || {});
        } else {
            // Primitive value
            if (target && target.hasOwnProperty(key)) {
                ordered[key] = target[key];
            } else {
                console.log(`  + Adding missing key: ${key}`);
                ordered[key] = source[key]; // Fill with English fallback
            }
        }
    });

    // 2. Preserve keys in target that are NOT in source (optional, maybe warn?)
    Object.keys(target || {}).forEach(key => {
        if (!source.hasOwnProperty(key)) {
            console.log(`  - Preserving extra key (not in EN): ${key}`);
            ordered[key] = target[key];
        }
    });

    return ordered;
}

function syncTranslations() {
    const enPath = path.join(MESSAGES_DIR, SOURCE_FILE);
    if (!fs.existsSync(enPath)) {
        console.error(`Source file ${SOURCE_FILE} not found!`);
        process.exit(1);
    }

    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    const files = fs.readdirSync(MESSAGES_DIR);

    files.forEach(file => {
        if (file === SOURCE_FILE) return;
        if (!file.endsWith('.json')) return;

        console.log(`Processing ${file}...`);
        const filePath = path.join(MESSAGES_DIR, file);
        let targetContent = {};

        try {
            targetContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error(`  Error parsing ${file}, treating as empty.`);
        }

        const orderedContent = orderKeys(enContent, targetContent);

        fs.writeFileSync(filePath, JSON.stringify(orderedContent, null, 4));
        console.log(`  Updated ${file}`);
    });
}

syncTranslations();
