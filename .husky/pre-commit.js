const { execSync } = require('child_process');

console.log('🔍 Pre-commit: Checking for hardcoded strings...\n');

// Get staged files
let stagedFiles;
try {
    stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
        .split('\n')
        .filter(file => /\.(tsx?|jsx?)$/.test(file) && file.trim() !== '');
} catch (error) {
    console.error('❌ Failed to get staged files');
    process.exit(1);
}

if (stagedFiles.length === 0) {
    console.log('✅ No code files to check\n');
    process.exit(0);
}

// Check for hardcoded strings in diff
const HARDCODED_PATTERNS = [
    // JSX text: >Text<
    />([A-Z][a-zA-Z\s]{2,})</g,
    // String props (but not className, etc)
    /(?:placeholder|title|aria-label|alt)=["']([^"'{}<>]+)["']/g,
];

const IGNORE_PATTERNS = [
    'className', 'import ', 'export ', 'from ', 'console.', 't(', 'useTranslations',
    'http://', 'https://', 'localhost', 'process.env', '//', '/*'
];

let hasIssues = false;

for (const file of stagedFiles) {
    try {
        const diff = execSync(`git diff --cached ${file}`, { encoding: 'utf8' });
        const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));

        for (const line of addedLines) {
            const cleanLine = line.substring(1);

            if (IGNORE_PATTERNS.some(p => cleanLine.includes(p))) continue;

            for (const pattern of HARDCODED_PATTERNS) {
                const matches = [...cleanLine.matchAll(pattern)];
                for (const match of matches) {
                    const text = match[1]?.trim();
                    if (!text || text.length < 3 || /^[A-Z_]+$/.test(text) || /\d/.test(text)) continue;

                    hasIssues = true;
                    console.log(`⚠️  ${file}`);
                    console.log(`   "${text}"`);
                    console.log(`   ${cleanLine.trim()}\n`);
                }
            }
        }
    } catch (error) {
        // Ignore errors for deleted files
    }
}

if (hasIssues) {
    console.log('💡 Tip: Add strings to messages/strings.json and use t("key")');
    console.log('To bypass: git commit --no-verify\n');
    process.exit(1);
}

// Auto-build translations if strings.json changed
const stringsChanged = stagedFiles.includes('messages/strings.json');
if (stringsChanged) {
    console.log('📝 strings.json changed, building translations...\n');
    try {
        execSync('npm run translate', { stdio: 'inherit' });
        execSync('git add messages/*.json', { stdio: 'inherit' });
        console.log('\n✅ Translations updated and staged\n');
    } catch (error) {
        console.error('❌ Failed to build translations');
        process.exit(1);
    }
}

console.log('✅ Pre-commit checks passed\n');
