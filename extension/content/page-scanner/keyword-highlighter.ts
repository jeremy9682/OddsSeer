/**
 * Keyword Highlighter
 * Highlights keywords in page content and shows related markets on hover
 */

import type { MarketEvent } from '../../utils/types';
import { escapeHtml, sanitizeExternalUrl } from '../utils/dom';
import { isZhLanguage } from '../state';
import { getKeywordPopupStyles } from './styles';

// Keyword to markets mapping
let keywordMarketsMap: Map<string, MarketEvent[]> = new Map();
// Highlighted elements
let highlightedElements: HTMLElement[] = [];
// Current hover popup
let currentHoverPopup: HTMLElement | null = null;
// Hide popup timeout
let hidePopupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Highlight detected keywords in page
 * Uses backend-returned markets for each event
 */
export function highlightKeywordsInPage(
  detectedEvents: any[],
  markets: MarketEvent[]
): void {
  // Clear previous highlights
  clearKeywordHighlights();

  if (!detectedEvents || detectedEvents.length === 0) {
    console.log('[OddsSeer] No detectedEvents to highlight');
    return;
  }

  console.log('[OddsSeer] detectedEvents:', detectedEvents.length, 'events');

  // Build keyword to markets mapping
  keywordMarketsMap.clear();

  // Iterate each detected event
  for (const event of detectedEvents) {
    const keywords: string[] = event.keywords || event.query_keywords || [];
    const query = event.query || event.query_en || '';

    // Get event's markets
    let eventMarkets: MarketEvent[] = [];

    if (event.markets && event.markets.length > 0) {
      // New format: backend already returned markets for each event
      eventMarkets = event.markets;
      console.log('[OddsSeer] Event has', eventMarkets.length, 'markets for query:', query);
    } else {
      // Old format/fallback: match from merged markets list
      eventMarkets = markets.filter(m => {
        const titleLower = m.title.toLowerCase();
        return keywords.some((kw: string) =>
          kw.length >= 3 && titleLower.includes(kw.toLowerCase())
        );
      });
    }

    // Skip if no matching markets
    if (eventMarkets.length === 0) {
      console.log('[OddsSeer] No markets for event:', query);
      continue;
    }

    // Associate each keyword with markets
    keywords.forEach((kw: string) => {
      if (kw && kw.length >= 3) {
        const kwLower = kw.toLowerCase();
        if (!keywordMarketsMap.has(kwLower)) {
          keywordMarketsMap.set(kwLower, eventMarkets);
        }
      }
    });

    // Also add query mapping
    if (query && query.length >= 3 && query.length <= 50) {
      const queryLower = query.toLowerCase();
      if (!keywordMarketsMap.has(queryLower)) {
        keywordMarketsMap.set(queryLower, eventMarkets);
      }
    }
  }

  console.log('[OddsSeer] keywordMarketsMap size:', keywordMarketsMap.size);

  // Only highlight keywords with matching markets
  const keywordsWithMarkets = Array.from(keywordMarketsMap.keys());
  if (keywordsWithMarkets.length === 0) {
    console.log('[OddsSeer] No keywords have matching markets');
    return;
  }

  // Find and highlight keywords in page
  highlightTextNodes(document.body, keywordsWithMarkets);

  console.log(`[OddsSeer] Highlighted ${highlightedElements.length} keyword instances`);
}

/**
 * Find and highlight keywords in text nodes
 */
function highlightTextNodes(root: Node, keywords: string[]): void {
  console.log('[OddsSeer] highlightTextNodes called with', keywords.length, 'keywords');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      const tagName = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'textarea', 'input', 'svg', 'path'].includes(tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip our own elements
      if (parent.closest('[id^="oddsseer"]')) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip already highlighted
      if (parent.classList.contains('oddsseer-keyword')) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip hidden elements
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodesToProcess: { node: Text; matches: { keyword: string; start: number; end: number }[] }[] = [];

  let node: Text | null;
  let nodeCount = 0;
  while ((node = walker.nextNode() as Text)) {
    nodeCount++;
    const text = node.textContent || '';
    const textLower = text.toLowerCase();
    if (text.trim().length < 3) continue;

    const matches: { keyword: string; start: number; end: number }[] = [];

    for (const keyword of keywords) {
      if (keyword.length < 3) continue;

      let searchPos = 0;
      let foundIndex: number;

      while ((foundIndex = textLower.indexOf(keyword, searchPos)) !== -1) {
        matches.push({
          keyword: keyword,
          start: foundIndex,
          end: foundIndex + keyword.length
        });
        searchPos = foundIndex + 1;

        // Limit matches per node
        if (matches.length >= 10) break;
      }
    }

    if (matches.length > 0) {
      // Sort by position and deduplicate overlaps
      matches.sort((a, b) => a.start - b.start);
      const deduped = deduplicateMatches(matches);
      if (deduped.length > 0) {
        nodesToProcess.push({ node, matches: deduped });
      }
    }
  }

  console.log('[OddsSeer] Scanned', nodeCount, 'text nodes, found', nodesToProcess.length, 'with matches');

  // Limit processing to avoid performance issues
  const maxHighlights = 50;
  let count = 0;

  for (const { node, matches } of nodesToProcess) {
    if (count >= maxHighlights) break;

    try {
      highlightMatches(node, matches);
      count += matches.length;
    } catch (e) {
      console.warn('[OddsSeer] Error highlighting:', e);
    }
  }
}

/**
 * Remove overlapping matches
 */
function deduplicateMatches(
  matches: { keyword: string; start: number; end: number }[]
): typeof matches {
  const result: typeof matches = [];
  let lastEnd = -1;

  for (const match of matches) {
    if (match.start >= lastEnd) {
      result.push(match);
      lastEnd = match.end;
    }
  }

  return result;
}

/**
 * Create highlights in text node
 */
function highlightMatches(
  textNode: Text,
  matches: { keyword: string; start: number; end: number }[]
): void {
  const text = textNode.textContent || '';
  const parent = textNode.parentNode;
  if (!parent) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before match
    if (match.start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
    }

    // Create highlight element
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'oddsseer-keyword';
    highlightSpan.textContent = text.slice(match.start, match.end);
    highlightSpan.dataset.keyword = match.keyword;
    highlightSpan.style.cssText = `
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(124, 58, 237, 0.15));
      border-bottom: 2px solid #4F46E5;
      padding: 1px 2px;
      border-radius: 3px;
      cursor: pointer;
      transition: background 0.15s;
    `;

    // Bind hover events
    highlightSpan.addEventListener('mouseenter', (e) => showKeywordPopup(e, match.keyword));
    highlightSpan.addEventListener('mouseleave', () => hideKeywordPopupDelayed());
    highlightSpan.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showKeywordPopup(e, match.keyword, true);
    });

    fragment.appendChild(highlightSpan);
    highlightedElements.push(highlightSpan);

    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // Replace original text node
  parent.replaceChild(fragment, textNode);
}

/**
 * Show keyword hover popup
 */
function showKeywordPopup(
  event: MouseEvent,
  keyword: string,
  sticky = false
): void {
  // Clear delayed hide
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = null;
  }

  // Get associated markets
  const markets = keywordMarketsMap.get(keyword.toLowerCase()) || [];
  if (markets.length === 0) return;

  // Hide previous popup
  hideKeywordPopup();

  const isZh = isZhLanguage();

  // Create popup
  const host = document.createElement('div');
  host.id = 'oddsseer-keyword-popup';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = getKeywordPopupStyles();
  shadow.appendChild(style);

  // Calculate popup position
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  let x = rect.left;
  let y = rect.bottom + 8;

  // Ensure within screen
  if (x + 320 > window.innerWidth) {
    x = window.innerWidth - 330;
  }
  if (y + 350 > window.innerHeight) {
    y = rect.top - 358;
  }
  if (y < 10) y = 10;
  if (x < 10) x = 10;

  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;

  // Build markets list
  const marketsHtml = markets.slice(0, 5).map((market, index) => `
    <div class="market-item" data-index="${index}">
      <div class="market-title">${escapeHtml(market.title)}</div>
      <div class="market-meta">
        <span class="source-badge source-${escapeHtml(String(market.source))}">${market.source === 'polymarket' ? 'PM' : 'KS'}</span>
        <span class="price-badge price-yes">Yes ${market.yesPrice != null ? Math.round(market.yesPrice * 100) + '%' : '--'}</span>
        <span class="price-badge price-no">No ${market.noPrice != null ? Math.round(market.noPrice * 100) + '%' : '--'}</span>
      </div>
    </div>
  `).join('');

  popup.innerHTML = `
    <div class="header">
      <div class="header-left">
        <span>🔮</span>
        <span class="keyword-badge" title="${escapeHtml(keyword)}">${escapeHtml(keyword)}</span>
      </div>
      <button class="close-btn">✕</button>
    </div>
    <div class="markets-list">
      ${marketsHtml}
    </div>
  `;

  // Bind events
  popup.querySelector('.close-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideKeywordPopup();
  });

  popup.querySelectorAll('.market-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      const market = markets[index];
      if (market.url) {
        const url = sanitizeExternalUrl(market.url);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  });

  // Don't hide when mouse on popup
  popup.addEventListener('mouseenter', () => {
    if (hidePopupTimeout) {
      clearTimeout(hidePopupTimeout);
      hidePopupTimeout = null;
    }
  });

  popup.addEventListener('mouseleave', () => {
    if (!sticky) {
      hideKeywordPopupDelayed();
    }
  });

  shadow.appendChild(popup);
  document.body.appendChild(host);
  currentHoverPopup = host;
}

/**
 * Delayed hide popup
 */
function hideKeywordPopupDelayed(): void {
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
  }
  hidePopupTimeout = setTimeout(() => {
    hideKeywordPopup();
  }, 200);
}

/**
 * Hide keyword popup
 */
export function hideKeywordPopup(): void {
  if (currentHoverPopup) {
    currentHoverPopup.remove();
    currentHoverPopup = null;
  }
}

/**
 * Clear all keyword highlights
 */
export function clearKeywordHighlights(): void {
  // Remove highlight elements, restore original text
  for (const element of highlightedElements) {
    if (element.parentNode) {
      const textNode = document.createTextNode(element.textContent || '');
      element.parentNode.replaceChild(textNode, element);
    }
  }
  highlightedElements = [];
  keywordMarketsMap.clear();
  hideKeywordPopup();
}
