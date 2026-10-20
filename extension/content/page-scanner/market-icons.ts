/**
 * Market Icons
 * Manages market icons added to event blocks
 */

import type { MarketEvent, MarketOutcome } from '../../utils/types';
import { sendToBackground } from '../../utils/messaging';
import { escapeHtml, formatVolume, sanitizeExternalUrl } from '../utils/dom';
import { getSettings, isZhLanguage } from '../state';
import { getBlockPopupStyles } from './styles';

// 多选项市场显示限制
const MULTI_OPTION_DISPLAY_LIMIT = 3;

/**
 * 检查市场是否为多选项市场
 */
function isMultiOptionMarket(market: MarketEvent): boolean {
  return market.isMultiOptionMarket === true ||
    (market.outcomes != null && market.outcomes.length > 2) ||
    (market.outcomes != null && market.outcomes.length > 0 &&
      !market.outcomes.every(o => ['Yes', 'No', 'yes', 'no'].includes(o.name)));
}

/**
 * 渲染多选项市场的价格 HTML
 */
function renderMultiOptionOdds(outcomes: MarketOutcome[], isZh: boolean): string {
  // 按价格排序（高到低）
  const sortedOutcomes = [...outcomes].sort((a, b) => (b.yesPrice || 0) - (a.yesPrice || 0));
  const topOutcomes = sortedOutcomes.slice(0, MULTI_OPTION_DISPLAY_LIMIT);
  const remainingCount = outcomes.length - MULTI_OPTION_DISPLAY_LIMIT;

  let html = '<div class="multi-odds">';
  topOutcomes.forEach((outcome, index) => {
    const isLeader = index === 0;
    html += `
      <div class="option-row ${isLeader ? 'leader' : ''}">
        <span class="option-name">${isLeader ? '🏆 ' : ''}${escapeHtml(outcome.name)}</span>
        <span class="option-price">${outcome.yesPrice != null ? Math.round(outcome.yesPrice * 100) + '%' : '-'}</span>
      </div>
    `;
  });
  if (remainingCount > 0) {
    html += `<div class="option-more">+${remainingCount} ${isZh ? '更多' : 'more'}</div>`;
  }
  html += '</div>';
  return html;
}

// Store added icon elements
let marketIconElements: HTMLElement[] = [];
let currentBlockPopup: HTMLElement | null = null;

/**
 * Add market icon next to an event block
 */
export function addMarketIcon(block: {
  element: Element;
  text: string;
  markets: MarketEvent[];
}): boolean {
  const { element, text, markets } = block;

  // Create icon container
  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'oddsseer-icon';
  iconWrapper.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 8px;
    background: linear-gradient(135deg, #4F46E5, #7C3AED);
    border-radius: 50%;
    cursor: pointer;
    vertical-align: middle;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
    z-index: 999999;
    pointer-events: auto;
  `;

  // Icon SVG
  iconWrapper.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  `;

  // Hover effect
  iconWrapper.addEventListener('mouseenter', () => {
    iconWrapper.style.transform = 'scale(1.1)';
    iconWrapper.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
  });

  iconWrapper.addEventListener('mouseleave', () => {
    iconWrapper.style.transform = 'scale(1)';
    iconWrapper.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.3)';
  });

  // Click to show markets popup
  // Use capture phase and stopImmediatePropagation to prevent
  // parent containers (like Google News cards) from handling the click
  const handleIconClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // Block mousedown to prevent sites that use mousedown for navigation
  iconWrapper.addEventListener('mousedown', handleIconClick, { capture: true });

  // Handle actual click
  iconWrapper.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    showBlockMarketsPopup(e, text, markets);
  }, { capture: true });

  // Add icon next to element
  try {
    // For headings: add inside at the end
    // For links and other elements: add AFTER to avoid click event conflicts
    if (element.tagName.match(/^H[1-6]$/)) {
      element.appendChild(iconWrapper);
    } else {
      // Add after element (outside) - prevents link click propagation issues
      element.parentElement?.insertBefore(iconWrapper, element.nextSibling);
    }

    marketIconElements.push(iconWrapper);
    return true;
  } catch (e) {
    console.warn('[OddsSeer] Failed to add icon:', e);
    return false;
  }
}

/**
 * Show markets popup for event block
 * 初始显示加载状态，然后异步获取实时数据
 */
function showBlockMarketsPopup(
  event: MouseEvent,
  title: string,
  markets: MarketEvent[]
): void {
  // Hide previous popup
  hideBlockMarketsPopup();

  const isZh = isZhLanguage();

  // Create popup
  const host = document.createElement('div');
  host.id = 'oddsseer-block-popup';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getBlockPopupStyles();
  shadow.appendChild(style);

  const popup = document.createElement('div');
  popup.className = 'popup';

  // 初始渲染：显示加载状态
  popup.innerHTML = renderPopupContent(title, markets, isZh, true);

  shadow.appendChild(popup);
  document.body.appendChild(host);

  // Position popup
  const rect = (event.target as HTMLElement).getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left - 160 + rect.width / 2;

  if (left < 10) left = 10;
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (top + 350 > window.innerHeight) {
    top = rect.top - 350 - 8;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  // Click outside to close
  const closeOnOutsideClick = (e: MouseEvent) => {
    if (!host.contains(e.target as Node)) {
      hideBlockMarketsPopup();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeOnOutsideClick);
  }, 100);

  currentBlockPopup = host;

  // 异步加载实时数据
  loadRealtimeData(markets, shadow, title, isZh);
}

/**
 * 渲染弹窗内容
 */
function renderPopupContent(
  title: string,
  markets: MarketEvent[],
  isZh: boolean,
  isLoading: boolean
): string {
  return `
    <div class="header">
      <div class="header-title">${escapeHtml(title)}</div>
      <div class="header-subtitle">${isZh ? '相关预测市场' : 'Related Prediction Markets'}</div>
    </div>
    <div class="markets-list">
      ${markets.map((m, index) => {
        const safeUrl = sanitizeExternalUrl(m.url);
        const isMulti = isMultiOptionMarket(m);

        let oddsHtml: string;
        if (isLoading) {
          // 加载中状态
          oddsHtml = `<div class="market-odds loading">
            <div class="odds-spinner"></div>
          </div>`;
        } else if (isMulti && m.outcomes && m.outcomes.length > 0) {
          // 多选项市场
          oddsHtml = renderMultiOptionOdds(m.outcomes, isZh);
        } else {
          // 普通市场
          oddsHtml = `<div class="market-odds">
            <div class="odds-value">${m.yesPrice != null ? Math.round(m.yesPrice * 100) + '%' : '-'}</div>
            <div class="odds-label">YES</div>
          </div>`;
        }

        return `
          <a class="market-item ${isMulti ? 'multi-option' : ''}" href="${safeUrl || '#'}" target="_blank" rel="noopener noreferrer" data-market-index="${index}">
            <div class="market-info">
              <div class="market-title">${isMulti ? '📋 ' : ''}${escapeHtml(m.title)}</div>
              <div class="market-meta">
                <span class="source-badge">${escapeHtml(String(m.source || 'Market'))}</span>
                ${m.volume ? `<span>Vol: $${formatVolume(m.volume)}</span>` : ''}
              </div>
            </div>
            ${oddsHtml}
          </a>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 异步加载实时数据并更新弹窗
 */
async function loadRealtimeData(
  markets: MarketEvent[],
  shadow: ShadowRoot,
  title: string,
  isZh: boolean
): Promise<void> {
  // 限制只加载前3个市场的实时数据
  const marketsToLoad = markets.slice(0, 3);

  const updatedMarkets = await Promise.all(
    marketsToLoad.map(async (market) => {
      try {
        const response = await sendToBackground('FETCH_MARKET_REALTIME_PRICE', {
          marketId: market.id,
          source: market.source
        });

        if (response.success && response.data) {
          const data = response.data;
          return {
            ...market,
            yesPrice: data.yesPrice ?? market.yesPrice,
            noPrice: data.noPrice ?? market.noPrice,
            outcomes: data.outcomes,
            isMultiOptionMarket: data.isMultiOptionMarket
          };
        }
      } catch (e) {
        console.warn('[OddsSeer] Failed to fetch realtime data for:', market.id);
      }
      return market;
    })
  );

  // 合并更新后的市场和剩余市场
  const allMarkets = [...updatedMarkets, ...markets.slice(3)];

  // 更新弹窗内容
  const popup = shadow.querySelector('.popup');
  if (popup && currentBlockPopup) {
    // 保存当前位置
    const currentTop = popup.getAttribute('style')?.match(/top:\s*([^;]+)/)?.[1];
    const currentLeft = popup.getAttribute('style')?.match(/left:\s*([^;]+)/)?.[1];

    popup.innerHTML = renderPopupContent(title, allMarkets, isZh, false);

    // 恢复位置
    if (currentTop && currentLeft) {
      (popup as HTMLElement).style.top = currentTop;
      (popup as HTMLElement).style.left = currentLeft;
    }
  }
}

/**
 * Hide block markets popup
 */
export function hideBlockMarketsPopup(): void {
  if (currentBlockPopup) {
    currentBlockPopup.remove();
    currentBlockPopup = null;
  }
}

/**
 * Clear all added market icons
 */
export function clearMarketIcons(): void {
  marketIconElements.forEach(icon => {
    try {
      icon.remove();
    } catch (e) {}
  });
  marketIconElements = [];
  hideBlockMarketsPopup();
}
