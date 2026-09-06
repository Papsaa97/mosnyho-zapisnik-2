/**
 * Haptic feedback utility for mobile touch devices (iPhone / Android).
 * Uses navigator.vibrate where supported, with safe error handling and standard vibration patterns.
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticType = 'light'): void {
  if (typeof window === 'undefined' || !('navigator' in window)) return;

  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      switch (type) {
        case 'light':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate([35, 20, 35]);
          break;
        case 'success':
          navigator.vibrate([15, 30, 45]);
          break;
        case 'warning':
          navigator.vibrate([40, 40, 40, 40, 70]);
          break;
        case 'error':
          navigator.vibrate([60, 40, 60, 40, 80]);
          break;
        default:
          navigator.vibrate(15);
      }
    }
  } catch {
    // Ignore environments where vibration is prohibited or throws
  }
}
