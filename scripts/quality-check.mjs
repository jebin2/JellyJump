import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const failures = [];

async function walk(dir, predicate = () => true) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walk(fullPath, predicate));
        } else if (predicate(fullPath)) {
            files.push(fullPath);
        }
    }

    return files;
}

function countBraces(line) {
    let depth = 0;
    for (const char of line) {
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
    }
    return depth;
}

async function checkDuplicateClassMethods(filePath) {
    const source = await readFile(filePath, 'utf8');
    const lines = source.split(/\r?\n/);
    let className = null;
    let classDepth = 0;
    let methods = new Map();

    lines.forEach((line, index) => {
        const classMatch = line.match(/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/);
        if (!className && classMatch) {
            className = classMatch[1];
            classDepth = countBraces(line);
            methods = new Map();
            return;
        }

        if (!className) return;

        if (classDepth === 1) {
            const methodMatch = line.match(/^\s*(?:(static)\s+)?(?:(async)\s+)?(?:(get|set)\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
            if (methodMatch) {
                const [, staticPrefix, , accessor, methodName] = methodMatch;
                const key = `${staticPrefix || ''}:${accessor || 'method'}:${methodName}`;
                if (methods.has(key)) {
                    const relativePath = path.relative(root, filePath);
                    failures.push(`${relativePath}:${index + 1} duplicate class method "${methodName}" in ${className}; first defined on line ${methods.get(key)}`);
                } else {
                    methods.set(key, index + 1);
                }
            }
        }

        classDepth += countBraces(line);
        if (classDepth <= 0) {
            className = null;
            methods = new Map();
        }
    });
}

async function checkAccidentalLocalCommands(filePath) {
    const source = await readFile(filePath, 'utf8');
    const localCommandPattern = /\b(?:claude|codex)\s+--resume\s+[a-z0-9-]+/i;
    if (localCommandPattern.test(source)) {
        failures.push(`${path.relative(root, filePath)} contains an accidental local resume command`);
    }
}

const jsFiles = await walk(path.join(root, 'assets/js'), (filePath) => {
    return filePath.endsWith('.js') && !filePath.includes(`${path.sep}lib${path.sep}`);
});

/**
 * An empty catch hides a failure on purpose; the purpose has to be written
 * down, or the next reader cannot tell a deliberate shrug from a forgotten
 * handler. A comment inside the braces is enough.
 */
async function checkSilentCatches(filePath) {
    const source = await readFile(filePath, 'utf8');
    const pattern = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
    let match;
    while ((match = pattern.exec(source))) {
        const line = source.slice(0, match.index).split('\n').length;
        failures.push(`${path.relative(root, filePath)}:${line} empty catch block; say why it is safe to ignore`);
    }
}

/**
 * Browser code logs through Logger, which keeps production quiet and can be
 * switched on with ?debug=1. A bare console call bypasses both.
 */
const LOGGER_FILE = path.join(root, 'assets/js/shared/utils/Logger.js');
async function checkBareConsole(filePath) {
    if (filePath === LOGGER_FILE) return;
    const lines = (await readFile(filePath, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/\bconsole\.(log|warn|error|info|debug)\(/.test(line)) {
            failures.push(`${path.relative(root, filePath)}:${index + 1} uses console directly; use Logger`);
        }
    });
}

const desktopFiles = await walk(path.join(root, 'desktop'), (filePath) => {
    return filePath.endsWith('.js')
        && !filePath.includes(`${path.sep}node_modules${path.sep}`)
        && !filePath.includes(`${path.sep}build${path.sep}`)
        && !filePath.includes(`${path.sep}dist${path.sep}`);
});

for (const filePath of jsFiles) {
    await checkDuplicateClassMethods(filePath);
    await checkSilentCatches(filePath);
    await checkBareConsole(filePath);
}
for (const filePath of desktopFiles) {
    await checkSilentCatches(filePath);
}

// Every tracked Markdown file, wherever it lives: a hard-coded docs/ folder
// made this whole check crash once that folder was removed.
const markdownFiles = execSync('git ls-files "*.md"', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => path.join(root, file));

for (const filePath of markdownFiles) {
    await checkAccidentalLocalCommands(filePath);
}

if (failures.length > 0) {
    console.error('Quality check failed:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log(`Quality check passed (${jsFiles.length + desktopFiles.length} JavaScript files, ${markdownFiles.length} Markdown files).`);
