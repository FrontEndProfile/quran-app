import type { PlaybackState, VerseData } from '../types';

export type PlaybackPhase = 'idle' | 'arabic' | 'urdu';

type StateListener = (state: PlaybackState) => void;

type NoticeListener = (message: string) => void;

type ProgressListener = (payload: {
  phase: 'arabic' | 'urdu';
  currentIndex: number;
  currentTime: number;
  duration: number;
}) => void;

export class PlayerService {
  private queue: VerseData[] = [];
  private state: PlaybackState = {
    status: 'idle',
    currentIndex: 0,
    phase: 'arabic',
    isPlaying: false
  };
  private listeners = new Set<StateListener>();
  private noticeListeners = new Set<NoticeListener>();
  private progressListeners = new Set<ProgressListener>();
  private audio = new Audio();
  private arabicBase = '';
  private urduBase = '';
  private playToken = 0;
  private delayTimeoutId: number | null = null;
  private pausedPhase: PlaybackPhase = 'idle';
  private repeat = false;
  private urduVoiceEnabled = true;
  private playbackRate = 1;

  constructor() {
    this.audio.preload = 'auto';
  }

  setSources(arabicBase: string, urduBase: string) {
    this.arabicBase = normalizeBase(arabicBase);
    this.urduBase = normalizeBase(urduBase);
  }

  setRepeat(value: boolean) {
    this.repeat = value;
  }

  setUrduVoiceEnabled(value: boolean) {
    this.urduVoiceEnabled = value;
  }

  setPlaybackRate(value: number) {
    const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0.25), 2) : 1;
    this.playbackRate = normalized;
    this.audio.playbackRate = normalized;
  }

  loadPlaylist(queue: VerseData[]) {
    this.stopInternal();
    this.queue = queue;
    this.state = {
      status: queue.length ? 'stopped' : 'idle',
      currentIndex: 0,
      phase: 'arabic',
      isPlaying: false
    };
    this.notify();
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  onNotice(listener: NoticeListener): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  getQueue(): VerseData[] {
    return this.queue;
  }

  play() {
    if (!this.queue.length) return;
    if (this.state.status === 'paused') {
      this.resume();
      return;
    }
    this.state.status = 'playing';
    this.state.isPlaying = true;
    this.notify();
    this.playCurrent();
  }

  playFromIndex(index: number) {
    if (!this.queue.length) return;
    this.clearAudio(true);
    this.clearDelay();
    this.pausedPhase = 'idle';
    this.state.currentIndex = clampIndex(index, this.queue.length);
    this.state.status = 'playing';
    this.state.phase = 'arabic';
    this.state.isPlaying = true;
    this.notify();
    this.playCurrent();
  }

  pause() {
    if (this.state.status !== 'playing') return;

    if (this.state.phase === 'arabic' || this.state.phase === 'urdu') {
      this.audio.pause();
      this.pausedPhase = this.state.phase;
    } else {
      this.clearDelay();
      this.pausedPhase = 'idle';
    }

    this.state.status = 'paused';
    this.state.isPlaying = false;
    this.notify();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'playing';
    this.state.isPlaying = true;
    this.notify();

    if (this.pausedPhase === 'arabic') {
      this.audio.play().catch(() => this.handleArabicError());
      return;
    }

    if (this.pausedPhase === 'urdu') {
      this.audio.play().catch(() => this.handleUrduError());
      return;
    }

    this.playCurrent();
  }

  stop() {
    this.clearAudio(true);
    this.clearDelay();
    this.state = {
      ...this.state,
      status: this.queue.length ? 'stopped' : 'idle',
      isPlaying: false
    };
    this.pausedPhase = 'idle';
    this.notify();
  }

  prevSurah(): boolean {
    return this.jumpSurah(-1);
  }

  nextSurah(): boolean {
    return this.jumpSurah(1);
  }

  next() {
    if (!this.queue.length) return;
    this.clearAudio(true);
    this.clearDelay();
    this.pausedPhase = 'idle';
    this.state.currentIndex = clampIndex(this.state.currentIndex + 1, this.queue.length);
    this.state.phase = 'arabic';
    this.state.status = 'playing';
    this.state.isPlaying = true;
    this.notify();
    this.playCurrent();
  }

  prev() {
    if (!this.queue.length) return;
    this.clearAudio(true);
    this.clearDelay();
    this.pausedPhase = 'idle';
    this.state.currentIndex = clampIndex(this.state.currentIndex - 1, this.queue.length);
    this.state.phase = 'arabic';
    this.state.status = 'playing';
    this.state.isPlaying = true;
    this.notify();
    this.playCurrent();
  }

  restartCurrent() {
    if (!this.queue.length) return;
    this.clearAudio(true);
    this.clearDelay();
    this.state.phase = 'arabic';
    if (this.state.status === 'playing') {
      this.playCurrent();
    }
  }

  private playCurrent() {
    if (this.state.status !== 'playing') return;
    const verse = this.queue[this.state.currentIndex];
    if (!verse) {
      this.stop();
      return;
    }

    this.playToken += 1;
    const token = this.playToken;
    this.state.phase = 'arabic';
    this.notify();

    const url = buildUrl(this.arabicBase, verse.key);
    this.clearAudioHandlers();
    this.audio.src = url;
    this.audio.playbackRate = this.playbackRate;
    this.audio.onended = () => {
      if (token !== this.playToken) return;
      if (!this.urduVoiceEnabled) {
        this.advance();
        return;
      }
      this.playUrdu(verse);
    };
    this.audio.onerror = () => {
      if (token !== this.playToken) return;
      this.handleArabicError();
    };
    this.audio.onloadedmetadata = () => {
      if (token !== this.playToken) return;
      this.emitProgress();
    };
    this.audio.ontimeupdate = () => {
      if (token !== this.playToken) return;
      this.emitProgress();
    };

    this.audio.play().catch(() => {
      if (token !== this.playToken) return;
      this.handleArabicError();
    });
  }

  private playUrdu(verse: VerseData) {
    if (this.state.status !== 'playing') return;

    this.state.phase = 'urdu';
    this.notify();

    const url = buildUrl(this.urduBase, verse.key);
    this.clearAudioHandlers();
    this.audio.src = url;
    this.audio.playbackRate = this.playbackRate;

    const token = ++this.playToken;
    this.audio.onended = () => {
      if (token !== this.playToken) return;
      this.advance();
    };
    this.audio.onerror = () => {
      if (token !== this.playToken) return;
      this.handleUrduError();
    };
    this.audio.onloadedmetadata = () => {
      if (token !== this.playToken) return;
      this.emitProgress();
    };
    this.audio.ontimeupdate = () => {
      if (token !== this.playToken) return;
      this.emitProgress();
    };

    this.audio.play().catch(() => {
      if (token !== this.playToken) return;
      this.handleUrduError();
    });
  }

  private handleArabicError() {
    const verse = this.queue[this.state.currentIndex];
    if (!verse) return;
    this.emitNotice(`Arabic audio missing for ${verse.surah}:${verse.ayah}. Trying Urdu.`);
    if (!this.urduVoiceEnabled) {
      this.scheduleAdvance(400);
      return;
    }
    this.playUrdu(verse);
  }

  private handleUrduError() {
    const verse = this.queue[this.state.currentIndex];
    if (!verse) return;
    this.emitNotice(`Urdu audio missing for ${verse.surah}:${verse.ayah}. Skipping ahead.`);
    this.scheduleAdvance(400);
  }

  private scheduleAdvance(delayMs: number) {
    this.clearDelay();
    this.delayTimeoutId = window.setTimeout(() => {
      if (this.state.status !== 'playing') return;
      this.advance();
    }, delayMs);
  }

  private advance() {
    if (this.repeat) {
      this.state.phase = 'arabic';
      this.notify();
      this.playCurrent();
      return;
    }

    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      this.stop();
      return;
    }
    this.state.currentIndex = nextIndex;
    this.state.phase = 'arabic';
    this.notify();
    this.playCurrent();
  }

  private stopInternal() {
    this.clearAudio(true);
    this.clearDelay();
    this.playToken += 1;
    this.pausedPhase = 'idle';
    this.state = {
      status: 'idle',
      currentIndex: 0,
      phase: 'arabic',
      isPlaying: false
    };
  }

  private clearDelay() {
    if (this.delayTimeoutId) {
      window.clearTimeout(this.delayTimeoutId);
      this.delayTimeoutId = null;
    }
  }

  private clearAudioHandlers() {
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.ontimeupdate = null;
    this.audio.onloadedmetadata = null;
  }

  private clearAudio(resetSrc: boolean) {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.clearAudioHandlers();
    if (resetSrc) {
      this.audio.src = '';
    }
  }

  private jumpSurah(direction: -1 | 1): boolean {
    if (!this.queue.length) return false;
    const current = this.queue[this.state.currentIndex];
    if (!current) return false;

    const surahStarts: { surah: number; index: number }[] = [];
    for (let i = 0; i < this.queue.length; i += 1) {
      const verse = this.queue[i];
      const prev = this.queue[i - 1];
      if (!prev || verse.surah !== prev.surah) {
        surahStarts.push({ surah: verse.surah, index: i });
      }
    }

    const currentIndex = surahStarts.findIndex((entry) => entry.surah === current.surah);
    if (currentIndex === -1) return false;

    const target = surahStarts[currentIndex + direction];
    if (!target) return false;

    this.playFromIndex(target.index);
    return true;
  }

  private emitNotice(message: string) {
    this.noticeListeners.forEach((listener) => listener(message));
  }

  private emitProgress() {
    if (this.state.status !== 'playing') return;
    this.progressListeners.forEach((listener) =>
      listener({
        phase: this.state.phase,
        currentIndex: this.state.currentIndex,
        currentTime: this.audio.currentTime,
        duration: this.audio.duration
      })
    );
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function ayahFileKey(surah: number, ayah: number): string {
  return `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}`;
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

function buildUrl(base: string, fileKey: string): string {
  return `${normalizeBase(base)}${fileKey}.mp3`;
}

function clampIndex(index: number, length: number) {
  if (!length) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}
