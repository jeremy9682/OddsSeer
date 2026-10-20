/**
 * Community Sentiment section for enhancement panel
 * Displays LLM-analyzed community sentiment from Polymarket comments
 */

import type { MarketEvent, CommunitySentimentData } from '../../../utils/types';
import { sendToBackground } from '../../../utils/messaging';
import { escapeHtml } from '../../utils/dom';
function finiteCount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1e9, number)) : 0;
}

import { isZhLanguage } from '../../state';

/**
 * Load and render community sentiment data
 */
export async function loadCommunitySentiment(
  shadow: ShadowRoot,
  market: MarketEvent
): Promise<void> {
  const body = shadow.getElementById('sentiment-body');
  if (!body) {
    console.error('[CommunitySentiment] sentiment-body element not found');
    return;
  }

  const isZh = isZhLanguage();
  console.log('[CommunitySentiment] Loading for market:', market?.id, market?.title?.substring(0, 50));

  try {
    const response = await sendToBackground('GET_COMMUNITY_SENTIMENT', { market });
    console.log('[CommunitySentiment] Full response:', JSON.stringify(response, null, 2));
    console.log('[CommunitySentiment] Response summary:', {
      success: response.success,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      sentiment: response.data?.overallSentiment,
      summary: response.data?.summary?.substring(0, 50),
      analyzedCount: response.data?.analyzedCount,
      error: response.error
    });

    if (response.success && response.data) {
      // Handle potential double-nesting from backend response
      const sentimentData = response.data.data || response.data;
      console.log('[CommunitySentiment] Using data:', {
        wasDoubleNested: !!response.data.data,
        sentiment: sentimentData.overallSentiment,
        analyzedCount: sentimentData.analyzedCount
      });
      renderCommunitySentiment(body, sentimentData, market, isZh);
      console.log('[CommunitySentiment] Rendered successfully');
    } else {
      console.warn('[CommunitySentiment] No data or error:', response.error);
      renderEmptyState(body, isZh, response.error);
    }
  } catch (error) {
    console.error('[CommunitySentiment] Error:', error);
    renderEmptyState(body, isZh);
  }
}

/**
 * Render the community sentiment analysis
 */
function renderCommunitySentiment(
  body: HTMLElement,
  data: CommunitySentimentData,
  market: MarketEvent,
  isZh: boolean
): void {
  // Use backend's determination of multi-option, fallback to market object check
  const isMultiOption = data.isMultiOption ??
    (market.isMultiOptionMarket && market.outcomes && market.outcomes.length > 2);

  console.log('[CommunitySentiment] Rendering:', {
    isMultiOption,
    'data.isMultiOption': data.isMultiOption,
    'market.isMultiOptionMarket': market.isMultiOptionMarket,
    'market.outcomes?.length': market.outcomes?.length,
    sentiment: data.overallSentiment,
    optionMentionsCount: data.optionMentions?.length
  });

  // Add fallbacks for potentially undefined values
  const analyzedCount = data.analyzedCount ?? 0;
  const totalComments = data.totalComments ?? 0;
  const summary = data.summary || (isZh ? '暂无社区观点摘要' : 'No community summary available');

  // Sentiment badge
  // Binary events: bullish, bearish, neutral, divided
  // Multi-option events: consensus, divided, uncertain
  const sentimentLabels: Record<string, { zh: string; en: string; class: string }> = {
    bullish: { zh: '看涨', en: 'Bullish', class: 'bullish' },
    bearish: { zh: '看跌', en: 'Bearish', class: 'bearish' },
    neutral: { zh: '中立', en: 'Neutral', class: 'neutral' },
    divided: { zh: '分歧', en: 'Divided', class: 'divided' },
    consensus: { zh: '有共识', en: 'Consensus', class: 'bullish' },
    uncertain: { zh: '不确定', en: 'Uncertain', class: 'neutral' }
  };

  const sentimentInfo = sentimentLabels[data.overallSentiment] || sentimentLabels.neutral;

  // Wilson Score stats
  const stats = data.stats;
  const hasStats = stats && typeof stats.wilsonLower === 'number';
  const wilsonLower = hasStats ? Math.round(stats.wilsonLower * 100) : 50;
  const wilsonUpper = hasStats ? Math.round(stats.wilsonUpper * 100) : 50;
  const bullishRate = hasStats && stats.bullishRate !== undefined ? Math.round(stats.bullishRate * 100) : 50;

  const reliabilityLabels: Record<string, { zh: string; en: string }> = {
    high: { zh: '高可靠性', en: 'High reliability' },
    medium: { zh: '中可靠性', en: 'Medium reliability' },
    low: { zh: '低可靠性', en: 'Low reliability' }
  };
  const reliabilityInfo = reliabilityLabels[stats?.reliability || 'low'] || reliabilityLabels.low;

  // Velocity indicator
  const velocity = stats?.velocity;
  const velocityLabels: Record<string, { zh: string; en: string; emoji: string; class: string }> = {
    accelerating: { zh: '讨论加速中', en: 'Accelerating', emoji: '🔥', class: 'velocity-hot' },
    increasing: { zh: '讨论增加中', en: 'Increasing', emoji: '📈', class: 'velocity-up' },
    stable: { zh: '讨论平稳', en: 'Stable', emoji: '➖', class: 'velocity-stable' },
    slowing: { zh: '讨论减少中', en: 'Slowing', emoji: '📉', class: 'velocity-down' },
    declining: { zh: '讨论下降中', en: 'Declining', emoji: '❄️', class: 'velocity-cold' }
  };
  const velocityInfo = velocityLabels[velocity?.trend || 'stable'] || velocityLabels.stable;
  const showVelocity = velocity && velocity.trend !== 'stable' && (velocity.recentCount + velocity.olderCount) >= 5;

  // Build HTML
  let html = `
    <div class="sentiment-header">
      <span class="sentiment-badge ${sentimentInfo.class}">
        ${getSentimentEmoji(data.overallSentiment)} ${isZh ? sentimentInfo.zh : sentimentInfo.en}
        ${!isMultiOption && hasStats ? ` ${bullishRate}%` : ''}
      </span>
      <span class="sentiment-meta">
        ${isZh ? reliabilityInfo.zh : reliabilityInfo.en}
      </span>
    </div>
  `;

  // Velocity indicator (only show if not stable and enough data)
  if (showVelocity) {
    const ratioPercent = Math.round((velocity.ratio - 1) * 100);
    const ratioText = ratioPercent >= 0 ? `+${ratioPercent}%` : `${ratioPercent}%`;
    html += `
      <div class="velocity-indicator ${velocityInfo.class}">
        <span class="velocity-emoji">${velocityInfo.emoji}</span>
        <span class="velocity-text">${isZh ? velocityInfo.zh : velocityInfo.en}</span>
        <span class="velocity-ratio">${ratioText} ${isZh ? 'vs 上周' : 'vs last week'}</span>
      </div>
    `;
  }

  // Wilson Score confidence interval visualization
  if (hasStats) {
    if (!isMultiOption) {
      // Binary event: bullish vs bearish bar
      html += `
        <div class="wilson-stats">
          <div class="wilson-header">
            <span class="wilson-label">${isZh ? '置信区间' : 'Confidence Interval'} (95% CI)</span>
            <span class="wilson-range">${wilsonLower}% - ${wilsonUpper}%</span>
          </div>
          <div class="wilson-bar">
            <div class="wilson-range-fill" style="left: ${wilsonLower}%; width: ${wilsonUpper - wilsonLower}%"></div>
            <div class="wilson-marker" style="left: ${bullishRate}%"></div>
          </div>
          <div class="wilson-labels">
            <span class="wilson-label-left">${isZh ? '看跌' : 'Bearish'}</span>
            <span class="wilson-label-center">50%</span>
            <span class="wilson-label-right">${isZh ? '看涨' : 'Bullish'}</span>
          </div>
          <div class="wilson-counts">
            📊 ${bullishRate}% ${isZh ? '看涨' : 'bullish'} · ${100 - bullishRate}% ${isZh ? '看跌' : 'bearish'}
          </div>
        </div>
      `;
    } else {
      // Multi-option event: per-option confidence intervals
      const leadGap = finiteCount(stats.leadGap);
      const consensusStrengthLabel = leadGap >= 30
        ? (isZh ? '强共识' : 'Strong')
        : leadGap >= 15
          ? (isZh ? '中等共识' : 'Moderate')
          : (isZh ? '弱共识' : 'Weak');

      html += `
        <div class="wilson-stats multi-option">
          <div class="wilson-header">
            <span class="wilson-label">${isZh ? '选项支持度' : 'Option Support'} (95% CI)</span>
            <span class="wilson-meta">${isZh ? '共识强度' : 'Consensus'}: ${consensusStrengthLabel} (${leadGap}%${isZh ? '领先' : ' lead'})</span>
          </div>
          ${renderMultiOptionWilson(data.optionMentions, stats, isZh)}
        </div>
      `;
    }
  }

  html += `
    <div class="sentiment-summary">
      <span class="summary-icon">💡</span>
      <span class="summary-text">${escapeHtml(summary)}</span>
    </div>
  `;

  // Show favored option for multi-option events with consensus
  if (isMultiOption && data.favoredOption && data.overallSentiment === 'consensus') {
    html += `
      <div class="favored-option">
        <span class="favored-icon">🏆</span>
        <span class="favored-label">${isZh ? '社区看好:' : 'Community favors:'}</span>
        <span class="favored-name">${escapeHtml(data.favoredOption)}</span>
      </div>
    `;
  }

  // Option mentions for multi-option markets (only show if Wilson stats not available)
  // If Wilson stats are shown, skip this as it would be redundant
  if (isMultiOption && !hasStats && data.optionMentions && data.optionMentions.length > 0) {
    html += `
      <div class="option-mentions">
        <div class="option-mentions-header">📈 ${isZh ? '选项热度' : 'Option Mentions'}</div>
        ${renderOptionMentions(data.optionMentions, isZh)}
      </div>
    `;
  }

  // Key arguments
  if (data.keyArguments && data.keyArguments.length > 0) {
    html += `
      <div class="key-arguments">
        <div class="key-arguments-header">🔑 ${isZh ? '关键论点' : 'Key Arguments'}</div>
        <div class="arguments-list">
          ${data.keyArguments.map(arg => {
            // Multi-option events use forOption, binary events use sentiment
            if (isMultiOption && arg.forOption) {
              return `
                <div class="argument-item">
                  <span class="argument-option">${escapeHtml(arg.forOption)}:</span>
                  <span class="argument-text">${escapeHtml(arg.point)}</span>
                  <span class="argument-count">(${finiteCount(arg.mentions)})</span>
                </div>
              `;
            }
            return `
              <div class="argument-item">
                <span class="argument-sentiment ${arg.sentiment === 'support' ? 'support' : 'oppose'}">
                  ${arg.sentiment === 'support' ? '✅' : '❌'}
                </span>
                <span class="argument-text">${escapeHtml(arg.point)}</span>
                <span class="argument-count">(${finiteCount(arg.mentions)})</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Notable comments
  if (data.notableComments && data.notableComments.length > 0) {
    html += `
      <div class="notable-comments">
        <div class="notable-comments-header">📝 ${isZh ? '精选评论' : 'Notable Comments'}</div>
        ${data.notableComments.map(comment => `
          <div class="notable-comment">
            <div class="comment-text">"${escapeHtml(comment.text.substring(0, 150))}${comment.text.length > 150 ? '...' : ''}"</div>
            <div class="comment-meta">
              <span class="comment-author">@${escapeHtml(comment.username || 'Anonymous')}</span>
              ${comment.reactionCount > 0 ? `<span class="comment-reactions">❤️ ${finiteCount(comment.reactionCount)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Footer with stats (show percentage only to avoid "only 20 comments" perception)
  const analysisPct = totalComments > 0 ? Math.round((analyzedCount / totalComments) * 100) : 0;
  html += `
    <div class="sentiment-footer">
      📊 ${isZh
        ? `基于 ${analysisPct}% 高赞评论分析`
        : `Based on top ${analysisPct}% of comments`}
    </div>
  `;

  body.innerHTML = html;
}

/**
 * Render Wilson Score confidence intervals for multi-option events
 */
function renderMultiOptionWilson(
  mentions: CommunitySentimentData['optionMentions'],
  stats: CommunitySentimentData['stats'],
  isZh: boolean
): string {
  if (!mentions || mentions.length === 0) {
    return `<div class="empty-state">${isZh ? '暂无数据' : 'No data'}</div>`;
  }

  return mentions.slice(0, 5).map((m, index) => {
    const supportPct = Math.round(m.supportRate * 100);
    const wilsonLower = m.wilsonLower !== undefined ? Math.round(m.wilsonLower * 100) : supportPct;
    const wilsonUpper = m.wilsonUpper !== undefined ? Math.round(m.wilsonUpper * 100) : supportPct;
    const isTopOption = m.option === stats.topOption;

    // Color coding: top option is green, others are gray
    const barClass = isTopOption ? 'top-option' : '';

    return `
      <div class="multi-option-wilson-item ${barClass}">
        <div class="multi-option-wilson-header">
          <span class="option-rank">${index + 1}.</span>
          <span class="option-name">${escapeHtml(m.option)}</span>
          ${isTopOption ? `<span class="top-badge">${isZh ? '领先' : 'Leading'}</span>` : ''}
          <span class="option-ci">${wilsonLower}% - ${wilsonUpper}%</span>
        </div>
        <div class="multi-option-wilson-bar">
          <div class="wilson-ci-range" style="left: ${wilsonLower}%; width: ${Math.max(wilsonUpper - wilsonLower, 2)}%"></div>
          <div class="wilson-point" style="left: ${supportPct}%"></div>
        </div>
        <div class="multi-option-wilson-labels">
          <span>0%</span>
          <span>${supportPct}%</span>
          <span>100%</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render option mentions with progress bars
 */
function renderOptionMentions(
  mentions: CommunitySentimentData['optionMentions'],
  isZh: boolean
): string {
  // Find max mentions for scaling
  const maxMentions = Math.max(...mentions.map(m => m.mentions), 1);

  return mentions.map(m => {
    const barWidth = Math.round((m.mentions / maxMentions) * 100);
    const supportPct = Math.round(m.supportRate * 100);
    // Handle both binary (bullish/bearish) and multi-option (favored/opposed) sentiment
    let sentimentClass = 'neutral';
    if (m.sentiment === 'bullish' || m.sentiment === 'favored') {
      sentimentClass = 'bullish';
    } else if (m.sentiment === 'bearish' || m.sentiment === 'opposed') {
      sentimentClass = 'bearish';
    }

    return `
      <div class="option-mention-item">
        <div class="option-mention-header">
          <span class="option-name">${escapeHtml(m.option)}</span>
          <span class="option-stats">${finiteCount(m.mentions)}${isZh ? '次' : 'x'} (${supportPct}%${isZh ? '支持' : ' support'})</span>
        </div>
        <div class="option-mention-bar">
          <div class="option-mention-fill ${sentimentClass}" style="width: ${barWidth}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Get emoji for sentiment
 */
function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case 'bullish': return '📈';
    case 'bearish': return '📉';
    case 'divided': return '⚖️';
    case 'consensus': return '🎯';
    case 'uncertain': return '❓';
    default: return '➖';
  }
}

/**
 * Render empty state
 */
function renderEmptyState(body: HTMLElement, isZh: boolean, error?: string): void {
  const message = error
    ? (isZh ? '加载失败，请稍后重试' : 'Failed to load, please try again')
    : (isZh ? '暂无社区评论数据' : 'No community comments available');

  body.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}
