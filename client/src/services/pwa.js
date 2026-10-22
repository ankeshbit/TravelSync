/**
 * TravelSync PWA & Service Worker Registration Helper
 */

let deferredPrompt = null;
let isInstallable = false;

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    isInstallable = true;
    window.dispatchEvent(new CustomEvent('travelsync-can-install', { detail: true }));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    isInstallable = false;
    window.dispatchEvent(new CustomEvent('travelsync-installed'));
    console.log('[PWA] TravelSync was successfully installed');
  });

  // Only register service worker in supported browser environments
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] ServiceWorker registered with scope:', registration.scope);

      // Periodically check for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available.');
              window.dispatchEvent(new CustomEvent('travelsync-sw-update', { detail: registration }));
            }
          });
        }
      });

      return registration;
    })
    .catch((err) => {
      console.warn('[SW] ServiceWorker registration failed (non-fatal):', err);
      return null;
    });
}

export function promptPwaInstall() {
  if (!deferredPrompt) {
    return Promise.resolve({ outcome: 'unavailable' });
  }

  deferredPrompt.prompt();
  return deferredPrompt.userChoice.then((choiceResult) => {
    deferredPrompt = null;
    isInstallable = false;
    return choiceResult;
  });
}

export function canInstallPwa() {
  return isInstallable;
}

export const installPwa = promptPwaInstall;
export { isInstallable };
