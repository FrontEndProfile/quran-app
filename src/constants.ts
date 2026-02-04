export interface AudioSource {
  id: string;
  name: string;
  baseUrl: string;
}

export const ARABIC_RECITERS: AudioSource[] = [
  {
    id: 'alafasy',
    name: 'Mishary Alafasy (64kbps)',
    baseUrl: 'https://everyayah.com/data/Alafasy_64kbps/'
  },
  {
    id: 'abdulbasit',
    name: 'Abdul Basit Mujawwad (128kbps)',
    baseUrl: 'https://everyayah.com/data/Abdul_Basit_Mujawwad_128kbps/'
  },
  {
    id: 'husary',
    name: 'Husary (64kbps)',
    baseUrl: 'https://everyayah.com/data/Husary_64kbps/'
  }
];

export const URDU_AUDIO_SOURCES: AudioSource[] = [
  {
    id: 'shamshad',
    name: 'Shamshad Ali Khan (Urdu translation, 46kbps)',
    baseUrl: 'https://everyayah.com/data/translations/urdu_shamshad_ali_khan_46kbps/'
  },
  {
    id: 'farhat',
    name: 'Farhat Hashmi (Urdu word-for-word)',
    baseUrl: 'https://everyayah.com/data/translations/urdu_farhat_hashmi/'
  }
];

export const DEFAULT_RECITER_ID = ARABIC_RECITERS[0].id;
export const DEFAULT_URDU_AUDIO_ID = URDU_AUDIO_SOURCES[0].id;
