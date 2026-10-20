/**
 * Floating toolbar module
 * Provides a vertical toolbar on the right edge (like Monica/Trancy)
 * Contains: AI Analysis, Page Scan, Clear highlights
 * Supports vertical dragging
 */

import { getSettings, getFloatingBall, setFloatingBall, isZhLanguage } from '../state';
import { createShadowHost } from '../utils/dom';
import { getFloatingBallStyles } from './styles';
import { sendToBackground, extStorage } from '../../utils/messaging';
import { toggleEnhancementPanel } from '../enhancement-panel';
import { scanCurrentPage, clearPageScanResults } from '../page-scanner';
import { showToast } from '../utils/toast';

// Reference to clear button for external access
let clearBtnRef: HTMLElement | null = null;

// Storage key for toolbar position
const TOOLBAR_POSITION_KEY = 'toolbarPositionY';

/**
 * Create the floating toolbar
 */
export function createFloatingBall(): void {
  // Don't create if already exists
  if (getFloatingBall()) return;

  const settings = getSettings();
  if (!settings?.enableFloatingBall) return;

  const { host, shadow } = createShadowHost('oddsseer-floating-ball');
  const isZh = isZhLanguage();

  // Add styles
  const style = document.createElement('style');
  style.textContent = getFloatingBallStyles();
  shadow.appendChild(style);

  // Create toolbar container
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar';

  // Load saved position
  void extStorage.get<number>(TOOLBAR_POSITION_KEY).then(savedY => {
    if (typeof savedY !== 'number' || !Number.isFinite(savedY) || !host.isConnected || toolbar.style.top) return;
    const top = Math.max(10, Math.min(savedY, Math.max(10, window.innerHeight - toolbar.offsetHeight - 10)));
    toolbar.style.top = `${top}px`;
    toolbar.style.transform = 'translateY(0)';
  }).catch(() => {});

  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5"/>
      <circle cx="15" cy="6" r="1.5"/>
      <circle cx="9" cy="12" r="1.5"/>
      <circle cx="15" cy="12" r="1.5"/>
    </svg>
  `;
  toolbar.appendChild(dragHandle);

  // AI Analysis button (primary)
  const aiBtn = document.createElement('button');
  aiBtn.className = 'toolbar-btn primary';
  aiBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
    <span class="toolbar-tooltip">${isZh ? '打开 OddsSeer' : 'Open OddsSeer'}</span>
  `;
  aiBtn.addEventListener('click', async () => {
    const panel = document.getElementById('oddsseer-enhancement-panel');
    if (panel) {
      toggleEnhancementPanel();
    } else {
      const response = await sendToBackground('OPEN_SIDEPANEL', undefined, { maxRetries: 0 });
      if (!response.success) showToast(isZh ? '请点击浏览器工具栏中的 OddsSeer 图标打开侧栏' : 'Click the OddsSeer toolbar icon to open the sidebar', 'info');
    }
  });
  toolbar.appendChild(aiBtn);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'toolbar-divider';
  toolbar.appendChild(divider);

  // Scan page button
  const scanBtn = document.createElement('button');
  scanBtn.className = 'toolbar-btn scan';
  scanBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12"/>
    </svg>
    <span class="toolbar-tooltip">${isZh ? '扫描页面' : 'Scan Page'}</span>
  `;
  scanBtn.addEventListener('click', async () => {
    if (scanBtn.classList.contains('loading')) return;

    scanBtn.classList.add('loading');
    const hasHighlights = await scanCurrentPage();
    scanBtn.classList.remove('loading');

    // Show clear button if there are highlights
    if (hasHighlights && clearBtnRef) {
      clearBtnRef.classList.add('visible');
    }
  });
  toolbar.appendChild(scanBtn);

  // Clear highlights button (hidden by default)
  const clearBtn = document.createElement('button');
  clearBtn.className = 'toolbar-btn clear';
  clearBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    <span class="toolbar-tooltip">${isZh ? '清除高亮' : 'Clear Highlights'}</span>
  `;
  clearBtn.addEventListener('click', () => {
    clearPageScanResults();
    clearBtn.classList.remove('visible');
    showToast(isZh ? '已清除' : 'Cleared', 'info');
  });
  toolbar.appendChild(clearBtn);
  clearBtnRef = clearBtn;

  shadow.appendChild(toolbar);
  document.body.appendChild(host);
  setFloatingBall(host);

  // Setup dragging
  setupDragging(toolbar, dragHandle);
}

/**
 * Setup vertical dragging for the toolbar
 */
function setupDragging(toolbar: HTMLElement, handle: HTMLElement): void {
  let isDragging = false;
  let startY = 0;
  let startTop = 0;

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    startY = e.clientY;

    // Get current top position
    const rect = toolbar.getBoundingClientRect();
    startTop = rect.top;

    toolbar.classList.add('dragging');
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = e.clientY - startY;
    let newTop = startTop + deltaY;

    // Get toolbar height for boundary calculation
    const toolbarHeight = toolbar.offsetHeight;
    const maxTop = window.innerHeight - toolbarHeight - 10;
    const minTop = 10;

    // Constrain to viewport
    newTop = Math.max(minTop, Math.min(newTop, maxTop));

    toolbar.style.top = `${newTop}px`;
    toolbar.style.transform = 'translateY(0)';
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    toolbar.classList.remove('dragging');

    // Save position
    const top = parseInt(toolbar.style.top) || window.innerHeight / 2;
    void extStorage.set(TOOLBAR_POSITION_KEY, top).catch(() => {});
  };

  handle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Touch events for mobile
  handle.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    onMouseDown({ clientY: touch.clientY, preventDefault: () => e.preventDefault() } as MouseEvent);
  }, { passive: false });

  document.addEventListener('touchmove', (e: TouchEvent) => {
    const touch = e.touches[0];
    onMouseMove({ clientY: touch.clientY } as MouseEvent);
  }, { passive: true });

  document.addEventListener('touchend', onMouseUp);
}

/**
 * Show the clear button (called from page scanner)
 */
export function showClearButton(): void {
  if (clearBtnRef) {
    clearBtnRef.classList.add('visible');
  }
}

/**
 * Hide the clear button
 */
export function hideClearButton(): void {
  if (clearBtnRef) {
    clearBtnRef.classList.remove('visible');
  }
}

/**
 * Remove the floating toolbar
 */
export function removeFloatingBall(): void {
  const ball = getFloatingBall();
  if (ball) {
    ball.remove();
    setFloatingBall(null);
    clearBtnRef = null;
  }
}

/**
 * Update floating toolbar visibility based on settings
 */
export function updateFloatingBallVisibility(): void {
  const settings = getSettings();
  const ball = getFloatingBall();

  if (settings?.enableFloatingBall && !ball) {
    createFloatingBall();
  } else if (!settings?.enableFloatingBall && ball) {
    removeFloatingBall();
  }
}
