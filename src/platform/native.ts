import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export interface NativeCallbacks {
  /** Freeze play, release held input and silence audio immediately. */
  pause: () => void;
  /** Prepare the foreground UI; the game decides when play may resume. */
  resume: () => void;
  /** Return true when Back closes a panel, pauses play or returns to the menu. */
  back: () => boolean;
}

export type HapticKind = 'tap' | 'hop' | 'pickup' | 'impact' | 'reward' | 'death';

export const isNative = Capacitor.isNativePlatform();
let foreground = true;
let hapticsEnabled = true;
let lastHapticAt = -Infinity;
let lastHapticPriority = 0;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/** One bounded pulse per event, with important impacts allowed to supersede
 * a small pickup. The browser path never needs a native plugin or permission. */
export function haptic(kind: HapticKind = 'tap'): void {
  if (!hapticsEnabled || !foreground || document.hidden) return;
  const priority = kind === 'death' ? 3 : kind === 'impact' || kind === 'reward' ? 2 : 1;
  const now = performance.now();
  if (now - lastHapticAt < 65 && priority <= lastHapticPriority) return;
  lastHapticAt = now;
  lastHapticPriority = priority;
  if (!isNative) {
    const duration = kind === 'death' ? 55 : kind === 'impact' ? 35 : kind === 'reward' ? 24 : kind === 'hop' ? 12 : 7;
    try { navigator.vibrate?.(duration); } catch { /* Haptics are optional. */ }
    return;
  }
  const pulse = kind === 'reward'
    ? Haptics.notification({ type: NotificationType.Success })
    : kind === 'death'
      ? Haptics.notification({ type: NotificationType.Error })
      : Haptics.impact({
        style: kind === 'impact' ? ImpactStyle.Heavy : kind === 'hop' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
  void pulse.catch(() => { /* Unsupported hardware must not interrupt play. */ });
}

/** Bind once at game startup. The returned disposer removes only this bridge's
 * listeners, so a scene reload cannot accumulate lifecycle or Back callbacks. */
export async function installNativeBridge(callbacks: NativeCallbacks): Promise<() => void> {
  const listeners: PluginListenerHandle[] = [];
  let disposed = false;
  let nativeActive = true;
  let visible = !document.hidden;
  let wasActive = visible;
  foreground = visible;
  const publish = (): void => {
    if (disposed) return;
    const active = visible && nativeActive;
    foreground = active;
    if (active === wasActive) return;
    wasActive = active;
    if (active) callbacks.resume();
    else callbacks.pause();
  };
  const visibility = (): void => { visible = !document.hidden; publish(); };
  document.addEventListener('visibilitychange', visibility);
  if (!visible) callbacks.pause();

  if (isNative) {
    const bindings = await Promise.allSettled([
      App.addListener('appStateChange', ({ isActive }) => { nativeActive = isActive; publish(); }),
      // Android onPause precedes onStop; do not leave audio playing in between.
      App.addListener('pause', () => { nativeActive = false; publish(); }),
      // A transient activity can resume without ever reaching onStop/onStart.
      App.addListener('resume', () => { nativeActive = true; publish(); }),
      App.addListener('backButton', () => {
        if (disposed) return;
        if (!callbacks.back()) void App.minimizeApp().catch(() => {});
      }),
    ]);
    for (const result of bindings) if (result.status === 'fulfilled') listeners.push(result.value);
    try { nativeActive = (await App.getState()).isActive; publish(); } catch { /* Visibility remains a fallback. */ }
  }

  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', visibility);
    for (const listener of listeners) void listener.remove().catch(() => {});
  };
}
