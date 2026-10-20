/**
 * Arbitrage/Cross-market section for enhancement panel
 */

import type { MarketEvent } from '../../../utils/types';
import { escapeHtml, sanitizeExternalUrl } from '../../utils/dom';
import { isZhLanguage } from '../../state';

/**
 * Render arbitrage data (accepts pre-fetched data)
 */
export function renderArbitrageSection(
  shadow: ShadowRoot,
  market: MarketEvent,
  markets: any[]
): void {
  const arbBody = shadow.getElementById('arbitrage-body');
  const arbCount = shadow.getElementById('arb-count');
  if (!arbBody) return;

  const isZh = isZhLanguage();

  const crossMarkets = (markets || [])
    .filter((m: any) => m.source !== market.source && m.title && m.yesPrice !== undefined)
    .map((m: any) => {
      const { maxDiff } = findBestArbitrage(market, m);
      return { ...m, priceDiff: maxDiff == null ? null : maxDiff.toFixed(1) };
    })
    .filter(m => m.priceDiff != null)
    .slice(0, 4);

  if (arbCount) {
    arbCount.textContent = crossMarkets.length.toString();
  }

  if (crossMarkets.length === 0) {
    arbBody.innerHTML = `
      <div class="empty-state">
        <p>${isZh ? '未找到其他平台的相关市场' : 'No related markets on other platforms'}</p>
      </div>
    `;
    return;
  }

  renderArbitrageMarkets(arbBody, crossMarkets, isZh);
}

function findBestArbitrage(currentMarket: any, otherMarket: any): { maxDiff: number | null } {
  const difference = (a: any, b: any) => typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) ? (b - a) * 100 : null;
  const currentOutcomes = currentMarket.outcomes || [];
  const otherOutcomes = otherMarket.outcomes || [];
  if (!currentOutcomes.length || !otherOutcomes.length) return { maxDiff: difference(currentMarket.yesPrice, otherMarket.yesPrice) };
  let maxDiff: number | null = null;
  for (const co of currentOutcomes) {
    const match = otherOutcomes.find((oo: any) => co.name && oo.name && oo.name.toLowerCase() === co.name.toLowerCase());
    const diff = match ? difference(co.yesPrice, match.yesPrice) : null;
    if (diff != null && (maxDiff == null || Math.abs(diff) > Math.abs(maxDiff))) maxDiff = diff;
  }
  return { maxDiff };
}

function renderArbitrageMarkets(
  container: HTMLElement,
  markets: any[],
  isZh: boolean
): void {
  const exactMatches = markets.filter((m: any) => m.isExactMatch);
  const similarMatches = markets.filter((m: any) => !m.isExactMatch);

  let html = '';

  if (exactMatches.length > 0) {
    html += `
      <div style="font-size: 11px; font-weight: 600; color: #16a34a; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
        <span>✅</span> ${isZh ? '同一事件' : 'Same Event'}
      </div>
    `;
    exactMatches.forEach((m: any) => {
      html += renderMarketCard(m, isZh, true);
    });
  }

  if (similarMatches.length > 0) {
    html += `
      <div style="font-size: 11px; font-weight: 600; color: #d97706; margin: 12px 0 8px; display: flex; align-items: center; gap: 4px;">
        <span>🔍</span> ${isZh ? '相似市场' : 'Similar'}
      </div>
    `;
    similarMatches.forEach((m: any) => {
      html += renderMarketCard(m, isZh, false);
    });
  }

  container.innerHTML = html;
}

function renderMarketCard(m: any, isZh: boolean, isExact: boolean): string {
  const safeUrl = sanitizeExternalUrl(m.url);
  const diff = parseFloat(m.priceDiff);
  const diffColor = diff > 2 ? '#dc2626' : diff < -2 ? '#16a34a' : '#64748b';
  const diffSign = diff > 0 ? '+' : '';
  const isMultiOption = m.isMultiOptionMarket || (m.outcomes && m.outcomes.length > 1);
  const bgColor = isExact ? '#f0fdf4' : '#fffbeb';
  const borderColor = isExact ? '#bbf7d0' : '#fde68a';
  const textColor = isExact ? '#166534' : '#92400e';

  return `
    <a href="${safeUrl || '#'}" target="_blank" rel="noopener noreferrer" style="display: block; text-decoration: none; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px; margin-bottom: 8px; transition: all 0.2s;">
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="flex-shrink: 0;">
          ${getPlatformIcon(m.source)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 500; color: ${textColor}; line-height: 1.3; margin-bottom: 4px;">
            ${escapeHtml((m.title || '').substring(0, 60))}${(m.title || '').length > 60 ? '...' : ''}
            ${isMultiOption ? `<span style="font-size: 9px; background: ${isExact ? '#dcfce7' : '#fef3c7'}; color: ${textColor}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${m.outcomes?.length || 0} ${isZh ? '选项' : 'options'}</span>` : ''}
          </div>
          ${isMultiOption && m.outcomes ?
            renderOutcomes(m.outcomes, 3, textColor) :
            `<div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-size: 18px; font-weight: 700; color: ${textColor};">${m.yesPrice == null ? "—" : (m.yesPrice * 100).toFixed(1) + "%"}</span>
              <span style="font-size: 12px; font-weight: 600; color: ${diffColor};">${diffSign}${m.priceDiff}%</span>
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
