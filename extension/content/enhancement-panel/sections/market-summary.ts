import { showToast } from '../../utils/toast';
/**
 * Market Summary section for enhancement panel
 */

import type { MarketEvent } from '../../../utils/types';
import { sendToBackground } from '../../../utils/messaging';
import { escapeHtml, formatUsd, formatPercent } from '../../utils/dom';
import { isZhLanguage } from '../../state';

/**
 * Load and render market summary
 */
export async function loadMarketSummary(
  shadow: ShadowRoot,
  market: MarketEvent
): Promise<void> {
  const body = shadow.getElementById('market-summary-body');
  if (!body) return;

  const isZh = isZhLanguage();

  try {
    const response = await sendToBackground('GET_MARKET_SUMMARY', { market });
    const s = response?.data;

    if (response.success && s && s.microstructure && s.risks) {
      renderMarketSummary(body, shadow, s, market, isZh);
    } else {
      renderFallbackSummary(body, shadow, market, isZh);
    }
  } catch (error) {
    console.error('[Enhancement Panel] Market Summary error:', error);
    renderFallbackSummary(body, shadow, market, isZh);
  }
}

function renderMarketSummary(
  body: HTMLElement,
  shadow: ShadowRoot,
  s: any,
  market: MarketEvent,
  isZh: boolean
): void {
  const micro = s.microstructure;
  const activity = s.activity || {};
  const risks = s.risks;

  const riskLevel = risks.overallLevel || 'low';
  const riskLabel = riskLevel === 'high'
    ? (isZh ? '高风险' : 'High')
    : riskLevel === 'medium'
      ? (isZh ? '中等' : 'Medium')
      : (isZh ? '低风险' : 'Low');

  const spreadPct = (micro.spreadPercent || 0).toFixed(1);
  const bidDepth = micro.depth?.bidDepth || 0;
  const askDepth = micro.depth?.askDepth || 0;
  const slipBuy500 = (micro.slippage?.buy500 || 0).toFixed(2);
  const vol = (activity.volatility || 0).toFixed(1);
  const pc24h = activity.priceChange24h || 0;
  const riskAlerts = risks.alerts || [];

  body.innerHTML = `
    <div class="summary-cards">
      <!-- Metrics Card -->
      <div class="summary-card metrics">
        <div class="metrics-label">📐 ${isZh ? '关键指标' : 'Key Metrics'}</div>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-key">${isZh ? '价差' : 'Spread'}</span>
            <span class="metric-val">${spreadPct}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-key">${isZh ? '深度' : 'Depth'}</span>
            <span class="metric-val">${formatUsd(bidDepth + askDepth)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-key">${isZh ? '成交量' : 'Volume'}</span>
            <span class="metric-val">${formatUsd(activity.volume || 0)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-key">${isZh ? '24h 变化' : '24h Chg'}</span>
            <span class="metric-val ${pc24h >= 0 ? 'positive' : 'negative'}">${formatPercent(pc24h)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-key">${isZh ? '波动率' : 'Vol.'}</span>
            <span class="metric-val">${vol}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-key">${isZh ? '滑点$500' : 'Slip.$500'}</span>
            <span class="metric-val">${slipBuy500}%</span>
          </div>
        </div>
      </div>

      <!-- Risk Card -->
      <div class="summary-card risk">
        <div class="risk-header">
          ⚠️ ${isZh ? '风险提醒' : 'Risk Alerts'}
          <span class="risk-level-badge ${riskLevel}">${riskLabel}</span>
        </div>
        ${riskAlerts.length > 0 ? `
          <div class="risk-alerts">
            ${riskAlerts.slice(0, 3).map((alert: any) => `
              <div class="risk-alert-item">
                <span class="risk-dot ${alert.severity || 'low'}"></span>
                <span>${escapeHtml(alert.message || '')}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="no-risks">✅ ${isZh ? '未发现显著风险' : 'No significant risks detected'}</div>
        `}
      </div>
    </div>

    <button class="summary-action-btn" id="run-deep-analysis">
      <span>🧠</span>
      <span>${isZh ? '关注这个市场' : 'Watch this market'}</span>
    </button>
  `;

  // Bind deep analysis button
  bindDeepAnalysisButton(shadow, market);
}

function renderFallbackSummary(
  body: HTMLElement,
  shadow: ShadowRoot,
  market: MarketEvent,
  isZh: boolean
): void {
  const yesPrice = market.yesPrice;
  body.innerHTML = `
    <div class="summary-cards">
      <div class="summary-card conclusion">
        <div class="conclusion-header">
          <span class="confidence-tag">YES ${yesPrice == null ? "—" : (yesPrice * 100).toFixed(0) + "%"}</span>
        </div>
        <div class="one-liner">${isZh ? '基于当前价格的基础分析，详细市场数据暂时无法获取' : 'Basic analysis from current price. Detailed market data temporarily unavailable.'}</div>
      </div>
    </div>
    <button class="summary-action-btn" id="run-deep-analysis">
      <span>🧠</span>
      <span>${isZh ? '关注这个市场' : 'Watch this market'}</span>
    </button>
  `;

  bindDeepAnalysisButton(shadow, market);
}

function bindDeepAnalysisButton(shadow: ShadowRoot, market: MarketEvent): void {
  shadow.getElementById('run-deep-analysis')?.addEventListener('click', async () => {
    const opening = sendToBackground('OPEN_SIDEPANEL', undefined, { maxRetries: 0 });
    await sendToBackground('SET_SELECTED_MARKET', { market });
    if (!(await opening).success) showToast(isZhLanguage() ? '请点击浏览器中的 OddsSeer 图标' : 'Click the OddsSeer toolbar icon', 'info');
  });
}
