export const SITE_URL = 'https://quran.asmco.company';
const OG_IMAGE_PATH = '/og-image.svg';

export type SeoRoute =
  | { kind: 'home' }
  | { kind: 'surah-list' }
  | { kind: 'juz-list' }
  | { kind: 'surah-detail'; surahId: number; surahName?: string; ayah?: number }
  | { kind: 'juz-detail'; juzId: number };

interface SeoApplyOptions {
  siteUrl?: string;
}

interface SeoMeta {
  title: string;
  description: string;
  keywords: string;
}

function toInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizePath(pathname: string): string {
  const [rawPath] = pathname.split('?');
  const lowered = (rawPath || '/').toLowerCase();
  const withSlash = lowered.startsWith('/') ? lowered : `/${lowered}`;
  const compact = withSlash.replace(/\/{2,}/g, '/');
  if (compact === '/') return '/';
  return compact.endsWith('/') ? compact.slice(0, -1) : compact;
}

export function normalizeCurrentPath(): string {
  const normalized = normalizePath(window.location.pathname);
  if (normalized !== window.location.pathname) {
    window.history.replaceState(window.history.state, '', normalized + window.location.search + window.location.hash);
  }
  return normalized;
}

export function parseRouteFromPath(pathname: string): SeoRoute {
  const normalized = normalizePath(pathname);
  if (normalized === '/') return { kind: 'home' };
  const segments = normalized.slice(1).split('/');

  if (segments[0] === 'surah') {
    if (segments.length === 1) return { kind: 'surah-list' };
    const surahId = toInt(segments[1]);
    if (!surahId || surahId < 1 || surahId > 114) return { kind: 'home' };
    if (segments.length === 2) return { kind: 'surah-detail', surahId };

    const ayah = segments[2] === 'ayah' ? toInt(segments[3]) : null;
    if (segments.length === 4 && ayah && ayah > 0) {
      return { kind: 'surah-detail', surahId, ayah };
    }
    return { kind: 'surah-detail', surahId };
  }

  if (segments[0] === 'juz') {
    if (segments.length === 1) return { kind: 'juz-list' };
    const juzId = toInt(segments[1]);
    if (!juzId || juzId < 1 || juzId > 30) return { kind: 'home' };
    return { kind: 'juz-detail', juzId };
  }

  return { kind: 'home' };
}

export function routeToPath(route: SeoRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'surah-list':
      return '/surah';
    case 'juz-list':
      return '/juz';
    case 'surah-detail':
      if (route.ayah && route.ayah > 0) {
        return `/surah/${route.surahId}/ayah/${route.ayah}`;
      }
      return `/surah/${route.surahId}`;
    case 'juz-detail':
      return `/juz/${route.juzId}`;
    default:
      return '/';
  }
}

function buildMeta(route: SeoRoute): SeoMeta {
  switch (route.kind) {
    case 'home':
      return {
        title: 'Quran Urdu Player | Quran Pak Audio with Urdu Tarjuma',
        description:
          'Listen to Quran Pak ayah by ayah with Arabic recitation + Urdu tarjuma audio. Surah and Juz navigation, speed control, repeat, and script switching.',
        keywords: 'quran urdu, quran audio, quran pak online, urdu tarjuma, surah player, juz player'
      };
    case 'surah-list':
      return {
        title: 'All Surahs | Quran Urdu Audio Player',
        description:
          'Browse all 114 Surahs and listen with Arabic tilawat and Urdu translation audio. Quran e Pak reading and listening in one place.',
        keywords: 'surah list, quran surah audio, quran urdu translation, quran reader'
      };
    case 'juz-list':
      return {
        title: 'All Juz (Parah) | Quran Urdu Audio Player',
        description:
          'Open all 30 Juz (Parah) and play ayah-by-ayah Arabic recitation with Urdu tarjuma audio for smooth daily recitation.',
        keywords: 'juz list, para list, quran juz audio, quran urdu para'
      };
    case 'surah-detail': {
      const surahLabel = route.surahName ? `Surah ${route.surahName}` : `Surah ${route.surahId}`;
      if (route.ayah && route.ayah > 0) {
        return {
          title: `${surahLabel} Ayah ${route.ayah} | Quran Urdu Player`,
          description:
            `${surahLabel} Ayah ${route.ayah} with Arabic recitation and Urdu translation audio. Quran ayah-by-ayah playback with repeat and speed control.`,
          keywords: `${surahLabel.toLowerCase()}, ayah ${route.ayah}, quran urdu ayah, quran audio translation`
        };
      }
      return {
        title: `${surahLabel} | Quran Urdu Audio Player`,
        description:
          `${surahLabel} complete recitation with Urdu tarjuma audio. Play, pause, repeat, and switch reciter/script in this Quran web app.`,
        keywords: `${surahLabel.toLowerCase()}, quran surah audio, urdu tarjuma, quran player`
      };
    }
    case 'juz-detail':
      return {
        title: `Juz ${route.juzId} | Quran Urdu Audio Player`,
        description:
          `Listen to Juz ${route.juzId} with Arabic recitation and Urdu tarjuma audio. Ayah-by-ayah playback for focused Quran study.`,
        keywords: `juz ${route.juzId}, para ${route.juzId}, quran juz urdu, quran audio`
      };
    default:
      return {
        title: 'Quran Urdu Player',
        description: 'Quran Pak audio and Urdu translation player.',
        keywords: 'quran urdu, quran audio'
      };
  }
}

function getCanonicalUrl(siteUrl: string, route: SeoRoute) {
  const origin = siteUrl.replace(/\/+$/, '');
  const path = normalizePath(routeToPath(route));
  return path === '/' ? `${origin}/` : `${origin}${path}`;
}

function clearSeoTags() {
  const selectors = [
    'meta[data-seo-managed="true"]',
    'meta[name="description"]',
    'meta[name="keywords"]',
    'meta[name="robots"]',
    'meta[property^="og:"]',
    'meta[name^="twitter:"]',
    'link[rel="canonical"]',
    'script[data-seo-jsonld="true"]'
  ];
  document.head.querySelectorAll(selectors.join(',')).forEach((node) => node.remove());
}

function appendMeta(nameOrProperty: 'name' | 'property', key: string, content: string) {
  const meta = document.createElement('meta');
  meta.setAttribute(nameOrProperty, key);
  meta.content = content;
  meta.dataset.seoManaged = 'true';
  document.head.appendChild(meta);
}

function appendCanonical(href: string) {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = href;
  canonical.dataset.seoManaged = 'true';
  document.head.appendChild(canonical);
}

function buildBreadcrumb(route: SeoRoute, siteUrl: string) {
  const home = { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl.replace(/\/+$/, '')}/` };
  if (route.kind === 'home') return null;

  if (route.kind === 'surah-list') {
    return [home, { '@type': 'ListItem', position: 2, name: 'Surah', item: `${siteUrl.replace(/\/+$/, '')}/surah` }];
  }

  if (route.kind === 'juz-list') {
    return [home, { '@type': 'ListItem', position: 2, name: 'Juz', item: `${siteUrl.replace(/\/+$/, '')}/juz` }];
  }

  if (route.kind === 'surah-detail') {
    const surahName = route.surahName ? `Surah ${route.surahName}` : `Surah ${route.surahId}`;
    const surahItem = {
      '@type': 'ListItem',
      position: 3,
      name: surahName,
      item: `${siteUrl.replace(/\/+$/, '')}/surah/${route.surahId}`
    };
    const items = [
      home,
      { '@type': 'ListItem', position: 2, name: 'Surah', item: `${siteUrl.replace(/\/+$/, '')}/surah` },
      surahItem
    ];
    if (route.ayah && route.ayah > 0) {
      items.push({
        '@type': 'ListItem',
        position: 4,
        name: `Ayah ${route.ayah}`,
        item: `${siteUrl.replace(/\/+$/, '')}/surah/${route.surahId}/ayah/${route.ayah}`
      });
    }
    return items;
  }

  if (route.kind === 'juz-detail') {
    return [
      home,
      { '@type': 'ListItem', position: 2, name: 'Juz', item: `${siteUrl.replace(/\/+$/, '')}/juz` },
      {
        '@type': 'ListItem',
        position: 3,
        name: `Juz ${route.juzId}`,
        item: `${siteUrl.replace(/\/+$/, '')}/juz/${route.juzId}`
      }
    ];
  }

  return null;
}

function injectJsonLd(route: SeoRoute, canonicalUrl: string, siteUrl: string) {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'SoftwareApplication',
      name: 'Quran Urdu Player',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      inLanguage: ['ar', 'ur', 'en'],
      url: `${siteUrl.replace(/\/+$/, '')}/`,
      featureList: [
        'Ayah by ayah playback',
        'Arabic recitation + Urdu translation audio',
        'Surah and Juz navigation',
        'Reciter switch, speed control, repeat',
        'Uthmani, IndoPak and Tajweed scripts'
      ]
    },
    {
      '@type': 'WebSite',
      name: 'Quran Urdu Player',
      url: `${siteUrl.replace(/\/+$/, '')}/`,
      inLanguage: ['ar', 'ur', 'en']
    },
    {
      '@type': 'WebPage',
      name: document.title,
      url: canonicalUrl,
      isPartOf: { '@type': 'WebSite', name: 'Quran Urdu Player', url: `${siteUrl.replace(/\/+$/, '')}/` }
    }
  ];

  const breadcrumbItems = buildBreadcrumb(route, siteUrl);
  if (breadcrumbItems && breadcrumbItems.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems
    });
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.seoJsonld = 'true';
  script.text = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  });
  document.head.appendChild(script);
}

export function applySEO(route: SeoRoute, options: SeoApplyOptions = {}) {
  const siteUrl = options.siteUrl ?? SITE_URL;
  const meta = buildMeta(route);
  const canonicalUrl = getCanonicalUrl(siteUrl, route);
  const ogImageUrl = `${siteUrl.replace(/\/+$/, '')}${OG_IMAGE_PATH}`;

  clearSeoTags();
  document.title = meta.title;
  appendCanonical(canonicalUrl);

  appendMeta('name', 'description', meta.description);
  appendMeta('name', 'keywords', meta.keywords);
  appendMeta('name', 'robots', 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1');

  appendMeta('property', 'og:type', 'website');
  appendMeta('property', 'og:site_name', 'Quran Urdu Player');
  appendMeta('property', 'og:title', meta.title);
  appendMeta('property', 'og:description', meta.description);
  appendMeta('property', 'og:url', canonicalUrl);
  appendMeta('property', 'og:locale', 'en_US');
  appendMeta('property', 'og:image', ogImageUrl);
  appendMeta('property', 'og:image:alt', 'Quran Urdu Player - Arabic recitation and Urdu translation audio');

  appendMeta('name', 'twitter:card', 'summary');
  appendMeta('name', 'twitter:title', meta.title);
  appendMeta('name', 'twitter:description', meta.description);
  appendMeta('name', 'twitter:url', canonicalUrl);
  appendMeta('name', 'twitter:image', ogImageUrl);

  injectJsonLd(route, canonicalUrl, siteUrl);
}
