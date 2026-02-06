import type { Bookmark, Chapter, PlaybackScope, PlaybackState, Settings, TabMode, VerseData } from '../types';

export interface AppState {
  viewMode: 'dashboard' | 'reader';
  dashboardTab: 'surah' | 'juz';
  currentMode: TabMode;
  currentSelection: number | null;
  verses: VerseData[];
  playbackState: PlaybackState;
  settings: Settings;
  bookmarks: Bookmark[];
  chapters: Chapter[];
  translatorName: string;
  translationId: number | null;
  playbackScope: PlaybackScope;
  activeMode: TabMode | null;
  activeSurahNumber: number | null;
  activeAyahKey: string | null;
  playerVisible: boolean;
  settingsOpen: boolean;
  speedMenuOpen: boolean;
  mobileNavOpen: boolean;
  mobileNavTab: 'surah' | 'juz' | 'bookmarks';
  readerOverlayVisible: boolean;
  loading: boolean;
  error: string;
}

type Listener = (state: AppState) => void;

type Updater = (state: AppState) => AppState;

export function createStore(initialState: AppState) {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getState = () => state;

  const setState = (nextState: AppState) => {
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };

  const update = (updater: Updater) => {
    setState(updater(state));
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  };

  return {
    getState,
    setState,
    update,
    subscribe
  };
}
