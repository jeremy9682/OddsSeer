import { showToast } from '../utils/toast';
/**
 * Enhancement Panel Module
 * Provides AI analysis panel for prediction market event pages
 */

import type { MarketEvent } from '../../utils/types';
import { sendToBackground } from '../../utils/messaging';
import { createShadowHost } from '../utils/dom';
import {
  getSettings,
  getEnhancementPanel,
  setEnhancementPanel,
  isZhLanguage
} from '../state';
import { isSupportedEventPage, extractEventFromPage } from '../page-detector';
import { getEnhancementPanelStyles } from './styles';
import { getEnhancementPanelHTML } from './html-templates';
import {
  loadMarketSummary,
  renderArbitrageSection,
  renderRelatedSection,
  loadTimelineData,
  loadCommunitySentiment
} from './sections';
import { injectChartNewsOverlay, cleanupChartOverlay } from '../chart-overlay';

/**
 * Create the enhancement panel
 */
export async function createEnhancementPanel(): Promise<void> {
  const { supported, platform, eventId } = isSupportedEventPage();
  if (!supported || !getSettings()?.enablePageEnhancement) return;

  // Don't create if already exists
  if (getEnhancementPanel()) return;

  console.log(`[OddsSeer] Creating enhancement panel for ${platform}:${eventId}`);

  const pageUrl = window.location.href;
  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 1500));

  if (!getSettings()?.enablePageEnhancement || window.location.href !== pageUrl) return;

  // Extract market data
  const market = extractEventFromPage(eventId, platform);
  if (!market) {
    console.log('[OddsSeer] Could not extract market data');
    return;
  }

  const isZh = isZhLanguage();

  // Create panel
  const { host, shadow } = createShadowHost('oddsseer-enhancement-panel');

  const style = document.createElement('style');
  style.textContent = getEnhancementPanelStyles();
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'enhancement-panel';
  panel.innerHTML = getEnhancementPanelHTML(market, isZh);

  shadow.appendChild(panel);
  document.body.appendChild(host);
  setEnhancementPanel(host);

  // Store shadow and panel references for toggleEnhancementPanel
  (host as any).__shadow = shadow;
  (host as any).__panel = panel;

  // Bind events
  bindPanelEvents(shadow, panel, market);

  // Load data
  loadEnhancementData(shadow, market);
}

/**
 * Bind panel events
 */
function bindPanelEvents(
  shadow: ShadowRoot,
  panel: HTMLElement,
  market: MarketEvent
): void {
  // Toggle panel
  const toggleTab = shadow.getElementById('toggle-panel');
  toggleTab?.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('collapsed');
    console.log('[Enhancement Panel] Panel toggled:', panel.classList.contains('collapsed') ? 'collapsed' : 'expanded');
  });

  // Close button
  const closeBtn = shadow.getElementById('close-panel');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.add('collapsed');
    console.log('[Enhancement Panel] Panel collapsed');
  });

  // Section toggle
  shadow.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const section = (e.currentTarget as HTMLElement).parentElement;
      section?.classList.toggle('collapsed');
    });
  });

  // Tab switching
  let timelineLoaded = false;
  shadow.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      if (!tabName) return;

      shadow.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      shadow.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const content = shadow.getElementById(`tab-${tabName}`);
      content?.classList.add('active');

      // Load timeline data on first switch
      if (tabName === 'timeline' && !timelineLoaded) {
        timelineLoaded = true;
        loadTimelineData(shadow, market, '7d', 'all');
      }
    });
  });

  // Timeline period buttons
  shadow.querySelectorAll('.timeline-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = (btn as HTMLElement).dataset.period;
      if (!period) return;
      shadow.querySelectorAll('.timeline-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const impactBtn = shadow.querySelector('.timeline-impact-btn.active');
      const filter = impactBtn ? 'high' : 'all';
      loadTimelineData(shadow, market, period, filter);
    });
  });

  // Timeline impact filter
  shadow.querySelectorAll('.timeline-impact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const filter = btn.classList.contains('active') ? 'high' : 'all';
      const activeP = shadow.querySelector('.timeline-period-btn.active') as HTMLElement;
      const period = activeP?.dataset.period || '7d';
      loadTimelineData(shadow, market, period, filter);
    });
  });

  // Open sidepanel link
  const openSidepanel = shadow.getElementById('open-sidepanel');
  openSidepanel?.addEventListener('click', async (e) => {
    e.preventDefault();
    const opening = sendToBackground('OPEN_SIDEPANEL', undefined, { maxRetries: 0 });
    await sendToBackground('SET_SELECTED_MARKET', { market });
    if (!(await opening).success) showToast(isZhLanguage() ? '请点击浏览器中的 OddsSeer 图标' : 'Click the OddsSeer toolbar icon', 'info');
  });
}

/**
 * Load enhancement data
 */
async function loadEnhancementData(
  shadow: ShadowRoot,
  market: MarketEvent
): Promise<void> {
  const dataLoadStart = performance.now();
  console.log('[Enhancement] Starting parallel data loading...');

  // 统一获取跨市场和关联事件数据 (一次API调用)
  const loadCrossMarketData = async () => {
    try {
      const response = await sendToBackground('GET_ARBITRAGE_DATA', {
        market,
        searchQuery: market.title
      });

      if (response.success) {
        // 渲染跨市场比价 (高相似度)
        renderArbitrageSection(shadow, market, response.data?.markets || []);
        // 渲染关联事件 (低相似度)
        renderRelatedSection(shadow, market, response.data?.related || []);
      } else {
        // 失败时显示空状态
        renderArbitrageSection(shadow, market, []);
        renderRelatedSection(shadow, market, []);
      }
    } catch (error) {
      console.error('[Enhancement] Cross-market data error:', error);
      renderArbitrageSection(shadow, market, []);
      renderRelatedSection(shadow, market, []);
    }
  };

  // Load all data in parallel
  await Promise.all([
    loadMarketSummary(shadow, market),
    loadCommunitySentiment(shadow, market),
    loadCrossMarketData()
  ]);

  const dataLoadTime = performance.now() - dataLoadStart;
  console.log(`[Enhancement] Parallel data loading completed in ${dataLoadTime.toFixed(0)}ms`);

  // Inject chart news overlay
  scheduleChartOverlay(shadow, market);
}

/**
 * Schedule chart overlay injection
 */
function scheduleChartOverlay(shadow: ShadowRoot, market: MarketEvent): void {
  console.log('[ChartNews] Scheduling overlay injection...');
  const chartInjectionStart = performance.now();

  const waitForChart = (maxAttempts: number = 10, interval: number = 300) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const svgs = document.querySelectorAll('svg');
      const chartSvg = Array.from(svgs).find(svg => {
        const rect = svg.getBoundingClientRect();
        return rect.width > 400 && rect.height > 100 && rect.height < 500 && !svg.getAttribute('viewBox');
      });

      if (chartSvg) {
        const waitTime = performance.now() - chartInjectionStart;
        console.log(`[ChartNews] Chart detected after ${waitTime.toFixed(0)}ms (${attempts} attempts)`);
        try {
          injectChartNewsOverlay(shadow, market);
        } catch (e) {
          console.error('[ChartNews] Could not inject overlay:', e);
        }
      } else if (attempts < maxAttempts) {
        setTimeout(check, interval);
      } else {
        console.warn(`[ChartNews] Chart not found after ${maxAttempts} attempts, injecting anyway...`);
        try {
          injectChartNewsOverlay(shadow, market);
        } catch (e) {
          console.error('[ChartNews] Could not inject overlay:', e);
        }
      }
    };
    setTimeout(check, 500);
  };

  waitForChart();
}

/**
 * Toggle enhancement panel visibility
 */
export function toggleEnhancementPanel(): void {
  const host = getEnhancementPanel();
  if (!host) return;

  const panel = (host as any).__panel as HTMLElement;
  if (panel) {
    panel.classList.toggle('collapsed');
  }
}

/**
 * Remove enhancement panel
 */
export function removeEnhancementPanel(): void {
  const host = getEnhancementPanel();
  if (host) {
    host.remove();
    setEnhancementPanel(null);
  }
  cleanupChartOverlay();
}

/**
 * Initialize enhancement panel with URL monitoring
 */
export function initEnhancementPanel(): void {
  let lastUrl = window.location.href;

  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      removeEnhancementPanel();

      setTimeout(() => {
        const { supported } = isSupportedEventPage();
        const settings = getSettings();
        if (supported && settings?.enablePageEnhancement) {
          createEnhancementPanel();
        }
      }, 1000);
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Initial check
  setTimeout(() => {
    const { supported } = isSupportedEventPage();
    const settings = getSettings();
    if (supported && settings?.enablePageEnhancement) {
      createEnhancementPanel();
    }
  }, 2000);
}
