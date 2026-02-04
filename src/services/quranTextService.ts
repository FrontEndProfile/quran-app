import type { Chapter, TranslationResource, VerseApi } from '../types';
import { QURAN_TEXT_API_BASE, URDU_TRANSLATOR_NAME } from '../constants';

interface ChaptersResponse {
  chapters: Chapter[];
}

interface TranslationsResponse {
  translations: TranslationResource[];
}

interface VersesResponse {
  verses: VerseApi[];
  pagination?: {
    next_page: number | null;
    total_pages: number | null;
  };
}

export interface UrduTranslationMatch {
  id: number | null;
  name: string;
}

export class QuranTextService {
  private cache = new Map<string, unknown>();

  async getChapters(): Promise<Chapter[]> {
    const response = await this.fetchJson<ChaptersResponse>(`${QURAN_TEXT_API_BASE}/chapters`, 'chapters');
    return response.chapters;
  }

  async getTranslations(): Promise<TranslationResource[]> {
    const response = await this.fetchJson<TranslationsResponse>(
      `${QURAN_TEXT_API_BASE}/resources/translations?language=ur`,
      'translations-ur'
    );
    return response.translations;
  }

  async getVersesByChapter(chapterNumber: number, translationId: number): Promise<VerseApi[]> {
    return this.fetchAllVerses(`verses/by_chapter/${chapterNumber}`, translationId);
  }

  async getVersesByJuz(juzNumber: number, translationId: number): Promise<VerseApi[]> {
    return this.fetchAllVerses(`verses/by_juz/${juzNumber}`, translationId);
  }

  private async fetchAllVerses(path: string, translationId: number): Promise<VerseApi[]> {
    const verses: VerseApi[] = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = new URL(`${QURAN_TEXT_API_BASE}/${path}`);
      url.searchParams.set('translations', String(translationId));
      url.searchParams.set('fields', 'text_uthmani,verse_key,verse_number,chapter_id');
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));

      const cacheKey = `${path}:${translationId}:${page}`;
      const response = await this.fetchJson<VersesResponse>(url.toString(), cacheKey);
      verses.push(...response.verses);

      const nextPage = response.pagination?.next_page;
      if (!nextPage) break;
      page = nextPage;
    }

    return verses;
  }

  private async fetchJson<T>(url: string, cacheKey?: string): Promise<T> {
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as T;
    if (cacheKey) {
      this.cache.set(cacheKey, data);
    }
    return data;
  }
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveUrduTranslation(translations: TranslationResource[]): UrduTranslationMatch {
  let best: TranslationResource | null = null;
  let bestScore = 0;

  for (const translation of translations) {
    const haystack = normalize(`${translation.name ?? ''} ${translation.author_name ?? ''}`);
    const hasJalandh = haystack.includes('jalandh');
    const hasFateh = haystack.includes('fateh');
    const hasMuhammad = haystack.includes('muhammad');
    const score = (hasJalandh ? 2 : 0) + (hasFateh ? 1 : 0) + (hasMuhammad ? 1 : 0);

    if (score > bestScore) {
      bestScore = score;
      best = translation;
    }
  }

  if (!best || bestScore === 0) {
    return { id: null, name: URDU_TRANSLATOR_NAME };
  }

  return {
    id: best.id,
    name: best.translated_name?.name ?? best.name
  };
}
