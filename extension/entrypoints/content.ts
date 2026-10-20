import { showToast } from '../content/utils/toast';
/**
 * Content Script - Page Enhancement
 * Entry point that initializes all content script modules
 *
 * Features:
 * 1. Floating ball - Quick access to sidebar
 * 2. Page scanning - Detect prediction market events
 * 3. Text selection - Search related markets for selected text
 * 4. Page injection - Add AI analysis on prediction market pages
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendToBackground } from '../utils/messaging';
import type { MarketEvent, PageContext } from '../utils/types';
import {
  initState,
  getSettings,
  setSettings,
  getFloatingBall,
  setFloatingBall,
  isZhLanguage
} from '../content/state';
import {
  createFloatingBall,
  removeFloatingBall
} from '../content/floating-ball';
import {
  getPageType,
  isSupportedEventPage,
  extractEventFromPage
} from '../content/page-detector';
import {
  setupTextSelection, searchMarkets
} from '../content/text-selection';
import {
  cleanupPageScanner
} from '../content/page-scanner';
import {
  initEnhancementPanel,
  toggleEnhancementPanel, createEnhancementPanel, removeEnhancementPanel
} from '../content/enhancement-panel';
import {
  showPageScanResults
} from '../content/events-panel';
import { isHiddenElement } from '../content/utils/dom';

// News site patterns
const NEWS_PATTERNS = [
  /twitter\.com/,
  /x\.com/,
  /bloomberg\.com/,
  /coindesk\.com/,
  /cnn\.com/,
  /reuters\.com/
];

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',

  async main() {
    console.log('%c[OddsSeer] Content Script Loaded!', 'background: #4F46E5; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log('[OddsSeer] URL:', window.location.href);
    console.log('[OddsSeer] Host:', window.location.hostname);

    // Check if extension context is valid
    if (!chrome?.runtime?.id) {
      console.warn('[OddsSeer] Extension context not available, skipping initialization');
      return;
    }

    try {
      // Initialize state and load settings
      await initState();
      const settings = getSettings();
      console.log('[OddsSeer] Settings loaded:', {
        enableFloatingBall: settings?.enableFloatingBall,
        enableTextSelection: settings?.enableTextSelection
      });

      // Determine page type
      const pageType = getPageType();

      // Send page context to background
      await sendPageContext(pageType);

      // Initialize features based on settings
      if (settings?.enableFloatingBall) {
        // Floating ball now includes scan button in a unified toolbar
        createFloatingBall();
      }

      if (settings?.enablePageEnhancement) {
        if (pageType === 'prediction_market') {
          enhancePredictionMarketPage();
          // Auto-detect current event on event detail pages
          await detectCurrentEventPage();
        } else if (pageType === 'news' || pageType === 'social') {
          scanPageForKeywords();
        }
      }

      setupTextSelection();

      // Set up listeners
      setupSettingsListener();
      setupMessageListener();

      // Initialize enhancement panel
      initEnhancementPanel();

      // 检测系统主题并更新图标
      const updateThemeIcon = () => {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        sendToBackground('UPDATE_ICON_THEME', { isDark });
      };
      updateThemeIcon();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeIcon);

      console.log('[OddsSeer] Initialization complete');
    } catch (error) {
      console.error('[OddsSeer] Initialization error:', error);
    }
  }
});

/**
 * Send page context to background
 */
async function sendPageContext(pageType: PageContext['type']): Promise<void> {
  const context: PageContext = {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title,
    type: pageType,
    keywords: extractKeywords()
  };

  await sendToBackground('SET_PAGE_CONTEXT', { context });
}

/**
 * Extract page keywords
 */
function extractKeywords(): string[] {
  const text = document.body.innerText;
  const keywords: string[] = [];

  // Prediction market related keywords
  const patterns = [
    /trump/gi,
    /biden/gi,
    /election/gi,
    /bitcoin/gi,
    /ethereum/gi,
    /fed\s+rate/gi,
    /interest\s+rate/gi,
    /super\s+bowl/gi,
    /world\s+cup/gi,
    /oscars?/gi
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(matches[0].toLowerCase());
    }
  });

  return [...new Set(keywords)];
}

/**
 * Detect current Polymarket event page
 */
async function detectCurrentEventPage(): Promise<void> {
  const info = isSupportedEventPage();
  if (!info.supported || !info.eventId || !info.platform) return;
  const market = extractEventFromPage(info.eventId, info.platform);
  if (market) await sendToBackground('SET_SELECTED_MARKET', { market });
}

/**
 * Enhance prediction market page
 */
function enhancePredictionMarketPage(): void {
  // Observe for market cards
  const observer = new MutationObserver((mutations) => {
    const marketCards = document.querySelectorAll('[data-testid="market-card"], .c-dhzjXW');

    marketCards.forEach((card) => {
      if (card.querySelector('.oddsseer-analyze-btn')) return;
      addAnalyzeButton(card as HTMLElement);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan
  setTimeout(() => {
    const marketCards = document.querySelectorAll('[data-testid="market-card"], .c-dhzjXW');
    marketCards.forEach((card) => {
      addAnalyzeButton(card as HTMLElement);
    });
  }, 1000);
}

/**
 * Add an open-in-OddsSeer button to the market card
 */
function addAnalyzeButton(card: HTMLElement): void {
  const settings = getSettings();
  const isZh = isZhLanguage();

  const btn = document.createElement('button');
  btn.className = 'oddsseer-analyze-btn';
  btn.textContent = 'OddsSeer ↗';
  btn.title = isZh ? '在 OddsSeer 中打开' : 'Open in OddsSeer';

  btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
    background: linear-gradient(135deg, #4F46E5, #7C3AED);
    color: white;
    border: none;
    cursor: pointer;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  // Show on hover
  card.style.position = 'relative';
  card.addEventListener('mouseenter', () => {
    btn.style.opacity = '1';
  });
  card.addEventListener('mouseleave', () => {
    btn.style.opacity = '0';
  });

  // Click handler
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const market = extractMarketFromCard(card);
    if (market) {
      const opening = sendToBackground('OPEN_SIDEPANEL', undefined, { maxRetries: 0 });
      await sendToBackground('ANALYZE_MARKET', { market });
      if (!(await opening).success) showToast(isZhLanguage() ? '请点击浏览器中的 OddsSeer 图标' : 'Click the OddsSeer toolbar icon', 'info');
    }
  });

  card.appendChild(btn);
}

/**
 * Extract market info from card
 */
function extractMarketFromCard(card: HTMLElement): MarketEvent | null {
  try {
    const conditionId = card.getAttribute('data-condition-id');
    const title = card.querySelector('h3, [class*="title"]')?.textContent?.trim();

    // Try to get price
    const priceElements = card.querySelectorAll('[class*="price"], [class*="outcome"]');
    let yesPrice: number | null = null;
    let noPrice: number | null = null;

    priceElements.forEach(el => {
      const text = el.textContent || '';
      const match = text.match(/(\d+(?:\.\d+)?)\s*[%¢]/);
      if (match) {
        const price = parseFloat(match[1]) / 100;
        if (text.toLowerCase().includes('yes')) {
          yesPrice = price;
        } else if (text.toLowerCase().includes('no')) {
          noPrice = price;
        }
      }
    });

    if (!title) return null;

    return {
      id: conditionId || `temp-${Date.now()}`,
      conditionId: conditionId || '',
      title,
      yesPrice,
      noPrice,
      source: 'polymarket',
      url: window.location.href
    };
  } catch (error) {
    console.error('[Content Script] Failed to extract market:', error);
    return null;
  }
}

/**
 * Scan page for keywords
 */
function scanPageForKeywords(): void {
  console.log('[Content Script] Scanning page for keywords...');
}

/**
 * Set up settings listener
 */
function setupSettingsListener(): void {
  if (!chrome?.storage?.onChanged) {
    console.warn('[Content Script] chrome.storage.onChanged not available');
    return;
  }

  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings) {
        setSettings(changes.settings.newValue);
        const settings = changes.settings.newValue;

        if (!settings?.enablePageEnhancement) removeEnhancementPanel();
        else void createEnhancementPanel();

        // Update features based on new settings
        const floatingBall = getFloatingBall();
        if (settings?.enableFloatingBall && !floatingBall) {
          createFloatingBall();
        } else if (!settings?.enableFloatingBall && floatingBall) {
          removeFloatingBall();
        }
      }
    });
  } catch (error) {
    console.warn('[Content Script] Failed to setup settings listener:', error);
  }
}

/**
 * Set up message listener from background
 */
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SEARCH_SELECTION') {
      void searchMarkets(String(message.payload?.text || ''));
      sendResponse({ success: true });
    } else if (message.type === 'GET_PAGE_STATE') {
      const info = isSupportedEventPage();
      sendResponse({ url: window.location.href, market: info.supported && info.eventId && info.platform ? extractEventFromPage(info.eventId, info.platform) : null });
    } else if (message.type === 'GET_PAGE_MARKETS') {
      // Return detected markets on page
      const markets: MarketEvent[] = [];
      document.querySelectorAll('[data-testid="market-card"]').forEach((card) => {
        const market = extractMarketFromCard(card as HTMLElement);
        if (market) markets.push(market);
      });
      sendResponse({ markets });
    } else if (message.type === 'GET_PAGE_CONTENT') {
      // Return page content for scanning
      const content = extractPageContent();
      sendResponse({ success: true, content });
    } else if (message.type === 'SCAN_PAGE_RESULT') {
      // Show scan results
      if (message.data?.markets) {
        showPageScanResults(message.data.markets, message.data.detectedEvents);
      }
    }
    return false;
  });
}

/**
 * Extract main page content - only visible area
 */
function extractPageContent(): {
  title: string;
  content: string;
  url: string;
  meta: Record<string, string>;
} {
  const title = document.title || '';

  // Extract meta info
  const meta: Record<string, string> = {};
  document.querySelectorAll('meta').forEach(metaEl => {
    const name = metaEl.getAttribute('name') || metaEl.getAttribute('property');
    const content = metaEl.getAttribute('content');
    if (name && content) {
      meta[name] = content;
    }
  });

  // Only extract visible content
  const visibleContent = extractVisibleContent();

  // Limit content length
  const maxLength = 1000;
  let mainContent = visibleContent;
  if (mainContent.length > maxLength) {
    mainContent = mainContent.substring(0, maxLength) + '...';
  }

  console.log('[OddsSeer] Extracted visible content:', mainContent.length, 'chars');

  return {
    title,
    content: mainContent,
    url: window.location.href,
    meta
  };
}

/**
 * Extract visible area text content
 */
function extractVisibleContent(): string {
  const viewportHeight = window.innerHeight;
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + viewportHeight;

  const visibleTexts: string[] = [];

  const textElements = document.querySelectorAll(
    'p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, a, blockquote, figcaption'
  );

  textElements.forEach(el => {
    if (isHiddenElement(el)) return;
    if (isNavigationElement(el)) return;

    const rect = el.getBoundingClientRect();
    const elementTop = rect.top + viewportTop;
    const elementBottom = rect.bottom + viewportTop;

    const isVisible = (elementTop < viewportBottom && elementBottom > viewportTop);

    if (isVisible) {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && !visibleTexts.includes(text)) {
        const isDuplicate = visibleTexts.some(existing =>
          existing.includes(text) || text.includes(existing)
        );
        if (!isDuplicate) {
          visibleTexts.push(text);
        }
      }
    }
  });

  return visibleTexts.join('\n').trim();
}

/**
 * Check if element is navigation/footer etc
 */
function isNavigationElement(el: Element): boolean {
  const className = el.className?.toLowerCase?.() || '';
  const id = el.id?.toLowerCase() || '';

  const parent = el.closest(
    'nav, footer, header, aside, [role="navigation"], [role="banner"], [role="contentinfo"], .nav, .footer, .header, .sidebar, .menu, .advertisement, .ad'
  );
  if (parent) return true;

  const skipPatterns = ['nav', 'menu', 'footer', 'header', 'sidebar', 'ad', 'advertisement', 'cookie', 'popup', 'modal', 'tooltip'];
  return skipPatterns.some(pattern =>
    className.includes(pattern) || id.includes(pattern)
  );
}
