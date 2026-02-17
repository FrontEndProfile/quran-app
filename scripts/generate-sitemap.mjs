import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = (process.env.SITE_URL || 'https://quran.asmco.company').replace(/\/+$/, '');
const OUT_DIR = resolve(process.cwd(), 'dist');
const OUT_FILE = resolve(OUT_DIR, 'sitemap.xml');
const LASTMOD = new Date().toISOString().slice(0, 10);
const INCLUDE_AYAHS = !['0', 'false', 'no'].includes((process.env.SITEMAP_INCLUDE_AYAHS || 'true').toLowerCase());

const SURAH_VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78,
  118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38,
  29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
  56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];

function normalizePath(path) {
  const lower = path.toLowerCase();
  const withLeadingSlash = lower.startsWith('/') ? lower : `/${lower}`;
  const compact = withLeadingSlash.replace(/\/{2,}/g, '/');
  if (compact === '/') return '/';
  return compact.endsWith('/') ? compact.slice(0, -1) : compact;
}

function toAbsoluteUrl(path) {
  return `${SITE_URL}${normalizePath(path)}`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlEntry(path, changefreq, priority) {
  return `  <url>
    <loc>${xmlEscape(toAbsoluteUrl(path))}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

const entries = [];
entries.push(buildUrlEntry('/', 'daily', 1.0));
entries.push(buildUrlEntry('/surah', 'weekly', 0.9));
entries.push(buildUrlEntry('/juz', 'weekly', 0.9));

for (let surah = 1; surah <= 114; surah += 1) {
  entries.push(buildUrlEntry(`/surah/${surah}`, 'weekly', 0.8));
}

for (let juz = 1; juz <= 30; juz += 1) {
  entries.push(buildUrlEntry(`/juz/${juz}`, 'weekly', 0.7));
}

if (INCLUDE_AYAHS) {
  SURAH_VERSE_COUNTS.forEach((ayahCount, index) => {
    const surah = index + 1;
    for (let ayah = 1; ayah <= ayahCount; ayah += 1) {
      entries.push(buildUrlEntry(`/surah/${surah}/ayah/${ayah}`, 'monthly', 0.6));
    }
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, xml, 'utf8');

console.log(`Sitemap generated at ${OUT_FILE}`);
console.log(`Total URLs: ${entries.length}`);
