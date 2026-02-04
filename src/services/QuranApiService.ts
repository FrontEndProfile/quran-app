import type { Chapter, TranslationResource, VerseApi } from '../types';

const API_BASE = 'https://api.quran.com/api/v4';

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

export class QuranApiService {
  private cache = new Map<string, unknown>();

  async getChapters(): Promise<Chapter[]> {
    const response = await this.fetchJson<ChaptersResponse>(`${API_BASE}/chapters`, 'chapters');
    return response.chapters;
  }

  async getTranslations(): Promise<TranslationResource[]> {
    const response = await this.fetchJson<TranslationsResponse>(
      `${API_BASE}/resources/translations?language=ur`,
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
      const url = new URL(`${API_BASE}/${path}`);
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
