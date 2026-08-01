const RECOVERY_KEY = 'bito-app-recovery-attempted';
const RECOVERY_PARAM = '_app_refresh';

export function isRecoverableAssetError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value ?? '');
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror|load failed|error loading dynamically imported module/i.test(message);
}

async function clearRuntimeCaches(): Promise<void> {
  if ('caches' in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

export async function recoverFromStaleAppShell(reason: unknown): Promise<boolean> {
  if (!isRecoverableAssetError(reason)) return false;
  if (sessionStorage.getItem(RECOVERY_KEY) === '1') return false;

  sessionStorage.setItem(RECOVERY_KEY, '1');

  try {
    await clearRuntimeCaches();
  } catch (error) {
    console.warn('App-cache kon niet volledig worden opgeschoond.', error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set(RECOVERY_PARAM, Date.now().toString());
  window.location.replace(url.toString());
  return true;
}

export function markAppBootSuccessful(): void {
  sessionStorage.removeItem(RECOVERY_KEY);

  const url = new URL(window.location.href);
  if (!url.searchParams.has(RECOVERY_PARAM)) return;

  url.searchParams.delete(RECOVERY_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function installGlobalAppRecovery(): () => void {
  const onError = (event: ErrorEvent) => {
    void recoverFromStaleAppShell(event.error ?? event.message);
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    void recoverFromStaleAppShell(event.reason);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
