/**
 * Timeline section for enhancement panel
 */

import type { MarketEvent } from '../../../utils/types';
import { sendToBackground } from '../../../utils/messaging';
import { escapeHtml, sanitizeExternalUrl } from '../../utils/dom';
import { isZhLanguage, setCachedTimelineData, getCachedTimelineData, buildTimelineCacheKey } from '../../state';

let activeTimelineRequestId = 0;

/**
 * Load and render timeline data
 */
export async function loadTimelineData(
  shadow: ShadowRoot,
  market: MarketEvent,
  period: string,
  impactFilter: string
): Promise<void> {
  const requestId = ++activeTimelineRequestId;
  const feed = shadow.getElementById('timeline-feed');
  const summaryBar = shadow.getElementById('timeline-summary');
  const isZh = isZhLanguage();

  if (!feed) {
    console.error('[Timeline] Feed container not found in shadow DOM');
    return;
  }

  console.log('[Timeline] Loading data:', { conditionId: market.conditionId, title: market.title, period, impactFilter });

  // Show loading state
  feed.innerHTML = `<div class="loading" style="padding: 40px 20px;"><div class="spinner"></div><span>${isZh ? '加载事件数据...' : 'Loading events...'}</span></div>`;
  if (summaryBar) {
    summaryBar.innerHTML = `<div class="loading"><div class="spinner"></div><span>${isZh ? '分析中...' : 'Analyzing...'}</span></div>`;
  }

  try {
    const marketId = market.conditionId || market.id;
    const cacheKey = buildTimelineCacheKey(marketId, period, impactFilter);
    const cached = getCachedTimelineData(cacheKey);
    if (cached) {
      if (requestId !== activeTimelineRequestId) return;
      renderTimelineSummary(summaryBar, cached.data, isZh);
      renderTimelineFeed(feed, cached.data.events || [], isZh);
      return;
    }

    const response = await sendToBackground('GET_TIMELINE_DATA', {
      conditionId: market.conditionId,
      title: market.title,
      period,
      impactFilter
    });

    const timeline = response?.data;
    if (requestId !== activeTimelineRequestId) return;

    // Update global cache
    if (timeline && timeline.capabilities?.events !== 'unavailable' && (timeline.priceData || timeline.events)) {
      setCachedTimelineData(cacheKey, timeline);
      console.log('[Timeline] Updated global timeline cache');
    }

    if (!timeline || (!timeline.priceData && !timeline.events)) {
      console.warn('[Timeline] No timeline data available');
      feed.innerHTML = `<div class="empty-state">${isZh ? '时间线数据加载失败' : 'Failed to load timeline'}</div>`;
      if (summaryBar) summaryBar.innerHTML = '';
      return;
    }

    // Render summary bar
    renderTimelineSummary(summaryBar, timeline, isZh);

    // Render event feed
    if (timeline.capabilities?.events === 'unavailable') {
      if (summaryBar) summaryBar.innerHTML = '';
      feed.innerHTML = `<div class="empty-state">${isZh ? '事件源暂不可用' : 'Event source unavailable'}</div>`;
    } else renderTimelineFeed(feed, timeline.events || [], isZh);
  } catch (error) {
    if (requestId !== activeTimelineRequestId) return;
    console.error('[Timeline] Load error:', error);
    feed.innerHTML = `<div class="empty-state">${isZh ? '加载失败' : 'Failed to load'}</div>`;
  }
}

function renderTimelineSummary(
  container: HTMLElement | null,
  timeline: any,
  isZh: boolean
): void {
  if (!container) return;

  const s = timeline.summary || {};

  container.innerHTML = `
    <span class="timeline-summary-stat">📰 ${escapeHtml(String(s.totalEvents ?? 0))} ${isZh ? '事件' : 'events'}</span>
  `;
}

function renderTimelineFeed(
  container: HTMLElement,
  events: any[],
  isZh: boolean
): void {
  if (!events || events.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding: 30px;">${isZh ? '该时间段内暂无事件' : 'No events in this period'}</div>`;
    return;
  }

  let html = '<div class="timeline-axis">';
  let lastDateStr = '';

  events.forEach((event: any) => {
    const date = new Date(event.timestamp * 1000);
    const dateStr = date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(isZh ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Time group header
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      html += `<div class="timeline-time-marker">${dateStr}</div>`;
    }

    // Card type classes
    const isAnomaly = event.type === 'market_anomaly' || event.type === 'volume_surge';
    const anomalyClass = isAnomaly ? 'anomaly' : '';

    const icon = event.source?.icon || (isAnomaly ? '📊' : '📰');

    // Source URL for detail
    const safeSourceUrl = sanitizeExternalUrl(event.sourceUrl);
    const sourceLink = safeSourceUrl
      ? `<a href="${safeSourceUrl}" target="_blank" rel="noopener noreferrer">${isZh ? '查看原文' : 'View source'} ↗</a>`
      : '';

    html += `
      <div class="timeline-card ${anomalyClass}" data-event-id="${escapeHtml(String(event.id))}">
        <div class="timeline-card-header">
          <span class="timeline-card-icon">${escapeHtml(String(icon))}</span>
          <span class="timeline-card-source">${escapeHtml(event.source?.name || '')}</span>
          <span class="timeline-card-time">${timeStr}</span>
        </div>
        <div class="timeline-card-title">${escapeHtml(event.title)}</div>
        <div class="timeline-card-detail">
          <p>${escapeHtml(event.summary || '')}</p>
          ${sourceLink ? `<p style="margin-top:4px;">${sourceLink}</p>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Bind card expand/collapse
  container.querySelectorAll('.timeline-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'A') return;
      card.classList.toggle('expanded');
    });
  });
}
