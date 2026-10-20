/**
 * Chart News Overlay Module
 * Injects news markers and tooltips on the native Polymarket chart
 */

import type { MarketEvent } from '../../utils/types';
import { sendToBackground } from '../../utils/messaging';
import { escapeHtml } from '../utils/dom';
import {
  isZhLanguage,
  getCachedTimelineData,
  setCachedTimelineData,
  isTimelineCacheValid,
  buildTimelineCacheKey
} from '../state';

// Module state
let chartNewsEvents: any[] = [];
let chartNewsPriceData: any[] = [];
let chartNewsTooltipEl: HTMLElement | null = null;
let chartNewsCleanup: (() => void) | null = null;

/**
 * Inject news overlay on the native chart
 */
export function injectChartNewsOverlay(
  shadow: ShadowRoot,
  market: MarketEvent
): void {
  let chartElement: SVGSVGElement | HTMLCanvasElement | null = null;
  let chartContainer: HTMLElement | null = null;

  // Find SVG chart
  const allSvgs = document.querySelectorAll('svg');
  console.log('[ChartNews] Found', allSvgs.length, 'SVG elements on page');

  const chartSvgCandidates: Array<{ svg: SVGSVGElement; rect: DOMRect; score: number }> = [];

  for (const svg of allSvgs) {
    const rect = svg.getBoundingClientRect();
    // Debug: log larger SVGs that might be charts
    if (rect.width > 200 && rect.height > 50) {
      console.log('[ChartNews] SVG candidate:', {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        viewBox: svg.getAttribute('viewBox'),
        passesFilter: rect.width >= 400 && rect.height >= 100 && rect.height <= 500 && !svg.getAttribute('viewBox')
      });
    }
    if (rect.width < 400 || rect.height < 100 || rect.height > 500) continue;
    if (svg.getAttribute('viewBox')) continue;

    let score = 0;
    score += Math.min(rect.width / 100, 10);
    if (rect.height >= 150 && rect.height <= 350) score += 5;
    if (rect.top > 200) score += 3;

    chartSvgCandidates.push({ svg, rect, score });
  }

  if (chartSvgCandidates.length > 0) {
    chartSvgCandidates.sort((a, b) => b.score - a.score);
    const best = chartSvgCandidates[0];
    chartElement = best.svg;

    let parent = best.svg.parentElement;
    for (let depth = 0; depth < 5 && parent; depth++) {
      if (parent.tagName === 'DIV') {
        const parentRect = parent.getBoundingClientRect();
        if (parentRect.height >= best.rect.height && parentRect.height < best.rect.height + 200) {
          chartContainer = parent;
          break;
        }
      }
      parent = parent.parentElement;
    }

    if (!chartContainer && best.svg.parentElement) {
      chartContainer = best.svg.parentElement as HTMLElement;
    }
  }

  // Fallback to canvas
  if (!chartElement) {
    const allCanvases = document.querySelectorAll('canvas');
    for (const canvas of allCanvases) {
      const rect = canvas.getBoundingClientRect();
      if ((canvas.width > 300 && canvas.height > 150) || (rect.width > 300 && rect.height > 150)) {
        let parent = canvas.parentElement;
        for (let depth = 0; depth < 3 && parent; depth++) {
          if (parent.tagName === 'DIV' && parent.offsetHeight > 150) {
            chartElement = canvas;
            chartContainer = parent;
            break;
          }
          parent = parent.parentElement;
        }
        if (chartContainer) break;
      }
    }
  }

  if (!chartContainer || !chartElement) {
    console.warn('[ChartNews] No suitable chart found');
    return;
  }

  const chartCanvas = chartElement;

  if (chartContainer.dataset.newsOverlay === 'true') {
    console.log('[ChartNews] Overlay already injected, skipping');
    return;
  }
  chartContainer.dataset.newsOverlay = 'true';

  console.log('[ChartNews] Injecting news overlay on native chart');

  // Create tooltip
  const tooltip = createTooltip();
  document.body.appendChild(tooltip);
  chartNewsTooltipEl = tooltip;

  const isZh = isZhLanguage();

  // Create markers container
  const canvasParent = chartCanvas.parentElement;
  if (!canvasParent) {
    console.warn('[ChartNews] Chart element has no parent element');
    return;
  }

  const isSvgChart = chartCanvas.tagName.toLowerCase() === 'svg';
  const canvasRect = chartCanvas.getBoundingClientRect();

  const parentStyle = window.getComputedStyle(canvasParent);
  if (parentStyle.position === 'static') {
    canvasParent.style.position = 'relative';
  }

  const markersContainer = document.createElement('div');
  markersContainer.className = 'chart-news-markers';

  const parentRect = canvasParent.getBoundingClientRect();
  const relativeLeft = canvasRect.left - parentRect.left;
  const relativeTop = canvasRect.top - parentRect.top;

  markersContainer.style.cssText = `
    position: absolute;
    top: ${relativeTop}px;
    left: ${relativeLeft}px;
    width: ${canvasRect.width}px;
    height: ${canvasRect.height}px;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
  `;
  canvasParent.appendChild(markersContainer);

  // Time axis parsing
  let cachedTimePoints: Array<{ x: number; timestamp: number }> | null = null;
  let cacheTimestamp = 0;
  const CACHE_TTL = 2000;

  const monthMap: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  // Pattern for "Jan 15", "February 23", etc.
  const datePattern = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{1,2}))?(?:,?\s+\d{1,2}:\d{2}(?:\s*[ap]m)?)?$/i;
  // Pattern for "1/15", "01/15", "1-15", "01-15" (numeric month/day)
  const numericDatePattern = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/;
  // Pattern for "15 Jan", "23 Feb" (day first)
  const dayFirstPattern = /^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)$/i;
  // Pattern for "Dec 2024", "Apr 2025" (Kalshi format: month + year)
  const monthYearPattern = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})$/i;
  const currentYear = new Date().getFullYear();

  function parseTimeAxisLabels(): Array<{ x: number; timestamp: number }> {
    const now = Date.now();
    if (cachedTimePoints && (now - cacheTimestamp) < CACHE_TTL) {
      return cachedTimePoints;
    }

    const points: Array<{ x: number; timestamp: number }> = [];
    const debugTexts: string[] = [];

    document.querySelectorAll('text').forEach(el => {
      const text = el.textContent?.trim();
      if (!text || text.length > 30) return;

      let month: number | undefined;
      let day: number = 1;
      let year: number = currentYear;

      // Try pattern 1: "Jan 15", "February 23"
      const match = text.match(datePattern);
      if (match) {
        const monthStr = match[1].toLowerCase().substring(0, 3);
        day = match[2] ? parseInt(match[2], 10) : 1;
        month = monthMap[monthStr];
      }

      // Try pattern 2: "1/15", "01/15", "1-15" (numeric)
      if (month === undefined) {
        const numMatch = text.match(numericDatePattern);
        if (numMatch) {
          month = parseInt(numMatch[1], 10) - 1; // 0-indexed
          day = parseInt(numMatch[2], 10);
          if (numMatch[3]) {
            year = parseInt(numMatch[3], 10);
            if (year < 100) year += 2000;
          }
        }
      }

      // Try pattern 3: "15 Jan", "23 Feb" (day first)
      if (month === undefined) {
        const dayFirstMatch = text.match(dayFirstPattern);
        if (dayFirstMatch) {
          day = parseInt(dayFirstMatch[1], 10);
          const monthStr = dayFirstMatch[2].toLowerCase().substring(0, 3);
          month = monthMap[monthStr];
        }
      }

      // Try pattern 4: "Dec 2024", "Apr 2025" (Kalshi month + year format)
      if (month === undefined) {
        const monthYearMatch = text.match(monthYearPattern);
        if (monthYearMatch) {
          const monthStr = monthYearMatch[1].toLowerCase().substring(0, 3);
          month = monthMap[monthStr];
          year = parseInt(monthYearMatch[2], 10);
          day = 15; // Use middle of month for month-only labels
        }
      }

      // Collect debug texts
      if (debugTexts.length < 20 && text.length >= 2 && text.length <= 15) {
        debugTexts.push(text);
      }

      if (month !== undefined && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const bbox = el.getBoundingClientRect();
        if (bbox.width === 0 || bbox.height === 0) return;
        if (bbox.left < 0 || bbox.top < 0) return;

        const x = bbox.left + bbox.width / 2;

        // Adjust year if month is in the future
        const nowMonth = new Date().getMonth();
        if (month > nowMonth + 2 && year === currentYear) {
          year = currentYear - 1;
        }
        const date = new Date(year, month, day, 12, 0, 0);
        const timestamp = Math.floor(date.getTime() / 1000);

        points.push({ x, timestamp });
      }
    });

    points.sort((a, b) => a.x - b.x);

    if (points.length >= 2) {
      cachedTimePoints = points;
      cacheTimestamp = now;
      console.log('[ChartNews] Parsed', points.length, 'time axis labels');
    } else {
      console.log('[ChartNews] Could not parse time axis. Found texts:', debugTexts.slice(0, 10).join(', '));
    }

    return points;
  }

  function invalidateTimeRangeCache() {
    cachedTimePoints = null;
    cacheTimestamp = 0;
  }

  // Listen for time period changes
  // Support various formats: "1H", "1h", "1 H", "1M", "1m", "1W", "1w", "ALL", "All", "Max", etc.
  const timePeriodPattern = /^(1[hdwmHDWM]|6[hH]|1\s*[hdwmHDWM]|all|max|ytd)$/i;
  let boundButtons = 0;
  document.querySelectorAll('button').forEach(btn => {
    const text = btn.textContent?.trim();
    if (text && timePeriodPattern.test(text)) {
      boundButtons++;
      btn.addEventListener('click', () => {
        console.log('[ChartNews] Time period button clicked:', text);
        setTimeout(() => {
          invalidateTimeRangeCache();
          setTimeout(renderNewsMarkers, 300);
        }, 500);
      }, { passive: true });
    }
  });
  console.log('[ChartNews] Bound', boundButtons, 'time period buttons');

  // Track time axis labels to detect real chart changes (not mouse interactions)
  let lastTimeAxisSignature = '';
  let chartUpdateTimeout: any = null;

  function getTimeAxisSignature(): string {
    // Create a signature from time axis text labels
    const texts: string[] = [];
    document.querySelectorAll('text').forEach(el => {
      const text = el.textContent?.trim();
      if (text && (monthYearPattern.test(text) || datePattern.test(text))) {
        texts.push(text);
      }
    });
    return texts.sort().join('|');
  }

  // Initialize signature
  lastTimeAxisSignature = getTimeAxisSignature();

  // Use MutationObserver to detect chart changes, but only respond to real data changes
  const chartObserver = new MutationObserver(() => {
    // Debounce and check if time axis actually changed
    if (chartUpdateTimeout) clearTimeout(chartUpdateTimeout);
    chartUpdateTimeout = setTimeout(() => {
      const newSignature = getTimeAxisSignature();
      if (newSignature !== lastTimeAxisSignature) {
        console.log('[ChartNews] Time axis changed, re-rendering markers');
        lastTimeAxisSignature = newSignature;
        invalidateTimeRangeCache();
        renderNewsMarkers();
      }
    }, 300);
  });

  // Observe the chart container for changes (only childList, not attributes to avoid mouse interactions)
  if (chartContainer) {
    chartObserver.observe(chartContainer, {
      childList: true,
      subtree: true,
      attributes: false // Don't watch attributes - they change on mouse move
    });
  }

  function xToTimestamp(mouseX: number): number | null {
    const points = parseTimeAxisLabels();
    if (points.length < 2) return null;

    if (mouseX <= points[0].x) {
      const dx = points[1].x - points[0].x;
      const dt = points[1].timestamp - points[0].timestamp;
      const ratio = (mouseX - points[0].x) / dx;
      return points[0].timestamp + ratio * dt;
    }

    const last = points.length - 1;
    if (mouseX >= points[last].x) {
      const dx = points[last].x - points[last - 1].x;
      const dt = points[last].timestamp - points[last - 1].timestamp;
      const ratio = (mouseX - points[last].x) / dx;
      return points[last].timestamp + ratio * dt;
    }

    for (let i = 0; i < points.length - 1; i++) {
      if (mouseX >= points[i].x && mouseX <= points[i + 1].x) {
        const dx = points[i + 1].x - points[i].x;
        const dt = points[i + 1].timestamp - points[i].timestamp;
        const ratio = (mouseX - points[i].x) / dx;
        return points[i].timestamp + ratio * dt;
      }
    }

    return null;
  }

  function timestampToX(timestamp: number): number | null {
    const points = parseTimeAxisLabels();
    if (points.length < 2) return null;
    if (!chartCanvas || !document.body.contains(chartCanvas)) return null;

    const canvasRect = chartCanvas.getBoundingClientRect();

    if (timestamp <= points[0].timestamp) {
      const dx = points[1].x - points[0].x;
      const dt = points[1].timestamp - points[0].timestamp;
      const ratio = (timestamp - points[0].timestamp) / dt;
      const screenX = points[0].x + ratio * dx;
      return screenX - canvasRect.left;
    }

    const last = points.length - 1;
    if (timestamp >= points[last].timestamp) {
      const dx = points[last].x - points[last - 1].x;
      const dt = points[last].timestamp - points[last - 1].timestamp;
      const ratio = (timestamp - points[last].timestamp) / dt;
      const screenX = points[last].x + ratio * dx;
      return screenX - canvasRect.left;
    }

    for (let i = 0; i < points.length - 1; i++) {
      if (timestamp >= points[i].timestamp && timestamp <= points[i + 1].timestamp) {
        const dx = points[i + 1].x - points[i].x;
        const dt = points[i + 1].timestamp - points[i].timestamp;
        const ratio = (timestamp - points[i].timestamp) / dt;
        const screenX = points[i].x + ratio * dx;
        return screenX - canvasRect.left;
      }
    }

    return null;
  }

  function renderNewsMarkers() {
    markersContainer.innerHTML = '';

    console.log('[ChartNews] renderNewsMarkers called, events:', chartNewsEvents.length);

    if (chartNewsEvents.length === 0) {
      console.log('[ChartNews] No events to render');
      return;
    }
    if (!chartCanvas || !chartCanvas.parentElement || !document.body.contains(chartCanvas)) {
      console.log('[ChartNews] Chart canvas not available');
      return;
    }

    const canvasRect = chartCanvas.getBoundingClientRect();
    const parentRect = chartCanvas.parentElement.getBoundingClientRect();
    const relativeLeft = canvasRect.left - parentRect.left;
    const relativeTop = canvasRect.top - parentRect.top;
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;

    markersContainer.style.top = `${relativeTop}px`;
    markersContainer.style.left = `${relativeLeft}px`;
    markersContainer.style.width = `${canvasWidth}px`;
    markersContainer.style.height = `${canvasHeight}px`;

    // Check if we can parse time axis
    const timePoints = parseTimeAxisLabels();
    if (timePoints.length < 2) {
      console.log('[ChartNews] Cannot render markers: insufficient time axis points');
      return;
    }

    // Group events by day
    const eventsByDay = new Map<string, any[]>();
    chartNewsEvents.forEach(event => {
      if (!event.timestamp) return;
      const dayKey = new Date(event.timestamp * 1000).toDateString();
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, []);
      }
      eventsByDay.get(dayKey)!.push(event);
    });

    console.log('[ChartNews] Events grouped into', eventsByDay.size, 'days');

    let markersRendered = 0;
    let markersSkipped = 0;

    eventsByDay.forEach((events, dayKey) => {
      const avgTimestamp = Math.round(events.reduce((sum, e) => sum + e.timestamp, 0) / events.length);
      const x = timestampToX(avgTimestamp);

      if (x === null) {
        markersSkipped++;
        return;
      }
      if (x < 0 || x > canvasWidth) {
        markersSkipped++;
        return;
      }

      // Dashed line (neutral color for all events)
      const line = document.createElement('div');
      line.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: 24px;
        width: 1px;
        height: ${canvasHeight - 48}px;
        background: repeating-linear-gradient(
          to bottom,
          #6366f1 0px,
          #6366f1 4px,
          transparent 4px,
          transparent 8px
        );
        opacity: 0.5;
        pointer-events: none;
      `;
      markersContainer.appendChild(line);

      // Icon marker
      const icon = document.createElement('div');
      icon.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: 4px;
        transform: translateX(-50%);
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #6366f1;
        color: white;
        font-size: 9px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        pointer-events: auto;
        cursor: pointer;
        transition: transform 0.15s;
      `;
      icon.textContent = events.length > 1 ? String(events.length) : '📰';
      icon.title = `${events.length} ${isZh ? '条新闻' : 'news'} - ${dayKey}`;

      icon.addEventListener('mouseenter', () => {
        icon.style.transform = 'translateX(-50%) scale(1.2)';
      });
      icon.addEventListener('mouseleave', () => {
        icon.style.transform = 'translateX(-50%)';
      });

      markersContainer.appendChild(icon);
      markersRendered++;
    });

    console.log('[ChartNews] Rendered', markersRendered, 'news markers, skipped', markersSkipped);
  }

  function findNearbyEvents(timestamp: number, windowHours: number = 12): any[] {
    const windowSec = windowHours * 3600;
    return chartNewsEvents.filter(e => {
      if (!e.timestamp) return false;
      return Math.abs(e.timestamp - timestamp) <= windowSec;
    }).sort((a, b) => {
      return Math.abs(a.timestamp - timestamp) - Math.abs(b.timestamp - timestamp);
    }).slice(0, 5);
  }

  function renderTooltipContent(events: any[], timestamp: number) {
    const date = new Date(timestamp * 1000);
    const dateStr = date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString(isZh ? 'zh-CN' : 'en-US', {
      hour: '2-digit', minute: '2-digit'
    });

    let html = `
      <div style="padding:8px 12px;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;font-size:11px;font-weight:600;display:flex;align-items:center;gap:6px;">
        <span>📰</span>
        <span>${dateStr} ${timeStr}</span>
        <span style="margin-left:auto;opacity:0.7;font-size:10px;">${events.length} ${isZh ? '条' : ''}</span>
      </div>
      <div style="padding:8px 12px;max-height:200px;overflow-y:auto;">
    `;

    if (events.length === 0) {
      html += `<div style="padding:8px 0;font-size:11px;color:#94a3b8;text-align:center;">${isZh ? '该时间段暂无相关新闻' : 'No news for this period'}</div>`;
    } else {
      events.forEach(event => {
        const icon = event.source?.icon || '📰';
        const source = event.source?.name || 'News';
        const evtDate = new Date(event.timestamp * 1000);
        const evtTime = evtDate.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });

        html += `
          <div style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:11px;font-weight:500;color:#1e293b;line-height:1.4;margin-bottom:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${escapeHtml(String(icon))} ${escapeHtml(event.title)}
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#94a3b8;">
              <span>${escapeHtml(String(source))}</span>
              <span>•</span>
              <span>${evtTime}</span>
            </div>
          </div>
        `;
      });
    }

    html += '</div>';
    tooltip.innerHTML = html;
  }

  // Mouse event handlers
  let moveTimer: any = null;
  let lastTooltipTs = 0;

  function onMouseMove(e: MouseEvent) {
    if (moveTimer) clearTimeout(moveTimer);

    moveTimer = setTimeout(() => {
      const timestamp = xToTimestamp(e.clientX);
      if (!timestamp || chartNewsEvents.length === 0) {
        tooltip.style.opacity = '0';
        return;
      }

      const roundedTs = Math.round(timestamp / 3600) * 3600;
      if (roundedTs === lastTooltipTs) {
        positionTooltip(e);
        return;
      }
      lastTooltipTs = roundedTs;

      const nearby = findNearbyEvents(timestamp);

      // Only show tooltip if there are nearby events
      if (nearby.length === 0) {
        tooltip.style.opacity = '0';
        return;
      }

      renderTooltipContent(nearby, timestamp);
      positionTooltip(e);
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    }, 50);
  }

  function positionTooltip(e: MouseEvent) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipW = tooltipRect.width || 280;
    const tooltipH = tooltipRect.height || 150;

    let left = e.clientX + 16;
    let top = e.clientY - tooltipH - 10;

    if (left + tooltipW > window.innerWidth - 10) {
      left = e.clientX - tooltipW - 16;
    }
    if (top < 10) {
      top = e.clientY + 20;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function onMouseLeave() {
    if (moveTimer) clearTimeout(moveTimer);
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px)';
    lastTooltipTs = 0;
  }

  chartContainer.addEventListener('mousemove', onMouseMove, { passive: true });
  chartContainer.addEventListener('mouseleave', onMouseLeave, { passive: true });

  console.log('[ChartNews] Event listeners attached to chart container');

  // Save cleanup function
  chartNewsCleanup = () => {
    chartContainer!.removeEventListener('mousemove', onMouseMove);
    chartContainer!.removeEventListener('mouseleave', onMouseLeave);
    chartObserver.disconnect();
    if (chartUpdateTimeout) clearTimeout(chartUpdateTimeout);
    tooltip.remove();
    markersContainer.remove();
    if (moveTimer) clearTimeout(moveTimer);
    chartContainer!.dataset.newsOverlay = '';
    chartNewsTooltipEl = null;
  };

  // Load data
  loadChartNewsData(market).then(() => {
    setTimeout(renderNewsMarkers, 500);
  });

  console.log('[ChartNews] Overlay injected successfully');
}

function createTooltip(): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-news-tooltip';
  tooltip.style.cssText = `
    position: fixed; z-index: 999999; pointer-events: none;
    max-width: 280px; background: white; border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden; opacity: 0; transform: translateY(4px);
    transition: opacity 0.15s, transform 0.15s;
  `;
  return tooltip;
}

async function loadChartNewsData(market: MarketEvent): Promise<void> {
  const marketId = market.conditionId || market.id;
  const cacheKey = buildTimelineCacheKey(marketId, '30d', 'all');

  try {
    if (isTimelineCacheValid(cacheKey)) {
      const cached = getCachedTimelineData(cacheKey);
      if (cached) {
        chartNewsEvents = cached.data.events || [];
        chartNewsPriceData = cached.data.priceData || [];
        console.log('[ChartNews] Using cached timeline data:', {
          events: chartNewsEvents.length,
          pricePoints: chartNewsPriceData.length,
          dataKeys: Object.keys(cached.data)
        });
        return;
      }
    }

    console.log('[ChartNews] Loading timeline data for chart overlay...');

    const response = await sendToBackground('GET_TIMELINE_DATA', {
      conditionId: market.conditionId,
      title: market.title,
      period: '30d',
      impactFilter: 'all'
    });

    const timeline = response?.data;
    if (timeline) {
      setCachedTimelineData(cacheKey, timeline);

      chartNewsEvents = timeline.events || [];
      chartNewsPriceData = timeline.priceData || [];
      console.log('[ChartNews] Data loaded successfully:', {
        events: chartNewsEvents.length,
        pricePoints: chartNewsPriceData.length
      });
    }
  } catch (err) {
    console.error('[ChartNews] Failed to load data:', err);
  }
}

/**
 * Cleanup chart overlay
 */
export function cleanupChartOverlay(): void {
  if (chartNewsCleanup) {
    chartNewsCleanup();
    chartNewsCleanup = null;
  }
  chartNewsEvents = [];
  chartNewsPriceData = [];
}
