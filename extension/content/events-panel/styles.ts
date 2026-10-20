/**
 * Events Panel Styles
 * Styles for the events list panel
 */

export function getEventsPanelStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    .panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 360px;
      max-height: calc(100vh - 120px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.25s ease-out;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: 999990;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .header {
      padding: 16px 18px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
    }

    .header-icon {
      width: 24px;
      height: 24px;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .events-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .event-card {
      background: #f8f9fa;
      border-radius: 12px;
      margin-bottom: 12px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      transition: box-shadow 0.15s, border-color 0.15s;
    }

    .event-card:hover {
      border-color: #4F46E5;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
    }

    .event-card:last-child {
      margin-bottom: 0;
    }

    .event-header {
      padding: 14px 16px;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .event-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .event-icon svg {
      width: 20px;
      height: 20px;
      color: white;
    }

    .event-content {
      flex: 1;
      min-width: 0;
    }

    .event-query {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .event-keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .keyword-tag {
      background: #e0e7ff;
      color: #4338ca;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    .event-toggle {
      color: #9ca3af;
      transition: transform 0.2s;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .event-card.expanded .event-toggle {
      transform: rotate(180deg);
    }

    .markets-container {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.25s ease-out;
      background: white;
    }

    .event-card.expanded .markets-container {
      max-height: 400px;
    }

    .markets-list {
      padding: 0 12px 12px 12px;
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
      background: #f0f0f5;
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

    .market-source {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
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
      font-size: 16px;
      font-weight: 700;
      color: #10B981;
    }

    .odds-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
    }

    .no-markets {
      text-align: center;
      padding: 20px;
      color: #9ca3af;
      font-size: 13px;
    }

    .footer {
      padding: 12px 16px;
      background: #f8f9fa;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .footer a {
      color: #4F46E5;
      text-decoration: none;
      font-weight: 500;
    }

    .footer a:hover {
      text-decoration: underline;
    }
  `;
}

export function getPageScanResultsStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .scan-results-panel {
      position: fixed;
      z-index: 999999;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      max-height: 80vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: popIn 0.25s ease-out;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    @keyframes popIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999998;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .header {
      padding: 20px 24px;
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
    .header-icon {
      width: 32px;
      height: 32px;
      background: rgba(255,255,255,0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .close-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .header-subtitle {
      font-size: 13px;
      opacity: 0.9;
    }
    .detected-events {
      padding: 12px 24px;
      background: #f0fdf4;
      border-bottom: 1px solid #dcfce7;
      font-size: 12px;
      color: #166534;
    }
    .detected-events strong {
      color: #14532d;
    }
    .event-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .event-tag {
      padding: 3px 10px;
      background: #dcfce7;
      border-radius: 12px;
      font-size: 11px;
      color: #166534;
    }
    .markets-list {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
    }
    .market-card {
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.15s;
    }
    .market-card:hover {
      background: #f8fafc;
    }
    .market-card:last-child {
      border-bottom: none;
    }
    .market-title {
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 10px;
    }
    .market-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .price-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .price-yes {
      background: #dcfce7;
      color: #166534;
    }
    .price-no {
      background: #fee2e2;
      color: #991b1b;
    }
    .volume {
      font-size: 12px;
      color: #94a3b8;
    }
    .source-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .source-polymarket {
      background: #4F46E5;
      color: white;
    }
    .source-kalshi {
      background: #059669;
      color: white;
    }
    .analyze-btn {
      margin-left: auto;
      padding: 6px 14px;
      border: none;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      font-size: 12px;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .market-card:hover .analyze-btn {
      opacity: 1;
    }
    .footer {
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: center;
    }
    .view-more-btn {
      padding: 10px 24px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .view-more-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
  
* { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: opacity 100ms linear !important; } }
`;
}
