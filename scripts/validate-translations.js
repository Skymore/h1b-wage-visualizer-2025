const fs = require('fs');
const path = require('path');
const readline = require('readline');

const MESSAGES_DIR = path.join(__dirname, '../messages');

// Load .env.local manually to ensure OPENROUTER_API_KEY is available
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            // Remove comments if any, and trim quotes
            let value = match[2].trim();
            if (value) {
                process.env[key] = value.replace(/^["']|["']$/g, '');
            }
        }
    });
}
const SOURCE_FILE = 'strings.json';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error('❌ Error: OPENROUTER_API_KEY not found');
    process.exit(1);
}

const TARGET_LOCALES = ['de', 'es', 'fr', 'hi', 'ja', 'ko', 'zh'];
const REQUIRED_PLACEHOLDERS = ['{count}', '{tool}', '{soc}', '{area}'];
const TECHNICAL_TERMS = ['H1B', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'SOC'];

// Flatten object
function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, fullKey));
        } else {
            result[fullKey] = value;
        }
    }
    return result;
}

// Check placeholder consistency
function checkPlaceholders(source, translation) {
    const issues = [];
    for (const placeholder of REQUIRED_PLACEHOLDERS) {
        const inSource = source.includes(placeholder);
        const inTranslation = translation.includes(placeholder);
        if (inSource && !inTranslation) {
            issues.push(`Missing placeholder ${placeholder}`);
        } else if (!inSource && inTranslation) {
            issues.push(`Extra placeholder ${placeholder} (not in source)`);
        }
    }
    return issues;
}

// Check technical terms
function checkTechnicalTerms(source, translation) {
    const issues = [];
    for (const term of TECHNICAL_TERMS) {
        if (source.includes(term) && !translation.includes(term)) {
            issues.push(`Technical term "${term}" should not be translated`);
        }
    }
    return issues;
}

// Find similar strings across components
function findSimilarStrings(flatSource) {
    const groups = {};
    const entries = Object.entries(flatSource);

    for (let i = 0; i < entries.length; i++) {
        const [key1, value1] = entries[i];
        for (let j = i + 1; j < entries.length; j++) {
            const [key2, value2] = entries[j];

            // Check if strings are similar (same words, different context)
            const words1 = value1.toLowerCase().split(/\s+/);
            const words2 = value2.toLowerCase().split(/\s+/);
            const commonWords = words1.filter(w => words2.includes(w));

            // If >50% overlap and different components
            if (commonWords.length > Math.min(words1.length, words2.length) * 0.5) {
                const component1 = key1.split('.')[0];
                const component2 = key2.split('.')[0];
                if (component1 !== component2) {
                    const groupKey = [value1, value2].sort().join('|||');
                    if (!groups[groupKey]) {
                        groups[groupKey] = { keys: [], value1, value2 };
                    }
                    if (!groups[groupKey].keys.includes(key1)) groups[groupKey].keys.push(key1);
                    if (!groups[groupKey].keys.includes(key2)) groups[groupKey].keys.push(key2);
                }
            }
        }
    }

    return Object.values(groups).filter(g => g.keys.length >= 2);
}

// AI validation
async function validateTranslationsWithAI(issues) {
    if (issues.length === 0) return [];

    const prompt = issues.map(issue =>
        `Key: ${issue.key}\nSource: "${issue.source}"\nTranslation (${issue.locale}): "${issue.translation}"\nProblem: ${issue.problem}`
    ).join('\n\n');

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
                content: `You are a translation quality expert for an H1B wage visualization app.

Review these translation issues and provide suggestions:

${prompt}

For each issue, respond in JSON format:
{
  "fixes": [
    {
      "key": "...",
      "locale": "...",
      "current": "...",
      "suggested": "...",
      "reason": "..."
    }
  ]
}

Only suggest fixes for actual errors. If a translation is acceptable despite the flagged issue, omit it.`
            }],
            temperature: 0.3,
            max_tokens: 4000
        })
    });

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[1]).fixes || [];
}

// Interactive prompt
async function promptUser(question, choices) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(`${question} (${choices.join('/')}) `, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function validateTranslations() {
    console.log('🔍 Validating translations...\n');

    // Load all files
    const sourcePath = path.join(MESSAGES_DIR, SOURCE_FILE);
    const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const flatSource = flattenObject(sourceContent);

    const translations = {};
    for (const locale of TARGET_LOCALES) {
        const localePath = path.join(MESSAGES_DIR, `${locale}.json`);
        if (fs.existsSync(localePath)) {
            translations[locale] = flattenObject(JSON.parse(fs.readFileSync(localePath, 'utf8')));
        }
    }

    const issues = [];

    // 1. Check placeholders and technical terms
    console.log('📋 Checking placeholders and technical terms...');
    for (const locale of TARGET_LOCALES) {
        for (const [key, sourceValue] of Object.entries(flatSource)) {
            const translation = translations[locale]?.[key];
            if (!translation) continue;

            const placeholderIssues = checkPlaceholders(sourceValue, translation);
            const termIssues = checkTechnicalTerms(sourceValue, translation);

            [...placeholderIssues, ...termIssues].forEach(problem => {
                issues.push({ key, locale, source: sourceValue, translation, problem });
            });
        }
    }

    // 2. Check similar strings consistency
    console.log('🔗 Checking cross-component consistency...');
    const similarGroups = findSimilarStrings(flatSource);
    for (const group of similarGroups) {
        for (const locale of TARGET_LOCALES) {
            const trans = group.keys.map(k => translations[locale]?.[k]).filter(Boolean);
            if (new Set(trans).size > 1) {
                issues.push({
                    key: group.keys.join(', '),
                    locale,
                    source: `Similar: "${group.value1}" vs "${group.value2}"`,
                    translation: trans.join(' vs '),
                    problem: 'Inconsistent translation for similar strings'
                });
            }
        }
    }

    if (issues.length === 0) {
        console.log('\n✅ All translations passed validation!\n');
        return;
    }

    console.log(`\n⚠️  Found ${issues.length} potential issues\n`);

    // 3. AI validation
    console.log('🤖 Consulting AI for suggestions...\n');
    const fixes = await validateTranslationsWithAI(issues.slice(0, 20)); // Limit to avoid token overflow

    if (fixes.length === 0) {
        console.log('✅ No fixes suggested by AI\n');
        return;
    }

    console.log(`💡 AI suggested ${fixes.length} fixes:\n`);

    // 4. Interactive review
    const appliedFixes = [];
    for (const fix of fixes) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Key: ${fix.key}`);
        console.log(`Locale: ${fix.locale}`);
        console.log(`Current:  "${fix.current}"`);
        console.log(`Suggested: "${fix.suggested}"`);
        console.log(`Reason: ${fix.reason}`);

        const answer = await promptUser('\nApply this fix?', ['y', 'n', 'q']);

        if (answer === 'q') break;
        if (answer === 'y') {
            appliedFixes.push(fix);
        }
    }

    // 5. Apply fixes
    if (appliedFixes.length > 0) {
        console.log(`\n📝 Applying ${appliedFixes.length} fixes...`);

        for (const fix of appliedFixes) {
            const locale = fix.locale;
            const keys = fix.key.split('.');
            let obj = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));

            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = fix.suggested;

            fs.writeFileSync(
                path.join(MESSAGES_DIR, `${locale}.json`),
                JSON.stringify(obj, null, 4)
            );
        }

        console.log('✅ Fixes applied!\n');
    } else {
        console.log('\n✅ No fixes applied\n');
    }
}

validateTranslations().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
