// Copy any keys present in en.json but missing in other locales,
// preserving existing translations and key order.
// Run: node scripts/sync-i18n.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'src', 'i18n', 'locales');
const targets = ['de', 'es', 'fr', 'uz', 'ar'];

function deepMergeMissing(source, target) {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return target === undefined ? source : target;
  }
  const out = {};
  for (const key of Object.keys(source)) {
    if (key in (target != null && typeof target === 'object' ? target : {})) {
      out[key] = deepMergeMissing(source[key], target[key]);
    } else {
      out[key] = source[key];
    }
  }
  // Preserve any extra keys the target had that source did not (defensive).
  if (target && typeof target === 'object') {
    for (const key of Object.keys(target)) {
      if (!(key in out)) out[key] = target[key];
    }
  }
  const orphans = Object.keys(target ?? {}).filter(k => !(k in (source ?? {})));
  if (orphans.length && typeof source === 'object' && source !== null) {
    console.warn(`  [warn] orphan keys not in source: ${orphans.join(', ')}`);
  }
  return out;
}

const en = JSON.parse(readFileSync(join(localesDir, 'en.json'), 'utf8'));

for (const lang of targets) {
  const path = join(localesDir, `${lang}.json`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const merged = deepMergeMissing(en, data);
  writeFileSync(path, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`synced ${lang}.json`);
}
