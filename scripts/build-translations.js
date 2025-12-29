const fs = require('fs');
const path = require('path');

const MESSAGES_DIR = path.join(__dirname, '../messages');
const SOURCE_FILE = 'strings.json';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment variables');
    process.exit(1);
}

const TARGET_LOCALES = ['de', 'es', 'fr', 'hi', 'ja', 'ko', 'zh'];
const LOCALE_NAMES = {
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    hi: 'Hindi',
    ja: 'Japanese',
    ko: 'Korean',
    zh: 'Chinese (Simplified)'
};

// Flatten nested object to dot notation
function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, path));
        } else {
            result[path] = value;
        }
    }
    return result;
}

// Unflatten dot notation back to nested object
function unflattenObject(flat) {
    const result = {};
    for (const [path, value] of Object.entries(flat)) {
        const keys = path.split('.');
        let current = result;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }
    return result;
}

// Batch translate all strings for all languages
async function batchTranslate(stringsToTranslate) {
    const stringsList = Object.entries(stringsToTranslate)
        .map(([key, value]) => `${key}: "${value}"`)
        .join('\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [{
                role: 'user',
                content: `You are translating UI strings for an H1B wage visualization web application.

Context:
- The app helps users explore H1B visa wage data by occupation and location
- Users can search occupations, view maps, compare wages across cities
- Supports 8 languages for international users

Translate the following English strings to ALL these languages: ${Object.values(LOCALE_NAMES).join(', ')}.

CRITICAL RULES:
- Keep technical terms like "H1B", "Level 1", "Level 2", "Level 3", "Level 4", "SOC code" UNCHANGED
- Maintain ALL placeholder syntax like {count}, {tool}, {soc}, {area} EXACTLY as-is
- Be concise and natural for UI labels/buttons
- Return ONLY valid JSON in this exact format:

{
  "de": { "key.path": "German translation", ... },
  "es": { "key.path": "Spanish translation", ... },
  "fr": { "key.path": "French translation", ... },
  "hi": { "key.path": "Hindi translation", ... },
  "ja": { "key.path": "Japanese translation", ... },
  "ko": { "key.path": "Korean translation", ... },
  "zh": { "key.path": "Chinese translation", ... }
}

English strings to translate:
${stringsList}`
            }],
            temperature: 0.3,
            max_tokens: 16000
        })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
        throw new Error('Failed to extract JSON from response');
    }

    return JSON.parse(jsonMatch[1]);
}

async function buildTranslations() {
    console.log('🌐 Building translations from strings.json...\n');

    // Load source
    const sourcePath = path.join(MESSAGES_DIR, SOURCE_FILE);
    if (!fs.existsSync(sourcePath)) {
        console.error(`❌ Source file ${SOURCE_FILE} not found!`);
        process.exit(1);
    }

    const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const flatSource = flattenObject(sourceContent);

    // Check what needs translation
    const needsTranslation = {};
    const existingTranslations = {};

    for (const locale of TARGET_LOCALES) {
        const localePath = path.join(MESSAGES_DIR, `${locale}.json`);
        if (fs.existsSync(localePath)) {
            existingTranslations[locale] = flattenObject(JSON.parse(fs.readFileSync(localePath, 'utf8')));
        } else {
            existingTranslations[locale] = {};
        }
    }

    // Find missing keys
    for (const [key, value] of Object.entries(flatSource)) {
        const missing = TARGET_LOCALES.some(locale => !existingTranslations[locale][key]);
        if (missing) {
            needsTranslation[key] = value;
        }
    }

    if (Object.keys(needsTranslation).length === 0) {
        console.log('✅ All translations are up to date!');

        // Still write en.json
        fs.writeFileSync(
            path.join(MESSAGES_DIR, 'en.json'),
            JSON.stringify(sourceContent, null, 4)
        );
        return;
    }

    console.log(`📝 Found ${Object.keys(needsTranslation).length} keys to translate\n`);
    console.log('🤖 Calling AI for batch translation...\n');

    // Batch translate
    const translations = await batchTranslate(needsTranslation);

    // Merge with existing and write files
    console.log('� Writing translation files...\n');

    // Write en.json (copy of source)
    fs.writeFileSync(
        path.join(MESSAGES_DIR, 'en.json'),
        JSON.stringify(sourceContent, null, 4)
    );
    console.log('  ✓ en.json');

    // Write other locales
    for (const locale of TARGET_LOCALES) {
        const merged = { ...existingTranslations[locale], ...translations[locale] };
        const nested = unflattenObject(merged);

        fs.writeFileSync(
            path.join(MESSAGES_DIR, `${locale}.json`),
            JSON.stringify(nested, null, 4)
        );
        console.log(`  ✓ ${locale}.json (${LOCALE_NAMES[locale]})`);
    }

    console.log('\n✅ All translations built successfully!');
}

buildTranslations().catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
});
