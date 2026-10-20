/**
 * Floating toolbar styles
 * Vertical toolbar on the right edge (like Monica/Trancy)
 */

export function getFloatingBallStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* Toolbar container - fixed on right edge */
    .floating-toolbar {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px;
      background: white;
      border-radius: 12px 0 0 12px;
      box-shadow: -2px 0 20px rgba(0, 0, 0, 0.1);
      transition: box-shadow 0.2s ease;
      user-select: none;
    }

    .floating-toolbar.dragging {
      box-shadow: -4px 0 30px rgba(0, 0, 0, 0.2);
      cursor: grabbing;
    }

    /* Drag handle */
    .drag-handle {
      width: 42px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: #cbd5e1;
      transition: color 0.15s;
      border-radius: 6px;
    }

    .drag-handle:hover {
      color: #94a3b8;
      background: #f1f5f9;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle svg {
      width: 16px;
      height: 16px;
    }

    .floating-toolbar.dragging .drag-handle {
      cursor: grabbing;
      color: #64748b;
    }

    /* Toolbar button base */
    .toolbar-btn {
      position: relative;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      background: #f8fafc;
      color: #64748b;
    }

    .toolbar-btn:hover {
      background: #f1f5f9;
      color: #4F46E5;
      transform: scale(1.05);
    }

    .toolbar-btn:active {
      transform: scale(0.95);
    }

    .toolbar-btn svg {
      width: 20px;
      height: 20px;
    }

    /* Primary button (AI Analysis) */
    .toolbar-btn.primary {
      background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    }

    .toolbar-btn.primary:hover {
      background: linear-gradient(135deg, #4338CA 0%, #6D28D9 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    /* Scan button */
    .toolbar-btn.scan {
      background: #ecfdf5;
      color: #059669;
    }

    .toolbar-btn.scan:hover {
      background: #d1fae5;
      color: #047857;
    }

    .toolbar-btn.scan.loading {
      opacity: 0.7;
      cursor: wait;
    }

    .toolbar-btn.scan.loading svg {
      animation: spin 1s linear infinite;
    }

    /* Clear button */
    .toolbar-btn.clear {
      background: #fef2f2;
      color: #dc2626;
      display: none;
    }

    .toolbar-btn.clear.visible {
      display: flex;
    }

    .toolbar-btn.clear:hover {
      background: #fee2e2;
      color: #b91c1c;
    }

    /* Divider */
    .toolbar-divider {
      width: 30px;
      height: 1px;
      background: #e2e8f0;
      margin: 4px auto;
    }

    /* Tooltip */
    .toolbar-tooltip {
      position: absolute;
      right: 52px;
      top: 50%;
      transform: translateY(-50%);
      background: #1e293b;
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s, visibility 0.15s;
      pointer-events: none;
    }

    .toolbar-tooltip::after {
      content: '';
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
      border: 6px solid transparent;
      border-left-color: #1e293b;
    }

    .toolbar-btn:hover .toolbar-tooltip {
      opacity: 1;
      visibility: visible;
    }

    /* Badge for notifications */
    .toolbar-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: #ef4444;
      color: white;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Ripple animation for primary button */
    .toolbar-btn.primary::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.3);
      animation: ripple 2s infinite ease-out;
      pointer-events: none;
    }

    @keyframes ripple {
      0% {
        transform: scale(1);
        opacity: 0.3;
      }
      100% {
        transform: scale(1.3);
        opacity: 0;
      }
    }
  
* { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: opacity 100ms linear !important; } }
`;
}
