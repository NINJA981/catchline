// Registers the offline service worker (written at build time by plugins/precache.ts).
// The worker only serves files this site already shipped; it makes no requests of its own.

export function registerServiceWorker(relativeUrl: string, onReady?: () => void): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const register = (): void => {
    navigator.serviceWorker
      .register(relativeUrl)
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        onReady?.();
      })
      .catch(() => {
        // Private windows and some embedded browsers refuse workers. The site still works online.
      });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
