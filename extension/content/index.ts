/**
 * Content Script Module Exports
 * Aggregates all content script modules
 */

// State management
export {
  initState,
  getSettings,
  setSettings,
  getCurrentMarket,
  setCurrentMarket,
  getFloatingBall,
  setFloatingBall,
  getEnhancementPanel,
  setEnhancementPanel,
  getSelectionPopup,
  setSelectionPopup,
  isZhLanguage
} from './state';

// DOM utilities
export {
  escapeHtml,
  formatVolume,
  formatUsd,
  isHiddenElement,
  createShadowHost
} from './utils/dom';

// Toast notifications
export { showToast } from './utils/toast';

// Extension guide
export { showExtensionGuide, hideExtensionGuide } from './utils/guide';

// Floating ball (now a unified toolbar)
export {
  createFloatingBall,
  removeFloatingBall,
  updateFloatingBallVisibility,
  showClearButton,
  hideClearButton
} from './floating-ball';

// Page detector
export {
  getPageType,
  isSupportedEventPage,
  extractEventFromPage
} from './page-detector';

// Text selection
export {
  setupTextSelection,
  hideSelectionPopup,
  hideSearchResults,
  cleanupTextSelection
} from './text-selection';

// Page scanner
export {
  scanCurrentPage,
  clearPageScanResults,
  hideEventsListPanel,
  cleanupPageScanner
} from './page-scanner';

// Events panel
export {
  showEventsListPanel,
  showPageScanResults,
  hidePageScanResults
} from './events-panel';

// Enhancement panel
export {
  createEnhancementPanel,
  toggleEnhancementPanel,
  removeEnhancementPanel,
  initEnhancementPanel
} from './enhancement-panel';

// Chart overlay
export {
  injectChartNewsOverlay,
  cleanupChartOverlay
} from './chart-overlay';
