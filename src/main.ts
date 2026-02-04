import './styles.css';
import { QuranApiService, stripHtml } from './services/QuranApiService';
import { PlayerService } from './services/PlayerService';
import { SettingsService } from './services/SettingsService';
import { ARABIC_RECITERS, DEFAULT_RECITER_ID, DEFAULT_URDU_AUDIO_ID, URDU_AUDIO_SOURCES } from './constants';
import type { Chapter, Settings, TabMode, TranslationResource, VerseApi, VerseData } from './types';

const api = new QuranApiService();
const player = new PlayerService();
const settingsService = new SettingsService();

const state = {
  tab: 'surah' as TabMode,
  loading: true,
  error: '',
  chapters: [] as Chapter[],
  translations: [] as TranslationResource[],
  selectedReciterId: DEFAULT_RECITER_ID,
  selectedUrduAudioId: DEFAULT_URDU_AUDIO_ID,
  selectedTranslationId: null as number | null,
  currentVerses: [] as VerseData[],
  currentTitle: '',
  currentMode: null as TabMode | null,
  currentNumber: null as number | null,
  settings: settingsService.get()
};

const elements = {
  tabSurah: document.getElementById('tabSurah') as HTMLButtonElement,
  tabJuz: document.getElementById('tabJuz') as HTMLButtonElement,
  listHeader: document.getElementById('listHeader') as HTMLDivElement,
  listContainer: document.getElementById('listContainer') as HTMLDivElement,
  controls: document.getElementById('controls') as HTMLDivElement,
  notice: document.getElementById('notice') as HTMLDivElement,
  currentAyah: document.getElementById('currentAyah') as HTMLDivElement,
  versesContainer: document.getElementById('versesContainer') as HTMLDivElement,
  statusBar: document.getElementById('statusBar') as HTMLDivElement,
  themeToggle: document.getElementById('themeToggle') as HTMLButtonElement
};

function applyTheme(theme: Settings['theme']) {
  document.documentElement.dataset.theme = theme;
}

function applyFontSizes(arabic: number, urdu: number) {
  document.documentElement.style.setProperty('--arabic-size', `${arabic}px`);
  document.documentElement.style.setProperty('--urdu-size', `${urdu}px`);
}

function renderTabs() {
  elements.tabSurah.classList.toggle('active', state.tab === 'surah');
  elements.tabJuz.classList.toggle('active', state.tab === 'juz');
}

function renderList() {
  if (state.loading) {
    elements.listHeader.textContent = 'Loading...';
    elements.listContainer.innerHTML = '';
    return;
  }

  if (state.error) {
    elements.listHeader.textContent = 'Error';
    elements.listContainer.innerHTML = `<p>${state.error}</p>`;
    return;
  }

  if (state.tab === 'surah') {
    elements.listHeader.textContent = `Surahs (${state.chapters.length})`;
    elements.listContainer.innerHTML = state.chapters
      .map((surah) => {
        const isActive = state.currentMode === 'surah' && state.currentNumber === surah.id;
        return `
          <div class="list-item ${isActive ? 'active' : ''}">
            <div>
              <h4>${surah.id}. ${surah.name_simple}</h4>
              <p>${surah.name_arabic} • ${surah.verses_count} ayahs</p>
            </div>
            <button data-action="play-item" data-type="surah" data-number="${surah.id}">Play</button>
          </div>
        `;
      })
      .join('');
    return;
  }

  elements.listHeader.textContent = 'Juz (30)';
  elements.listContainer.innerHTML = Array.from({ length: 30 }, (_, index) => {
    const juzNumber = index + 1;
    const isActive = state.currentMode === 'juz' && state.currentNumber === juzNumber;
    return `
      <div class="list-item ${isActive ? 'active' : ''}">
        <div>
          <h4>Juz ${juzNumber}</h4>
          <p>Para ${juzNumber}</p>
        </div>
        <button data-action="play-item" data-type="juz" data-number="${juzNumber}">Play</button>
      </div>
    `;
  }).join('');
}

function renderControls() {
  const playerState = player.getState();
  const isPlaying = playerState.status === 'playing';
  const playLabel = isPlaying ? 'Pause' : 'Play';
  const playAction = isPlaying ? 'pause' : 'play';

  const reciterOptions = ARABIC_RECITERS
    .map((reciter) => {
      const selected = reciter.id === state.selectedReciterId ? 'selected' : '';
      return `<option value="${reciter.id}" ${selected}>${reciter.name}</option>`;
    })
    .join('');

  const urduAudioOptions = URDU_AUDIO_SOURCES
    .map((source) => {
      const selected = source.id === state.selectedUrduAudioId ? 'selected' : '';
      return `<option value="${source.id}" ${selected}>${source.name}</option>`;
    })
    .join('');

  const translationOptions = state.translations
    .map((translation) => {
      const name = translation.translated_name?.name ?? translation.name;
      const selected = translation.id === state.selectedTranslationId ? 'selected' : '';
      return `<option value="${translation.id}" ${selected}>${name}</option>`;
    })
    .join('');

  elements.controls.innerHTML = `
    <button class="primary" data-action="${playAction}">${playLabel}</button>
    <button data-action="prev">Prev</button>
    <button data-action="next">Next</button>
    <button class="danger" data-action="stop">Stop</button>

    <div class="group">
      <label>Arabic Reciter</label>
      <select data-action="reciter-select">${reciterOptions}</select>
    </div>

    <div class="group">
      <label>Urdu Audio</label>
      <select data-action="urdu-audio-select">${urduAudioOptions}</select>
    </div>

    <div class="group">
      <label>Urdu Text</label>
      <select data-action="translation-select">${translationOptions}</select>
    </div>

    <div class="group">
      <label>Arabic</label>
      <button data-action="arabic-dec">-</button>
      <span>${state.settings.arabicFontSize}px</span>
      <button data-action="arabic-inc">+</button>
    </div>

    <div class="group">
      <label>Urdu</label>
      <button data-action="urdu-dec">-</button>
      <span>${state.settings.urduFontSize}px</span>
      <button data-action="urdu-inc">+</button>
    </div>
  `;
}

function renderNotice(message = '') {
  if (!message) {
    elements.notice.innerHTML = '';
    return;
  }
  elements.notice.innerHTML = `<div class="notice-banner">${message}</div>`;
}

function renderCurrentAyah() {
  if (!state.currentVerses.length) {
    elements.currentAyah.innerHTML = '<p>Select a Surah or Juz to start.</p>';
    return;
  }

  const index = player.getState().currentIndex;
  const verse = state.currentVerses[index] ?? state.currentVerses[0];
  const label = state.currentMode === 'surah'
    ? `${state.currentTitle} • Ayah ${verse.ayah}`
    : `Juz ${state.currentNumber} • ${verse.surah}:${verse.ayah}`;

  elements.currentAyah.innerHTML = `
    <div class="meta">${label}</div>
    <div class="arabic">${verse.arabicText}</div>
    <div class="urdu">${verse.urduText}</div>
  `;
}

function renderVerses() {
  if (!state.currentVerses.length) {
    elements.versesContainer.innerHTML = '';
    return;
  }

  const currentIndex = player.getState().currentIndex;

  elements.versesContainer.innerHTML = state.currentVerses
    .map((verse, index) => {
      const active = index === currentIndex ? 'active' : '';
      const label = state.currentMode === 'surah' ? `${verse.ayah}` : `${verse.surah}:${verse.ayah}`;
      return `
        <div class="verse ${active}" data-verse-index="${index}">
          <div class="meta">${label}</div>
          <div class="arabic">${verse.arabicText}</div>
          <div class="urdu">${verse.urduText}</div>
        </div>
      `;
    })
    .join('');
}

function renderStatus() {
  const playerState = player.getState();
  if (!state.currentVerses.length) {
    elements.statusBar.textContent = 'Ready';
    return;
  }

  const verse = state.currentVerses[playerState.currentIndex];
  const total = state.currentVerses.length;
  const status = playerState.status === 'playing'
    ? 'Playing'
    : playerState.status === 'paused'
      ? 'Paused'
      : 'Stopped';

  elements.statusBar.textContent = `${status} • Ayah ${verse?.ayah ?? 1}/${total}`;
}

function scrollCurrentIntoView() {
  const index = player.getState().currentIndex;
  const el = elements.versesContainer.querySelector(`[data-verse-index="${index}"]`);
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function renderAll() {
  renderTabs();
  renderList();
  renderControls();
  renderNotice();
  renderCurrentAyah();
  renderVerses();
  renderStatus();
}

function updateSettings(partial: Partial<Settings>) {
  const updated = settingsService.update(partial);
  state.settings = updated;
  applyTheme(updated.theme);
  applyFontSizes(updated.arabicFontSize, updated.urduFontSize);
  renderControls();
}

async function loadSelection(mode: TabMode, number: number, autoplay = true) {
  if (!state.selectedTranslationId) return;

  state.loading = true;
  state.error = '';
  renderList();

  try {
    let verseApi: VerseApi[] = [];
    if (mode === 'surah') {
      verseApi = await api.getVersesByChapter(number, state.selectedTranslationId);
      const surah = state.chapters.find((item) => item.id === number);
      state.currentTitle = surah?.name_simple ?? `Surah ${number}`;
    } else {
      verseApi = await api.getVersesByJuz(number, state.selectedTranslationId);
      state.currentTitle = `Juz ${number}`;
    }

    const verses: VerseData[] = verseApi.map((verse) => {
      const [surahStr, ayahStr] = verse.verse_key.split(':');
      const surah = Number(surahStr);
      const ayah = Number(ayahStr);
      const fileKey = `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}`;
      const translationText = stripHtml(verse.translations?.[0]?.text ?? '');

      return {
        surah,
        ayah,
        verseKey: verse.verse_key,
        fileKey,
        arabicText: verse.text_uthmani,
        urduText: translationText
      };
    });

    state.currentVerses = verses;
    state.currentMode = mode;
    state.currentNumber = number;

    player.setQueue(verses);
    player.setSources(getReciterBase(state.selectedReciterId), getUrduAudioBase(state.selectedUrduAudioId));

    renderAll();
    if (autoplay) {
      player.play();
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to load selection.';
  } finally {
    state.loading = false;
    renderAll();
  }
}

function handleClick(event: Event) {
  const target = event.target as HTMLElement;
  const action = target.dataset.action;
  if (!action) return;

  if (action === 'tab') {
    const tab = target.dataset.tab as TabMode;
    if (!tab || tab === state.tab) return;
    state.tab = tab;
    player.stop();
    renderAll();
    return;
  }

  if (action === 'play-item') {
    const type = (target.dataset.type as TabMode) ?? 'surah';
    const number = Number(target.dataset.number);
    if (!Number.isFinite(number)) return;
    loadSelection(type, number, true);
    return;
  }

  if (action === 'play') {
    player.play();
    renderAll();
    return;
  }

  if (action === 'pause') {
    player.pause();
    renderAll();
    return;
  }

  if (action === 'stop') {
    player.stop();
    renderAll();
    return;
  }

  if (action === 'next') {
    player.next();
    renderAll();
    return;
  }

  if (action === 'prev') {
    player.prev();
    renderAll();
    return;
  }

  if (action === 'arabic-inc') {
    updateSettings({ arabicFontSize: Math.min(state.settings.arabicFontSize + 2, 48) });
    return;
  }

  if (action === 'arabic-dec') {
    updateSettings({ arabicFontSize: Math.max(state.settings.arabicFontSize - 2, 28) });
    return;
  }

  if (action === 'urdu-inc') {
    updateSettings({ urduFontSize: Math.min(state.settings.urduFontSize + 2, 26) });
    return;
  }

  if (action === 'urdu-dec') {
    updateSettings({ urduFontSize: Math.max(state.settings.urduFontSize - 2, 16) });
    return;
  }

  if (action === 'toggle-theme') {
    const nextTheme = state.settings.theme === 'warm' ? 'dark' : 'warm';
    updateSettings({ theme: nextTheme });
    elements.themeToggle.textContent = `Theme: ${nextTheme === 'warm' ? 'Warm' : 'Dark'}`;
    return;
  }
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const action = target.dataset.action;
  if (!action) return;

  if (action === 'reciter-select') {
    state.selectedReciterId = target.value;
    updateSettings({ reciterId: target.value });
    player.setSources(getReciterBase(target.value), getUrduAudioBase(state.selectedUrduAudioId));
    player.restartCurrent();
    return;
  }

  if (action === 'urdu-audio-select') {
    state.selectedUrduAudioId = target.value;
    updateSettings({ urduAudioId: target.value });
    player.setSources(getReciterBase(state.selectedReciterId), getUrduAudioBase(target.value));
    player.restartCurrent();
    return;
  }

  if (action === 'translation-select') {
    state.selectedTranslationId = Number(target.value);
    updateSettings({ translationId: Number(target.value) });
    if (state.currentMode && state.currentNumber) {
      loadSelection(state.currentMode, state.currentNumber, false);
    }
  }
}

function getReciterBase(id: string): string {
  return ARABIC_RECITERS.find((reciter) => reciter.id === id)?.baseUrl ?? ARABIC_RECITERS[0].baseUrl;
}

function getUrduAudioBase(id: string): string {
  return URDU_AUDIO_SOURCES.find((source) => source.id === id)?.baseUrl ?? URDU_AUDIO_SOURCES[0].baseUrl;
}

function pickDefaultTranslation(translations: TranslationResource[]): number | null {
  const preferred = translations.find((t) =>
    (t.name ?? '').toLowerCase().includes('jalandhry') ||
    (t.name ?? '').toLowerCase().includes('junagarhi') ||
    (t.translated_name?.name ?? '').toLowerCase().includes('jalandhry') ||
    (t.translated_name?.name ?? '').toLowerCase().includes('junagarhi')
  );
  return preferred?.id ?? translations[0]?.id ?? null;
}

async function init() {
  applyTheme(state.settings.theme);
  applyFontSizes(state.settings.arabicFontSize, state.settings.urduFontSize);
  elements.themeToggle.textContent = `Theme: ${state.settings.theme === 'warm' ? 'Warm' : 'Dark'}`;

  try {
    const [chapters, translations] = await Promise.all([
      api.getChapters(),
      api.getTranslations()
    ]);

    state.chapters = chapters;
    state.translations = translations;

    const savedTranslation = state.settings.translationId;
    const preferredId = pickDefaultTranslation(translations);
    const defaultTranslation = translations.find((t) => t.id === savedTranslation) ??
      translations.find((t) => t.id === preferredId) ?? null;

    state.selectedTranslationId = defaultTranslation?.id ?? translations[0]?.id ?? null;
    if (state.selectedTranslationId) {
      updateSettings({ translationId: state.selectedTranslationId });
    }

    state.selectedReciterId = state.settings.reciterId || DEFAULT_RECITER_ID;
    state.selectedUrduAudioId = state.settings.urduAudioId || DEFAULT_URDU_AUDIO_ID;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Failed to load initial data.';
  } finally {
    state.loading = false;
    renderAll();
  }
}

player.subscribe(() => {
  renderControls();
  renderCurrentAyah();
  renderVerses();
  renderStatus();
  scrollCurrentIntoView();
});

settingsService.subscribe((settings) => {
  state.settings = settings;
  applyTheme(settings.theme);
  applyFontSizes(settings.arabicFontSize, settings.urduFontSize);
});

window.addEventListener('click', handleClick);
window.addEventListener('change', handleChange);
window.addEventListener('beforeunload', () => player.stop());

init();
