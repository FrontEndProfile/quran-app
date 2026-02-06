import { ARABIC_RECITERS, URDU_TRANSLATOR_NAME, URDU_VOICE_NAME } from '../constants';
import type { AppState } from './store';
import { isBookmarked, sortBookmarks } from './bookmarks';
import type { Bookmark, VerseData, Settings } from '../types';
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
  const playAction = isPlaying ? 'pause' : 'play';
  const repeatActive = state.settings.repeat ? 'active' : '';
  const speedLabel = formatSpeedLabel(state.settings.playbackSpeed);
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  elements.playerBar.classList.remove('hidden');
  document.body.classList.add('player-visible');

  const hasSelection = state.verses.length > 0;
  const info = hasSelection ? buildNowPlayingLabel(state) : 'Select a Surah/Juz/Ayah to play';
  const disabledAttr = hasSelection ? '' : 'disabled';

  elements.playerBar.innerHTML = `
    <div class="player-zone player-zone-left">
      <div class="player-info">
        <span class="player-title">Now Playing</span>
        <span class="player-sub">${info}</span>
      </div>
    </div>

    <div class="player-zone player-zone-center">
      <div class="player-controls" role="group" aria-label="Playback controls">
        ${renderPlayerIconButton('prev-surah', disabledAttr)}
        ${renderPlayerIconButton('prev-ayah', disabledAttr)}
        ${renderPlayerIconButton(playAction, disabledAttr, isPlaying)}
        ${renderPlayerIconButton('next-ayah', disabledAttr)}
        ${renderPlayerIconButton('next-surah', disabledAttr)}
        ${renderPlayerIconButton('toggle-repeat', disabledAttr, false, repeatActive)}
        ${renderPlayerIconButton('stop', disabledAttr, false, 'danger')}
      </div>
    </div>

    <div class="player-zone player-zone-right">
      <div class="speed-control">
        <button class="player-utility speed-button" data-action="toggle-speed-menu" aria-label="Playback speed">
          ${speedLabel}
        </button>
        <div class="speed-popover ${state.speedMenuOpen ? 'open' : ''}">
          ${speedOptions
            .map((speed) => {
              const isSelected = Number(speed) === Number(state.settings.playbackSpeed);
              const label = speed === 1 ? '1x (Normal)' : `${speed}x`;
              return `
                <button class="speed-option ${isSelected ? 'selected' : ''}" data-action="set-speed" data-speed="${speed}">
                  <span class="check">${isSelected ? '✓' : ''}</span>
                  <span>${label}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
      <button class="player-utility icon-only" data-action="toggle-settings" aria-label="Settings">
        ${iconGear()}
      </button>
    </div>
  `;
}

function renderPlayerIconButton(
  action: string,
  disabledAttr: string,
  isPlaying = false,
  extraClass = ''
) {
  const icon = getActionIcon(action, isPlaying);
  const label = getActionLabel(action, isPlaying);
  const pressedAttr = action === 'toggle-repeat' ? `aria-pressed="${extraClass.includes('active')}"` : '';
  const className = ['player-icon-button', extraClass].filter(Boolean).join(' ');
  return `
    <button class="${className}" data-action="${action}" ${disabledAttr} aria-label="${label}" ${pressedAttr}>
      ${icon}
      <span class="tooltip">${label}</span>
    </button>
  `;
}

function getActionLabel(action: string, isPlaying: boolean) {
  switch (action) {
    case 'pause':
    case 'play':
      return isPlaying ? 'Pause' : 'Play';
    case 'prev-ayah':
      return 'Prev Ayah';
    case 'next-ayah':
      return 'Next Ayah';
    case 'prev-surah':
      return 'Prev Surah';
    case 'next-surah':
      return 'Next Surah';
    case 'toggle-repeat':
      return 'Repeat';
    case 'stop':
      return 'Stop';
    default:
      return 'Action';
  }
}

function getActionIcon(action: string, isPlaying: boolean) {
  switch (action) {
    case 'pause':
    case 'play':
      return isPlaying ? iconPause() : iconPlay();
    case 'prev-ayah':
      return iconSkipPrev();
    case 'next-ayah':
      return iconSkipNext();
    case 'prev-surah':
      return iconStepPrev();
    case 'next-surah':
      return iconStepNext();
    case 'toggle-repeat':
      return iconRepeat();
    case 'stop':
      return iconStop();
    default:
      return iconPlay();
  }
}

function iconPlay() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z"></path>
    </svg>
  `;
}

function iconPause() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>
    </svg>
  `;
}

function iconSkipPrev() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h2v14H6zM18 6.5v11l-9-5.5 9-5.5z"></path>
    </svg>
  `;
}

function iconSkipNext() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 5h2v14h-2zM6 6.5l9 5.5-9 5.5v-11z"></path>
    </svg>
  `;
}

function iconStepPrev() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h2v12H7zM18 6l-8 6 8 6V6z"></path>
    </svg>
  `;
}

function iconStepNext() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6h2v12h-2zM6 6v12l8-6-8-6z"></path>
    </svg>
  `;
}

function iconRepeat() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h9a4 4 0 0 1 0 8h-1v-2h1a2 2 0 0 0 0-4H7l2.5 2.5L8 13 3 8l5-5 1.5 1.5L7 7z"></path>
      <path d="M17 17H8a4 4 0 0 1 0-8h1v2H8a2 2 0 0 0 0 4h9l-2.5-2.5L16 11l5 5-5 5-1.5-1.5L17 17z"></path>
    </svg>
  `;
}

function iconStop() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h10v10H7z"></path>
    </svg>
  `;
}

function iconGear() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.4 13.5a7.9 7.9 0 0 0 .1-1.5 7.9 7.9 0 0 0-.1-1.5l2.1-1.6-2-3.4-2.5 1a7.7 7.7 0 0 0-2.6-1.5l-.4-2.6H9l-.4 2.6a7.7 7.7 0 0 0-2.6 1.5l-2.5-1-2 3.4 2.1 1.6a7.9 7.9 0 0 0-.1 1.5 7.9 7.9 0 0 0 .1 1.5l-2.1 1.6 2 3.4 2.5-1a7.7 7.7 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.7 7.7 0 0 0 2.6-1.5l2.5 1 2-3.4-2.1-1.6zM12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4z"></path>
    </svg>
  `;
}

export function renderReaderOverlay(state: AppState) {
  if (!elements.readerOverlay) return;
  elements.readerOverlay.classList.toggle('hidden', !state.readerOverlayVisible);
  elements.versesContainer.classList.toggle('reader-disabled', state.readerOverlayVisible);
  elements.selectionHeader.classList.toggle('reader-disabled', state.readerOverlayVisible);
}

export function renderSidebar(state: AppState) {
  elements.modeSurah.classList.toggle('active', state.currentMode === 'surah');
  elements.modeJuz.classList.toggle('active', state.currentMode === 'juz');

  if (state.error) {
    elements.listHeader.textContent = 'Error';
    elements.listContainer.innerHTML = `<p class="empty">${state.error}</p>`;
  } else if (state.currentMode === 'surah') {
    elements.listHeader.textContent = `Surahs (${state.chapters.length})`;
    elements.listContainer.innerHTML = state.chapters
      .map((surah) => {
        const isActive = state.currentSelection === surah.id;
        const isSurahPlaying = Boolean(
          state.playbackState.isPlaying &&
          state.playbackScope === 'surah' &&
          state.activeSurahNumber === surah.id
        );
        const playIcon = renderIcon(isSurahPlaying ? 'stop' : 'play');
        const playLabel = isSurahPlaying ? 'Stop' : 'Play';
        return `
          <div class="list-item ${isActive ? 'active' : ''}" data-action="select-selection" data-mode="surah" data-number="${surah.id}">
            <div class="list-meta">
              <div class="list-title">${surah.id}. ${surah.name_simple}</div>
              <div class="list-sub">${surah.name_arabic} - ${surah.verses_count} ayahs</div>
            </div>
            <button class="player-icon-button list-play-button" data-action="play-selection" data-mode="surah" data-number="${surah.id}" aria-label="${playLabel} surah">
              ${playIcon}
              <span class="tooltip">${playLabel}</span>
            </button>
          </div>
        `;
      })
      .join('');
  } else {
    elements.listHeader.textContent = 'Juz (30)';
    elements.listContainer.innerHTML = Array.from({ length: 30 }, (_, index) => {
      const juzNumber = index + 1;
      const isActive = state.currentSelection === juzNumber;
      const playIcon = renderIcon('play');
      return `
        <div class="list-item ${isActive ? 'active' : ''}" data-action="select-selection" data-mode="juz" data-number="${juzNumber}">
          <div class="list-meta">
            <div class="list-title">Juz ${juzNumber}</div>
            <div class="list-sub">Para ${juzNumber}</div>
          </div>
          <button class="player-icon-button list-play-button" data-action="play-selection" data-mode="juz" data-number="${juzNumber}" aria-label="Play juz">
            ${playIcon}
            <span class="tooltip">Play</span>
          </button>
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

export function renderMobileNav(state: AppState) {
  if (elements.mobileNavOverlay && elements.mobileNav) {
    elements.mobileNavOverlay.classList.toggle('hidden', !state.mobileNavOpen);
    elements.mobileNav.classList.toggle('hidden', !state.mobileNavOpen);
  }

  if (elements.mobileTabSurah && elements.mobileTabJuz && elements.mobileTabBookmarks) {
    elements.mobileTabSurah.classList.toggle('active', state.mobileNavTab === 'surah');
    elements.mobileTabJuz.classList.toggle('active', state.mobileNavTab === 'juz');
    elements.mobileTabBookmarks.classList.toggle('active', state.mobileNavTab === 'bookmarks');
  }

  if (elements.mobileSurahList && elements.mobileJuzList && elements.mobileBookmarkList) {
    elements.mobileSurahList.classList.toggle('active', state.mobileNavTab === 'surah');
    elements.mobileJuzList.classList.toggle('active', state.mobileNavTab === 'juz');
    elements.mobileBookmarkList.classList.toggle('active', state.mobileNavTab === 'bookmarks');
  }

  if (elements.mobileSurahList) {
    elements.mobileSurahList.innerHTML = state.chapters
      .map((surah) => {
        const isActive = state.currentSelection === surah.id && state.currentMode === 'surah';
        const isSurahPlaying = Boolean(
          state.playbackState.isPlaying &&
          state.playbackScope === 'surah' &&
          state.activeSurahNumber === surah.id
        );
        const playIcon = renderIcon(isSurahPlaying ? 'stop' : 'play');
        const playLabel = isSurahPlaying ? 'Stop' : 'Play';
        return `
          <div class="list-item ${isActive ? 'active' : ''}" data-action="mobile-select-selection" data-mode="surah" data-number="${surah.id}">
            <div class="list-meta">
              <div class="list-title">${surah.id}. ${surah.name_simple}</div>
              <div class="list-sub">${surah.name_arabic} - ${surah.verses_count} ayahs</div>
            </div>
            <button class="player-icon-button list-play-button" data-action="mobile-play-selection" data-mode="surah" data-number="${surah.id}" aria-label="${playLabel} surah">
              ${playIcon}
              <span class="tooltip">${playLabel}</span>
            </button>
          </div>
        `;
      })
      .join('');
  }

  if (elements.mobileJuzList) {
    elements.mobileJuzList.innerHTML = Array.from({ length: 30 }, (_, index) => {
      const juzNumber = index + 1;
      const isActive = state.currentSelection === juzNumber && state.currentMode === 'juz';
      return `
        <div class="list-item ${isActive ? 'active' : ''}" data-action="mobile-select-selection" data-mode="juz" data-number="${juzNumber}">
          <div class="list-meta">
            <div class="list-title">Juz ${juzNumber}</div>
            <div class="list-sub">Para ${juzNumber}</div>
          </div>
          <button class="player-icon-button list-play-button" data-action="mobile-play-selection" data-mode="juz" data-number="${juzNumber}" aria-label="Play juz">
            ${renderIcon('play')}
            <span class="tooltip">Play</span>
          </button>
        </div>
      `;
    }).join('');
  }

  if (elements.mobileBookmarkList) {
    const sorted = sortBookmarks(state.bookmarks);
    if (!sorted.length) {
      elements.mobileBookmarkList.innerHTML = '<p class="empty">No bookmarks yet.</p>';
    } else {
      elements.mobileBookmarkList.innerHTML = sorted
        .map((bookmark) => {
          const label = bookmark.mode === 'surah'
            ? `Surah ${bookmark.surahNumber} - Ayah ${bookmark.ayahNumber}`
            : `Juz ${bookmark.juzNumber ?? ''} - ${bookmark.surahNumber}:${bookmark.ayahNumber}`;
          return `
            <div class="bookmark-row">
              <button class="bookmark-item" data-action="mobile-bookmark-select" data-mode="${bookmark.mode}" data-surah="${bookmark.surahNumber}" data-ayah="${bookmark.ayahNumber}" data-juz="${bookmark.juzNumber ?? ''}">
                <span>${label}</span>
                <span class="bookmark-time">${formatTimestamp(bookmark.timestamp)}</span>
              </button>
              <button class="player-icon-button list-play-button" data-action="mobile-bookmark-play" data-mode="${bookmark.mode}" data-surah="${bookmark.surahNumber}" data-ayah="${bookmark.ayahNumber}" data-juz="${bookmark.juzNumber ?? ''}" aria-label="Play from here">
                ${renderIcon('play')}
                <span class="tooltip">Play from here</span>
              </button>
            </div>
          `;
        })
        .join('');
    }
  }
}

export function renderVerses(state: AppState) {
  if (state.loading) {
    renderReaderSkeleton();
    lastActiveIndex = -1;
    lastPhase = null;
    lastStatus = null;
    lastArabicWordIndex = -1;
    lastUrduWordIndex = -1;
    lastWordVerseIndex = -1;
    return;
  }

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

function renderReaderSkeleton() {
  elements.selectionHeader.innerHTML = `
    <div class="selection-card skeleton-card">
      <div class="skeleton-line skeleton-title"></div>
      <div class="skeleton-line skeleton-subtitle"></div>
    </div>
  `;

  const skeletonCards = Array.from({ length: 6 }, () => {
    return `
      <div class="verse skeleton-verse">
        <div class="skeleton-line skeleton-action"></div>
        <div class="skeleton-line skeleton-meta"></div>
        <div class="skeleton-line skeleton-arabic"></div>
        <div class="skeleton-line skeleton-urdu"></div>
      </div>
    `;
  }).join('');

  elements.versesContainer.innerHTML = skeletonCards;
}

export function renderSelectionHeaderOnly(state: AppState) {
  renderSelectionHeader(state);
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
      <div class="settings-row">
        <label>Urdu Voice</label>
        <button class="toggle-switch ${state.settings.urduVoiceEnabled ? 'on' : ''}" data-action="toggle-urdu-voice" aria-pressed="${state.settings.urduVoiceEnabled}">
          <span class="toggle-dot"></span>
        </button>
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
      <h4>Quran Script</h4>
      <div class="pill-group" role="radiogroup" aria-label="Quran script">
        ${renderScriptPill('uthmani', 'Uthmani', state.settings.quranScript)}
        ${renderScriptPill('indopak', 'IndoPak', state.settings.quranScript)}
        ${renderScriptPill('tajweed', 'Tajweed', state.settings.quranScript)}
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
      updateAyahToggleAtIndex(state, lastActiveIndex);
    }

    const current = elements.versesContainer.querySelector(`[data-verse-index="${currentIndex}"]`);
    if (current instanceof HTMLElement) {
      current.classList.add('active');
      clearWordHighlights(current);
      updateAyahToggleAtIndex(state, currentIndex);
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
        updateAyahToggleAtIndex(state, currentIndex);
      }
      if (statusChanged && isPlaying) {
        clearWordHighlights(current);
        lastArabicWordIndex = -1;
        lastUrduWordIndex = -1;
        updateAyahToggleAtIndex(state, currentIndex);
      }
    }
  }

  lastPhase = currentPhase;
  lastStatus = state.playbackState.status;

  if (indexChanged && isPlaying) {
    scrollActiveIntoView(currentIndex);
  }
}

export function clearActiveAyahUI() {
  const active = elements.versesContainer.querySelector('.verse.active');
  if (active instanceof HTMLElement) {
    active.classList.remove('active');
    clearWordHighlights(active);
  }
  lastActiveIndex = -1;
  lastPhase = null;
  lastStatus = null;
  lastArabicWordIndex = -1;
  lastUrduWordIndex = -1;
  lastWordVerseIndex = -1;
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

  const script = state.settings.quranScript;
  const arabicText = getArabicText(verse, script);
  const isTajweed = script === 'tajweed' && Boolean(verse.arabicTajweed);
  const arabic = isTajweed ? wrapWordsFromHtml(arabicText) : wrapWords(arabicText);
  const scriptClass = script === 'indopak' ? 'is-indopak' : script === 'tajweed' ? 'is-tajweed' : '';
  const urdu = wrapWords(verse.urduText);
  const ayahId = `ayah-${pad3(verse.surah)}${pad3(verse.ayah)}`;

  const isAyahPlaying = Boolean(
    state.playbackState.isPlaying && state.activeAyahKey === verse.key
  );
  const ayahIcon = renderIcon(isAyahPlaying ? 'stop' : 'play');

  return `
    <div class="verse ${active}" id="${ayahId}" data-verse-index="${index}" data-ayah-key="${verse.key}" data-arabic-words="${arabic.count}" data-urdu-words="${urdu.count}">
      <div class="verse-actions">
        <button class="player-icon-button verse-action-button" data-action="toggle-ayah-play" data-index="${index}" aria-label="${isAyahPlaying ? 'Stop ayah' : 'Play ayah'}">
          ${ayahIcon}
          <span class="tooltip">${isAyahPlaying ? 'Stop' : 'Play ayah'}</span>
        </button>
        <button class="player-icon-button verse-action-button ${bookmarked ? 'active' : ''}" data-action="toggle-bookmark" data-index="${index}" aria-label="${bookmarked ? 'Remove bookmark' : 'Bookmark'}">
          ${bookmarked ? iconBookmarkFilled() : iconBookmark()}
          <span class="tooltip">${bookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
        </button>
      </div>
      <div class="verse-meta">
        <span>${label}</span>
        <span class="playing-indicator">Playing</span>
      </div>
      <div class="verse-arabic qr-arabic ${scriptClass}" dir="rtl" lang="ar">${arabic.html}</div>
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
    const isSurahPlaying = Boolean(
      state.playbackState.isPlaying &&
      state.playbackScope === 'surah' &&
      state.activeSurahNumber === state.currentSelection
    );
    const toggleLabel = isSurahPlaying ? 'Stop' : 'Play';
    const toggleIcon = renderIcon(isSurahPlaying ? 'stop' : 'play');
    elements.selectionHeader.innerHTML = `
      <div class="selection-card">
        <div class="selection-row">
          <div>
            <h3 class="qr-surah-title">${title}</h3>
            <p>${subtitle}</p>
          </div>
          <button class="header-toggle" data-action="toggle-surah-play" aria-label="${toggleLabel} surah">
            ${toggleIcon}
            <span>${toggleLabel}</span>
          </button>
        </div>
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

function renderIcon(kind: 'play' | 'stop') {
  if (kind === 'stop') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 7h10v10H7z"></path>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5-11-6.5z"></path>
    </svg>
  `;
}

function renderScriptPill(value: Settings['quranScript'], label: string, current: Settings['quranScript']) {
  const isActive = value === current ? 'active' : '';
  return `
    <button class="pill ${isActive}" data-action="script-select" data-script="${value}" role="radio" aria-checked="${value === current}">
      ${label}
    </button>
  `;
}

function getArabicText(verse: VerseData, script: Settings['quranScript']) {
  if (script === 'indopak' && verse.arabicIndoPak) return verse.arabicIndoPak;
  if (script === 'tajweed' && verse.arabicTajweed) return verse.arabicTajweed;
  return verse.arabicUthmani || verse.arabicText;
}

function iconBookmark() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4h10a2 2 0 0 1 2 2v14l-7-4-7 4V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.6" />
    </svg>
  `;
}

function iconBookmarkFilled() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4h10a2 2 0 0 1 2 2v14l-7-4-7 4V6a2 2 0 0 1 2-2z"></path>
    </svg>
  `;
}

function formatSpeedLabel(value: number) {
  if (Number(value) === 1) return '1x';
  return `${value}x`;
}

function updateAyahToggleAtIndex(state: AppState, index: number) {
  if (index < 0) return;
  const verse = state.verses[index];
  if (!verse) return;
  const card = elements.versesContainer.querySelector(`[data-verse-index="${index}"]`);
  if (!(card instanceof HTMLElement)) return;
  const button = card.querySelector('button[data-action="toggle-ayah-play"]');
  if (!(button instanceof HTMLButtonElement)) return;
  const isPlaying = Boolean(state.playbackState.isPlaying && state.activeAyahKey === verse.key);
  button.innerHTML = `${renderIcon(isPlaying ? 'stop' : 'play')}<span class="tooltip">${isPlaying ? 'Stop' : 'Play ayah'}</span>`;
  button.setAttribute('aria-label', isPlaying ? 'Stop ayah' : 'Play ayah');
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

function wrapWordsFromHtml(htmlText: string) {
  const container = document.createElement('div');
  container.innerHTML = htmlText;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue) textNodes.push(node as Text);
  }
  let index = 0;
  textNodes.forEach((node) => {
    const value = node.nodeValue ?? '';
    if (!value.trim()) return;
    const parts = value.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (!part.trim()) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.wordIndex = String(index);
      span.textContent = part;
      fragment.appendChild(span);
      index += 1;
    });
    node.parentNode?.replaceChild(fragment, node);
  });
  return { html: container.innerHTML, count: index };
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
