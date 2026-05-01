import fs from 'fs';
import path from 'path';

const localesDir = 'src/locales';
const srcDir = 'src';

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

function getAllKeys(obj, prefix = '') {
    let keys = [];
    for (let key in obj) {
        const fullKey = `${prefix}${key}`;
        keys.push(fullKey);
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(getAllKeys(obj[key], `${fullKey}.`));
        }
    }
    return keys;
}

const enKeys = getAllKeys(en);

function findTCalls(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'locales' && file !== 'node_modules') {
                findTCalls(fullPath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.matchAll(/\bt\(['"]([^'"]+)['"]/g);
            for (const match of matches) {
                const key = match[1];
                if (!enKeys.includes(key) && !key.includes('{{')) {
                    console.log(`Missing key: ${key} in ${fullPath}`);
                }
            }
        }
    }
}

findTCalls(srcDir);
