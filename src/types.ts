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
  translations?: { text: string }[];
}

export interface VerseData {
  surah: number;
  ayah: number;
  verseKey: string;
  fileKey: string;
  arabicText: string;
  urduText: string;
}

export interface Settings {
  theme: 'warm' | 'dark';
  arabicFontSize: number;
  urduFontSize: number;
  reciterId: string;
  urduAudioId: string;
  translationId: number | null;
}

export type PlaybackStage = 'idle' | 'arabic' | 'urdu' | 'text';

export interface PlayerState {
  status: 'idle' | 'playing' | 'paused' | 'stopped';
  currentIndex: number;
  stage: PlaybackStage;
}
