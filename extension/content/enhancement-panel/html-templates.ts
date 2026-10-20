/**
 * Enhancement panel HTML templates
 */

import type { MarketEvent } from '../../utils/types';
import { escapeHtml } from '../utils/dom';

/**
 * Get the main panel HTML structure
 */
export function getEnhancementPanelHTML(market: MarketEvent, isZh: boolean): string {
  return `
    <div class="toggle-tab" id="toggle-panel" title="${isZh ? '收起/展开面板' : 'Toggle panel'}">
      <span class="icon">🔮</span>
      <span class="label">AI</span>
      <span class="arrow">›</span>
    </div>

    <!-- Tab Bar -->
    <div class="panel-tabs">
      <div class="panel-tab active" data-tab="analysis">📊 ${isZh ? '分析' : 'Analysis'}</div>
      <div class="panel-tab" data-tab="timeline">⏱️ ${isZh ? '时间线' : 'Timeline'}</div>
      <button class="close-panel-btn" id="close-panel" title="${isZh ? '收起面板' : 'Collapse panel'}">→</button>
    </div>

    <!-- Analysis Tab -->
    <div class="tab-content active" id="tab-analysis">
      <div class="panel-content" style="flex:1;overflow-y:auto;">
        ${getMarketSummarySection(isZh)}
        ${getCommunitySentimentSection(isZh)}
        ${getArbitrageSection(isZh)}
        ${getRelatedEventsSection(isZh)}
      </div>
    </div>

    <!-- Timeline Tab -->
    <div class="tab-content" id="tab-timeline">
      ${getTimelineContent(isZh)}
    </div>

    <div class="panel-footer">
      <a class="footer-link" href="#" id="open-sidepanel">
        <span>📊</span>
        <span>${isZh ? '查看完整分析' : 'Full Analysis'}</span>
        <span>→</span>
      </a>
    </div>
  `;
}

function getMarketSummarySection(isZh: boolean): string {
  return `
    <div class="section" id="market-summary-section">
      <div class="section-header">
        <span class="section-icon">📊</span>
        <span class="section-title">${isZh ? '市场总结' : 'Market Summary'}</span>
        <span class="section-toggle">▼</span>
      </div>
      <div class="section-body" id="market-summary-body">
        <div class="loading">
          <div class="spinner"></div>
          <span>${isZh ? '正在分析市场结构...' : 'Analyzing market structure...'}</span>
        </div>
      </div>
    </div>
  `;
}

function getArbitrageSection(isZh: boolean): string {
  return `
    <div class="section" id="arbitrage-section">
      <div class="section-header">
        <span class="section-icon">⚖️</span>
        <span class="section-title">${isZh ? '跨市场比价' : 'Cross-Market'}</span>
        <span class="section-badge" id="arb-count">0</span>
        <span class="section-toggle">▼</span>
      </div>
      <div class="section-body" id="arbitrage-body">
        <div class="loading">
          <div class="spinner"></div>
          <span>${isZh ? '搜索跨平台市场...' : 'Searching markets...'}</span>
        </div>
      </div>
    </div>
  `;
}

function getCommunitySentimentSection(isZh: boolean): string {
  return `
    <div class="section" id="sentiment-section">
      <div class="section-header">
        <span class="section-icon">💬</span>
        <span class="section-title">${isZh ? '社区情绪' : 'Community Sentiment'}</span>
        <span class="section-toggle">▼</span>
      </div>
      <div class="section-body" id="sentiment-body">
        <div class="loading">
          <div class="spinner"></div>
          <span>${isZh ? '分析社区评论...' : 'Analyzing community comments...'}</span>
        </div>
      </div>
    </div>
  `;
}

function getRelatedEventsSection(isZh: boolean): string {
  return `
    <div class="section" id="related-section">
      <div class="section-header">
        <span class="section-icon">🔗</span>
        <span class="section-title">${isZh ? '关联事件' : 'Related Events'}</span>
        <span class="section-badge" id="related-count">0</span>
        <span class="section-toggle">▼</span>
      </div>
      <div class="section-body" id="related-body">
        <div class="loading">
          <div class="spinner"></div>
          <span>${isZh ? '发现关联事件...' : 'Finding related events...'}</span>
        </div>
      </div>
    </div>
  `;
}

function getTimelineContent(isZh: boolean): string {
  return `
    <div class="timeline-filters">
      <button class="timeline-period-btn" data-period="24h">1D</button>
      <button class="timeline-period-btn active" data-period="7d">7D</button>
      <button class="timeline-period-btn" data-period="30d">30D</button>
      <div class="timeline-filter-sep"></div>
      <button class="timeline-impact-btn" data-filter="high" title="${isZh ? '只看高影响事件' : 'High impact only'}">🔥</button>
    </div>

    <div class="timeline-summary" id="timeline-summary">
      <div class="loading"><div class="spinner"></div><span>${isZh ? '加载时间线...' : 'Loading timeline...'}</span></div>
    </div>

    <div class="timeline-feed" id="timeline-feed">
      <div class="loading" style="padding: 40px 20px;">
        <div class="spinner"></div>
        <span>${isZh ? '加载事件数据...' : 'Loading events...'}</span>
      </div>
    </div>
  `;
}

/**
 * Loading HTML template
 */
export function getLoadingHTML(message: string): string {
  return `
    <div class="loading">
      <div class="spinner"></div>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Empty state HTML template
 */
export function getEmptyStateHTML(message: string): string {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}
