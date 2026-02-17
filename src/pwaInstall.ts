interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'quran-urdu-player:pwa-install-dismissed-at';
const INSTALLED_KEY = 'quran-urdu-player:pwa-installed';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_DELAY_MS = 2500;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let promptElement: HTMLDivElement | null = null;
let showTimerId: number | null = null;
let allowPromptDisplay = false;

function isStandaloneMode() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

function isLocalDevHost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function getDismissedAt() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return 0;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

function wasDismissedRecently() {
  if (isLocalDevHost()) return false;
  const dismissedAt = getDismissedAt();
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

function markDismissed() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, '1');
}

function isAlreadyInstalled() {
  if (isLocalDevHost()) return false;
  return localStorage.getItem(INSTALLED_KEY) === '1';
}

function shouldSkipPrompt() {
  return isStandaloneMode() || isAlreadyInstalled() || wasDismissedRecently();
}

function hidePrompt() {
  if (!promptElement) return;
  promptElement.classList.add('hidden');
}

function showPrompt() {
  if (shouldSkipPrompt()) return;
  if (!deferredPrompt) return;
  if (!allowPromptDisplay) return;

  if (!promptElement) {
    promptElement = document.createElement('div');
    promptElement.className = 'install-prompt hidden';
    promptElement.innerHTML = `
      <div class="install-prompt-title">Install Quran Reader App</div>
      <p class="install-prompt-text" data-role="install-text"></p>
      <div class="install-prompt-actions">
        <button type="button" class="install-btn install-btn-primary" data-action="install-app">Install</button>
        <button type="button" class="install-btn" data-action="dismiss-install">Not now</button>
      </div>
    `;
    document.body.appendChild(promptElement);

    promptElement.querySelector('[data-action="dismiss-install"]')?.addEventListener('click', () => {
      markDismissed();
      hidePrompt();
    });

    promptElement.querySelector('[data-action="install-app"]')?.addEventListener('click', async () => {
      if (!deferredPrompt) {
        hidePrompt();
        return;
      }
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        markInstalled();
      } else {
        markDismissed();
      }
      deferredPrompt = null;
      hidePrompt();
    });
  }

  const textEl = promptElement.querySelector('[data-role="install-text"]');
  if (textEl instanceof HTMLElement) {
    textEl.textContent = 'Install button dabayein aur app ko quickly open karein.';
  }

  promptElement.classList.remove('hidden');
}

function schedulePrompt() {
  if (showTimerId) return;
  showTimerId = window.setTimeout(() => {
    showTimerId = null;
    allowPromptDisplay = true;
    showPrompt();
  }, PROMPT_DELAY_MS);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep app usable even when SW registration fails.
    });
  });
}

export function initPwaInstallPrompt() {
  registerServiceWorker();
  if (shouldSkipPrompt()) return;

  schedulePrompt();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    showPrompt();
  });

  window.addEventListener('appinstalled', () => {
    markInstalled();
    deferredPrompt = null;
    hidePrompt();
  });
}
