/**
 * Events Panel Module
 * Displays detected events and related markets
 */

import type { MarketEvent } from '../../utils/types';
import { sendToBackground } from '../../utils/messaging';
import { escapeHtml, formatVolume, sanitizeExternalUrl } from '../utils/dom';
import { showToast } from '../utils/toast';
import { showExtensionGuide } from '../utils/guide';
import { isZhLanguage } from '../state';
import { getEventsPanelStyles, getPageScanResultsStyles } from './styles';
import { clearMarketIcons } from '../page-scanner/market-icons';
import { clearKeywordHighlights } from '../page-scanner/keyword-highlighter';

// Panel references
let eventsListPanel: HTMLElement | null = null;
let pageScanPanel: HTMLElement | null = null;

/**
 * Show events list panel
 * Displays events grouped by detected topics
 */
export function showEventsListPanel(
  detectedEvents: any[],
  markets: MarketEvent[]
): void {
  // Remove existing panel
  hideEventsListPanel();

  const isZh = isZhLanguage();

  // Filter events that have markets
  const eventsWithMarkets = detectedEvents.filter(e =>
    (e.markets && e.markets.length > 0) || markets.length > 0
  );

  if (eventsWithMarkets.length === 0) {
    showToast(isZh ? '未找到相关市场' : 'No related markets found', 'info');
    return;
  }

  // Create panel
  const host = document.createElement('div');
  host.id = 'oddsseer-events-panel';
  eventsListPanel = host;

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getEventsPanelStyles();

  const panel = document.createElement('div');
  panel.className = 'panel';

  // Header
  panel.innerHTML = `
    <div class="header">
      <div class="header-title">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <span>${isZh ? '检测到的事件' : 'Detected Events'}</span>
        <span style="opacity: 0.8; font-weight: 400;">(${eventsWithMarkets.length})</span>
      </div>
      <button class="close-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="events-list"></div>
    <div class="footer">
      ${isZh ? '点击事件查看相关预测市场' : 'Click events to view related prediction markets'}
    </div>
  `;

  // Events list
  const eventsList = panel.querySelector('.events-list')!;

  eventsWithMarkets.forEach((event, index) => {
    const eventCard = document.createElement('div');
    eventCard.className = 'event-card';

    // Get event's markets
    const eventMarkets = event.markets || [];
    const keywords = event.keywords || [];
    const query = event.query || '';

    eventCard.innerHTML = `
      <div class="event-header">
        <div class="event-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div class="event-content">
          <div class="event-query">${escapeHtml(query)}</div>
          <div class="event-keywords">
            ${keywords.slice(0, 5).map((kw: string) => `<span class="keyword-tag">${escapeHtml(kw)}</span>`).join('')}
            ${keywords.length > 5 ? `<span class="keyword-tag">+${keywords.length - 5}</span>` : ''}
          </div>
        </div>
        <svg class="event-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      <div class="markets-container">
        <div class="markets-list">
          ${eventMarkets.length > 0
            ? eventMarkets.map((m: any) => `
                <a class="market-item" href="${sanitizeExternalUrl(m.url) || '#'}" target="_blank" rel="noopener noreferrer">
                  <div class="market-info">
                    <div class="market-title">${escapeHtml(m.title)}</div>
                    <div class="market-source">
                      <span class="source-badge">${escapeHtml(String(m.source || 'Market'))}</span>
                      ${m.volume ? `<span>Vol: $${formatVolume(m.volume)}</span>` : ''}
                    </div>
                  </div>
                  <div class="market-odds">
                    <div class="odds-value">${m.yesPrice != null ? Math.round(m.yesPrice * 100) + '%' : '--'}</div>
                    <div class="odds-label">YES</div>
                  </div>
                </a>
              `).join('')
            : `<div class="no-markets">${isZh ? '暂无匹配市场' : 'No matching markets'}</div>`
          }
        </div>
      </div>
    `;

    // Click to expand/collapse
    const eventHeader = eventCard.querySelector('.event-header')!;
    eventHeader.addEventListener('click', () => {
      // Collapse other expanded cards
      panel.querySelectorAll('.event-card.expanded').forEach(card => {
        if (card !== eventCard) {
          card.classList.remove('expanded');
        }
      });
      // Toggle current card
      eventCard.classList.toggle('expanded');
    });

    // Default expand first
    if (index === 0) {
      eventCard.classList.add('expanded');
    }

    eventsList.appendChild(eventCard);
  });

  // Close button
  const closeBtn = panel.querySelector('.close-btn')!;
  closeBtn.addEventListener('click', () => {
    hideEventsListPanel();
  });

  shadow.appendChild(style);
  shadow.appendChild(panel);
  document.body.appendChild(host);

  // Show success toast
  showToast(
    isZh
      ? `✨ 发现 ${eventsWithMarkets.length} 个相关事件`
      : `✨ Found ${eventsWithMarkets.length} related events`,
    'success'
  );
}

/**
 * Hide events list panel
 */
export function hideEventsListPanel(): void {
  if (eventsListPanel) {
    eventsListPanel.remove();
    eventsListPanel = null;
  }
}

/**
 * Show page scan results
 * Inline mode - shows detected events or fallback modal
 */
export function showPageScanResults(
  markets: MarketEvent[],
  detectedEvents?: any[]
): void {
  hidePageScanResults();

  const isZh = isZhLanguage();

  // Use events list panel if we have detected events
  if (detectedEvents && detectedEvents.length > 0) {
    showEventsListPanel(detectedEvents, markets);
    return;
  }

  // Fallback to traditional modal
  const host = document.createElement('div');
  host.id = 'oddsseer-page-scan-results';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getPageScanResultsStyles();
  shadow.appendChild(style);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.addEventListener('click', () => hidePageScanResults());
  shadow.appendChild(overlay);

  // Create results panel
  const panel = document.createElement('div');
  panel.className = 'scan-results-panel';

  // Build detected events tags
  let detectedEventsHtml = '';
  if (detectedEvents && detectedEvents.length > 0) {
    const eventTags = detectedEvents.map(e =>
      `<span class="event-tag">${escapeHtml(e.query || e.query_en || '')}</span>`
    ).join('');
    detectedEventsHtml = `
      <div class="detected-events">
        <strong>${isZh ? '检测到的主题:' : 'Detected topics:'}</strong>
        <div class="event-tags">${eventTags}</div>
      </div>
    `;
  }

  // Build markets list
  const marketsHtml = markets.map((market, index) => `
    <div class="market-card" data-index="${index}">
      <div class="market-title">${escapeHtml(market.title)}</div>
      <div class="market-meta">
        <span class="source-badge source-${escapeHtml(String(market.source))}">${market.source === 'polymarket' ? 'Polymarket' : 'Kalshi'}</span>
        <span class="price-badge price-yes">Yes ${market.yesPrice != null ? Math.round(market.yesPrice * 100) + '%' : '--'}</span>
        <span class="price-badge price-no">No ${market.noPrice != null ? Math.round(market.noPrice * 100) + '%' : '--'}</span>
        ${market.volume ? `<span class="volume">$${formatVolume(market.volume)}</span>` : ''}
        <button class="analyze-btn">${isZh ? '☆ 加入关注' : '☆ Watch market'}</button>
      </div>
    </div>
  `).join('');

  panel.innerHTML = `
    <div class="header">
      <div class="header-top">
        <div class="header-title">
          <div class="header-icon">🔍</div>
          <span>${isZh ? '页面扫描结果' : 'Page Scan Results'}</span>
        </div>
        <button class="close-btn">✕</button>
      </div>
      <div class="header-subtitle">
        ${isZh ? `找到 ${markets.length} 个相关预测市场` : `Found ${markets.length} related prediction markets`}
      </div>
    </div>
    ${detectedEventsHtml}
    <div class="markets-list">
      ${marketsHtml}
    </div>
    <div class="footer">
      <button class="view-more-btn">${isZh ? '在侧边栏查看更多' : 'View More in Sidebar'}</button>
    </div>
  `;

  // Bind events
  panel.querySelector('.close-btn')?.addEventListener('click', () => hidePageScanResults());

  panel.querySelectorAll('.market-card').forEach((card, index) => {
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const market = markets[index];

      if (target.classList.contains('analyze-btn')) {
        e.stopPropagation();
        await sendToBackground('SET_SELECTED_MARKET', { market });
        hidePageScanResults();
        showExtensionGuide(isZh
          ? '👆 点击扩展图标添加市场关注'
          : '👆 Click extension icon to watch this market');
        return;
      }

      if (market.url) {
        const url = sanitizeExternalUrl(market.url);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  });

  panel.querySelector('.view-more-btn')?.addEventListener('click', async () => {
    hidePageScanResults();
    showExtensionGuide(isZh
      ? '👆 点击扩展图标查看更多市场'
      : '👆 Click extension icon for more markets');
  });

  shadow.appendChild(panel);
  document.body.appendChild(host);
  pageScanPanel = host;
}

/**
 * Hide page scan results
 */
export function hidePageScanResults(): void {
  // Hide modal panel
  if (pageScanPanel) {
    pageScanPanel.remove();
    pageScanPanel = null;
  }
  // Clear market icons
  clearMarketIcons();
  // Hide events list panel
  hideEventsListPanel();
  // Clear keyword highlights
  clearKeywordHighlights();
}
