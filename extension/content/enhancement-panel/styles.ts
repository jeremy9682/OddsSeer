/**
 * Enhancement panel styles
 * Contains all CSS for the enhancement panel and its sections
 */

export function getEnhancementPanelStyles(): string {
  return `
    ${getBaseStyles()}
    ${getPanelStructureStyles()}
    ${getToggleTabStyles()}
    ${getHeaderStyles()}
    ${getTabStyles()}
    ${getSectionStyles()}
    ${getMarketSummaryStyles()}
    ${getCommunitySentimentStyles()}
    ${getArbitrageStyles()}
    ${getNewsStyles()}
    ${getLoadingStyles()}
    ${getRelatedEventsStyles()}
    ${getTimelineStyles()}
    ${getChartTooltipStyles()}
    ${getDarkModeStyles()}
  `;
}

function getBaseStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  `;
}

function getPanelStructureStyles(): string {
  return `
    .enhancement-panel {
      position: fixed;
      top: 100px;
      right: 0;
      width: 320px;
      max-height: calc(100vh - 140px);
      background: #ffffff;
      border-radius: 16px 0 0 16px;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999990;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
    }

    .enhancement-panel.collapsed {
      transform: translateX(320px);
    }
  `;
}

function getToggleTabStyles(): string {
  return `
    .toggle-tab {
      position: absolute;
      left: -36px;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 100px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      border-radius: 10px 0 0 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: white;
      font-size: 18px;
      box-shadow: -3px 0 12px rgba(79, 70, 229, 0.35);
      transition: all 0.2s ease;
      user-select: none;
    }

    .toggle-tab:hover {
      width: 40px;
      left: -40px;
      box-shadow: -5px 0 18px rgba(79, 70, 229, 0.55);
    }

    .toggle-tab:active {
      transform: translateY(-50%) scale(0.95);
    }

    .toggle-tab .icon {
      font-size: 22px;
      line-height: 1;
    }

    .toggle-tab .label {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      opacity: 0.9;
    }

    .toggle-tab .arrow {
      font-size: 14px;
      line-height: 1;
      opacity: 0.8;
      transition: transform 0.3s ease;
    }

    .enhancement-panel.collapsed .toggle-tab .arrow {
      transform: rotate(180deg);
    }

    .close-panel-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      color: #64748b;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      margin-left: auto;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .close-panel-btn:hover {
      background: #cbd5e1;
      color: #475569;
    }
  `;
}

function getHeaderStyles(): string {
  return `
    .panel-header {
      padding: 16px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      flex-shrink: 0;
      border-radius: 16px 0 0 0;
      overflow: hidden;
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .panel-subtitle {
      font-size: 12px;
      opacity: 0.9;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .panel-footer {
      padding: 12px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;
    }

    .footer-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: #64748b;
      text-decoration: none;
      transition: color 0.2s;
    }

    .footer-link:hover {
      color: #4F46E5;
    }
  `;
}

function getTabStyles(): string {
  return `
    .panel-tabs {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;
      border-radius: 16px 0 0 0;
    }

    .panel-tab {
      flex: 1;
      padding: 10px 8px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-align: center;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      user-select: none;
    }

    .panel-tab:hover {
      color: #4F46E5;
      background: #eef2ff;
    }

    .panel-tab.active {
      color: #4F46E5;
      border-bottom-color: #4F46E5;
      background: white;
    }

    .tab-content {
      display: none;
      flex: 1;
      overflow-y: auto;
    }

    .tab-content.active {
      display: flex;
      flex-direction: column;
    }
  `;
}

function getSectionStyles(): string {
  return `
    .section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      cursor: pointer;
    }

    .section-icon {
      font-size: 18px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      flex: 1;
    }

    .section-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: #e0e7ff;
      color: #4338ca;
    }

    .section-toggle {
      font-size: 12px;
      color: #94a3b8;
      transition: transform 0.2s;
    }

    .section.collapsed .section-toggle {
      transform: rotate(-90deg);
    }

    .section.collapsed .section-body {
      display: none;
    }

    .empty-state {
      text-align: center;
      padding: 16px;
      color: #94a3b8;
      font-size: 12px;
    }
  `;
}

function getMarketSummaryStyles(): string {
  return `
    .summary-cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .summary-card {
      border-radius: 8px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .summary-card.conclusion {
      border-left: 3px solid #94a3b8;
    }

    .summary-card.conclusion.bullish {
      border-left-color: #10b981;
      background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
    }

    .summary-card.conclusion.bearish {
      border-left-color: #ef4444;
      background: linear-gradient(135deg, #fef2f2, #fff1f2);
    }

    .summary-card.conclusion.neutral {
      border-left-color: #f59e0b;
      background: linear-gradient(135deg, #fffbeb, #fef3c7);
    }

    .conclusion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .direction-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
    }

    .direction-badge.bullish { background: #dcfce7; color: #166534; }
    .direction-badge.bearish { background: #fee2e2; color: #991b1b; }
    .direction-badge.neutral { background: #fef3c7; color: #92400e; }

    .confidence-tag {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .one-liner {
      font-size: 12px;
      color: #334155;
      line-height: 1.5;
      margin-bottom: 4px;
    }

    .key-driver {
      font-size: 11px;
      color: #64748b;
      line-height: 1.4;
    }

    .summary-card.metrics {
      padding: 8px 10px;
    }

    .metrics-label {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .metric-key {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .metric-val {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }

    .metric-val.positive { color: #10b981; }
    .metric-val.negative { color: #ef4444; }

    .summary-card.risk {
      padding: 8px 10px;
    }

    .risk-header {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .risk-level-badge {
      display: inline-flex;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 600;
    }

    .risk-level-badge.low { background: #dcfce7; color: #166534; }
    .risk-level-badge.medium { background: #fef3c7; color: #92400e; }
    .risk-level-badge.high { background: #fee2e2; color: #991b1b; }

    .risk-alerts {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .risk-alert-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }

    .risk-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }

    .risk-dot.low { background: #10b981; }
    .risk-dot.medium { background: #f59e0b; }
    .risk-dot.high { background: #ef4444; }

    .no-risks {
      font-size: 11px;
      color: #10b981;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .summary-action-btn {
      width: 100%;
      padding: 9px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 8px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }

    .summary-action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }
  `;
}

function getCommunitySentimentStyles(): string {
  return `
    /* Community Sentiment Section */
    .sentiment-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .sentiment-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .sentiment-badge.bullish {
      background: #dcfce7;
      color: #166534;
    }

    .sentiment-badge.bearish {
      background: #fee2e2;
      color: #991b1b;
    }

    .sentiment-badge.neutral {
      background: #f1f5f9;
      color: #64748b;
    }

    .sentiment-badge.divided {
      background: #fef3c7;
      color: #92400e;
    }

    .sentiment-meta {
      font-size: 10px;
      color: #94a3b8;
    }

    .sentiment-summary {
      display: flex;
      gap: 8px;
      padding: 10px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 3px solid #a5b4fc;
    }

    .summary-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .summary-text {
      font-size: 12px;
      color: #334155;
      line-height: 1.5;
    }

    /* Velocity Indicator */
    .velocity-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 11px;
    }

    .velocity-emoji {
      font-size: 14px;
    }

    .velocity-text {
      font-weight: 600;
    }

    .velocity-ratio {
      margin-left: auto;
      font-size: 10px;
      opacity: 0.8;
    }

    .velocity-hot {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border: 1px solid #fecaca;
      color: #dc2626;
    }

    .velocity-up {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      color: #16a34a;
    }

    .velocity-stable {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #64748b;
    }

    .velocity-down {
      background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
      border: 1px solid #fde047;
      color: #ca8a04;
    }

    .velocity-cold {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      color: #2563eb;
    }

    /* Wilson Score Stats */
    .wilson-stats {
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      border: 1px solid #e2e8f0;
    }

    .wilson-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .wilson-label {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    .wilson-range {
      font-size: 11px;
      color: #334155;
      font-weight: 600;
    }

    .wilson-bar {
      position: relative;
      height: 8px;
      background: linear-gradient(90deg, #fecaca 0%, #fef9c3 50%, #bbf7d0 100%);
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .wilson-range-fill {
      position: absolute;
      top: 0;
      height: 100%;
      background: rgba(99, 102, 241, 0.3);
      border: 2px solid #6366f1;
      border-radius: 4px;
      box-sizing: border-box;
    }

    .wilson-marker {
      position: absolute;
      top: -2px;
      width: 4px;
      height: 12px;
      background: #1e293b;
      border-radius: 2px;
      transform: translateX(-50%);
    }

    .wilson-labels {
      display: flex;
      justify-content: space-between;
      position: relative;
      font-size: 9px;
      color: #94a3b8;
      margin-bottom: 6px;
    }

    .wilson-label-left,
    .wilson-label-right {
      flex: 0 0 auto;
    }

    .wilson-label-center {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
    }

    .wilson-counts {
      font-size: 10px;
      color: #64748b;
      text-align: center;
    }

    /* Favored Option (multi-option events with consensus) */
    .favored-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-radius: 8px;
      margin-bottom: 10px;
      border: 1px solid #a7f3d0;
    }

    .favored-icon {
      font-size: 14px;
    }

    .favored-label {
      font-size: 11px;
      color: #065f46;
      font-weight: 500;
    }

    .favored-name {
      font-size: 12px;
      color: #047857;
      font-weight: 600;
    }

    /* Option Mentions */
    .option-mentions {
      margin-bottom: 10px;
    }

    .option-mentions-header,
    .key-arguments-header,
    .notable-comments-header {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .option-mention-item {
      margin-bottom: 6px;
    }

    .option-mention-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }

    .option-name {
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
    }

    .option-stats {
      font-size: 10px;
      color: #64748b;
    }

    .option-mention-bar {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .option-mention-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .option-mention-fill.bullish {
      background: linear-gradient(90deg, #10b981, #34d399);
    }

    .option-mention-fill.bearish {
      background: linear-gradient(90deg, #ef4444, #f87171);
    }

    .option-mention-fill.neutral {
      background: linear-gradient(90deg, #94a3b8, #cbd5e1);
    }

    /* Key Arguments */
    .key-arguments {
      margin-bottom: 10px;
    }

    .arguments-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .argument-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }

    .argument-sentiment {
      flex-shrink: 0;
      font-size: 12px;
    }

    .argument-option {
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 600;
      color: #6366f1;
      background: #eef2ff;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .argument-text {
      flex: 1;
    }

    .argument-count {
      flex-shrink: 0;
      font-size: 10px;
      color: #94a3b8;
    }

    /* Notable Comments */
    .notable-comments {
      margin-bottom: 8px;
    }

    .notable-comment {
      padding: 8px 10px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 6px;
    }

    .notable-comment:last-child {
      margin-bottom: 0;
    }

    .comment-text {
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
      font-style: italic;
      margin-bottom: 4px;
    }

    .comment-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: #94a3b8;
    }

    .comment-author {
      font-weight: 500;
    }

    .comment-reactions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* Footer */
    .sentiment-footer {
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }

    /* Multi-Option Wilson Stats */
    .wilson-stats.multi-option {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }

    .wilson-meta {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }

    .multi-option-wilson-item {
      margin-bottom: 10px;
      padding: 8px;
      background: white;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .multi-option-wilson-item.top-option {
      border-color: #a7f3d0;
      background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
    }

    .multi-option-wilson-item:last-child {
      margin-bottom: 0;
    }

    .multi-option-wilson-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .multi-option-wilson-header .option-rank {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      min-width: 16px;
    }

    .multi-option-wilson-header .option-name {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      flex: 1;
    }

    .multi-option-wilson-header .top-badge {
      font-size: 9px;
      font-weight: 600;
      color: #047857;
      background: #d1fae5;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .multi-option-wilson-header .option-ci {
      font-size: 10px;
      color: #6366f1;
      font-weight: 600;
    }

    .multi-option-wilson-bar {
      position: relative;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      margin-bottom: 4px;
    }

    .multi-option-wilson-bar .wilson-ci-range {
      position: absolute;
      top: 0;
      height: 100%;
      background: rgba(99, 102, 241, 0.25);
      border-radius: 3px;
    }

    .multi-option-wilson-item.top-option .wilson-ci-range {
      background: rgba(16, 185, 129, 0.3);
    }

    .multi-option-wilson-bar .wilson-point {
      position: absolute;
      top: -1px;
      width: 8px;
      height: 8px;
      background: #6366f1;
      border-radius: 50%;
      transform: translateX(-50%);
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .multi-option-wilson-item.top-option .wilson-point {
      background: #10b981;
    }

    .multi-option-wilson-labels {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }

    .multi-option-wilson-labels span:nth-child(2) {
      font-weight: 500;
      color: #64748b;
    }
  `;
}

function getArbitrageStyles(): string {
  return `
    .arbitrage-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .arbitrage-item:last-child {
      border-bottom: none;
    }

    .arb-platform {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .arb-logo {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .arb-name {
      font-size: 12px;
      font-weight: 500;
      color: #475569;
    }

    .arb-price {
      text-align: right;
    }

    .arb-value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }

    .arb-diff {
      font-size: 11px;
      font-weight: 500;
    }

    .arb-diff.positive { color: #10b981; }
    .arb-diff.negative { color: #ef4444; }
    .arb-diff.neutral { color: #94a3b8; }

    .arbitrage-alert {
      margin-top: 10px;
      padding: 10px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .arbitrage-alert .icon {
      font-size: 18px;
    }

    .arbitrage-alert .text {
      font-size: 12px;
      color: #92400e;
      font-weight: 500;
    }
  `;
}

function getNewsStyles(): string {
  return `
    .news-item {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .news-item:last-child {
      border-bottom: none;
    }

    .news-title {
      font-size: 12px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-decoration: none;
    }

    .news-title:hover {
      color: #4F46E5;
    }

    .news-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #94a3b8;
    }

    .news-sentiment {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }

    .news-sentiment.positive {
      background: #dcfce7;
      color: #166534;
    }

    .news-sentiment.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .news-sentiment.neutral {
      background: #f1f5f9;
      color: #64748b;
    }
  `;
}

function getLoadingStyles(): string {
  return `
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #94a3b8;
      font-size: 12px;
      gap: 8px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e2e8f0;
      border-top-color: #4F46E5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

function getRelatedEventsStyles(): string {
  return `
    .relation-graph-container {
      position: relative;
      width: 100%;
      min-height: 220px;
    }

    .relation-graph-svg {
      width: 100%;
      display: block;
    }

    .relation-graph-svg text {
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: none;
    }

    .relation-graph-svg .node-group {
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .relation-graph-svg .node-group:hover {
      opacity: 0.85;
    }

    .relation-graph-svg .edge-line {
      stroke-linecap: round;
    }

    .relation-graph-svg .edge-label-bg {
      fill: white;
      opacity: 0.85;
    }

    .relation-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 0 8px;
      justify-content: center;
    }

    .relation-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      color: #64748b;
    }

    .relation-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .relation-detail {
      padding: 10px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-top: 8px;
      animation: fadeInDetail 0.2s ease;
    }

    @keyframes fadeInDetail {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .relation-detail-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .relation-detail-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .relation-detail-badge.CAUSAL { background: #fee2e2; color: #dc2626; }
    .relation-detail-badge.SIMILAR { background: #fef3c7; color: #d97706; }
    .relation-detail-badge.HEDGE { background: #dcfce7; color: #16a34a; }
    .relation-detail-badge.CORRELATED { background: #dbeafe; color: #2563eb; }
    .relation-detail-badge.PREREQUISITE { background: #f3e8ff; color: #9333ea; }

    .relation-detail-strength {
      font-size: 10px;
      color: #94a3b8;
      margin-left: auto;
    }

    .relation-detail-title {
      font-size: 12px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .relation-detail-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .relation-detail-price {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }

    .relation-detail-source {
      font-size: 10px;
      color: #94a3b8;
      padding: 1px 5px;
      background: #f1f5f9;
      border-radius: 3px;
    }

    .relation-detail-insight {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      padding: 6px 8px;
      background: #f8fafc;
      border-radius: 6px;
      border-left: 3px solid #a5b4fc;
      margin-bottom: 8px;
    }

    .relation-detail-actions {
      display: flex;
      gap: 6px;
    }

    .relation-detail-btn {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-decoration: none;
    }

    .relation-detail-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .relation-detail-btn.primary {
      background: #4F46E5;
      border-color: #4F46E5;
      color: white;
    }

    .relation-detail-btn.primary:hover {
      background: #4338ca;
    }
  `;
}

function getTimelineStyles(): string {
  return `
    .timeline-chart-container {
      position: sticky;
      top: 0;
      z-index: 5;
      background: white;
      padding: 8px 12px 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    .timeline-chart-canvas {
      width: 100%;
      height: 120px;
      background: #f8fafc;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    }

    .timeline-chart-canvas canvas {
      width: 100%;
      height: 100%;
    }

    .timeline-filters {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      flex-shrink: 0;
    }

    .timeline-period-btn {
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
    }

    .timeline-period-btn:hover {
      border-color: #a5b4fc;
      color: #4F46E5;
    }

    .timeline-period-btn.active {
      background: #4F46E5;
      border-color: #4F46E5;
      color: white;
    }

    .timeline-filter-sep {
      width: 1px;
      height: 16px;
      background: #e2e8f0;
      margin: 0 2px;
    }

    .timeline-impact-btn {
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .timeline-impact-btn:hover {
      border-color: #fbbf24;
      color: #d97706;
    }

    .timeline-impact-btn.active {
      background: #fef3c7;
      border-color: #fbbf24;
      color: #92400e;
    }

    .timeline-feed {
      flex: 1;
      overflow-y: auto;
      padding: 4px 12px 12px;
    }

    .timeline-axis {
      position: relative;
      padding-left: 20px;
    }

    .timeline-axis::before {
      content: '';
      position: absolute;
      left: 5px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, #a5b4fc, #e2e8f0);
      border-radius: 1px;
    }

    .timeline-time-marker {
      position: relative;
      padding: 8px 0 2px;
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .timeline-time-marker::before {
      content: '';
      position: absolute;
      left: -19px;
      top: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #a5b4fc;
      border: 2px solid white;
      box-shadow: 0 0 0 1px #e2e8f0;
    }

    .timeline-card {
      position: relative;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      margin: 4px 0 10px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .timeline-card:hover {
      border-color: #a5b4fc;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
    }

    .timeline-card::before {
      content: '';
      position: absolute;
      left: -16px;
      top: 16px;
      width: 10px;
      height: 1px;
      background: #e2e8f0;
    }

    .timeline-card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .timeline-card-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .timeline-card-source {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .timeline-card-time {
      font-size: 10px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .timeline-card-title {
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

    .timeline-card-footer {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .timeline-impact-tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }

    .timeline-impact-tag.bullish { background: #dcfce7; color: #166534; }
    .timeline-impact-tag.bearish { background: #fee2e2; color: #991b1b; }
    .timeline-impact-tag.neutral { background: #f1f5f9; color: #64748b; }

    .timeline-price-jump {
      font-size: 10px;
      font-weight: 600;
      margin-left: auto;
    }

    .timeline-price-jump.up { color: #10b981; }
    .timeline-price-jump.down { color: #ef4444; }

    .timeline-card.anomaly {
      border-left: 3px solid #f59e0b;
      background: #fffbeb;
    }

    .timeline-card.anomaly.high-severity {
      border-left-color: #ef4444;
      background: #fef2f2;
    }

    .timeline-card-detail {
      display: none;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }

    .timeline-card.expanded .timeline-card-detail {
      display: block;
    }

    .timeline-card-detail a {
      color: #4F46E5;
      text-decoration: none;
      font-weight: 500;
    }

    .timeline-card-detail a:hover {
      text-decoration: underline;
    }

    .timeline-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f0f4ff;
      font-size: 11px;
      color: #475569;
      flex-shrink: 0;
    }

    .timeline-summary-stat {
      display: flex;
      align-items: center;
      gap: 3px;
      font-weight: 600;
    }
  `;
}

function getChartTooltipStyles(): string {
  return `
    .chart-news-tooltip {
      position: fixed;
      z-index: 999999;
      pointer-events: none;
      max-width: 280px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
      font-family: "PingFang SC", "MiSans", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.15s, transform 0.15s;
    }

    .chart-news-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .chart-news-tooltip-header {
      padding: 8px 12px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chart-news-tooltip-body {
      padding: 8px 12px;
      max-height: 200px;
      overflow-y: auto;
    }

    .chart-news-item {
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .chart-news-item:last-child {
      border-bottom: none;
    }

    .chart-news-item-title {
      font-size: 11px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 3px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .chart-news-item-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #94a3b8;
    }

    .chart-news-sentiment {
      display: inline-flex;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 600;
    }

    .chart-news-sentiment.bullish { background: #dcfce7; color: #166534; }
    .chart-news-sentiment.bearish { background: #fee2e2; color: #991b1b; }
    .chart-news-sentiment.neutral { background: #f1f5f9; color: #64748b; }

    .chart-news-empty {
      padding: 8px 0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }

    .chart-event-marker {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f59e0b;
      border: 1.5px solid white;
      box-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 50;
    }

    .chart-event-marker.high {
      background: #ef4444;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
    }
  `;
}

function getDarkModeStyles(): string {
  return `
    @media (prefers-color-scheme: dark) {
      .enhancement-panel {
        background: #1e293b;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
      }

      .section {
        background: #334155;
      }

      .section-title, .arb-value, .news-title {
        color: #f1f5f9;
      }

      .news-meta, .arb-name {
        color: #94a3b8;
      }

      .arbitrage-item, .news-item {
        border-color: #475569;
      }

      .summary-card {
        background: #1e293b;
        border-color: #475569;
      }

      .summary-card.conclusion.bullish {
        background: linear-gradient(135deg, #064e3b33, #065f4633);
      }

      .summary-card.conclusion.bearish {
        background: linear-gradient(135deg, #7f1d1d33, #991b1b33);
      }

      .summary-card.conclusion.neutral {
        background: linear-gradient(135deg, #78350f33, #92400e33);
      }

      .one-liner { color: #e2e8f0; }
      .key-driver, .metric-key, .confidence-tag { color: #94a3b8; }
      .metric-val { color: #f1f5f9; }
      .metrics-label, .risk-header { color: #cbd5e1; }
      .risk-alert-item { color: #cbd5e1; }

      .panel-footer {
        background: #0f172a;
        border-color: #334155;
      }

      .relation-graph-svg .edge-label-bg {
        fill: #1e293b;
      }

      .relation-detail {
        background: #334155;
        border-color: #475569;
      }

      .relation-detail-title, .relation-detail-price {
        color: #f1f5f9;
      }

      .relation-detail-insight {
        background: #1e293b;
        color: #94a3b8;
      }

      .relation-detail-btn {
        background: #334155;
        border-color: #475569;
        color: #cbd5e1;
      }

      .relation-detail-btn:hover {
        background: #475569;
        color: #f1f5f9;
      }

      .relation-detail-source {
        background: #475569;
        color: #94a3b8;
      }

      .relation-legend-item {
        color: #94a3b8;
      }

      .chart-news-tooltip {
        background: #1e293b;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      }

      .chart-news-item { border-color: #334155; }
      .chart-news-item-title { color: #f1f5f9; }
      .chart-news-item-meta { color: #64748b; }

      .panel-tabs {
        background: #0f172a;
        border-color: #334155;
      }

      .panel-tab { color: #94a3b8; }
      .panel-tab.active { color: #a5b4fc; border-bottom-color: #a5b4fc; background: #1e293b; }
      .panel-tab:hover { background: #1e293b; color: #a5b4fc; }

      .close-panel-btn { background: #334155; color: #94a3b8; }
      .close-panel-btn:hover { background: #475569; color: #e2e8f0; }

      .timeline-chart-container { background: #1e293b; border-color: #334155; }
      .timeline-chart-canvas { background: #0f172a; }
      .timeline-filters { background: #1e293b; }
      .timeline-period-btn { background: #334155; border-color: #475569; color: #94a3b8; }
      .timeline-period-btn.active { background: #4F46E5; border-color: #4F46E5; color: white; }
      .timeline-impact-btn { background: #334155; border-color: #475569; color: #94a3b8; }

      .timeline-card { background: #334155; border-color: #475569; }
      .timeline-card:hover { border-color: #6366f1; }
      .timeline-card-title { color: #f1f5f9; }
      .timeline-card-source { color: #94a3b8; }
      .timeline-card-detail { color: #94a3b8; border-color: #475569; }

      .timeline-card.anomaly { background: #422006; border-left-color: #f59e0b; }
      .timeline-card.anomaly.high-severity { background: #450a0a; border-left-color: #ef4444; }

      .timeline-summary { background: #0f172a; color: #94a3b8; }

      /* Community Sentiment Dark Mode */
      .sentiment-summary { background: #1e293b; border-color: #6366f1; }
      .summary-text { color: #e2e8f0; }

      /* Velocity Dark Mode */
      .velocity-hot { background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%); border-color: #dc2626; color: #fca5a5; }
      .velocity-up { background: linear-gradient(135deg, #052e16 0%, #14532d 100%); border-color: #16a34a; color: #86efac; }
      .velocity-stable { background: #1e293b; border-color: #475569; color: #94a3b8; }
      .velocity-down { background: linear-gradient(135deg, #422006 0%, #713f12 100%); border-color: #ca8a04; color: #fde047; }
      .velocity-cold { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border-color: #3b82f6; color: #93c5fd; }

      .wilson-stats { background: #1e293b; border-color: #475569; }
      .wilson-label { color: #94a3b8; }
      .wilson-range { color: #e2e8f0; }
      .wilson-bar { background: linear-gradient(90deg, #7f1d1d 0%, #713f12 50%, #14532d 100%); }
      .wilson-range-fill { background: rgba(129, 140, 248, 0.3); border-color: #818cf8; }
      .wilson-marker { background: #f1f5f9; }
      .wilson-labels { color: #64748b; }
      .wilson-counts { color: #94a3b8; }
      .favored-option { background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-color: #047857; }
      .favored-label { color: #a7f3d0; }
      .favored-name { color: #34d399; }
      .option-name { color: #f1f5f9; }
      .option-stats { color: #94a3b8; }
      .option-mention-bar { background: #475569; }
      .argument-item { color: #cbd5e1; }
      .argument-option { background: #312e81; color: #a5b4fc; }
      .argument-count { color: #64748b; }
      .notable-comment { background: #1e293b; border-color: #475569; }
      .comment-text { color: #e2e8f0; }
      .comment-meta { color: #64748b; }
      .sentiment-footer { color: #64748b; border-color: #475569; }
      .sentiment-meta { color: #64748b; }

      .sentiment-badge.bullish { background: #064e3b; color: #34d399; }
      .sentiment-badge.bearish { background: #450a0a; color: #f87171; }
      .sentiment-badge.neutral { background: #334155; color: #94a3b8; }
      .sentiment-badge.divided { background: #422006; color: #fbbf24; }

      /* Multi-Option Wilson Dark Mode */
      .wilson-stats.multi-option { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); }
      .wilson-meta { color: #94a3b8; }
      .multi-option-wilson-item { background: #0f172a; border-color: #475569; }
      .multi-option-wilson-item.top-option { border-color: #047857; background: linear-gradient(135deg, #0f172a 0%, #052e16 100%); }
      .multi-option-wilson-header .option-rank { color: #64748b; }
      .multi-option-wilson-header .option-name { color: #f1f5f9; }
      .multi-option-wilson-header .top-badge { background: #065f46; color: #6ee7b7; }
      .multi-option-wilson-header .option-ci { color: #a5b4fc; }
      .multi-option-wilson-bar { background: #475569; }
      .multi-option-wilson-bar .wilson-ci-range { background: rgba(129, 140, 248, 0.3); }
      .multi-option-wilson-item.top-option .wilson-ci-range { background: rgba(16, 185, 129, 0.35); }
      .multi-option-wilson-bar .wilson-point { background: #818cf8; border-color: #1e293b; }
      .multi-option-wilson-item.top-option .wilson-point { background: #34d399; }
      .multi-option-wilson-labels { color: #64748b; }
      .multi-option-wilson-labels span:nth-child(2) { color: #94a3b8; }
    }
  
* { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: opacity 100ms linear !important; } }
`;
}
