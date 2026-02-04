import type { Bookmark, TabMode } from '../types';
import { BOOKMARKS_STORAGE_KEY } from '../constants';

interface BookmarkPayload {
  mode: TabMode;
  surahNumber: number;
  ayahNumber: number;
  juzNumber?: number;
}

export function bookmarkId(payload: BookmarkPayload) {
  const juzPart = payload.mode === 'juz' ? `j${payload.juzNumber ?? 0}` : 's';
  return `${payload.mode}-${juzPart}-${payload.surahNumber}-${payload.ayahNumber}`;
}

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => Number.isFinite(item.timestamp));
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
}

export function toggleBookmark(bookmarks: Bookmark[], payload: BookmarkPayload): Bookmark[] {
  const id = bookmarkId(payload);
  const exists = bookmarks.find((item) => item.id === id);
  if (exists) {
    return bookmarks.filter((item) => item.id !== id);
  }

  const next: Bookmark = {
    id,
    mode: payload.mode,
    surahNumber: payload.surahNumber,
    ayahNumber: payload.ayahNumber,
    juzNumber: payload.juzNumber,
    timestamp: Date.now()
  };

  return [next, ...bookmarks];
}

export function isBookmarked(bookmarks: Bookmark[], payload: BookmarkPayload): boolean {
  const id = bookmarkId(payload);
  return bookmarks.some((item) => item.id === id);
}

export function sortBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);
}
