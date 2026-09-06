import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ActiveShiftState, 
  ShiftTimelineEvent, 
  ShiftCheckoutData,
  WorkType, 
  WeldingMethod 
} from '../types';
import { triggerHaptic } from '../utils/haptics';

const STORAGE_KEY = 'mosny_active_shift_v2';

const DEFAULT_STATE: ActiveShiftState = {
  status: 'idle',
  startTimestamp: null,
  currentPauseStart: null,
  totalPausedMs: 0,
  events: [],
  clientName: '',
  projectName: '',
  workType: 'site_assembly',
  weldingMethod: 'TIG',
  notes: '',
  notifiedTenHours: false
};

function formatDigits(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDurationMs(ms: number): {
  hours: number;
  minutes: number;
  seconds: number;
  display: string;
} {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    display: `${formatDigits(hours)}:${formatDigits(minutes)}:${formatDigits(seconds)}`
  };
}

export function formatTimestampToTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${formatDigits(date.getHours())}:${formatDigits(date.getMinutes())}`;
}

export function formatTimestampToDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = formatDigits(date.getMonth() + 1);
  const day = formatDigits(date.getDate());
  return `${year}-${month}-${day}`;
}

export function useShiftTimer() {
  const [shiftState, setShiftState] = useState<ActiveShiftState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse active shift from localStorage:', e);
    }
    return DEFAULT_STATE;
  });

  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const timerRef = useRef<number | null>(null);

  // Sync with localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shiftState));
    } catch (e) {
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.error('[ShiftTimer] localStorage quota exceeded – active shift state NOT saved!', e);
        // Try to clear any stale data and retry once
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(shiftState));
        } catch {
          console.error('[ShiftTimer] Cannot save shift state – storage is completely full.');
        }
      } else {
        console.error('[ShiftTimer] Failed to save active shift to localStorage:', e);
      }
    }
  }, [shiftState]);

  // Interval ticker to update clock every 1 second when shift is not idle
  useEffect(() => {
    if (shiftState.status !== 'idle') {
      timerRef.current = window.setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [shiftState.status]);

  // iOS Safari Background Sync: when app wakes up or tab becomes visible again,
  // JS timers may have been frozen. Immediately sync clock with Date.now()
  useEffect(() => {
    const handleSync = () => {
      setCurrentTime(Date.now());
    };

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('pageshow', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('pageshow', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  // Compute live elapsed times: strictly calculated as Date.now() - startTime - pausedTime
  const {
    totalElapsedMs,
    pausedMs,
    netWorkedMs,
    currentPauseDurationMs,
    isWarningLongShift,
    isSmartCheckoutRequired,
    isAnomaly,
    anomalyReason,
    elapsedHours
  } = (() => {
    if (shiftState.status === 'idle' || !shiftState.startTimestamp) {
      return {
        totalElapsedMs: 0,
        pausedMs: 0,
        netWorkedMs: 0,
        currentPauseDurationMs: 0,
        isWarningLongShift: false,
        isSmartCheckoutRequired: false,
        isAnomaly: false,
        anomalyReason: '',
        elapsedHours: 0
      };
    }

    const elapsed = Math.max(0, currentTime - shiftState.startTimestamp);
    const activePause = shiftState.status === 'paused' && shiftState.currentPauseStart
      ? Math.max(0, currentTime - shiftState.currentPauseStart)
      : 0;

    const totalPause = shiftState.totalPausedMs + activePause;
    const netWork = Math.max(0, elapsed - totalPause);
    const hours = elapsed / (1000 * 60 * 60);

    // Anomaly checks – based purely on elapsed duration. A shift crossing
    // midnight is completely normal for night/emergency work (see the
    // 'night' surcharge) and must NOT alone flag a false "forgotten shift"
    // alert – only genuinely long shifts should trigger Smart Checkout.
    const isOver14Hours = hours >= 14;
    const isOver16Hours = hours >= 16;
    const hasCrossedMidnight = new Date(shiftState.startTimestamp).toDateString() !== new Date(currentTime).toDateString();

    let reason = '';
    if (isOver16Hours && hasCrossedMidnight) {
      reason = `Běží už ${hours.toFixed(1)} h a přetekla přes půlnoc!`;
    } else if (isOver16Hours) {
      reason = `Běží už ${hours.toFixed(1)} hodin bez přerušení!`;
    } else if (isOver14Hours) {
      reason = `Běží podezřele dlouho (${hours.toFixed(1)} h)`;
    }

    return {
      totalElapsedMs: elapsed,
      pausedMs: totalPause,
      netWorkedMs: netWork,
      currentPauseDurationMs: activePause,
      isWarningLongShift: isOver14Hours,
      isSmartCheckoutRequired: isOver16Hours,
      isAnomaly: isOver14Hours,
      anomalyReason: reason,
      elapsedHours: hours
    };
  })();

  // 10-hour Local Notification reminder check. This synchronizes with the
  // passage of wall-clock time (elapsedHours ticking up) and fires an
  // external Notification exactly once – there is no discrete user event to
  // hook this off, so an effect (not an event handler) is the correct tool.
  useEffect(() => {
    if (
      (shiftState.status === 'running' || shiftState.status === 'paused') &&
      elapsedHours >= 10 &&
      !shiftState.notifiedTenHours
    ) {
      // Mark as notified so we don't repeat endlessly
      // oxlint-disable-next-line react/set-state-in-effect
      setShiftState(prev => ({ ...prev, notifiedTenHours: true }));

      // Trigger notification if permitted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(reg => {
              // Use NotificationOptions cast – 'renotify' is valid but missing in some TS lib typings
              const opts: NotificationOptions & { renotify?: boolean } = {
                body: `Mošnýho zápisník: Směna běží už ${Math.floor(elapsedHours)} hodin. Nezapomeň píchnout odchod!`,
                icon: '/icon-192.svg',
                badge: '/icon-192.svg',
                tag: 'shift-10h-reminder',
                renotify: true
              };
              reg.showNotification('⚠️ Nezapomněl sis ukončit směnu?', opts);
            });
          } else {
            new Notification('⚠️ Nezapomněl sis ukončit směnu?', {
              body: `Mošnýho zápisník: Směna běží už ${Math.floor(elapsedHours)} hodin.`,
              icon: '/icon-192.svg'
            });
          }
        } catch (e) {
          console.warn('Could not display 10h reminder notification:', e);
        }
      }
    }
  }, [shiftState.status, elapsedHours, shiftState.notifiedTenHours]);

  // Action: Start Shift
  const startShift = useCallback((options?: {
    clientName?: string;
    projectName?: string;
    workType?: WorkType;
    weldingMethod?: WeldingMethod;
  }) => {
    const now = Date.now();
    const timeStr = formatTimestampToTime(now);

    const startEvent: ShiftTimelineEvent = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeStr,
      type: 'shift_start',
      title: 'Start směny',
      description: options?.projectName ? `Zahájení na projektu: ${options.projectName}` : 'Zahájení směny na pracovišti'
    };

    setShiftState({
      status: 'running',
      startTimestamp: now,
      currentPauseStart: null,
      totalPausedMs: 0,
      events: [startEvent],
      clientName: options?.clientName || 'Metrostav DIZ s.r.o.',
      projectName: options?.projectName || 'Montáž ocelových konstrukcí',
      workType: options?.workType || 'site_assembly',
      weldingMethod: options?.weldingMethod || 'TIG',
      notes: '',
      notifiedTenHours: false
    });

    setCurrentTime(now);
    triggerHaptic('success');
  }, []);

  // Action: Pause Shift
  const pauseShift = useCallback(() => {
    if (shiftState.status !== 'running') return;
    const now = Date.now();
    const timeStr = formatTimestampToTime(now);

    const pauseEvent: ShiftTimelineEvent = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeStr,
      type: 'pause_start',
      title: 'Začátek pauzy',
      description: 'Oběd / odpočinek / čekání na materiál'
    };

    setShiftState(prev => ({
      ...prev,
      status: 'paused',
      currentPauseStart: now,
      events: [...prev.events, pauseEvent]
    }));

    setCurrentTime(now);
    triggerHaptic('warning');
  }, [shiftState.status]);

  // Action: Resume Shift
  const resumeShift = useCallback(() => {
    if (shiftState.status !== 'paused' || !shiftState.currentPauseStart) return;
    const now = Date.now();
    const timeStr = formatTimestampToTime(now);
    const pauseDurationMs = Math.max(0, now - shiftState.currentPauseStart);
    const pauseMinutes = Math.round(pauseDurationMs / 60000);

    const resumeEvent: ShiftTimelineEvent = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeStr,
      type: 'pause_end',
      title: 'Konec pauzy',
      description: `Pauza trvala ${pauseMinutes} minut`
    };

    setShiftState(prev => ({
      ...prev,
      status: 'running',
      currentPauseStart: null,
      totalPausedMs: prev.totalPausedMs + pauseDurationMs,
      events: [...prev.events, resumeEvent]
    }));

    setCurrentTime(now);
    triggerHaptic('success');
  }, [shiftState.status, shiftState.currentPauseStart]);

  // Action: Add Note to Timeline
  const addTimelineNote = useCallback((noteText: string) => {
    if (!noteText.trim()) return;
    const now = Date.now();
    const timeStr = formatTimestampToTime(now);

    const noteEvent: ShiftTimelineEvent = {
      id: `evt-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      timeStr,
      type: 'note',
      title: 'Poznámka z terénu',
      description: noteText.trim()
    };

    setShiftState(prev => {
      const updatedNotes = prev.notes 
        ? `${prev.notes}\n[${timeStr}] ${noteText.trim()}`
        : `[${timeStr}] ${noteText.trim()}`;
      return {
        ...prev,
        notes: updatedNotes,
        events: [...prev.events, noteEvent]
      };
    });

    triggerHaptic('light');
  }, []);

  // Update metadata (client, project, workType, etc.) while running
  const updateMetadata = useCallback((data: Partial<ActiveShiftState>) => {
    setShiftState(prev => ({ ...prev, ...data }));
  }, []);

  // Prepare data for ending shift / modal
  const getShiftCheckoutData = useCallback((): ShiftCheckoutData | null => {
    if (!shiftState.startTimestamp) return null;

    const startTs = shiftState.startTimestamp;
    const now = Date.now();

    // If currently paused, accumulate the current pause into total paused
    let totalPause = shiftState.totalPausedMs;
    if (shiftState.status === 'paused' && shiftState.currentPauseStart) {
      totalPause += (now - shiftState.currentPauseStart);
    }

    const breakMinutes = Math.round(totalPause / 60000);
    const startDate = formatTimestampToDate(startTs);
    const startTime = formatTimestampToTime(startTs);
    const endTime = formatTimestampToTime(now);

    // Build timeline summary text for notes
    const timelineSummary = shiftState.events
      .map(e => `${e.timeStr} - ${e.title}${e.description ? ` (${e.description})` : ''}`)
      .join(' | ');

    const combinedNotes = shiftState.notes 
      ? `${shiftState.notes}\n\nČasová osa:\n${timelineSummary}`
      : `Časová osa:\n${timelineSummary}`;

    return {
      date: startDate,
      startTime,
      endTime,
      breakMinutes,
      startTimestamp: startTs,
      isAnomaly,
      anomalyReason,
      elapsedHours,
      isWarningLongShift,
      isSmartCheckoutRequired,
      clientName: shiftState.clientName,
      projectName: shiftState.projectName,
      workType: shiftState.workType,
      weldingMethod: shiftState.weldingMethod,
      events: shiftState.events,
      notes: combinedNotes
    };
  }, [shiftState, isAnomaly, anomalyReason, elapsedHours, isWarningLongShift, isSmartCheckoutRequired]);

  // Reset shift to idle (after saving or explicit discard)
  const resetShift = useCallback(() => {
    setShiftState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
    triggerHaptic('medium');
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      triggerHaptic(permission === 'granted' ? 'success' : 'light');
      return permission;
    }
    return 'denied';
  }, []);

  return {
    shiftState,
    status: shiftState.status,
    totalElapsedMs,
    pausedMs,
    netWorkedMs,
    currentPauseDurationMs,
    isWarningLongShift,
    isSmartCheckoutRequired,
    isAnomaly,
    anomalyReason,
    elapsedHours,
    startShift,
    pauseShift,
    resumeShift,
    addTimelineNote,
    updateMetadata,
    getShiftCheckoutData,
    resetShift,
    requestNotificationPermission
  };
}
