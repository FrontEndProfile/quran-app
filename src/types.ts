export type TabMode = 'surah' | 'juz';

export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
}

export interface TranslationResource {
  id: number;
  name: string;
  author_name: string | null;
  language_name: string;
  translated_name?: {
    name: string;
    language_name: string;
  };
}

export interface VerseApi {
  id: number;
  verse_key: string;
  verse_number: number;
  chapter_id: number;
  text_uthmani: string;
  text_indopak?: string;
  text_uthmani_tajweed?: string;
  translations?: { text: string }[];
}

export interface VerseData {
  surah: number;
  ayah: number;
  verseKey: string;
  key: string;
  arabicText: string;
  arabicUthmani: string;
  arabicIndoPak?: string;
  arabicTajweed?: string;
  urduText: string;
}

export interface Settings {
  arabicFontPx: number;
  urduFontPx: number;
  reciterId: string;
  theme: 'warm' | 'dark';
  repeat: boolean;
  urduVoiceEnabled: boolean;
  playbackSpeed: number;
  quranScript: 'uthmani' | 'indopak' | 'tajweed';
}

export type PlaybackScope = 'surah' | 'ayah' | null;

export interface PlaybackState {
  isPlaying: boolean;
  phase: 'arabic' | 'urdu';
  currentIndex: number;
  status: 'idle' | 'playing' | 'paused' | 'stopped';
}

export interface Bookmark {
  id: string;
  mode: TabMode;
  juzNumber?: number;
  surahNumber: number;
  ayahNumber: number;
  timestamp: number;
}
