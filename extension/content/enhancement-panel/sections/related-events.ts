/**
 * Related Events section for enhancement panel
 * Displays related markets in a simple card format (like arbitrage section)
 */

import type { MarketEvent } from '../../../utils/types';
import { escapeHtml, sanitizeExternalUrl } from '../../utils/dom';
import { isZhLanguage } from '../../state';

/**
 * Render related events (accepts pre-fetched data)
 */
export function renderRelatedSection(
  shadow: ShadowRoot,
  market: MarketEvent,
  relatedMarkets: any[]
): void {
  const relatedBody = shadow.getElementById('related-body');
  const relatedCount = shadow.getElementById('related-count');
  if (!relatedBody) return;

  const isZh = isZhLanguage();

  const filteredMarkets = (relatedMarkets || [])
    .filter((e: any) => e && e.title)
    .slice(0, 5);

  if (relatedCount) {
    relatedCount.textContent = filteredMarkets.length.toString();
  }

  if (filteredMarkets.length === 0) {
    relatedBody.innerHTML = `
      <div class="empty-state">${isZh ? '暂无关联事件' : 'No related events found'}</div>
    `;
    return;
  }

  renderRelatedMarkets(relatedBody, filteredMarkets, market, isZh);
}

function renderRelatedMarkets(
  container: HTMLElement,
  markets: any[],
  currentMarket: MarketEvent,
  isZh: boolean
): void {
  // Group by source - compare with current market's source
  const currentSource = currentMarket.source || 'polymarket';
  const samePlatformEvents = markets.filter((m: any) => m.source === currentSource);
  const otherPlatformEvents = markets.filter((m: any) => m.source !== currentSource);

  let html = '';

  // Same platform events
  if (samePlatformEvents.length > 0) {
    html += `
      <div style="font-size: 11px; font-weight: 600; color: #7c3aed; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
        <span>📌</span> ${isZh ? '同平台相关' : 'Same Platform'}
      </div>
    `;
    samePlatformEvents.forEach((m: any) => {
      html += renderMarketCard(m, isZh, true);
    });
  }

  // Other platform events
  if (otherPlatformEvents.length > 0) {
    html += `
      <div style="font-size: 11px; font-weight: 600; color: #6b7280; margin: ${samePlatformEvents.length > 0 ? '12px' : '0'} 0 8px; display: flex; align-items: center; gap: 4px;">
        <span>🔗</span> ${isZh ? '其他平台' : 'Other Platforms'}
      </div>
    `;
    otherPlatformEvents.forEach((m: any) => {
      html += renderMarketCard(m, isZh, false);
    });
  }

  container.innerHTML = html;
}

function renderMarketCard(m: any, isZh: boolean, isSamePlatform: boolean): string {
  const safeUrl = sanitizeExternalUrl(m.url);
  const isMultiOption = m.isMultiOptionMarket || (m.outcomes && m.outcomes.length > 2);
  const bgColor = isSamePlatform ? '#f5f3ff' : '#f9fafb';
  const borderColor = isSamePlatform ? '#ddd6fe' : '#e5e7eb';
  const textColor = isSamePlatform ? '#5b21b6' : '#374151';

  return `
    <a href="${safeUrl || '#'}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px; margin-bottom: 8px; transition: all 0.2s;">
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="flex-shrink: 0;">
          ${getPlatformIcon(m.source)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 500; color: ${textColor}; line-height: 1.3; margin-bottom: 4px;">
            ${escapeHtml((m.title || '').substring(0, 60))}${(m.title || '').length > 60 ? '...' : ''}
            ${isMultiOption ? `<span style="font-size: 9px; background: ${isSamePlatform ? '#ede9fe' : '#f3f4f6'}; color: ${textColor}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${m.outcomes?.length || 0} ${isZh ? '选项' : 'options'}</span>` : ''}
          </div>
          ${isMultiOption && m.outcomes ?
            renderOutcomes(m.outcomes, 3, textColor) :
            `<div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-size: 16px; font-weight: 700; color: ${textColor};">${m.yesPrice != null ? (m.yesPrice * 100).toFixed(0) + '%' : '--'}</span>
              <span style="font-size: 11px; color: #9ca3af;">Yes</span>
            </div>`
          }
        </div>
      </div>
    </a>
  `;
}

function getPlatformIcon(source: string): string {
  if (source === 'polymarket') {
    return '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #7c3aed; border-radius: 4px; font-size: 10px; color: white; font-weight: bold;">P</span>';
  }
  if (source === 'kalshi') {
    return '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #22c55e; border-radius: 4px; font-size: 10px; color: white; font-weight: bold;">K</span>';
  }
  if (source === 'metaculus') {
    return '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #3b82f6; border-radius: 4px; font-size: 10px; color: white; font-weight: bold;">M</span>';
  }
  return '<span style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: #6b7280; border-radius: 4px; font-size: 10px; color: white; font-weight: bold;">?</span>';
}

function renderOutcomes(outcomes: any[], maxShow: number, textColor: string): string {
  if (!outcomes || outcomes.length === 0) return '';

  const sortedOutcomes = [...outcomes].sort((a, b) => (b.yesPrice || 0) - (a.yesPrice || 0));
  const showOutcomes = sortedOutcomes.slice(0, maxShow);
  const hasMore = sortedOutcomes.length > maxShow;

  let html = '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">';
  showOutcomes.forEach((o: any) => {
    const price = o.yesPrice == null ? "—" : (o.yesPrice * 100).toFixed(0) + "%";
    html += `
      <span style="display: inline-flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 11px;">
        <span style="color: ${textColor}; font-weight: 500; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(o.name || 'Option')}</span>
        <span style="color: ${textColor}; font-weight: 700;">${price}</span>
      </span>
    `;
  });
  if (hasMore) {
    html += `<span style="font-size: 10px; color: #9ca3af;">+${sortedOutcomes.length - maxShow}</span>`;
  }
  html += '</div>';
  return html;
}
