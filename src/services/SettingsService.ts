import type { Settings } from '../types';
import { DEFAULT_ARABIC_FONT_PX, DEFAULT_RECITER_ID, DEFAULT_URDU_FONT_PX, SETTINGS_STORAGE_KEY } from '../constants';

const DEFAULT_SETTINGS: Settings = {
  arabicFontPx: DEFAULT_ARABIC_FONT_PX,
  urduFontPx: DEFAULT_URDU_FONT_PX,
  reciterId: DEFAULT_RECITER_ID,
  theme: 'warm',
  repeat: false,
  urduVoiceEnabled: true,
  playbackSpeed: 1
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
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persist() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
  }
}
