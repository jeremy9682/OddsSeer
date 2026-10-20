/**
 * Text selection popup and search results styles
 */

export function getSelectionPopupStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .selection-popup {
      position: fixed;
      z-index: 1000000;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: popIn 0.2s ease;
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .popup-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .btn-icon {
      font-size: 16px;
    }

    .btn-text {
      font-size: 13px;
    }

    .popup-btn-primary {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }

    .popup-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    .popup-btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }

    .popup-btn-secondary:hover {
      background: #e2e8f0;
      transform: translateY(-1px);
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .selection-popup {
        background: #1e293b;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      }

      .popup-btn-secondary {
        background: #334155;
        color: #e2e8f0;
      }

      .popup-btn-secondary:hover {
        background: #475569;
      }
    }
  `;
}

export function getSearchResultsStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .search-results-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease;
      z-index: 999999;
    }

    .results-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 999998;
    }

    .results-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .results-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .results-close {
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      cursor: pointer;
      color: #64748b;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .results-close:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    .results-query {
      padding: 12px 24px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .query-label {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .query-text {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .results-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 12px;
      color: #64748b;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #4F46E5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 16px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
    }

    .empty-desc {
      font-size: 14px;
      color: #94a3b8;
    }

    .market-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .market-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }

    .market-card:hover {
      background: #f1f5f9;
      transform: translateX(4px);
    }

    .market-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      flex-shrink: 0;
    }

    .market-info {
      flex: 1;
      min-width: 0;
    }

    .market-title {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .market-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }

    .market-source {
      display: inline-flex;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e0e7ff;
      color: #4338ca;
      font-weight: 500;
    }

    .market-price {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
    }

    .price-value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .price-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .price-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 32px;
    }

    .price-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid #e2e8f0;
      border-top-color: #4F46E5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .price-unavailable {
      color: #94a3b8 !important;
    }

    /* 实时价格（已确认） */
    .price-realtime {
      color: #059669 !important;
    }

    /* 快照价格（可能过期） */
    .price-snapshot {
      color: #64748b !important;
    }

    /* 正在更新的价格 */
    .price-updating {
      color: #1e293b;
    }

    .price-updating-dot {
      color: #f59e0b;
      font-size: 8px;
      animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* 快照标记 */
    .snapshot-badge {
      font-size: 10px;
      margin-left: 2px;
      opacity: 0.7;
    }

    /* 缓存标记 */
    .cache-badge {
      font-size: 10px;
      margin-left: 2px;
      color: #10b981;
    }

    /* 多选项市场样式 */
    .market-multi .market-price {
      min-width: 120px;
    }

    .multi-options {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }

    .option-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .option-leader {
      font-weight: 600;
    }

    .option-leader .option-price {
      color: #059669;
    }

    .option-name {
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80px;
    }

    .option-price {
      color: #1e293b;
      font-weight: 500;
      white-space: nowrap;
    }

    .option-more {
      font-size: 10px;
      color: #94a3b8;
      text-align: right;
      margin-top: 2px;
    }

    .multi-updating {
      position: relative;
    }

    .multi-updating .price-updating-dot {
      position: absolute;
      top: 0;
      right: -8px;
    }

    /* Show more button */
    .show-more-container {
      padding: 12px 16px;
      text-align: center;
    }

    .show-more-btn {
      width: 100%;
      padding: 10px 16px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: transparent;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .show-more-btn:hover {
      border-color: #4F46E5;
      color: #4F46E5;
      background: rgba(79, 70, 229, 0.05);
    }

    .results-footer {
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .footer-btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }

    .footer-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .search-results-panel {
        background: #1e293b;
      }

      .results-header {
        border-color: #334155;
      }

      .results-title {
        color: #f1f5f9;
      }

      .results-close {
        background: #334155;
        color: #94a3b8;
      }

      .results-close:hover {
        background: #475569;
        color: #f1f5f9;
      }

      .results-query {
        background: #0f172a;
        border-color: #334155;
      }

      .query-text {
        color: #f1f5f9;
      }

      .market-card {
        background: #334155;
      }

      .market-card:hover {
        background: #475569;
      }

      .market-title {
        color: #f1f5f9;
      }

      .market-meta {
        color: #94a3b8;
      }

      .price-value {
        color: #f1f5f9;
      }

      .results-footer {
        background: #0f172a;
        border-color: #334155;
      }

      .show-more-btn {
        border-color: #475569;
        color: #94a3b8;
      }

      .show-more-btn:hover {
        border-color: #818cf8;
        color: #818cf8;
        background: rgba(129, 140, 248, 0.1);
      }
    }
  
* { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: opacity 100ms linear !important; } }
`;
}
