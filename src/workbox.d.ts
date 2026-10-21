declare module 'workbox-precaching' {
  export function cleanupOutdatedCaches(): void;
  export function precacheAndRoute(entries: unknown[]): void;
}

declare interface ServiceWorkerGlobalScope {
  __WB_MANIFEST: unknown[];
}
