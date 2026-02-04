import { ARABIC_RECITERS, URDU_TRANSLATOR_NAME, URDU_VOICE_NAME } from '../constants';
import type { AppState } from './store';
import { isBookmarked, sortBookmarks } from './bookmarks';
import type { Bookmark, VerseData } from '../types';
import { elements } from './elements';

let lastActiveIndex = -1;
let lastPhase: 'arabic' | 'urdu' | null = null;
let lastStatus: AppState['playbackState']['status'] | null = null;
let lastUserScrollAt = 0;
let isAutoScrolling = false;
let autoScrollTimeoutId: number | null = null;
let lastArabicWordIndex = -1;
let lastUrduWordIndex = -1;
let lastWordVerseIndex = -1;

export function markUserScroll() {
  if (isAutoScrolling) return;
  lastUserScrollAt = Date.now();
}

export function renderPlayerBar(state: AppState) {
  const isPlaying = state.playbackState.status === 'playing';
  const playLabel = isPlaying ? 'Pause' : 'Play';
  const playAction = isPlaying ? 'pause' : 'play';
  const repeatActive = state.settings.repeat ? 'active' : '';

  if (!state.playerVisible) {
    elements.playerBar.classList.add('hidden');
    document.body.classList.remove('player-visible');
    elements.playerBar.innerHTML = '';
    return;
  }

  elements.playerBar.classList.remove('hidden');
  document.body.classList.add('player-visible');

  const info = buildNowPlayingLabel(state);

  elements.playerBar.innerHTML = `
    <div class="player-info">
      <span class="player-title">Now Playing</span>
      <span class="player-sub">${info}</span>
    </div>

    <div class="player-controls">
      <button class="player-button" data-action="${playAction}">${playLabel}</button>
      <button class="player-button" data-action="prev-ayah">Prev Ayah</button>
      <button class="player-button" data-action="next-ayah">Next Ayah</button>
      <button class="player-button" data-action="prev-surah">Prev Surah</button>
      <button class="player-button" data-action="next-surah">Next Surah</button>
      <button class="player-button ${repeatActive}" data-action="toggle-repeat">Repeat</button>
      <button class="player-button danger" data-action="stop">Stop</button>
    </div>

    <div class="player-actions">
      <button class="icon-button" data-action="toggle-settings" aria-label="Settings">
        ⚙
      </button>
    </div>
  `;
}

export function renderSidebar(state: AppState) {
  elements.modeSurah.classList.toggle('active', state.currentMode === 'surah');
  elements.modeJuz.classList.toggle('active', state.currentMode === 'juz');

  if (state.loading) {
    elements.listHeader.textContent = 'Loading...';
    elements.listContainer.innerHTML = '';
  } else if (state.error) {
    elements.listHeader.textContent = 'Error';
    elements.listContainer.innerHTML = `<p class="empty">${state.error}</p>`;
  } else if (state.currentMode === 'surah') {
    elements.listHeader.textContent = `Surahs (${state.chapters.length})`;
    elements.listContainer.innerHTML = state.chapters
      .map((surah) => {
        const isActive = state.currentSelection === surah.id;
        return `
          <div class="list-item ${isActive ? 'active' : ''}" data-action="select-selection" data-mode="surah" data-number="${surah.id}">
            <div class="list-meta">
              <div class="list-title">${surah.id}. ${surah.name_simple}</div>
              <div class="list-sub">${surah.name_arabic} - ${surah.verses_count} ayahs</div>
            </div>
            <button data-action="play-selection" data-mode="surah" data-number="${surah.id}">Play</button>
          </div>
        `;
      })
      .join('');
  } else {
    elements.listHeader.textContent = 'Juz (30)';
    elements.listContainer.innerHTML = Array.from({ length: 30 }, (_, index) => {
      const juzNumber = index + 1;
      const isActive = state.currentSelection === juzNumber;
      return `
        <div class="list-item ${isActive ? 'active' : ''}" data-action="select-selection" data-mode="juz" data-number="${juzNumber}">
          <div class="list-meta">
            <div class="list-title">Juz ${juzNumber}</div>
            <div class="list-sub">Para ${juzNumber}</div>
          </div>
          <button data-action="play-selection" data-mode="juz" data-number="${juzNumber}">Play</button>
        </div>
      `;
    }).join('');
  }

  renderBookmarks(state.bookmarks);
}

export function renderBookmarks(bookmarks: Bookmark[]) {
  const sorted = sortBookmarks(bookmarks);
  if (!sorted.length) {
    elements.bookmarkList.innerHTML = '<p class="empty">No bookmarks yet.</p>';
    return;
  }

  elements.bookmarkList.innerHTML = sorted
    .map((bookmark) => {
      const label = bookmark.mode === 'surah'
        ? `Surah ${bookmark.surahNumber} - Ayah ${bookmark.ayahNumber}`
        : `Juz ${bookmark.juzNumber ?? ''} - ${bookmark.surahNumber}:${bookmark.ayahNumber}`;
      return `
        <button class="bookmark-item" data-action="bookmark-jump" data-mode="${bookmark.mode}" data-surah="${bookmark.surahNumber}" data-ayah="${bookmark.ayahNumber}" data-juz="${bookmark.juzNumber ?? ''}">
          <span>${label}</span>
          <span class="bookmark-time">${formatTimestamp(bookmark.timestamp)}</span>
        </button>
      `;
    })
    .join('');
}

export function renderVerses(state: AppState) {
  if (!state.verses.length) {
    renderSelectionHeader(state);
    elements.versesContainer.innerHTML = '<p class="empty">Select a Surah or Juz to begin.</p>';
    lastActiveIndex = -1;
    lastPhase = null;
    lastStatus = null;
    lastArabicWordIndex = -1;
    lastUrduWordIndex = -1;
    lastWordVerseIndex = -1;
    return;
  }

  renderSelectionHeader(state);

  const currentIndex = state.playbackState.currentIndex;
  const segments: string[] = [];
  let lastSurah: number | null = null;

  state.verses.forEach((verse, index) => {
    if (state.currentMode === 'juz' && lastSurah !== null && verse.surah !== lastSurah) {
      segments.push(renderSurahSeparator(state, verse.surah));
    }
    if (lastSurah === null || verse.surah !== lastSurah) {
      lastSurah = verse.surah;
    }
    segments.push(renderVerseRow(verse, index, state, currentIndex));
  });

  elements.versesContainer.innerHTML = segments.join('');
  lastActiveIndex = -1;
  lastPhase = null;
  lastStatus = null;
  lastArabicWordIndex = -1;
  lastUrduWordIndex = -1;
  lastWordVerseIndex = -1;
}

export function renderSettingsPanel(state: AppState) {
  const reciterOptions = ARABIC_RECITERS
    .map((reciter) => {
      const selected = reciter.id === state.settings.reciterId ? 'selected' : '';
      return `<option value="${reciter.id}" ${selected}>${reciter.name}</option>`;
    })
    .join('');

  elements.settingsContent.innerHTML = `
    <div class="settings-section">
      <h4>Audio</h4>
      <div class="settings-row">
        <label>Reciter</label>
        <select data-action="reciter-select">${reciterOptions}</select>
      </div>
      <div class="settings-row">
        <label>Urdu translation</label>
        <span>${URDU_TRANSLATOR_NAME}</span>
      </div>
      <div class="settings-row">
        <label>Voice</label>
        <span>${URDU_VOICE_NAME}</span>
      </div>
    </div>

    <div class="settings-section">
      <h4>Typography</h4>
      <div class="settings-row">
        <label>Arabic size</label>
        <div class="stepper">
          <button data-action="arabic-dec">-</button>
          <span>${state.settings.arabicFontPx}px</span>
          <button data-action="arabic-inc">+</button>
        </div>
      </div>
      <div class="settings-row">
        <label>Urdu size</label>
        <div class="stepper">
          <button data-action="urdu-dec">-</button>
          <span>${state.settings.urduFontPx}px</span>
          <button data-action="urdu-inc">+</button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h4>Theme</h4>
      <div class="settings-row">
        <label>Mode</label>
        <button class="toggle-pill" data-action="toggle-theme">${state.settings.theme === 'warm' ? 'Warm' : 'Dark'}</button>
      </div>
    </div>
  `;

  if (state.settingsOpen) {
    elements.settingsDrawer.classList.remove('hidden');
    elements.settingsOverlay.classList.remove('hidden');
  } else {
    elements.settingsDrawer.classList.add('hidden');
    elements.settingsOverlay.classList.add('hidden');
  }
}

export function updateActiveAyahUI(state: AppState) {
  const currentIndex = state.playbackState.currentIndex;
  const currentPhase = state.playbackState.phase;
  const isPlaying = state.playbackState.status === 'playing';
  const statusChanged = lastStatus !== state.playbackState.status;

  const indexChanged = lastActiveIndex !== currentIndex;
  const phaseChanged = lastPhase !== currentPhase;

  if (!indexChanged && !phaseChanged && !statusChanged) {
    return;
  }

  if (indexChanged) {
    const prev = elements.versesContainer.querySelector(`[data-verse-index="${lastActiveIndex}"]`);
    if (prev instanceof HTMLElement) {
      prev.classList.remove('active');
      clearWordHighlights(prev);
    }

    const current = elements.versesContainer.querySelector(`[data-verse-index="${currentIndex}"]`);
    if (current instanceof HTMLElement) {
      current.classList.add('active');
      clearWordHighlights(current);
    }

    lastActiveIndex = currentIndex;
    lastArabicWordIndex = -1;
    lastUrduWordIndex = -1;
    lastWordVerseIndex = currentIndex;
  } else {
    const current = elements.versesContainer.querySelector(`[data-verse-index="${currentIndex}"]`);
    if (current instanceof HTMLElement) {
      if (phaseChanged) {
        clearWordHighlights(current);
        lastArabicWordIndex = -1;
        lastUrduWordIndex = -1;
      }
      if (statusChanged && !isPlaying) {
        clearWordHighlights(current);
      }
      if (statusChanged && isPlaying) {
        clearWordHighlights(current);
        lastArabicWordIndex = -1;
        lastUrduWordIndex = -1;
      }
    }
  }

  lastPhase = currentPhase;
  lastStatus = state.playbackState.status;

  if (indexChanged && isPlaying) {
    scrollActiveIntoView(currentIndex);
  }
}

export function updateWordHighlightByProgress(
  state: AppState,
  payload: { phase: 'arabic' | 'urdu'; currentIndex: number; currentTime: number; duration: number }
) {
  if (state.playbackState.status !== 'playing') return;
  const verseIndex = payload.currentIndex;
  const card = elements.versesContainer.querySelector(`[data-verse-index="${verseIndex}"]`);
  if (!(card instanceof HTMLElement)) return;

  const total = getWordCount(card, payload.phase);
  if (!total) return;

  const duration = Number.isFinite(payload.duration) && payload.duration > 0 ? payload.duration : 0;
  const rawIndex = duration ? Math.floor((payload.currentTime / duration) * total) : 0;
  const wordIndex = Math.min(Math.max(rawIndex, 0), total - 1);

  updateWordHighlight(card, payload.phase, wordIndex, verseIndex);
}

export function renderNotice(state: AppState) {
  if (state.error) {
    elements.notice.innerHTML = `<div class="notice-banner error">${state.error}</div>`;
    return;
  }

  elements.notice.innerHTML = '';
}

export function showToast(message: string) {
  if (!message) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastHost.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('hide');
    window.setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function renderVerseRow(verse: VerseData, index: number, state: AppState, currentIndex: number) {
  const active = index === currentIndex ? 'active' : '';
  const label = state.currentMode === 'surah'
    ? `Ayah ${verse.ayah}`
    : `Ayah ${verse.surah}:${verse.ayah}`;

  const bookmarked = isBookmarked(state.bookmarks, {
    mode: state.currentMode,
    surahNumber: verse.surah,
    ayahNumber: verse.ayah,
    juzNumber: state.currentMode === 'juz' ? state.currentSelection ?? undefined : undefined
  });

  const arabic = wrapWords(verse.arabicText);
  const urdu = wrapWords(verse.urduText);
  const ayahId = `ayah-${pad3(verse.surah)}${pad3(verse.ayah)}`;

  return `
    <div class="verse ${active}" id="${ayahId}" data-verse-index="${index}" data-arabic-words="${arabic.count}" data-urdu-words="${urdu.count}">
      <div class="verse-actions">
        <button class="icon-button" data-action="play-ayah" data-index="${index}" aria-label="Play ayah">
          <span class="icon-play"></span>
        </button>
        <button class="bookmark-button ${bookmarked ? 'active' : ''}" data-action="toggle-bookmark" data-index="${index}">
          ${bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>
      <div class="verse-meta">
        <span>${label}</span>
        <span class="playing-indicator">Playing</span>
      </div>
      <div class="verse-arabic" dir="rtl" lang="ar">${arabic.html}</div>
      <div class="verse-urdu" dir="rtl" lang="ur">${urdu.html}</div>
    </div>
  `;
}

function renderSelectionHeader(state: AppState) {
  if (!state.verses.length) {
    elements.selectionHeader.innerHTML = '';
    return;
  }

  if (state.currentMode === 'surah') {
    const chapter = state.chapters.find((item) => item.id === state.currentSelection);
    const title = chapter ? `Surah ${chapter.name_simple}` : `Surah ${state.currentSelection ?? ''}`;
    const subtitle = chapter ? `${chapter.verses_count} ayahs` : `${state.verses.length} ayahs`;
    elements.selectionHeader.innerHTML = `
      <div class="selection-card">
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
    `;
    return;
  }

  const first = state.verses[0];
  const last = state.verses[state.verses.length - 1];
  const range = first && last ? `${first.surah}:${first.ayah} – ${last.surah}:${last.ayah}` : '';
  elements.selectionHeader.innerHTML = `
    <div class="selection-card">
      <h3>Juz ${state.currentSelection ?? ''}</h3>
      <p>${range}</p>
    </div>
  `;
}

function renderSurahSeparator(state: AppState, surahNumber: number) {
  const chapter = state.chapters.find((item) => item.id === surahNumber);
  const title = chapter ? `Now entering Surah ${chapter.name_simple}` : `Now entering Surah ${surahNumber}`;
  const subtitle = chapter ? `${chapter.verses_count} ayahs` : '';
  return `
    <div class="surah-separator">
      <div>${title}</div>
      <span>${subtitle}</span>
    </div>
  `;
}

function buildNowPlayingLabel(state: AppState) {
  if (!state.verses.length) return 'No selection';
  const verse = state.verses[state.playbackState.currentIndex];
  if (!verse) return 'No selection';
  if (state.currentMode === 'surah') {
    const chapter = state.chapters.find((item) => item.id === verse.surah);
    return `${chapter?.name_simple ?? `Surah ${verse.surah}`} • Ayah ${verse.ayah}`;
  }
  return `Juz ${state.currentSelection ?? ''} • ${verse.surah}:${verse.ayah}`;
}

function scrollActiveIntoView(index: number) {
  const el = elements.versesContainer.querySelector(`[data-verse-index="${index}"]`);
  if (!(el instanceof HTMLElement)) return;
  const container = elements.versesContainer;
  const isScrollable = container.scrollHeight > container.clientHeight + 1;

  const finishAutoScroll = () => {
    autoScrollTimeoutId = window.setTimeout(() => {
      isAutoScrolling = false;
    }, 600);
  };

  isAutoScrolling = true;
  if (autoScrollTimeoutId) {
    window.clearTimeout(autoScrollTimeoutId);
  }

  if (isScrollable) {
    const offset = Math.round(container.clientHeight * 0.15);
    const targetTop = el.offsetTop - offset;
    container.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
    finishAutoScroll();
    return;
  }

  const barHeight = document.body.classList.contains('player-visible')
    ? Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--player-bar-height'), 10) || 0
    : 0;
  const offsetBase = Math.max(window.innerHeight - barHeight, 0);
  const offset = Math.round(offsetBase * 0.15);
  const rect = el.getBoundingClientRect();
  const target = window.scrollY + rect.top - offset;
  window.scrollTo({ top: Math.max(target, 0), behavior: 'smooth' });
  finishAutoScroll();
}

function shouldAutoScroll() {
  const now = Date.now();
  return now - lastUserScrollAt > 1500;
}

function updateWordHighlight(
  card: HTMLElement,
  phase: 'arabic' | 'urdu',
  wordIndex: number,
  verseIndex: number
) {
  if (lastWordVerseIndex !== verseIndex) {
    clearWordHighlights(card);
    lastArabicWordIndex = -1;
    lastUrduWordIndex = -1;
    lastWordVerseIndex = verseIndex;
  }

  if (phase === 'arabic') {
    if (wordIndex === lastArabicWordIndex) return;
    updateWordClass(card, '.verse-arabic', lastArabicWordIndex, wordIndex);
    lastArabicWordIndex = wordIndex;
    return;
  }

  if (phase === 'urdu') {
    if (wordIndex === lastUrduWordIndex) return;
    updateWordClass(card, '.verse-urdu', lastUrduWordIndex, wordIndex);
    lastUrduWordIndex = wordIndex;
  }
}

function updateWordClass(card: HTMLElement, selector: string, previous: number, next: number) {
  const container = card.querySelector(selector);
  if (!(container instanceof HTMLElement)) return;
  if (previous >= 0) {
    const prev = container.querySelector(`[data-word-index="${previous}"]`);
    if (prev instanceof HTMLElement) prev.classList.remove('word-active');
  }
  const nextEl = container.querySelector(`[data-word-index="${next}"]`);
  if (nextEl instanceof HTMLElement) nextEl.classList.add('word-active');
}

function clearWordHighlights(card: HTMLElement) {
  const activeWords = card.querySelectorAll('.word-active');
  activeWords.forEach((node) => node.classList.remove('word-active'));
}

function getWordCount(card: HTMLElement, phase: 'arabic' | 'urdu'): number {
  const value = phase === 'arabic'
    ? card.dataset.arabicWords
    : card.dataset.urduWords;
  const count = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(count) ? count : 0;
}


function wrapWords(text: string) {
  const parts = text.split(/(\s+)/);
  let index = 0;
  const html = parts
    .map((part) => {
      if (!part.trim()) return part;
      const safe = escapeHtml(part);
      const markup = `<span class="word" data-word-index="${index}">${safe}</span>`;
      index += 1;
      return markup;
    })
    .join('');
  return { html, count: index };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad3(value: number) {
  return String(value).padStart(3, '0');
}

function formatTimestamp(value: number) {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
