import { registerPushSubscription, revokePushSubscription } from './repository';
import { registerBitoServiceWorker } from '@/lib/pwa/serviceWorker';

export interface PushCapability {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  displayMode: 'standalone' | 'browser';
  platform: string;
  browser: string;
}

function detectDisplayMode(): 'standalone' | 'browser' {
  if (typeof window === 'undefined') return 'browser';
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneMedia || iosStandalone ? 'standalone' : 'browser';
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'unknown';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'Chrome iOS';
  if (/FxiOS/i.test(ua)) return 'Firefox iOS';
  if (/EdgiOS/i.test(ua)) return 'Edge iOS';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua)) return 'Safari';
  return 'unknown';
}

export function getPushCapability(): PushCapability {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

  return {
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    displayMode: detectDisplayMode(),
    platform: detectPlatform(),
    browser: detectBrowser(),
  };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function enablePushForThisDevice(deviceLabel?: string): Promise<PushSubscription> {
  const capability = getPushCapability();
  if (!capability.supported) throw new Error('Pushmeldingen worden op dit apparaat/browser niet ondersteund');

  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error('VITE_WEB_PUSH_PUBLIC_KEY ontbreekt');

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Toestemming voor pushmeldingen is niet verleend');

  const registration = await registerBitoServiceWorker();
  if (!registration) throw new Error('Service worker is niet beschikbaar');

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh || arrayBufferToBase64Url(subscription.getKey('p256dh'));
  const authKey = json.keys?.auth || arrayBufferToBase64Url(subscription.getKey('auth'));
  if (!p256dh || !authKey) throw new Error('Push subscription mist cryptografische sleutels');

  await registerPushSubscription({
    endpoint: subscription.endpoint,
    p256dh,
    authKey,
    deviceLabel,
    platform: capability.platform,
    browser: capability.browser,
    displayMode: capability.displayMode,
  });

  return subscription;
}

export async function disablePushForThisDevice(): Promise<void> {
  const registration = await registerBitoServiceWorker();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await revokePushSubscription(endpoint);
}
