import { loadStats, getStreak, getLevelProgress } from './userStats';
import { getRandomMessage } from './notificationMessages';

const SETTINGS_KEY = 'tm_reminder_settings';

const DEFAULT_SETTINGS = {
  enabled: false,
  style: 'normal',
  frequency: 'normal',
  quietHoursEnabled: true,
  quietStart: 22,
  quietEnd: 7,
  preferredTime: 9,
  programReminders: true,
  streakReminders: true,
};

export function loadReminderSettings() {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveReminderSettings(settings) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch {}
}

function getLastTrainingDate(stats) {
  if (!stats.sessions || stats.sessions.length === 0) return null;
  const last = stats.sessions[stats.sessions.length - 1];
  return new Date(last.completedAt);
}

function getDaysInactive(stats) {
  const lastDate = getLastTrainingDate(stats);
  if (!lastDate) return 999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(lastDate);
  last.setHours(0, 0, 0, 0);
  return Math.floor((now - last) / (1000 * 60 * 60 * 24));
}

function trainedToday(stats) {
  if (!stats.sessions || stats.sessions.length === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  return stats.sessions.some(s => s.completedAt && s.completedAt.slice(0, 10) === today);
}

function isInQuietHours(settings) {
  if (!settings.quietHoursEnabled) return false;
  const hour = new Date().getHours();
  const start = settings.quietStart;
  const end = settings.quietEnd;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function wasNotificationSentRecently() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const lastSent = localStorage.getItem('tm_last_reminder_sent');
    if (!lastSent) return false;
    const diff = Date.now() - parseInt(lastSent, 10);
    return diff < 8 * 60 * 60 * 1000;
  } catch { return false; }
}

function markNotificationSent() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tm_last_reminder_sent', Date.now().toString());
    }
  } catch {}
}

export function evaluateReminder() {
  const settings = loadReminderSettings();
  if (!settings.enabled) return null;
  if (isInQuietHours(settings)) return null;
  if (wasNotificationSentRecently()) return null;

  const stats = loadStats();
  if (trainedToday(stats)) return null;

  const daysOff = getDaysInactive(stats);
  const streak = getStreak(stats);
  const { current: levelXp, needed: levelNeeded } = getLevelProgress(stats.xp);
  const levelPercent = Math.round((levelXp / levelNeeded) * 100);

  let category = null;
  let priority = 0;

  if (levelPercent >= 75) {
    category = 'progress';
    priority = 3;
  }

  if (daysOff >= 7) { category = 'inactivity7'; priority = 5; }
  else if (daysOff >= 3) { category = 'inactivity3'; priority = 4; }
  else if (daysOff >= 2) { category = 'inactivity2'; priority = 3; }
  else if (daysOff === 1 && streak > 0 && settings.streakReminders) { category = 'streak'; priority = 2; }
  else if (daysOff === 1) { category = 'inactivity1'; priority = 1; }

  if (settings.frequency === 'low' && priority < 2) return null;

  if (!category) return null;

  const message = getRandomMessage(category);
  if (!message) return null;

  return { message, category, daysOff, streak, levelPercent, priority };
}

export function sendBrowserNotification(message) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    new Notification('Training Mode', {
      body: message,
      icon: '/static/brand/tm-logo-gold.png',
      badge: '/static/brand/tm-logo-gold.png',
      tag: 'tm-reminder',
      renotify: false,
    });
    markNotificationSent();
    return true;
  } catch { return false; }
}

export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('unavailable');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unavailable';
  return Notification.permission;
}

export function getDashboardReminder() {
  const settings = loadReminderSettings();
  const stats = loadStats();

  if (trainedToday(stats)) return null;

  const daysOff = getDaysInactive(stats);
  const streak = getStreak(stats);
  const { current: levelXp, needed: levelNeeded } = getLevelProgress(stats.xp);
  const levelPercent = Math.round((levelXp / levelNeeded) * 100);

  let category = null;
  let actionLabel = 'Start Training';
  let actionType = 'general';

  if (levelPercent >= 75) {
    category = 'progress';
    actionLabel = 'Earn XP Now';
    actionType = 'progress';
  } else if (daysOff >= 7) {
    category = 'inactivity7';
    actionLabel = 'Quick Mission';
    actionType = 'quickMission';
  } else if (daysOff >= 3) {
    category = 'inactivity3';
    actionLabel = 'Start a Round';
    actionType = 'fightFocus';
  } else if (daysOff >= 2) {
    category = 'inactivity2';
    actionLabel = 'Get Back In';
    actionType = 'general';
  } else if (daysOff === 1 && streak > 0 && settings.streakReminders) {
    category = 'streak';
    actionLabel = 'Keep Streak';
    actionType = 'general';
  } else if (daysOff === 1) {
    category = 'inactivity1';
    actionLabel = 'Start Training';
    actionType = 'general';
  }

  if (!category) return null;

  const message = getRandomMessage(category);
  if (!message) return null;

  return { message, category, daysOff, streak, levelPercent, actionLabel, actionType };
}
