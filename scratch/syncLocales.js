const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/locales');
const esPath = path.join(localesDir, 'es.json');
const caPath = path.join(localesDir, 'ca.json');
const enPath = path.join(localesDir, 'en.json');
const frPath = path.join(localesDir, 'fr.json');

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// Recursive merge function
function mergeKeys(source, target) {
    const result = { ...target };
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            result[key] = mergeKeys(source[key], target[key] || {});
        } else {
            if (target[key] === undefined) {
                result[key] = source[key];
            }
        }
    }
    // Remove extra keys in target that are not in source
    for (const key in result) {
        if (source[key] === undefined) {
            delete result[key];
        }
    }
    return result;
}

const caData = fs.existsSync(caPath) ? JSON.parse(fs.readFileSync(caPath, 'utf8')) : {};
const enData = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : {};
const frData = fs.existsSync(frPath) ? JSON.parse(fs.readFileSync(frPath, 'utf8')) : {};

const newCaData = mergeKeys(esData, caData);
const newEnData = mergeKeys(esData, enData);
const newFrData = mergeKeys(esData, frData);

fs.writeFileSync(caPath, JSON.stringify(newCaData, null, 2) + '\n');
fs.writeFileSync(enPath, JSON.stringify(newEnData, null, 2) + '\n');
fs.writeFileSync(frPath, JSON.stringify(newFrData, null, 2) + '\n');

console.log('Locales synchronized!');
