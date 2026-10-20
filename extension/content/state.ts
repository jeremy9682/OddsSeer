/**
 * Global state management for content scripts
 * Centralizes all state variables and provides getters/setters
 */

import type { UserSettings, MarketEvent, TimelineResponse } from '../utils/types';
import { sendToBackground } from '../utils/messaging';

// ============================================
// State Variables
// ============================================

let settings: UserSettings | null = null;
let currentMarket: MarketEvent | null = null;

// DOM element references
let floatingBall: HTMLElement | null = null;
let enhancementPanel: HTMLElement | null = null;
let selectionPopup: HTMLElement | null = null;
let pageScanPanel: HTMLElement | null = null;
let eventsListPanel: HTMLElement | null = null;

// Timeline cache (multi-key by market + period + filter)
type TimelineCacheEntry = {
  data: TimelineResponse;
  timestamp: number;
};

const timelineCache = new Map<string, TimelineCacheEntry>();
const TIMELINE_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const TIMELINE_CACHE_MAX_SIZE = 40;

// ============================================
// Settings
// ============================================

export function getSettings(): UserSettings | null {
  return settings;
}

export function setSettings(s: UserSettings): void {
  settings = s;
}

export async function loadSettings(): Promise<UserSettings> {
  const response = await sendToBackground('GET_SETTINGS');
  const defaultSettings: UserSettings = {
    language: 'en',
    theme: 'system',
    enableFloatingBall: true,
    enablePageEnhancement: true,
    enableTextSelection: true,
    enableNotifications: true,
    floatingBallPosition: { x: window.innerWidth - 80, y: window.innerHeight - 80 },
    preferredModel: 'claude-sonnet',
    priceAlertThreshold: 5,
    isPro: false,
    dailyAnalysisCount: 0,
    dailyAnalysisLimit: 10
  };
  const loadedSettings: UserSettings = response.success && response.data
    ? { ...defaultSettings, ...response.data }
    : defaultSettings;
  settings = loadedSettings;
  return loadedSettings;
}

export function isZhLanguage(): boolean {
  return settings?.language === 'zh';
}

// ============================================
// Market
// ============================================

export function getCurrentMarket(): MarketEvent | null {
  return currentMarket;
}

export function setCurrentMarket(market: MarketEvent | null): void {
  currentMarket = market;
}

// ============================================
// DOM References
// ============================================

export function getFloatingBall(): HTMLElement | null {
  return floatingBall;
}

export function setFloatingBall(el: HTMLElement | null): void {
  floatingBall = el;
}

export function getEnhancementPanel(): HTMLElement | null {
  return enhancementPanel;
}

export function setEnhancementPanel(el: HTMLElement | null): void {
  enhancementPanel = el;
}

export function getSelectionPopup(): HTMLElement | null {
  return selectionPopup;
}

export function setSelectionPopup(el: HTMLElement | null): void {
  selectionPopup = el;
}

export function getPageScanPanel(): HTMLElement | null {
  return pageScanPanel;
}

export function setPageScanPanel(el: HTMLElement | null): void {
  pageScanPanel = el;
}

export function getEventsListPanel(): HTMLElement | null {
  return eventsListPanel;
}

export function setEventsListPanel(el: HTMLElement | null): void {
  eventsListPanel = el;
}

// ============================================
// Timeline Cache
// ============================================

export function buildTimelineCacheKey(marketId: string, period: string = '7d', impactFilter: string = 'all'): string {
  return `${marketId}:${period}:${impactFilter}`;
}

export function getCachedTimelineData(cacheKey: string): TimelineCacheEntry | null {
  const entry = timelineCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > TIMELINE_CACHE_TTL) {
    timelineCache.delete(cacheKey);
    return null;
  }

  // LRU: move key to tail
  timelineCache.delete(cacheKey);
  timelineCache.set(cacheKey, entry);
  return entry;
}

export function setCachedTimelineData(cacheKey: string, data: TimelineResponse): void {
  if (timelineCache.has(cacheKey)) {
    timelineCache.delete(cacheKey);
  }
  timelineCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  if (timelineCache.size > TIMELINE_CACHE_MAX_SIZE) {
    const oldestKey = timelineCache.keys().next().value;
    if (oldestKey) {
      timelineCache.delete(oldestKey);
    }
  }
}

export function getTimelineCacheTTL(): number {
  return TIMELINE_CACHE_TTL;
}

export function isTimelineCacheValid(cacheKey: string): boolean {
  return !!getCachedTimelineData(cacheKey);
}

// ============================================
// Initialization
// ============================================

export async function initState(): Promise<void> {
  await loadSettings();
}
