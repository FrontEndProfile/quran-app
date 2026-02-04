import './styles.css';
import { QuranTextService, resolveUrduTranslation, stripHtml } from './services/quranTextService';
import { PlayerService, ayahFileKey } from './services/playerService';
import { SettingsService } from './services/SettingsService';
import {
  ARABIC_RECITERS,
  DEFAULT_RECITER_ID,
  URDU_TRANSLATION_STORAGE_KEY,
  URDU_AUDIO_BASE_URL,
  URDU_TRANSLATOR_NAME
} from './constants';
import type { Chapter, Settings, TabMode, VerseApi, VerseData } from './types';
import { createStore } from './app/store';
import {
  markUserScroll,
  renderPlayerBar,
  renderNotice,
  renderSettingsPanel,
  renderSidebar,
  renderVerses,
  showToast,
  updateActiveAyahUI,
  updateWordHighlightByProgress
} from './app/render';
import { loadBookmarks, saveBookmarks, toggleBookmark } from './app/bookmarks';

const api = new QuranTextService();
const player = new PlayerService();
const settingsService = new SettingsService();

const store = createStore({
  currentMode: 'surah' as TabMode,
  currentSelection: null,
  verses: [],
  playbackState: player.getState(),
  settings: settingsService.get(),
  bookmarks: loadBookmarks(),
  chapters: [] as Chapter[],
  translatorName: URDU_TRANSLATOR_NAME,
  translationId: null,
  playerVisible: false,
  settingsOpen: false,
  loading: true,
  error: ''
});

function applyFontSizes(arabic: number, urdu: number) {
  document.documentElement.style.setProperty('--arabic-size', `${arabic}px`);
  document.documentElement.style.setProperty('--urdu-size', `${urdu}px`);
}

function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset.theme = theme;
}

function getReciterBase(id: string): string {
  return ARABIC_RECITERS.find((reciter) => reciter.id === id)?.baseUrl ?? ARABIC_RECITERS[0].baseUrl;
}

async function loadSelection(
  mode: TabMode,
  number: number,
  startAt?: { surah: number; ayah: number },
  autoplay = false
) {
  if (autoplay) {
    store.update((state) => ({ ...state, playerVisible: true }));
    renderPlayerBar(store.getState());
  }

  const translationId = store.getState().translationId;
  if (!translationId) {
    store.update((current) => ({ ...current, error: 'Urdu translation not found.' }));
    renderNotice(store.getState());
    return;
  }

  store.update((state) => ({ ...state, loading: true, error: '' }));
  renderNotice(store.getState());
  renderSidebar(store.getState());

  try {
    let verseApi: VerseApi[] = [];
    if (mode === 'surah') {
      verseApi = await api.getVersesByChapter(number, translationId);
    } else {
      verseApi = await api.getVersesByJuz(number, translationId);
    }

    const verses: VerseData[] = verseApi.map((verse) => {
      const [surahStr, ayahStr] = verse.verse_key.split(':');
      const surah = Number(surahStr);
      const ayah = Number(ayahStr);
      return {
        surah,
        ayah,
        verseKey: verse.verse_key,
        key: ayahFileKey(surah, ayah),
        arabicText: verse.text_uthmani,
        urduText: stripHtml(verse.translations?.[0]?.text ?? '')
      };
    });

    const startIndex = startAt
      ? Math.max(
          verses.findIndex((verse) => verse.surah === startAt.surah && verse.ayah === startAt.ayah),
          0
        )
      : 0;

    store.update((state) => ({
      ...state,
      currentMode: mode,
      currentSelection: number,
      verses,
      loading: false,
      error: ''
    }));

    player.loadPlaylist(verses);
    player.setSources(getReciterBase(store.getState().settings.reciterId), URDU_AUDIO_BASE_URL);

    if (autoplay && verses.length) {
      player.playFromIndex(startIndex);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load selection.';
    store.update((state) => ({
      ...state,
      loading: false,
      error: message,
      playerVisible: autoplay ? false : state.playerVisible
    }));
    renderNotice(store.getState());
    renderPlayerBar(store.getState());
  } finally {
    renderSidebar(store.getState());
    renderVerses(store.getState());
    updateActiveAyahUI(store.getState());
  }
}

function updateSettings(partial: Partial<Settings>) {
  const updated = settingsService.update(partial);
  store.update((state) => ({ ...state, settings: updated }));
  applyFontSizes(updated.arabicFontPx, updated.urduFontPx);
  applyTheme(updated.theme);
  player.setRepeat(updated.repeat);
  renderPlayerBar(store.getState());
  renderSettingsPanel(store.getState());
}

function handleClick(event: Event) {
  const target = event.target as HTMLElement;
  const actionEl = target.closest('[data-action]') as HTMLElement | null;
  const action = actionEl?.dataset.action;
  if (!action) return;

  if (action === 'switch-mode') {
    const mode = actionEl?.dataset.mode as TabMode;
    if (mode && mode !== store.getState().currentMode) {
      store.update((state) => ({ ...state, currentMode: mode }));
      renderSidebar(store.getState());
    }
    return;
  }

  if (action === 'select-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    player.stop();
    store.update((state) => ({ ...state, playerVisible: false }));
    renderPlayerBar(store.getState());
    loadSelection(mode, number, undefined, false);
    return;
  }

  if (action === 'play-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    loadSelection(mode, number, undefined, true);
    return;
  }

  if (action === 'play') {
    player.play();
    return;
  }

  if (action === 'pause') {
    player.pause();
    return;
  }

  if (action === 'stop') {
    player.stop();
    store.update((state) => ({ ...state, playerVisible: false }));
    renderPlayerBar(store.getState());
    return;
  }

  if (action === 'next-ayah') {
    player.next();
    return;
  }

  if (action === 'prev-ayah') {
    player.prev();
    return;
  }

  if (action === 'prev-surah') {
    const state = store.getState();
    if (state.currentMode === 'surah') {
      const prev = (state.currentSelection ?? 1) - 1;
      if (prev >= 1) {
        loadSelection('surah', prev, undefined, true);
      }
      return;
    }
    player.prevSurah();
    return;
  }

  if (action === 'next-surah') {
    const state = store.getState();
    if (state.currentMode === 'surah') {
      const next = (state.currentSelection ?? 1) + 1;
      if (next <= state.chapters.length) {
        loadSelection('surah', next, undefined, true);
      }
      return;
    }
    player.nextSurah();
    return;
  }

  if (action === 'toggle-repeat') {
    updateSettings({ repeat: !store.getState().settings.repeat });
    return;
  }

  if (action === 'arabic-inc') {
    updateSettings({ arabicFontPx: Math.min(store.getState().settings.arabicFontPx + 2, 52) });
    return;
  }

  if (action === 'arabic-dec') {
    updateSettings({ arabicFontPx: Math.max(store.getState().settings.arabicFontPx - 2, 24) });
    return;
  }

  if (action === 'urdu-inc') {
    updateSettings({ urduFontPx: Math.min(store.getState().settings.urduFontPx + 2, 28) });
    return;
  }

  if (action === 'urdu-dec') {
    updateSettings({ urduFontPx: Math.max(store.getState().settings.urduFontPx - 2, 14) });
    return;
  }

  if (action === 'play-ayah') {
    const index = Number(actionEl?.dataset.index);
    if (!Number.isFinite(index)) return;
    player.stop();
    player.loadPlaylist(store.getState().verses);
    player.setSources(getReciterBase(store.getState().settings.reciterId), URDU_AUDIO_BASE_URL);
    player.playFromIndex(index);
    store.update((state) => ({ ...state, playerVisible: true }));
    renderPlayerBar(store.getState());
    return;
  }

  if (action === 'toggle-bookmark') {
    const index = Number(actionEl?.dataset.index);
    if (!Number.isFinite(index)) return;
    const verse = store.getState().verses[index];
    if (!verse) return;

    const mode = store.getState().currentMode;
    const next = toggleBookmark(store.getState().bookmarks, {
      mode,
      surahNumber: verse.surah,
      ayahNumber: verse.ayah,
      juzNumber: mode === 'juz' ? store.getState().currentSelection ?? undefined : undefined
    });

    saveBookmarks(next);
    store.update((state) => ({ ...state, bookmarks: next }));
    renderSidebar(store.getState());
    renderVerses(store.getState());
    updateActiveAyahUI(store.getState());
    return;
  }

  if (action === 'bookmark-jump') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const surah = Number(actionEl?.dataset.surah);
    const ayah = Number(actionEl?.dataset.ayah);
    const juz = Number(actionEl?.dataset.juz);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;

    const selectionNumber = mode === 'surah' ? surah : juz;
    if (!Number.isFinite(selectionNumber)) return;

    loadSelection(mode, selectionNumber, { surah, ayah }, true);
    return;
  }

  if (action === 'toggle-settings') {
    store.update((state) => ({ ...state, settingsOpen: !state.settingsOpen }));
    renderSettingsPanel(store.getState());
    return;
  }

  if (action === 'close-settings') {
    store.update((state) => ({ ...state, settingsOpen: false }));
    renderSettingsPanel(store.getState());
    return;
  }

  if (action === 'toggle-theme') {
    const nextTheme = store.getState().settings.theme === 'warm' ? 'dark' : 'warm';
    updateSettings({ theme: nextTheme });
    return;
  }
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;

  if (action === 'reciter-select') {
    const reciterId = target.value || DEFAULT_RECITER_ID;
    updateSettings({ reciterId });
    player.setSources(getReciterBase(reciterId), URDU_AUDIO_BASE_URL);
    player.restartCurrent();
  }
}

async function init() {
  applyFontSizes(store.getState().settings.arabicFontPx, store.getState().settings.urduFontPx);
  applyTheme(store.getState().settings.theme);
  player.setRepeat(store.getState().settings.repeat);
  const currentReciter = store.getState().settings.reciterId;
  if (!ARABIC_RECITERS.some((reciter) => reciter.id === currentReciter)) {
    updateSettings({ reciterId: DEFAULT_RECITER_ID });
  }

  try {
    const [chapters, translations] = await Promise.all([
      api.getChapters(),
      api.getTranslations()
    ]);

    const match = resolveUrduTranslation(translations);
    if (match.id) {
      localStorage.setItem(URDU_TRANSLATION_STORAGE_KEY, String(match.id));
    }

    store.update((state) => ({
      ...state,
      chapters,
      translatorName: URDU_TRANSLATOR_NAME,
      translationId: match.id ?? null,
      loading: false,
      error: match.id ? '' : 'Urdu translation not found (Jalandhari).'
    }));
    renderNotice(store.getState());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Quran data.';
    store.update((state) => ({ ...state, loading: false, error: message }));
    renderNotice(store.getState());
  } finally {
    renderSidebar(store.getState());
    renderPlayerBar(store.getState());
    renderSettingsPanel(store.getState());
    renderVerses(store.getState());
    renderNotice(store.getState());
  }
}

player.subscribe((playbackState) => {
  store.update((state) => ({ ...state, playbackState }));
  renderPlayerBar(store.getState());
  updateActiveAyahUI(store.getState());
});

player.onNotice((message) => {
  showToast(message);
});

player.onProgress((payload) => {
  updateWordHighlightByProgress(store.getState(), {
    phase: payload.phase,
    currentIndex: payload.currentIndex,
    currentTime: payload.currentTime,
    duration: payload.duration
  });
});

settingsService.subscribe((settings) => {
  store.update((state) => ({ ...state, settings }));
  applyFontSizes(settings.arabicFontPx, settings.urduFontPx);
  applyTheme(settings.theme);
  player.setRepeat(settings.repeat);
  renderPlayerBar(store.getState());
  renderSettingsPanel(store.getState());
});

window.addEventListener('click', handleClick);
window.addEventListener('change', handleChange);
window.addEventListener('scroll', markUserScroll, { passive: true });
window.addEventListener('beforeunload', () => player.stop());

init();
