/**
 * Haptic feedback utilities for mobile devices
 * Uses the Vibration API when available
 */

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export const haptics = {
  /**
   * Light haptic feedback - for subtle interactions
   * e.g., toggling a switch, selecting an option
   */
  light: () => {
    if (canVibrate()) {
      navigator.vibrate(10);
    }
  },

  /**
   * Medium haptic feedback - for standard interactions
   * e.g., button press, tab selection
   */
  medium: () => {
    if (canVibrate()) {
      navigator.vibrate(20);
    }
  },

  /**
   * Success haptic feedback - for positive outcomes
   * e.g., successful purchase, achievement unlocked
   */
  success: () => {
    if (canVibrate()) {
      navigator.vibrate([10, 50, 10]);
    }
  },

  /**
   * Error haptic feedback - for negative outcomes
   * e.g., form validation error, failed action
   */
  error: () => {
    if (canVibrate()) {
      navigator.vibrate([50, 30, 50]);
    }
  },

  /**
   * Warning haptic feedback - for cautionary feedback
   * e.g., confirmation dialogs, destructive actions
   */
  warning: () => {
    if (canVibrate()) {
      navigator.vibrate([30, 20, 30]);
    }
  },

  /**
   * Custom haptic pattern
   * @param pattern - Array of vibration and pause durations in ms
   */
  custom: (pattern: number | number[]) => {
    if (canVibrate()) {
      navigator.vibrate(pattern);
    }
  },
};
