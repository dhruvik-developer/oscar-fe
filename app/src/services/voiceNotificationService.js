/**
 * Notification Sound Service for OSCAR ERP
 * 
 * Provides a short, soft, and professional "Ding" notification tone for new ERP
 * notifications using the standard Web Audio API:
 * - Single, pleasant chime tone (~0.65s duration)
 * - Zero SpeechSynthesis, Text-to-Speech or robotic voices
 * - Genuinely new notification detection (old items & page reloads never trigger sound)
 * - Duplicate sound prevention
 * - Overlap prevention: exactly one clean "Ding" when multiple notifications arrive
 * - Category sound filtering
 * - Quiet Hours support
 * - Browser autoplay policy handler & user gesture unlocker
 */

const SETTINGS_KEY = 'oscar.notifications.sound_settings';
const LEGACY_SETTINGS_KEY = 'oscar.notifications.voice_settings';
const ANNOUNCED_SESSION_KEY = 'oscar.notifications.announced_sound_ids';

export const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  volume: 0.8, // 0.0 - 1.0
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  categories: {
    crm: true,
    purchase: true,
    approvals: true,
    sales: true,
    inventory: true,
    qc: true,
    production: true,
    accounts: true,
    hr: true,
    tasks: true,
    system: true,
  },
};

// Backwards-compatibility alias
export const DEFAULT_VOICE_SETTINGS = DEFAULT_SOUND_SETTINGS;

// In-memory runtime state
let currentSettings = loadSettings();
let isAudioUnlocked = false;
let unlockListenersAttached = false;
let lastDingTime = 0;
const DING_COOLDOWN_MS = 800; // Minimum interval between dings to prevent any overlapping

// Sets to guarantee old notifications are NEVER sounded on reload or repeatedly
const seenNotificationKeys = new Set();
const announcedIds = new Set(loadAnnouncedSession());
const listeners = new Set();

// Shared AudioContext instance (lazy initialized)
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

/** Load settings from localStorage with fallback to defaults */
export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY) || window.localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SOUND_SETTINGS,
      ...parsed,
      categories: {
        ...DEFAULT_SOUND_SETTINGS.categories,
        ...(parsed.categories || {}),
      },
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** Save settings to localStorage and notify subscribers */
export function saveSettings(newSettings) {
  currentSettings = {
    ...currentSettings,
    ...newSettings,
    categories: {
      ...currentSettings.categories,
      ...(newSettings.categories || {}),
    },
  };
  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(currentSettings);
      window.localStorage.setItem(SETTINGS_KEY, serialized);
      window.localStorage.setItem(LEGACY_SETTINGS_KEY, serialized);
    }
  } catch (err) {
    console.warn('[SoundNotifications] Failed to save settings:', err);
  }
  notifyListeners();
  return currentSettings;
}

export function getSoundSettings() {
  return currentSettings;
}

// Backwards-compatibility alias
export const getVoiceSettings = getSoundSettings;

export function subscribeToSoundSettings(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Backwards-compatibility alias
export const subscribeToVoiceSettings = subscribeToSoundSettings;

function notifyListeners() {
  listeners.forEach((cb) => {
    try { cb(currentSettings); } catch (e) { console.error(e); }
  });
}

function loadAnnouncedSession() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(ANNOUNCED_SESSION_KEY) || window.sessionStorage.getItem('oscar.notifications.announced_ids');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistAnnouncedSession(id) {
  announcedIds.add(id);
  try {
    if (typeof window !== 'undefined') {
      const list = Array.from(announcedIds).slice(-300);
      window.sessionStorage.setItem(ANNOUNCED_SESSION_KEY, JSON.stringify(list));
    }
  } catch {}
}

/** Check if browser supports Web Audio API */
export function isSoundSupported() {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
}

// Backwards-compatibility alias
export const isVoiceSupported = isSoundSupported;

/** Dummy export for compatibility */
export function getAvailableVoices() {
  return [];
}

/** Check whether current local time falls inside quiet hours */
export function isCurrentlyInQuietHours(settings = currentSettings) {
  if (!settings.quietHoursEnabled) return false;
  try {
    const now = new Date();
    const [startH, startM] = (settings.quietHoursStart || '22:00').split(':').map(Number);
    const [endH, endM] = (settings.quietHoursEnd || '08:00').split(':').map(Number);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
  } catch {
    return false;
  }
}

/** Check if audio has been unlocked by user gesture */
export function getAudioUnlockedStatus() {
  if (isAudioUnlocked) return true;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'running') {
    isAudioUnlocked = true;
    return true;
  }
  return false;
}

/** Initialize global user gesture listener to unlock browser audio autoplay */
export function initAudioUnlocker() {
  if (typeof window === 'undefined' || isAudioUnlocked || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    isAudioUnlocked = true;
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('oscar:sound-unlocked'));
    window.dispatchEvent(new CustomEvent('oscar:voice-unlocked')); // legacy event compatibility
    removeListeners();
  };

  const removeListeners = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

/** Explicitly unlock audio (e.g. when user clicks "Enable Notification Sound" button) */
export function unlockAudio() {
  isAudioUnlocked = true;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('oscar:sound-unlocked'));
  window.dispatchEvent(new CustomEvent('oscar:voice-unlocked'));
}

/**
 * Categorize notification into one of the settings categories
 */
export function resolveNotificationCategory(notification) {
  if (!notification) return 'system';
  const type = String(notification.type || '').toLowerCase();
  const title = String(notification.title || '').toLowerCase();
  const mod = String(notification.module || notification.category || '').toLowerCase();
  const kind = String(notification.kind || '').toLowerCase();

  if (type.includes('approval') || title.includes('approval required') || title.includes('approval approved')) {
    return 'approvals';
  }
  if (mod === 'crm' || type.startsWith('crm.') || title.includes('lead') || title.includes('deal')) {
    return 'crm';
  }
  if (mod === 'inventory' || type.includes('stock') || title.includes('stock') || title.includes('inventory')) {
    return 'inventory';
  }
  if (mod === 'qc' || type.includes('qc') || title.includes('qc') || title.includes('rejection') || title.includes('inspection')) {
    return 'qc';
  }
  if (mod === 'production' || mod === 'projects' || type.startsWith('pms.') || title.includes('production') || title.includes('job work') || title.includes('loom')) {
    return 'production';
  }
  if (mod === 'purchase' || title.includes('purchase order') || title.includes('po-')) {
    return 'purchase';
  }
  if (mod === 'sales' || type.startsWith('sales.') || title.includes('sales order') || title.includes('quotation') || title.includes('challan')) {
    return 'sales';
  }
  if (mod === 'accounts' || title.includes('invoice') || title.includes('payment') || title.includes('commission') || title.includes('billing')) {
    return 'accounts';
  }
  if (mod === 'hr' || mod === 'hrms' || type.startsWith('hrms.') || title.includes('leave') || title.includes('attendance') || title.includes('appraisal')) {
    return 'hr';
  }
  if (kind === 'task' || type.includes('task') || title.includes('task:')) {
    return 'tasks';
  }
  return 'system';
}

/**
 * Synthesizes a soft, pleasant, and professional 2-tone "Ding" chime (duration ~0.65s)
 * via Web Audio API. Zero external audio file requests, works 100% reliably.
 * 
 * Frequency architecture:
 * Tone 1: Gentle attack chime at 587.33 Hz (D5) for ~70ms
 * Tone 2: Bright warm bell tone at 880.00 Hz (A5) with smooth exponential decay over 600ms
 * Tone 3: Delicate overtone at 1760.00 Hz (A6) for crystalline clarity
 */
export function playNotificationDing(volume = null) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    // If context is suspended, attempt to resume
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const effectiveVolume = volume !== null ? volume : (currentSettings.volume ?? 0.8);
    if (effectiveVolume <= 0) return true;

    const now = ctx.currentTime;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.connect(ctx.destination);

    // Tone 1: Initial soft attack chime (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.22 * effectiveVolume, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(masterGain);

    // Tone 2: Main resonant bell note (880.00 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.05);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.001, now + 0.05);
    gain2.gain.linearRampToValueAtTime(0.50 * effectiveVolume, now + 0.065);
    // Smooth decay over ~0.6 seconds
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    // Tone 3: Crystalline overtone (1760.00 Hz - A6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1760.00, now + 0.05);
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.setValueAtTime(0.001, now + 0.05);
    gain3.gain.linearRampToValueAtTime(0.10 * effectiveVolume, now + 0.065);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc3.connect(gain3);
    gain3.connect(masterGain);

    masterGain.gain.setValueAtTime(1.0, now);

    // Start and stop oscillators cleanly
    osc1.start(now);
    osc1.stop(now + 0.1);

    osc2.start(now + 0.05);
    osc2.stop(now + 0.68);

    osc3.start(now + 0.05);
    osc3.stop(now + 0.48);

    return true;
  } catch (err) {
    console.warn('[SoundNotifications] Audio playback error:', err);
    return false;
  }
}

/**
 * Trigger the notification ding with overlap protection.
 * If multiple triggers fire in rapid succession, only one clean Ding is played.
 */
export function triggerNotificationDing() {
  const now = Date.now();
  if (now - lastDingTime < DING_COOLDOWN_MS) {
    return; // Prevent overlapping sound
  }
  lastDingTime = now;
  playNotificationDing();
}

/**
 * Prime the service with existing unread notifications when page loads
 * to ensure old notifications are NEVER sounded on page refresh!
 */
export function registerInitialNotifications(notificationList) {
  if (!Array.isArray(notificationList)) return;
  notificationList.forEach((n) => {
    const key = n.key || n.id || (n.eventId ? `server-${n.eventId}` : null);
    if (key) {
      seenNotificationKeys.add(String(key));
    }
  });
}

/**
 * Process incoming notifications:
 * 1. Filter out read notifications.
 * 2. Filter out already seen / announced notifications.
 * 3. Filter out disabled categories or quiet hours.
 * 4. Play exactly ONE simple, short "Ding" if genuinely new notifications arrived.
 */
export function handleIncomingNotifications(notificationList) {
  if (!Array.isArray(notificationList) || notificationList.length === 0) return;
  if (!currentSettings.enabled) return;
  if (isCurrentlyInQuietHours()) return;

  let hasGenuinelyNew = false;

  notificationList.forEach((n) => {
    // Skip read notifications
    if (n.unread === false || n.read === true || n.status === 'read') return;

    const key = String(n.key || n.id || (n.eventId ? `server-${n.eventId}` : ''));
    if (!key) return;

    // Skip if seen on initial page load or announced in this session
    if (seenNotificationKeys.has(key) || announcedIds.has(key)) return;

    // Check category sound preference
    const category = resolveNotificationCategory(n);
    if (currentSettings.categories && currentSettings.categories[category] === false) {
      seenNotificationKeys.add(key);
      return;
    }

    // Mark as seen and announced
    seenNotificationKeys.add(key);
    persistAnnouncedSession(key);
    hasGenuinelyNew = true;
  });

  // Final requirement: One new notification (or batch) = one simple, short "Ding" sound
  if (hasGenuinelyNew) {
    triggerNotificationDing();
  }
}

/** Compatibility aliases for legacy voice callers */
export function queueVoiceNotification(notification, key) {
  if (!currentSettings.enabled) return;
  if (isCurrentlyInQuietHours()) return;
  const k = key || String(notification?.key || notification?.id || '');
  if (k && announcedIds.has(k)) return;
  if (k) persistAnnouncedSession(k);
  triggerNotificationDing();
}

export function queueCustomAnnouncement() {
  triggerNotificationDing();
}

export function stopSpeech() {
  // No-op for audio tone
}

/** Test function: plays the exact "Ding" tone with current volume */
export function testVoiceAnnouncement() {
  return playNotificationDing();
}

export function testNotificationSound(volume = null) {
  return playNotificationDing(volume);
}
