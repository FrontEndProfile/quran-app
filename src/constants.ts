export interface AudioSource {
  id: string;
  name: string;
  baseUrl: string;
}

export const QURAN_TEXT_API_BASE = 'https://api.quran.com/api/v4';

export const ARABIC_RECITERS: AudioSource[] = [
  {
    id: 'alafasy',
    name: 'Mishary Alafasy (128kbps)',
    baseUrl: 'https://everyayah.com/data/Alafasy_128kbps/'
  },
  {
    id: 'husary',
    name: 'Husary (128kbps)',
    baseUrl: 'https://everyayah.com/data/Husary_128kbps/'
  }
];

export const DEFAULT_RECITER_ID = ARABIC_RECITERS[0].id;

export const URDU_TRANSLATOR_NAME = 'Fateh Muhammad Jalandhari';
export const URDU_VOICE_NAME = 'Shamshad Ali Khan';
export const URDU_AUDIO_BASE_URL =
  'https://everyayah.com/data/translations/urdu_shamshad_ali_khan_46kbps/';

export const DEFAULT_ARABIC_FONT_PX = 36;
export const DEFAULT_URDU_FONT_PX = 20;

export const SETTINGS_STORAGE_KEY = 'quran-urdu-player:settings:v3';
export const BOOKMARKS_STORAGE_KEY = 'quran-urdu-player:bookmarks:v1';

export const URDU_TRANSLATION_STORAGE_KEY = 'quran-urdu-player:urdu-translation-id:v1';
