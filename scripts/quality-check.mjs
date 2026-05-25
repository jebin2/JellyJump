import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

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

for (const filePath of jsFiles) {
    await checkDuplicateClassMethods(filePath);
}

const markdownFiles = [
    path.join(root, 'README.md'),
    ...await walk(path.join(root, 'docs'), (filePath) => filePath.endsWith('.md')),
];

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

console.log(`Quality check passed (${jsFiles.length} JavaScript files, ${markdownFiles.length} Markdown files).`);
