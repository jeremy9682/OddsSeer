/**
 * DOM utility functions for content scripts
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, ch => entities[ch]);
}

/**
 * Only allow external http(s) links for anchor href.
 * Returns null for unsafe/invalid URLs.
 */
export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Format large volume numbers for display
 */
export function formatVolume(value: unknown): string {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume < 0) return "0";
  if (volume >= 1000000000) {
    return (volume / 1000000000).toFixed(1) + 'B';
  }
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M';
  }
  if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K';
  }
  return volume.toString();
}

/**
 * Format USD amounts
 */
export function formatUsd(value: number): string {
  const n = value || 0;
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Check if element is hidden
 */
export function isHiddenElement(el: Element): boolean {
  const style = window.getComputedStyle(el);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    el.closest('[aria-hidden="true"]') !== null
  );
}

/**
 * Check if element is navigation (nav, menu, footer, etc.)
 */
export function isNavigationElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  const navTags = ['nav', 'header', 'footer', 'aside', 'menu'];
  if (navTags.includes(tag)) return true;

  const navClasses = [
    'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
    'breadcrumb', 'pagination', 'toolbar', 'tab-bar'
  ];
  const className = el.className.toString().toLowerCase();
  return navClasses.some(nc => className.includes(nc));
}

/**
 * Clean text content by removing extra whitespace
 */
export function cleanTextContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Escape special regex characters
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a shadow DOM host with styles
 */
export function createShadowHost(id: string): { host: HTMLElement; shadow: ShadowRoot } {
  const host = document.createElement('div');
  host.id = id;
  const shadow = host.attachShadow({ mode: 'closed' });
  return { host, shadow };
}

/**
 * Wait for an element to appear in the DOM
 */
export function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
