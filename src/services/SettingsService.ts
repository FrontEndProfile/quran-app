import type { Settings } from '../types';
import { DEFAULT_RECITER_ID, DEFAULT_URDU_AUDIO_ID } from '../constants';

const STORAGE_KEY = 'quran-urdu-player:settings:v2';

const DEFAULT_SETTINGS: Settings = {
  theme: 'warm',
  arabicFontSize: 36,
  urduFontSize: 20,
  reciterId: DEFAULT_RECITER_ID,
  urduAudioId: DEFAULT_URDU_AUDIO_ID,
  translationId: null
};

export class SettingsService {
  private settings: Settings;
  private listeners = new Set<(settings: Settings) => void>();

  constructor() {
    this.settings = this.load();
  }

  get(): Settings {
    return { ...this.settings };
  }

  update(partial: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...partial };
    this.persist();
    this.notify();
    return this.get();
  }

  subscribe(listener: (settings: Settings) => void): () => void {
    this.listeners.add(listener);
    listener(this.get());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = this.get();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private load(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}
