/**
 * Text Selection Module
 * Provides text selection search functionality for prediction markets
 */

import { sendToBackground } from '../../utils/messaging';
import { createShadowHost, escapeHtml, sanitizeExternalUrl } from '../utils/dom';
import { getSettings, getSelectionPopup, setSelectionPopup, isZhLanguage } from '../state';
import { getSelectionPopupStyles, getSearchResultsStyles } from './styles';

let searchResultsPanel: HTMLElement | null = null;
let activeSearchRequestId = 0;

// 分批显示配置
const DISPLAY_BATCH_SIZE = 3;

// 存储当前搜索结果状态
let currentSearchState: {
  markets: any[];
  displayedCount: number;
  shadow: ShadowRoot | null;
  isZh: boolean;
} | null = null;

/**
 * Setup text selection handler
 */
export function setupTextSelection(): void {
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeydown);

  console.log('[TextSelection] Text selection handler initialized');
}

function handleMouseUp(e: MouseEvent): void {
  if (!getSettings()?.enableTextSelection) { hideSelectionPopup(); return; }
  // Skip if clicking on our own UI
  const target = e.target as HTMLElement;
  if (
    target.closest('#oddsseer-selection-popup') ||
    target.closest('#oddsseer-search-results')
  ) {
    return;
  }

  // Hide existing popup first
  hideSelectionPopup();

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (selectedText && selectedText.length >= 3 && selectedText.length <= 500) {
    // Show popup after a short delay
    setTimeout(() => showSelectionPopup(selectedText, e.clientX, e.clientY), 100);
  }
}

function handleKeydown(e: KeyboardEvent): void {
  // ESC to close popups
  if (e.key === 'Escape') {
    hideSelectionPopup();
    hideSearchResults();
  }
}

/**
 * Show selection popup near the mouse cursor
 */
function showSelectionPopup(text: string, x: number, y: number): void {
  const isZh = isZhLanguage();
  const { host, shadow } = createShadowHost('oddsseer-selection-popup');

  const style = document.createElement('style');
  style.textContent = getSelectionPopupStyles();
  shadow.appendChild(style);

  const popup = document.createElement('div');
  popup.className = 'selection-popup';

  // Position near cursor, with boundary checks
  const popupWidth = 120;
  const popupHeight = 100;

  let left = x + 10;
  let top = y - popupHeight / 2;

  // Keep within viewport
  if (left + popupWidth > window.innerWidth - 70) {
    // Don't overlap with right toolbar
    left = x - popupWidth - 10;
  }
  if (top < 10) top = 10;
  if (top + popupHeight > window.innerHeight - 10) {
    top = window.innerHeight - popupHeight - 10;
  }

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  popup.innerHTML = `
    <button class="popup-btn popup-btn-primary" id="search-markets">
      <span class="btn-icon">🔍</span>
      <span class="btn-text">${isZh ? '搜索市场' : 'Search'}</span>
    </button>
  `;

  shadow.appendChild(popup);
  document.body.appendChild(host);
  setSelectionPopup(host);

  // Bind search button
  const searchBtn = shadow.getElementById('search-markets');
  searchBtn?.addEventListener('click', () => {
    hideSelectionPopup();
    searchMarkets(text);
  });

  // Click outside to close
  const closeHandler = (e: MouseEvent) => {
    if (!host.contains(e.target as Node)) {
      hideSelectionPopup();
      document.removeEventListener('mousedown', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', closeHandler), 100);
}

/**
 * Hide selection popup
 */
export function hideSelectionPopup(): void {
  const popup = getSelectionPopup();
  if (popup) {
    popup.remove();
    setSelectionPopup(null);
  }
}

/**
 * Search markets for selected text
 */
export async function searchMarkets(query: string): Promise<void> {
  query = query.trim().slice(0, 500);
  if (!query) return;
  hideSearchResults();
  const requestId = ++activeSearchRequestId;
  const isZh = isZhLanguage();

  // Create search results panel
  const { host, shadow } = createShadowHost('oddsseer-search-results');

  const style = document.createElement('style');
  style.textContent = getSearchResultsStyles();
  shadow.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'results-overlay';
  shadow.appendChild(overlay);

  const panel = document.createElement('div');
  panel.className = 'search-results-panel';
  panel.innerHTML = `
    <div class="results-header">
      <div class="results-title">
        <span>🔍</span>
        <span>${isZh ? '搜索结果' : 'Search Results'}</span>
      </div>
      <button class="results-close" id="close-results">×</button>
    </div>
    <div class="results-query">
      <div class="query-label">${isZh ? '搜索内容' : 'Search Query'}</div>
      <div class="query-text">${escapeHtml(query)}</div>
    </div>
    <div class="results-content" id="results-content">
      <div class="loading">
        <div class="spinner"></div>
        <span>${isZh ? '正在搜索相关市场...' : 'Searching for related markets...'}</span>
      </div>
    </div>
  `;

  shadow.appendChild(panel);
  document.body.appendChild(host);
  searchResultsPanel = host;

  // Close handlers
  const closeBtn = shadow.getElementById('close-results');
  closeBtn?.addEventListener('click', hideSearchResults);
  overlay.addEventListener('click', hideSearchResults);

  // Load search results
  try {
    const response = await sendToBackground('SEARCH_MARKETS', { query });
    if (requestId !== activeSearchRequestId) {
      // A newer search has started; ignore stale response.
      return;
    }
    const content = shadow.getElementById('results-content');
    if (!content) return;

    if (!response.success) throw new Error('Search unavailable');
    if (response.data?.markets?.length > 0) {
      const markets = response.data.markets.slice(0, 10);
      const fromCache = !!response.data?.metadata?.fromCache;
      const queryLabel = shadow.querySelector('.query-label');
      if (fromCache && queryLabel) {
        queryLabel.innerHTML = `${isZh ? '搜索内容' : 'Search Query'} <span class="cache-badge" title="Cached result">⚡</span>`;
      }

      // 初始化搜索状态
      currentSearchState = {
        markets,
        displayedCount: DISPLAY_BATCH_SIZE,
        shadow,
        isZh
      };

      // 初始只显示前 3 个
      renderSearchResults(content, markets, isZh, shadow, DISPLAY_BATCH_SIZE);
    } else {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">${isZh ? '未找到相关市场' : 'No Markets Found'}</div>
          <div class="empty-desc">${isZh ? '尝试使用不同的搜索关键词' : 'Try different search keywords'}</div>
        </div>
      `;
    }
  } catch (error) {
    if (requestId !== activeSearchRequestId) {
      return;
    }
    console.error('[TextSelection] Search error:', error);
    const content = shadow.getElementById('results-content');
    if (content) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">${isZh ? '搜索失败' : 'Search Failed'}</div>
          <div class="empty-desc">${isZh ? '请稍后重试' : 'Please try again later'}</div>
        </div>
      `;
    }
  }
}

// 懒加载配置：只对前 N 个市场获取实时价格
const REALTIME_PRICE_LIMIT = 3;
// 多选项市场显示的选项数量
const MULTI_OPTION_DISPLAY_LIMIT = 3;

/**
 * 生成多选项市场的价格显示 HTML
 */
function renderMultiOptionPrice(outcomes: any[], isZh: boolean): string {
  if (!outcomes || outcomes.length === 0) {
    return `
      <div class="price-value price-unavailable">--</div>
      <div class="price-label">${isZh ? '多选项' : 'Multi'}</div>
    `;
  }

  // 按价格排序，取前3个
  const sortedOutcomes = [...outcomes].sort((a, b) => (b.yesPrice || 0) - (a.yesPrice || 0));
  const topOutcomes = sortedOutcomes.slice(0, MULTI_OPTION_DISPLAY_LIMIT);
  const remainingCount = outcomes.length - MULTI_OPTION_DISPLAY_LIMIT;

  let html = '<div class="multi-options">';
  topOutcomes.forEach((outcome, idx) => {
    const price = outcome.yesPrice == null ? "—" : Math.round(outcome.yesPrice * 100) + "%";
    const name = outcome.name || `Option ${idx + 1}`;
    // 截断过长的名称
    const displayName = name.length > 12 ? name.substring(0, 10) + '...' : name;
    const isLeader = idx === 0;

    html += `
      <div class="option-row ${isLeader ? 'option-leader' : ''}">
        <span class="option-name" title="${escapeHtml(name)}">${isLeader ? '🏆 ' : ''}${escapeHtml(displayName)}</span>
        <span class="option-price">${price}</span>
      </div>
    `;
  });

  if (remainingCount > 0) {
    html += `<div class="option-more">+${remainingCount} ${isZh ? '更多' : 'more'}</div>`;
  }

  html += '</div>';
  return html;
}

function renderSearchResults(
  container: HTMLElement,
  markets: any[],
  isZh: boolean,
  shadow?: ShadowRoot,
  displayedCount?: number
): void {
  // 如果没有指定显示数量，显示全部
  const countToShow = displayedCount ?? markets.length;
  const marketsToShow = markets.slice(0, countToShow);
  const remainingCount = markets.length - countToShow;

  let html = '<div class="market-list">';

  // 收集需要加载实时价格的市场（当前批次的前3个或全部）
  const marketsForRealtimePrice: Array<{ id: string; source: string; index: number }> = [];

  marketsToShow.forEach((market: any, index: number) => {
    const safeUrl = sanitizeExternalUrl(market.url);
    const hasPrice = market.yesPrice != null;
    const price = hasPrice ? Math.round(market.yesPrice * 100) : null;
    const source = (market.source || 'market').charAt(0).toUpperCase() + (market.source || 'market').slice(1);
    const isSnapshot = market.isSnapshotPrice === true;
    // 只对当前显示的市场中的前3个加载实时价格
    const shouldLoadRealtime = index < REALTIME_PRICE_LIMIT;
    const isMultiOption = market.isMultiOptionMarket === true || (market.outcomes && market.outcomes.length > 2);

    // 收集需要加载实时价格的市场
    if (shouldLoadRealtime && market.id && market.source) {
      marketsForRealtimePrice.push({ id: market.id, source: market.source, index });
    }

    // 决定价格显示方式
    let priceHtml: string;

    if (isMultiOption && market.outcomes && market.outcomes.length > 0) {
      // 多选项市场：显示前3个选项
      priceHtml = renderMultiOptionPrice(market.outcomes, isZh);
      if (shouldLoadRealtime && !isSnapshot) {
        // 正在更新的多选项市场
        priceHtml = `<div class="multi-updating">${priceHtml}<span class="price-updating-dot">●</span></div>`;
      }
    } else if (shouldLoadRealtime) {
      // 需要加载实时价格的二元市场：显示加载指示器
      if (hasPrice) {
        priceHtml = `
          <div class="price-value price-updating">${price}%</div>
          <div class="price-label">YES <span class="price-updating-dot">●</span></div>
        `;
      } else {
        priceHtml = `
          <div class="price-loading">
            <div class="price-spinner"></div>
          </div>
        `;
      }
    } else {
      // 后续市场：显示快照价格（带标记）或 "--"
      if (hasPrice) {
        priceHtml = `
          <div class="price-value ${isSnapshot ? 'price-snapshot' : ''}">${price}%</div>
          <div class="price-label">YES ${isSnapshot ? '<span class="snapshot-badge" title="' + (isZh ? '快照价格' : 'Snapshot') + '">⏱</span>' : ''}</div>
        `;
      } else {
        priceHtml = `
          <div class="price-value price-unavailable">--</div>
          <div class="price-label">YES</div>
        `;
      }
    }

    html += `
      <a class="market-card ${isMultiOption ? 'market-multi' : ''}" href="${safeUrl || '#'}" target="_blank" rel="noopener noreferrer">
        <div class="market-icon">${isMultiOption ? '📋' : '📊'}</div>
        <div class="market-info">
          <div class="market-title">${escapeHtml(market.title)}</div>
          <div class="market-meta">
            <span class="market-source">${escapeHtml(String(source))}</span>
            ${market.volume ? `<span>Vol: $${formatVolume(market.volume)}</span>` : ''}
          </div>
        </div>
        <div class="market-price" data-market-id="${escapeHtml(String(market.id))}" data-source="${escapeHtml(String(market.source))}" data-index="${index}" data-multi="${isMultiOption}">
          ${priceHtml}
        </div>
      </a>
    `;
  });

  html += '</div>';

  // 如果还有更多市场，添加"展开更多"按钮
  if (remainingCount > 0) {
    html += `
      <div class="show-more-container">
        <button class="show-more-btn" id="show-more-markets">
          ${isZh ? `查看更多 (还有 ${remainingCount} 个)` : `Show more (${remainingCount} more)`}
        </button>
      </div>
    `;
  }

  container.innerHTML = html;

  // 绑定"展开更多"按钮点击事件
  if (remainingCount > 0 && shadow) {
    const showMoreBtn = shadow.getElementById('show-more-markets');
    showMoreBtn?.addEventListener('click', handleShowMore);
  }

  // 为当前显示的市场加载实时价格
  if (marketsForRealtimePrice.length > 0 && shadow) {
    loadRealtimePrices(marketsForRealtimePrice, shadow, isZh);
  }
}

/**
 * 处理"展开更多"按钮点击
 */
function handleShowMore(): void {
  if (!currentSearchState) return;

  const { markets, displayedCount, shadow, isZh } = currentSearchState;
  const newDisplayedCount = Math.min(displayedCount + DISPLAY_BATCH_SIZE, markets.length);

  // 更新状态
  currentSearchState.displayedCount = newDisplayedCount;

  // 获取新显示的市场（用于加载实时价格）
  const newMarkets = markets.slice(displayedCount, newDisplayedCount);
  const marketsForRealtimePrice: Array<{ id: string; source: string; index: number }> = [];

  newMarkets.forEach((market, idx) => {
    if (market.id && market.source) {
      marketsForRealtimePrice.push({
        id: market.id,
        source: market.source,
        index: displayedCount + idx
      });
    }
  });

  // 重新渲染
  const content = shadow?.getElementById('results-content');
  if (content && shadow) {
    renderSearchResults(content, markets, isZh, shadow, newDisplayedCount);

    // 为新显示的市场加载实时价格
    if (marketsForRealtimePrice.length > 0) {
      loadRealtimePrices(marketsForRealtimePrice, shadow, isZh);
    }
  }
}

/**
 * Asynchronously load realtime prices for top markets
 * 只加载前 3 个市场的实时价格，减少 API 调用
 * 支持二元和多选项市场
 */
async function loadRealtimePrices(
  markets: Array<{ id: string; source: string; index: number }>,
  shadow: ShadowRoot,
  isZh: boolean
): Promise<void> {
  console.log(`[TextSelection] Loading realtime prices for ${markets.length} markets`);

  // Load prices in parallel
  const promises = markets.map(async ({ id, source, index }) => {
    try {
      const response = await sendToBackground('FETCH_MARKET_REALTIME_PRICE', {
        marketId: id,
        source,
      });

      const priceEl = Array.from(shadow.querySelectorAll<HTMLElement>("[data-market-id][data-source]")).find(el => el.dataset.marketId === String(id) && el.dataset.source === String(source));
      if (!priceEl) return;

      if (response.success && response.data) {
        const { yesPrice, outcomes, isMultiOptionMarket, fromCache } = response.data;

        // 多选项市场：显示前3个选项
        if (isMultiOptionMarket && outcomes && outcomes.length > 0) {
          const multiHtml = renderMultiOptionPrice(outcomes, isZh);
          priceEl.innerHTML = multiHtml;
          priceEl.setAttribute('data-multi', 'true');
          // 更新卡片图标
          const card = priceEl.closest('.market-card');
          if (card) {
            card.classList.add('market-multi');
            const iconEl = card.querySelector('.market-icon');
            if (iconEl) iconEl.textContent = '📋';
          }
          console.log(`[TextSelection] ✅ Multi-option loaded for ${source}/${id}: ${outcomes.length} outcomes ${fromCache ? '(cached)' : ''}`);
        } else if (yesPrice != null) {
          // 二元市场：显示 Yes 价格
          const price = Math.round(yesPrice * 100);
          priceEl.innerHTML = `
            <div class="price-value price-realtime">${price}%</div>
            <div class="price-label">YES ${fromCache ? '<span class="cache-badge" title="Cached">⚡</span>' : ''}</div>
          `;
          console.log(`[TextSelection] ✅ Price loaded for ${source}/${id}: ${price}% ${fromCache ? '(cached)' : ''}`);
        }
      } else {
        // API 调用失败，显示快照价格或 "--"
        const currentValue = priceEl.querySelector('.price-value')?.textContent;
        if (currentValue && currentValue !== '--' && !currentValue.includes('spinner')) {
          priceEl.innerHTML = `
            <div class="price-value price-snapshot">${escapeHtml(currentValue)}</div>
            <div class="price-label">YES <span class="snapshot-badge" title="Snapshot">⏱</span></div>
          `;
        } else {
          priceEl.innerHTML = `
            <div class="price-value price-unavailable">--</div>
            <div class="price-label">YES</div>
          `;
        }
        console.warn(`[TextSelection] ⚠️ Failed to load price for ${source}/${id}`);
      }
    } catch (error) {
      console.error(`[TextSelection] ❌ Error loading price for ${source}/${id}:`, error);
      const priceEl = Array.from(shadow.querySelectorAll<HTMLElement>("[data-market-id][data-source]")).find(el => el.dataset.marketId === String(id) && el.dataset.source === String(source));
      if (priceEl) {
        priceEl.innerHTML = `
          <div class="price-value price-unavailable">--</div>
          <div class="price-label">YES</div>
        `;
      }
    }
  });

  await Promise.all(promises);
}

function formatVolume(value: unknown): string {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume < 0) return "0";
  if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M';
  if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
  return volume.toString();
}

/**
 * Hide search results panel
 */
export function hideSearchResults(): void {
  activeSearchRequestId++;
  if (searchResultsPanel) {
    searchResultsPanel.remove();
    searchResultsPanel = null;
  }
  // 清除搜索状态
  currentSearchState = null;
}

/**
 * Cleanup text selection handlers
 */
export function cleanupTextSelection(): void {
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('keydown', handleKeydown);
  hideSelectionPopup();
  hideSearchResults();
}
