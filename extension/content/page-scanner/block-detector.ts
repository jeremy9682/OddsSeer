/**
 * Block Detector
 * Extracts visible text from viewport using TreeWalker (selector-agnostic)
 */

import { isHiddenElement } from '../utils/dom';

export interface EventBlock {
  element: Element;
  text: string;
  type: string;
}

export interface TextBlock {
  element: Element;
  text: string;
}

// Store extracted blocks for later element lookup
let extractedBlocks: TextBlock[] = [];

// Tags to skip when traversing
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
  'SVG', 'PATH', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'INPUT',
  'TEXTAREA', 'SELECT', 'BUTTON', 'NAV', 'FOOTER', 'HEADER',
]);

/**
 * Check if element is in viewport
 */
function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight &&
         rect.right > 0 && rect.left < window.innerWidth &&
         rect.width > 0 && rect.height > 0;
}

/**
 * Find the best parent element for a text node
 * Prefers semantic elements like p, span, a, h1-h6, article, div
 */
function findBestParent(node: Node): Element | null {
  let current = node.parentElement;

  // Walk up to find a suitable container
  while (current) {
    const tag = current.tagName;

    // Skip inline formatting elements, go higher
    if (['STRONG', 'EM', 'B', 'I', 'U', 'MARK', 'SMALL', 'SUB', 'SUP'].includes(tag)) {
      current = current.parentElement;
      continue;
    }

    // Good container elements
    if (['P', 'SPAN', 'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
         'LI', 'TD', 'TH', 'ARTICLE', 'SECTION', 'DIV', 'BLOCKQUOTE'].includes(tag)) {
      return current;
    }

    // Fallback: any element with reasonable size
    const rect = current.getBoundingClientRect();
    if (rect.width > 50 && rect.height > 10) {
      return current;
    }

    current = current.parentElement;
  }

  return node.parentElement;
}

/**
 * Extract text content from elements currently visible in viewport
 * Uses TreeWalker to traverse all text nodes (selector-agnostic)
 */
export function getVisibleText(): string {
  extractedBlocks = [];
  const seenTexts = new Set<string>();
  const elementTextMap = new Map<Element, string[]>();

  // Create TreeWalker to traverse all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Text) => {
        // Skip empty text
        const text = node.textContent?.trim();
        if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;

        // Skip if parent is in skip list
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('nav, footer, header, [role="navigation"], [role="banner"]')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip hidden elements
        if (isHiddenElement(parent)) return NodeFilter.FILTER_REJECT;

        // Skip if not in viewport
        if (!isInViewport(parent)) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Collect text nodes and group by parent element
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent?.trim() || '';
    const parent = findBestParent(node);

    if (parent && text) {
      const existing = elementTextMap.get(parent) || [];
      existing.push(text);
      elementTextMap.set(parent, existing);
    }
  }

  // Convert to text blocks, merging text from same element
  for (const [element, texts] of elementTextMap) {
    const combinedText = texts.join(' ').trim();

    // Filter: too short or too long
    if (combinedText.length < 15 || combinedText.length > 500) continue;

    // Skip if already has icon
    if (element.querySelector('.oddsseer-icon')) continue;
    if (element.parentElement?.querySelector('.oddsseer-icon')) continue;

    // Deduplicate
    const normalized = combinedText.toLowerCase().substring(0, 50);
    if (seenTexts.has(normalized)) continue;
    seenTexts.add(normalized);

    extractedBlocks.push({ element, text: combinedText });
  }

  console.log('[OddsSeer] Extracted', extractedBlocks.length, 'visible text blocks');

  // Combine texts for API (limit to ~3000 chars)
  let result = '';
  for (const block of extractedBlocks) {
    if (result.length + block.text.length > 3000) break;
    result += block.text + '\n';
  }

  return result.trim();
}

/**
 * Get the stored text blocks (call after getVisibleText)
 */
export function getExtractedBlocks(): TextBlock[] {
  return extractedBlocks;
}

/**
 * Extract keywords from text for matching
 * Filters out common words and keeps meaningful terms
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
    'now', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'any', 'some', 'no', 'most', 'other', 'such', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate keyword match score between two texts
 */
function calculateMatchScore(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  let matches = 0;
  for (const kw of keywords1) {
    if (keywords2.some(k2 => k2.includes(kw) || kw.includes(k2))) {
      matches++;
    }
  }

  return matches / Math.min(keywords1.length, keywords2.length);
}

/**
 * Find DOM element that contains text matching the given search text
 * Uses keyword matching to handle cases where market title differs from page text
 * Now uses extracted blocks first, then falls back to TreeWalker search
 */
export function findElementForText(searchText: string): Element | null {
  const cleanText = searchText.trim();
  if (cleanText.length < 10) return null;

  const searchKeywords = extractKeywords(cleanText);
  if (searchKeywords.length < 2) return null;

  let bestMatch: { element: Element; score: number } | null = null;

  // First, search in already extracted blocks (most efficient)
  for (const block of extractedBlocks) {
    const score = calculateMatchScore(cleanText, block.text);
    if (score >= 0.4) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { element: block.element, score };
      }
    }
  }

  // If found a good match in extracted blocks, return it
  if (bestMatch && bestMatch.score >= 0.5) {
    console.log('[OddsSeer] Found element in extracted blocks with score:', bestMatch.score.toFixed(2));
    return bestMatch.element;
  }

  // Fallback: search with TreeWalker for elements we might have missed
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Text) => {
        const text = node.textContent?.trim();
        if (!text || text.length < 10) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (isHiddenElement(parent)) return NodeFilter.FILTER_REJECT;

        // Extended viewport for fallback search
        const rect = parent.getBoundingClientRect();
        if (rect.top < -100 || rect.top > window.innerHeight * 2) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const parent = findBestParent(node);
    if (!parent) continue;

    // Skip if already has icon
    if (parent.querySelector('.oddsseer-icon')) continue;
    if (parent.parentElement?.querySelector('.oddsseer-icon')) continue;

    const elText = parent.textContent?.trim() || '';
    if (elText.length < 15 || elText.length > 500) continue;

    const score = calculateMatchScore(cleanText, elText);
    if (score >= 0.4) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { element: parent, score };
      }
    }
  }

  if (bestMatch) {
    console.log('[OddsSeer] Found element with score:', bestMatch.score.toFixed(2));
    return bestMatch.element;
  }

  return null;
}

/**
 * Legacy function for compatibility - now just returns empty array
 * @deprecated Use getVisibleText() and findElementForText() instead
 */
export function identifyEventBlocks(): EventBlock[] {
  console.warn('[OddsSeer] identifyEventBlocks() is deprecated, use getVisibleText() instead');
  return [];
}
