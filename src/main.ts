import './styles.css';
import { QuranTextService, resolveUrduTranslation, stripHtml } from './services/quranTextService';
import { PlayerService, ayahFileKey } from './services/PlayerService';
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
import { elements } from './app/elements';
import {
  clearActiveAyahUI,
  markUserScroll,
  renderPlayerBar,
  renderDashboard,
  renderNotice,
  renderSettingsPanel,
  renderSidebar,
  renderMobileNav,
  renderReaderOverlay,
  renderSelectionHeaderOnly,
  renderVerses,
  showToast,
  updateActiveAyahUI,
  updateWordHighlightByProgress
} from './app/render';
import { loadBookmarks, saveBookmarks, toggleBookmark } from './app/bookmarks';
import { applySEO, normalizeCurrentPath, parseRouteFromPath, routeToPath, SITE_URL, type SeoRoute } from './seo';
import { initPwaInstallPrompt } from './pwaInstall';

const api = new QuranTextService();
const player = new PlayerService();
const settingsService = new SettingsService();

const store = createStore({
  viewMode: 'dashboard',
  dashboardTab: 'surah',
  currentMode: 'surah' as TabMode,
  currentSelection: null,
  verses: [],
  playbackState: player.getState(),
  settings: settingsService.get(),
  bookmarks: loadBookmarks(),
  chapters: [] as Chapter[],
  translatorName: URDU_TRANSLATOR_NAME,
  translationId: null,
  playbackScope: null,
  activeMode: null,
  activeSurahNumber: null,
  activeAyahKey: null,
  playerVisible: true,
  settingsOpen: false,
  speedMenuOpen: false,
  mobileNavOpen: false,
  mobileNavTab: 'surah',
  readerOverlayVisible: false,
  loading: true,
  error: ''
});

let overlayTimer: number | null = null;
type HistoryMode = 'push' | 'replace' | 'none';

function getSurahNameById(surahId: number): string | undefined {
  return store.getState().chapters.find((chapter) => chapter.id === surahId)?.name_simple;
}

function buildSeoRouteFromState(explicitAyah?: number): SeoRoute {
  const state = store.getState();
  if (state.viewMode === 'dashboard') {
    if (state.dashboardTab === 'juz') return { kind: 'juz-list' };
    return { kind: 'surah-list' };
  }

  if (state.currentMode === 'surah' && state.currentSelection) {
    const route: Extract<SeoRoute, { kind: 'surah-detail' }> = {
      kind: 'surah-detail',
      surahId: state.currentSelection,
      surahName: getSurahNameById(state.currentSelection)
    };
    if (explicitAyah && explicitAyah > 0) {
      route.ayah = explicitAyah;
    }
    return route;
  }

  if (state.currentMode === 'juz' && state.currentSelection) {
    return { kind: 'juz-detail', juzId: state.currentSelection };
  }

  return { kind: 'home' };
}

function syncRouteAndSeo(options: { historyMode?: HistoryMode; route?: SeoRoute; explicitAyah?: number } = {}) {
  const { historyMode = 'none', explicitAyah } = options;
  const route = options.route ?? buildSeoRouteFromState(explicitAyah);
  const targetPath = routeToPath(route);

  if (historyMode !== 'none' && window.location.pathname !== targetPath) {
    if (historyMode === 'replace') {
      window.history.replaceState(window.history.state, '', targetPath);
    } else {
      window.history.pushState(window.history.state, '', targetPath);
    }
  }

  applySEO(route, { siteUrl: SITE_URL });
}

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
  autoplay = false,
  scopeOverride?: 'surah' | 'ayah',
  scrollToTop = false,
  historyMode: HistoryMode = 'push',
  seoAyah?: number
) {
  if (autoplay) {
    renderPlayerBar(store.getState());
  }

  store.update((state) => ({
    ...state,
    currentMode: mode,
    currentSelection: number
  }));

  const translationId = store.getState().translationId;
  if (!translationId) {
    store.update((current) => ({ ...current, error: 'Urdu translation not found.' }));
    renderNotice(store.getState());
    syncRouteAndSeo({ historyMode, explicitAyah: seoAyah });
    return;
  }

  store.update((state) => ({ ...state, loading: true, error: '' }));
  if (overlayTimer) window.clearTimeout(overlayTimer);
  overlayTimer = window.setTimeout(() => {
    store.update((state) => ({ ...state, readerOverlayVisible: true }));
    renderReaderOverlay(store.getState());
  }, 300);
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
      const arabicUthmani = verse.text_uthmani;
      const arabicIndoPak = verse.text_indopak;
      const arabicTajweed = verse.text_uthmani_tajweed;
      return {
        surah,
        ayah,
        verseKey: verse.verse_key,
        key: ayahFileKey(surah, ayah),
        arabicText: arabicUthmani,
        arabicUthmani,
        arabicIndoPak,
        arabicTajweed,
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
      const startVerse = verses[startIndex];
      const scope = scopeOverride ?? (mode === 'surah' ? 'surah' : 'ayah');
      store.update((state) => ({
        ...state,
        playbackScope: scope,
        activeMode: mode,
        activeSurahNumber: startVerse?.surah ?? null,
        activeAyahKey: startVerse?.key ?? null
      }));
      player.playFromIndex(startIndex);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load selection.';
    store.update((state) => ({
      ...state,
      loading: false,
      error: message
    }));
    renderNotice(store.getState());
    renderPlayerBar(store.getState());
  } finally {
    if (overlayTimer) {
      window.clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    store.update((state) => ({ ...state, readerOverlayVisible: false }));
    renderReaderOverlay(store.getState());
    renderSidebar(store.getState());
    renderMobileNav(store.getState());
    renderVerses(store.getState());
    updateActiveAyahUI(store.getState());
    if (scrollToTop) {
      scrollReaderToTop();
    }
    syncRouteAndSeo({ historyMode, explicitAyah: seoAyah });
  }
}

function updateSettings(partial: Partial<Settings>) {
  const updated = settingsService.update(partial);
  store.update((state) => ({ ...state, settings: updated }));
  applyFontSizes(updated.arabicFontPx, updated.urduFontPx);
  applyTheme(updated.theme);
  player.setRepeat(updated.repeat);
  player.setUrduVoiceEnabled(updated.urduVoiceEnabled);
  player.setPlaybackRate(updated.playbackSpeed);
  renderPlayerBar(store.getState());
  renderSettingsPanel(store.getState());
  renderVerses(store.getState());
  updateActiveAyahUI(store.getState());
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
      renderDashboard(store.getState());
    }
    return;
  }

  if (action === 'select-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    player.stop();
    renderPlayerBar(store.getState());
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(mode, number, undefined, false);
    return;
  }

  if (action === 'play-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    const state = store.getState();
    const isSameSurahPlaying = Boolean(
      mode === 'surah' &&
      state.playbackState.isPlaying &&
      state.playbackScope === 'surah' &&
      state.activeSurahNumber === number
    );
    if (isSameSurahPlaying) {
      player.stop();
      store.update((current) => ({
        ...current,
        playbackScope: null,
        activeMode: null,
        activeSurahNumber: null,
        activeAyahKey: null
      }));
      clearActiveAyahUI();
      renderPlayerBar(store.getState());
      renderVerses(store.getState());
      renderNotice(store.getState());
      return;
    }
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(mode, number, undefined, true, mode === 'surah' ? 'surah' : 'ayah');
    return;
  }

  if (action === 'open-nav') {
    store.update((state) => ({ ...state, mobileNavOpen: true }));
    renderMobileNav(store.getState());
    return;
  }

  if (action === 'close-nav') {
    store.update((state) => ({ ...state, mobileNavOpen: false }));
    renderMobileNav(store.getState());
    return;
  }

  if (action === 'mobile-tab') {
    const tab = actionEl?.dataset.tab as 'surah' | 'juz' | 'bookmarks' | undefined;
    if (!tab) return;
    store.update((state) => ({ ...state, mobileNavTab: tab }));
    renderMobileNav(store.getState());
    return;
  }

  if (action === 'mobile-select-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    store.update((state) => ({ ...state, mobileNavOpen: false }));
    renderMobileNav(store.getState());
    player.stop();
    renderPlayerBar(store.getState());
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(mode, number, undefined, false, undefined, true);
    return;
  }

  if (action === 'mobile-play-selection') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    store.update((state) => ({ ...state, mobileNavOpen: false }));
    renderMobileNav(store.getState());
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(mode, number, undefined, true, mode === 'surah' ? 'surah' : 'ayah', true);
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
    store.update((state) => ({
      ...state,
      playbackScope: null,
      activeMode: null,
      activeSurahNumber: null,
      activeAyahKey: null
    }));
    clearActiveAyahUI();
    renderPlayerBar(store.getState());
    syncRouteAndSeo({ historyMode: 'replace' });
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

  if (action === 'toggle-urdu-voice') {
    updateSettings({ urduVoiceEnabled: !store.getState().settings.urduVoiceEnabled });
    return;
  }

  if (action === 'toggle-speed-menu') {
    store.update((state) => ({ ...state, speedMenuOpen: !state.speedMenuOpen }));
    renderPlayerBar(store.getState());
    return;
  }

  if (action === 'set-speed') {
    const speed = Number(actionEl?.dataset.speed);
    if (!Number.isFinite(speed)) return;
    updateSettings({ playbackSpeed: speed });
    store.update((state) => ({ ...state, speedMenuOpen: false }));
    renderPlayerBar(store.getState());
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

  if (action === 'toggle-ayah-play') {
    const index = Number(actionEl?.dataset.index);
    if (!Number.isFinite(index)) return;
    const verse = store.getState().verses[index];
    if (!verse) return;
    const isSameAyah = store.getState().activeAyahKey === verse.key && store.getState().playbackState.isPlaying;
    if (isSameAyah) {
      player.stop();
      store.update((state) => ({
        ...state,
        playbackScope: null,
        activeMode: null,
        activeSurahNumber: null,
        activeAyahKey: null
      }));
      clearActiveAyahUI();
      renderPlayerBar(store.getState());
      renderVerses(store.getState());
      syncRouteAndSeo({ historyMode: 'replace' });
      return;
    }

    player.stop();
    player.loadPlaylist(store.getState().verses);
    player.setSources(getReciterBase(store.getState().settings.reciterId), URDU_AUDIO_BASE_URL);
    player.playFromIndex(index);
    store.update((state) => ({
      ...state,
      playbackScope: 'ayah',
      activeMode: state.currentMode,
      activeSurahNumber: verse.surah,
      activeAyahKey: verse.key
    }));
    renderPlayerBar(store.getState());
    renderVerses(store.getState());
    if (store.getState().currentMode === 'surah') {
      syncRouteAndSeo({ historyMode: 'push', explicitAyah: verse.ayah });
    } else {
      syncRouteAndSeo({ historyMode: 'replace' });
    }
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
    renderMobileNav(store.getState());
    renderDashboard(store.getState());
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

    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(
      mode,
      selectionNumber,
      { surah, ayah },
      true,
      'ayah',
      false,
      'push',
      mode === 'surah' ? ayah : undefined
    );
    return;
  }

  if (action === 'mobile-bookmark-select') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const surah = Number(actionEl?.dataset.surah);
    const ayah = Number(actionEl?.dataset.ayah);
    const juz = Number(actionEl?.dataset.juz);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;
    const selectionNumber = mode === 'surah' ? surah : juz;
    if (!Number.isFinite(selectionNumber)) return;
    store.update((state) => ({ ...state, mobileNavOpen: false }));
    renderMobileNav(store.getState());
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(
      mode,
      selectionNumber,
      { surah, ayah },
      false,
      'ayah',
      true,
      'push',
      mode === 'surah' ? ayah : undefined
    );
    return;
  }

  if (action === 'mobile-bookmark-play') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const surah = Number(actionEl?.dataset.surah);
    const ayah = Number(actionEl?.dataset.ayah);
    const juz = Number(actionEl?.dataset.juz);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;
    const selectionNumber = mode === 'surah' ? surah : juz;
    if (!Number.isFinite(selectionNumber)) return;
    store.update((state) => ({ ...state, mobileNavOpen: false }));
    renderMobileNav(store.getState());
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(
      mode,
      selectionNumber,
      { surah, ayah },
      true,
      'ayah',
      true,
      'push',
      mode === 'surah' ? ayah : undefined
    );
    return;
  }

  if (action === 'dash-tab') {
    const tab = actionEl?.dataset.tab as 'surah' | 'juz' | undefined;
    if (!tab) return;
    store.update((state) => ({ ...state, dashboardTab: tab }));
    renderDashboard(store.getState());
    syncRouteAndSeo({ historyMode: 'push' });
    return;
  }

  if (action === 'dash-open-surah') {
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection('surah', number, undefined, false, undefined, true);
    return;
  }

  if (action === 'dash-open-juz') {
    const number = Number(actionEl?.dataset.number);
    if (!Number.isFinite(number)) return;
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection('juz', number, undefined, false, undefined, true);
    return;
  }

  if (action === 'dash-open-last') {
    const mode = (actionEl?.dataset.mode as TabMode) ?? 'surah';
    const surah = Number(actionEl?.dataset.surah);
    const ayah = Number(actionEl?.dataset.ayah);
    const juz = Number(actionEl?.dataset.juz);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return;
    const selectionNumber = mode === 'surah' ? surah : juz;
    if (!Number.isFinite(selectionNumber)) return;
    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(
      mode,
      selectionNumber,
      { surah, ayah },
      false,
      'ayah',
      true,
      'push',
      mode === 'surah' ? ayah : undefined
    );
    return;
  }

  if (action === 'go-dashboard') {
    store.update((state) => ({ ...state, viewMode: 'dashboard' }));
    updateViewVisibility();
    syncRouteAndSeo({ historyMode: 'push' });
    return;
  }

  if (action === 'toggle-surah-play') {
    const state = store.getState();
    if (!state.currentSelection) return;
    const targetSurah =
      state.currentMode === 'surah'
        ? state.currentSelection
        : state.verses[0]?.surah ?? null;
    if (!targetSurah) return;
    const isSurahPlaying = Boolean(
      state.playbackState.isPlaying &&
      state.playbackScope === 'surah' &&
      state.activeSurahNumber === targetSurah
    );
    if (isSurahPlaying) {
      player.stop();
      store.update((current) => ({
        ...current,
        playbackScope: null,
        activeMode: null,
        activeSurahNumber: null,
        activeAyahKey: null
      }));
      clearActiveAyahUI();
      renderPlayerBar(store.getState());
      renderVerses(store.getState());
      renderNotice(store.getState());
      syncRouteAndSeo({ historyMode: 'replace' });
      return;
    }

    store.update((state) => ({ ...state, viewMode: 'reader' }));
    updateViewVisibility();
    loadSelection(state.currentMode, state.currentSelection, undefined, true, 'surah');
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

  if (action === 'script-select') {
    const script = actionEl?.dataset.script as Settings['quranScript'] | undefined;
    if (!script) return;
    updateSettings({ quranScript: script });
    return;
  }

  if (store.getState().speedMenuOpen && !target.closest('.speed-control')) {
    store.update((state) => ({ ...state, speedMenuOpen: false }));
    renderPlayerBar(store.getState());
  }
}

function scrollReaderToTop() {
  const container = document.getElementById('versesContainer');
  if (container && container.scrollHeight > container.clientHeight + 1) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

function updateViewVisibility() {
  const { viewMode } = store.getState();
  elements.dashboard.classList.toggle('hidden', viewMode !== 'dashboard');
  elements.readerContent.classList.toggle('hidden', viewMode !== 'reader');
  document.body.classList.toggle('dashboard-mode', viewMode === 'dashboard');
  elements.playerBar.classList.toggle('hidden', viewMode === 'dashboard');
}

async function applyRouteFromLocation() {
  const normalized = normalizeCurrentPath();
  const route = parseRouteFromPath(normalized);

  if (route.kind === 'home') {
    store.update((state) => ({
      ...state,
      viewMode: 'dashboard',
      dashboardTab: 'surah',
      currentMode: 'surah'
    }));
    updateViewVisibility();
    renderSidebar(store.getState());
    renderDashboard(store.getState());
    renderMobileNav(store.getState());
    renderVerses(store.getState());
    syncRouteAndSeo({ historyMode: 'replace', route });
    return;
  }

  if (route.kind === 'surah-list' || route.kind === 'juz-list') {
    const tab = route.kind === 'surah-list' ? 'surah' : 'juz';
    store.update((state) => ({
      ...state,
      viewMode: 'dashboard',
      dashboardTab: tab,
      currentMode: tab
    }));
    updateViewVisibility();
    renderSidebar(store.getState());
    renderDashboard(store.getState());
    renderMobileNav(store.getState());
    renderVerses(store.getState());
    syncRouteAndSeo({ historyMode: 'replace', route });
    return;
  }

  if (route.kind === 'surah-detail') {
    store.update((state) => ({
      ...state,
      viewMode: 'reader',
      currentMode: 'surah'
    }));
    updateViewVisibility();
    await loadSelection(
      'surah',
      route.surahId,
      route.ayah ? { surah: route.surahId, ayah: route.ayah } : undefined,
      false,
      route.ayah ? 'ayah' : undefined,
      true,
      'replace',
      route.ayah
    );
    return;
  }

  if (route.kind === 'juz-detail') {
    store.update((state) => ({
      ...state,
      viewMode: 'reader',
      currentMode: 'juz'
    }));
    updateViewVisibility();
    await loadSelection('juz', route.juzId, undefined, false, undefined, true, 'replace');
  }
}

async function init() {
  applyFontSizes(store.getState().settings.arabicFontPx, store.getState().settings.urduFontPx);
  applyTheme(store.getState().settings.theme);
  player.setRepeat(store.getState().settings.repeat);
  player.setUrduVoiceEnabled(store.getState().settings.urduVoiceEnabled);
  player.setPlaybackRate(store.getState().settings.playbackSpeed);
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
    renderMobileNav(store.getState());
    renderReaderOverlay(store.getState());
    renderDashboard(store.getState());
    updateViewVisibility();
    renderVerses(store.getState());
    renderNotice(store.getState());
  }

  await applyRouteFromLocation();
}

player.subscribe((playbackState) => {
  store.update((state) => ({ ...state, playbackState }));
  const queue = player.getQueue();
  const verse = queue[playbackState.currentIndex];
  if (verse && (playbackState.status === 'playing' || playbackState.status === 'paused')) {
    store.update((state) => ({
      ...state,
      activeAyahKey: verse.key,
      activeSurahNumber: verse.surah,
      activeMode: state.activeMode ?? state.currentMode
    }));
  }
  renderPlayerBar(store.getState());
  renderDashboard(store.getState());
  renderMobileNav(store.getState());
  renderReaderOverlay(store.getState());
  updateActiveAyahUI(store.getState());
  renderSelectionHeaderOnly(store.getState());
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
window.addEventListener('popstate', () => {
  void applyRouteFromLocation();
});
window.addEventListener('beforeunload', () => player.stop());

initPwaInstallPrompt();
init();
