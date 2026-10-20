/**
 * Page Scanner Styles
 * Styles for scan button, block popup, keyword highlighting, etc.
 */

export function getScanButtonStyles(): string {
  return `
    .btn-container {
      position: fixed;
      z-index: 999998;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .scan-btn, .clear-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
      border: none;
      color: white;
    }
    .scan-btn {
      background: linear-gradient(135deg, #10B981, #059669);
    }
    .scan-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    }
    .clear-btn {
      background: linear-gradient(135deg, #EF4444, #DC2626);
      display: none;
    }
    .clear-btn.visible {
      display: flex;
    }
    .clear-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
    }
    .scan-btn:active, .clear-btn:active {
      transform: scale(0.95);
    }
    .scan-btn svg, .clear-btn svg {
      width: 20px;
      height: 20px;
    }
    .scan-btn.loading {
      opacity: 0.7;
      cursor: wait;
    }
    .scan-btn.loading svg {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

export function getBlockPopupStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .popup {
      position: fixed;
      z-index: 999999;
      width: 340px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: fadeIn 0.15s ease-out;
      overflow: hidden;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      padding: 14px 16px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }
    .header-title {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .header-subtitle {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .markets-list {
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    }
    .market-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 10px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s;
      text-decoration: none;
      color: inherit;
    }
    .market-item:hover {
      background: #e8e8f0;
    }
    .market-item:last-child {
      margin-bottom: 0;
    }
    .market-info {
      flex: 1;
      min-width: 0;
    }
    .market-title {
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .market-meta {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .source-badge {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .market-odds {
      text-align: right;
      flex-shrink: 0;
    }
    .odds-value {
      font-size: 18px;
      font-weight: 700;
      color: #10B981;
    }
    .odds-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
    }

    /* Multi-option market styles */
    .market-item.multi-option {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .market-item.multi-option .market-info {
      width: 100%;
    }
    .multi-odds {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .option-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .option-row.leader {
      font-weight: 600;
    }
    .option-row.leader .option-name {
      color: #059669;
    }
    .option-row.leader .option-price {
      color: #059669;
    }
    .option-name {
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }
    .option-price {
      color: #1e293b;
      font-weight: 500;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .option-more {
      font-size: 10px;
      color: #94a3b8;
      text-align: right;
      margin-top: 2px;
    }

    /* Loading spinner */
    .market-odds.loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
    }
    .odds-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e5e7eb;
      border-top-color: #4F46E5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

export function getKeywordPopupStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .popup {
      position: fixed;
      z-index: 999999;
      width: 320px;
      max-height: 350px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: fadeIn 0.15s ease-out;
      overflow: hidden;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      padding: 12px 14px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
    }
    .keyword-badge {
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close-btn {
      width: 22px;
      height: 22px;
      border: none;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer;
      color: white;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover { background: rgba(255,255,255,0.3); }
    .markets-list {
      max-height: 280px;
      overflow-y: auto;
    }
    .market-item {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.1s;
    }
    .market-item:hover { background: #f8fafc; }
    .market-item:last-child { border-bottom: none; }
    .market-title {
      font-size: 12px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .market-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .source-badge {
      font-size: 9px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .source-polymarket { background: #4F46E5; color: white; }
    .source-kalshi { background: #059669; color: white; }
    .price-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .price-yes { background: #dcfce7; color: #166534; }
    .price-no { background: #fee2e2; color: #991b1b; }
  
* { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: opacity 100ms linear !important; } }
`;
}
