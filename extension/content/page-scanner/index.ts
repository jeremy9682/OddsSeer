/**
 * Page Scanner Module
 * Scans page content for prediction market events
 *
 * New flow:
 * 1. Extract visible text from viewport
 * 2. Send to backend for semantic search (one API call)
 * 3. For each returned market, locate corresponding DOM element
 * 4. Add market icon next to the element
 */

import type { MarketEvent } from '../../utils/types';
import { sendToBackground } from '../../utils/messaging';
import { isZhLanguage } from '../state';
import { showToast } from '../utils/toast';
import { getVisibleText, getExtractedBlocks, type TextBlock } from './block-detector';
import { addMarketIcon, clearMarketIcons } from './market-icons';
import { clearKeywordHighlights } from './keyword-highlighter';

// Events list panel
let eventsListPanel: HTMLElement | null = null;

// Stop words for keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'nor',
  'so', 'yet', 'both', 'either', 'neither', 'not', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'any', 'some', 'no', 'most',
  'other', 'such', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'says', 'said', 'new', 'news', 'effect', 'june',
  'july', 'march', 'april', 'february', 'january', 'year', 'month', 'day',
]);

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Scan current page for events
 * New approach: send text blocks to backend, get markets for each block
 * @returns Whether any icons were added
 */
export async function scanCurrentPage(): Promise<boolean> {
  console.log('[OddsSeer] Scanning page for events...');

  const isZh = isZhLanguage();

  try {
    // 1. Extract visible text blocks from viewport
    getVisibleText(); // This populates extractedBlocks
    const textBlocks = getExtractedBlocks();

    console.log('[OddsSeer] Extracted', textBlocks.length, 'text blocks');

    if (textBlocks.length === 0) {
      showToast(isZh ? '未找到可分析的内容' : 'No content to analyze', 'info');
      return false;
    }

    // 2. Filter meaningful blocks and prepare for API
    const meaningfulBlocks = textBlocks
      .map((block, index) => ({ index, text: block.text, element: block.element }))
      .filter(b => {
        const keywords = extractKeywords(b.text);
        return b.text.trim().length > 25 && (keywords.length >= 2 || (b.text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length || 0) >= 12);
      })
      .slice(0, 8); // Max 8 blocks

    console.log('[OddsSeer] Meaningful blocks:', meaningfulBlocks.length);

    if (meaningfulBlocks.length === 0) {
      showToast(isZh ? '未找到可分析的内容' : 'No content to analyze', 'info');
      return false;
    }

    // 3. Send blocks to backend (one API call, batch processing)
    const blocksForApi = meaningfulBlocks.map(b => ({
      index: b.index,
      text: b.text
    }));

    console.log('[OddsSeer] Sending', blocksForApi.length, 'blocks to backend');

    const response = await sendToBackground('PAGE_SCAN', {
      blocks: blocksForApi,
      url: window.location.href
    });

    if (!response.success || response.data?.success === false) {
      console.error('[OddsSeer] Search failed:', response.error);
      showToast(isZh ? '搜索失败，请重试' : 'Search failed, please retry', 'error');
      return false;
    }

    const blockResults: Array<{ blockIndex: number; markets: MarketEvent[] }> =
      response.data?.blockResults || [];

    console.log('[OddsSeer] Received results for', blockResults.length, 'blocks');

    if (blockResults.length === 0) {
      showToast(isZh ? '未找到相关预测市场' : 'No related markets found', 'info');
      return false;
    }

    // 4. Add icons for each block that has markets
    let iconsAdded = 0;
    const usedMarketIds = new Set<string>();

    for (const result of blockResults) {
      // Find the corresponding block
      const block = meaningfulBlocks.find(b => b.index === result.blockIndex);
      if (!block) {
        console.warn('[OddsSeer] Block not found for index:', result.blockIndex);
        continue;
      }

      // Filter out already used markets
      const uniqueMarkets = result.markets.filter(m => !usedMarketIds.has(m.id));
      if (uniqueMarkets.length === 0) continue;

      // Mark as used
      uniqueMarkets.forEach(m => usedMarketIds.add(m.id));

      // Add icon
      const success = addMarketIcon({
        element: block.element,
        text: block.text,
        markets: uniqueMarkets
      });

      if (success) {
        iconsAdded++;
        console.log('[OddsSeer] Added icon for block', result.blockIndex, ':', block.text.substring(0, 40));
      }
    }

    console.log('[OddsSeer] === Scan complete, icons added:', iconsAdded, '===');

    if (iconsAdded === 0) {
      showToast(isZh ? '未找到相关预测市场' : 'No related markets found', 'info');
      return false;
    }

    showToast(
      isZh
        ? `找到 ${iconsAdded} 个相关预测市场`
        : `Found ${iconsAdded} related markets`,
      'success'
    );

    return true;
  } catch (error) {
    console.error('[OddsSeer] Scan error:', error);
    showToast(isZh ? '扫描失败，请重试' : 'Scan failed, please retry', 'error');
    return false;
  }
}

/**
 * Clear all page scan results
 * Called from floating-ball when user clicks clear button
 */
export function clearPageScanResults(): void {
  clearMarketIcons();
  hideEventsListPanel();
  clearKeywordHighlights();
}

/**
 * Hide events list panel
 */
export function hideEventsListPanel(): void {
  if (eventsListPanel) {
    eventsListPanel.remove();
    eventsListPanel = null;
  }
}

/**
 * Cleanup page scanner
 */
export function cleanupPageScanner(): void {
  clearMarketIcons();
  hideEventsListPanel();
  clearKeywordHighlights();
}
