import React, { useEffect, useRef, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { useSharedPolling } from '../../hooks/usePolling';
import {
  loadEventNotifications,
  NOTIFICATION_EVENT,
  refreshNotifications,
} from '../../services/crmEventNotifications';
import {
  getAudioUnlockedStatus,
  handleIncomingNotifications,
  initAudioUnlocker,
  isSoundSupported,
  registerInitialNotifications,
  unlockAudio,
} from '../../services/voiceNotificationService';

/**
 * GlobalSoundNotifier - Mounted inside MainLayout to provide continuous,
 * system-wide notification sound chimes across all OSCAR ERP pages and routes.
 */
export default function GlobalVoiceNotifier() {
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!isSoundSupported()) return;

    // 1. Initialize user gesture listener for browser autoplay restrictions
    initAudioUnlocker();

    const onUnlocked = () => {
      setShowUnlockPrompt(false);
    };
    window.addEventListener('oscar:sound-unlocked', onUnlocked);
    window.addEventListener('oscar:voice-unlocked', onUnlocked);

    // 2. Fetch initial notification snapshot on mount and register as "seen"
    // GUARANTEE: Old notifications and page reloads NEVER play sounds!
    const initialItems = loadEventNotifications();
    registerInitialNotifications(initialItems);
    isInitializedRef.current = true;

    // 3. Listen for new notifications arriving via server updates or internal events
    const handleNotificationUpdate = () => {
      const currentItems = loadEventNotifications();
      if (!isInitializedRef.current) {
        registerInitialNotifications(currentItems);
        isInitializedRef.current = true;
        return;
      }
      handleIncomingNotifications(currentItems);

      // If audio isn't unlocked yet and user hasn't interacted, show clean helper pill
      if (!getAudioUnlockedStatus()) {
        setShowUnlockPrompt(true);
      }
    };

    window.addEventListener(NOTIFICATION_EVENT, handleNotificationUpdate);

    return () => {
      window.removeEventListener('oscar:sound-unlocked', onUnlocked);
      window.removeEventListener('oscar:voice-unlocked', onUnlocked);
      window.removeEventListener(NOTIFICATION_EVENT, handleNotificationUpdate);
    };
  }, []);

  // Shared 15-second background polling for the notification feed
  // Uses existing useSharedPolling to ensure no duplicate API calls across tabs
  useSharedPolling('sound-notifications-feed', refreshNotifications, 15000);

  if (!showUnlockPrompt) return null;

  return (
    <div
      onClick={unlockAudio}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 cursor-pointer animate-in fade-in slide-in-from-bottom-3 duration-200 hover:bg-slate-800 transition-colors"
      title="Click to enable automatic notification sounds in browser"
    >
      <Volume2 size={16} className="text-blue-400 shrink-0 animate-pulse" />
      <span className="text-xs font-semibold">
        Tap to enable Notification Sound
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowUnlockPrompt(false);
        }}
        className="ml-1 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
