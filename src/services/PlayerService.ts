import type { PlaybackStage, PlayerState, VerseData } from '../types';

export class PlayerService {
  private queue: VerseData[] = [];
  private state: PlayerState = {
    status: 'idle',
    currentIndex: 0,
    stage: 'idle'
  };
  private listeners = new Set<(state: PlayerState) => void>();
  private audio = new Audio();
  private arabicBase = '';
  private urduBase = '';
  private fallbackDelayMs = 800;
  private playToken = 0;
  private pausedStage: PlaybackStage = 'idle';
  private delayTimeoutId: number | null = null;

  constructor() {
    this.audio.preload = 'auto';
  }

  setSources(arabicBase: string, urduBase: string) {
    this.arabicBase = normalizeBase(arabicBase);
    this.urduBase = normalizeBase(urduBase);
  }

  setQueue(queue: VerseData[]) {
    this.stopInternal();
    this.queue = queue;
    this.state = {
      status: 'stopped',
      currentIndex: 0,
      stage: 'idle'
    };
    this.notify();
  }

  restartCurrent() {
    if (!this.queue.length) return;
    this.cancelPlayback();
    this.state.stage = 'idle';
    if (this.state.status === 'playing') {
      this.playCurrent();
    }
  }

  subscribe(listener: (state: PlayerState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  getState(): PlayerState {
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
    this.notify();
    this.playCurrent();
  }

  pause() {
    if (this.state.status !== 'playing') return;

    if (this.state.stage === 'arabic' || this.state.stage === 'urdu') {
      this.audio.pause();
      this.pausedStage = this.state.stage;
    } else if (this.state.stage === 'text') {
      this.clearDelay();
      this.pausedStage = 'text';
    }

    this.state.status = 'paused';
    this.notify();
  }

  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'playing';
    this.notify();

    if (this.pausedStage === 'arabic' || this.pausedStage === 'urdu') {
      this.audio.play().catch(() => this.handleAudioError());
      return;
    }

    if (this.pausedStage === 'text') {
      this.scheduleTextFallback();
      return;
    }

    this.playCurrent();
  }

  stop() {
    this.cancelPlayback();
    if (!this.queue.length) {
      this.stopInternal();
      return;
    }
    this.state = {
      ...this.state,
      status: 'stopped',
      currentIndex: 0,
      stage: 'idle'
    };
    this.notify();
  }

  next() {
    if (!this.queue.length) return;
    this.cancelPlayback();
    this.state.currentIndex = Math.min(this.state.currentIndex + 1, this.queue.length - 1);
    this.state.stage = 'idle';
    this.notify();
    if (this.state.status === 'playing') {
      this.playCurrent();
    }
  }

  prev() {
    if (!this.queue.length) return;
    this.cancelPlayback();
    this.state.currentIndex = Math.max(this.state.currentIndex - 1, 0);
    this.state.stage = 'idle';
    this.notify();
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
    this.state.stage = 'arabic';
    this.notify();

    const url = buildUrl(this.arabicBase, verse.fileKey);
    this.audio.src = url;
    this.audio.onended = () => {
      if (token !== this.playToken) return;
      this.playUrdu(verse);
    };
    this.audio.onerror = () => {
      if (token !== this.playToken) return;
      this.playUrdu(verse);
    };

    this.preloadNext(this.state.currentIndex + 1);

    this.audio.play().catch(() => {
      if (token !== this.playToken) return;
      this.playUrdu(verse);
    });
  }

  private playUrdu(verse: VerseData) {
    if (this.state.status !== 'playing') return;

    this.state.stage = 'urdu';
    this.notify();

    const url = buildUrl(this.urduBase, verse.fileKey);
    this.audio.src = url;

    const token = ++this.playToken;
    this.audio.onended = () => {
      if (token !== this.playToken) return;
      this.advance();
    };
    this.audio.onerror = () => {
      if (token !== this.playToken) return;
      this.scheduleTextFallback();
    };

    this.audio.play().catch(() => {
      if (token !== this.playToken) return;
      this.scheduleTextFallback();
    });
  }

  private scheduleTextFallback() {
    this.state.stage = 'text';
    this.notify();
    this.clearDelay();
    this.delayTimeoutId = window.setTimeout(() => {
      if (this.state.status !== 'playing') return;
      this.advance();
    }, this.fallbackDelayMs);
  }

  private advance() {
    const nextIndex = this.state.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      this.stop();
      return;
    }
    this.state.currentIndex = nextIndex;
    this.state.stage = 'idle';
    this.notify();
    this.playCurrent();
  }

  private preloadNext(index: number) {
    const verse = this.queue[index];
    if (!verse) return;
    const nextArabic = new Audio();
    nextArabic.preload = 'auto';
    nextArabic.src = buildUrl(this.arabicBase, verse.fileKey);

    const nextUrdu = new Audio();
    nextUrdu.preload = 'auto';
    nextUrdu.src = buildUrl(this.urduBase, verse.fileKey);
  }

  private handleAudioError() {
    this.playUrdu(this.queue[this.state.currentIndex]);
  }

  private cancelPlayback() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.clearDelay();
  }

  private stopInternal() {
    this.cancelPlayback();
    this.playToken += 1;
    this.pausedStage = 'idle';
    this.state = {
      status: 'idle',
      currentIndex: 0,
      stage: 'idle'
    };
  }

  private clearDelay() {
    if (this.delayTimeoutId) {
      window.clearTimeout(this.delayTimeoutId);
      this.delayTimeoutId = null;
    }
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

function buildUrl(base: string, fileKey: string): string {
  return `${normalizeBase(base)}${fileKey}.mp3`;
}
