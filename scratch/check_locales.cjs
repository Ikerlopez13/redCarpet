const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/locales');
const esData = JSON.parse(fs.readFileSync(path.join(localesDir, 'es.json'), 'utf8'));

const files = ['ca.json', 'en.json', 'fr.json', 'pt.json', 'de.json', 'it.json'];

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

const esKeys = getKeys(esData);
console.log(`es.json has ${esKeys.length} keys.`);

files.forEach(file => {
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`${file} does not exist.`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = getKeys(data);
    const missing = esKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !esKeys.includes(k));
    console.log(`${file}: keys=${keys.length}, missing=${missing.length}, extra=${extra.length}`);
});
