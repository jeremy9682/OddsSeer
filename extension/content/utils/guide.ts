/**
 * Extension guide/onboarding utility
 */

import { createShadowHost, escapeHtml } from './dom';
import { isZhLanguage } from '../state';

let guidePanel: HTMLElement | null = null;

/**
 * Show extension guide/onboarding panel
 * @param message Optional message to display as a toast instead of full guide
 */
export function showExtensionGuide(message?: string): void {
  // If a simple message is provided, show a quick toast-like notification
  if (message) {
    showQuickGuide(message);
    return;
  }

  // Don't show if already visible
  if (guidePanel && document.body.contains(guidePanel)) {
    return;
  }

  const isZh = isZhLanguage();
  const { host, shadow } = createShadowHost('oddsseer-guide');

  const style = document.createElement('style');
  style.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .guide-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    }

    .guide-panel {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 480px;
      width: 90%;
      overflow: hidden;
      animation: slideUp 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .guide-header {
      padding: 24px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      text-align: center;
    }

    .guide-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .guide-subtitle {
      font-size: 14px;
      opacity: 0.9;
    }

    .guide-content {
      padding: 24px;
    }

    .guide-feature {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .guide-feature:last-child {
      border-bottom: none;
    }

    .guide-feature-icon {
      font-size: 28px;
      flex-shrink: 0;
    }

    .guide-feature-text h3 {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .guide-feature-text p {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }

    .guide-footer {
      padding: 16px 24px;
      background: #f8fafc;
      display: flex;
      gap: 12px;
    }

    .guide-btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .guide-btn-secondary {
      background: white;
      border: 1px solid #e2e8f0;
      color: #475569;
    }

    .guide-btn-secondary:hover {
      background: #f1f5f9;
    }

    .guide-btn-primary {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
    }

    .guide-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .guide-panel {
        background: #1e293b;
      }

      .guide-feature-text h3 {
        color: #f1f5f9;
      }

      .guide-feature-text p {
        color: #94a3b8;
      }

      .guide-footer {
        background: #0f172a;
      }

      .guide-btn-secondary {
        background: #334155;
        border-color: #475569;
        color: #e2e8f0;
      }

      .guide-btn-secondary:hover {
        background: #475569;
      }
    }
  `;

  const features = [
    {
      icon: '🔮',
      title: isZh ? '悬浮球快捷入口' : 'Floating Ball',
      desc: isZh
        ? '点击页面右下角的悬浮球，快速打开AI分析面板'
        : 'Click the floating ball to quickly open the AI analysis panel'
    },
    {
      icon: '✨',
      title: isZh ? '划词搜索' : 'Text Selection Search',
      desc: isZh
        ? '选中任意文本，即可搜索相关预测市场'
        : 'Select any text to search for related prediction markets'
    },
    {
      icon: '📊',
      title: isZh ? '页面增强' : 'Page Enhancement',
      desc: isZh
        ? '在预测市场页面自动显示AI分析面板，提供市场洞察'
        : 'Auto-show AI analysis panel on prediction market pages'
    },
    {
      icon: '🔍',
      title: isZh ? '页面扫描' : 'Page Scan',
      desc: isZh
        ? '扫描新闻页面，自动识别相关预测事件'
        : 'Scan news pages to identify related prediction events'
    }
  ];

  const panel = document.createElement('div');
  panel.className = 'guide-overlay';
  panel.innerHTML = `
    <div class="guide-panel">
      <div class="guide-header">
        <div class="guide-title">🔮 OddsSeer</div>
        <div class="guide-subtitle">${isZh ? '您的预测市场智能助手' : 'Your Intelligent Prediction Market Assistant'}</div>
      </div>
      <div class="guide-content">
        ${features
          .map(
            f => `
          <div class="guide-feature">
            <span class="guide-feature-icon">${f.icon}</span>
            <div class="guide-feature-text">
              <h3>${escapeHtml(f.title)}</h3>
              <p>${escapeHtml(f.desc)}</p>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="guide-footer">
        <button class="guide-btn guide-btn-secondary" id="guide-later">
          ${isZh ? '稍后了解' : 'Later'}
        </button>
        <button class="guide-btn guide-btn-primary" id="guide-start">
          ${isZh ? '开始使用' : 'Get Started'}
        </button>
      </div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(panel);
  document.body.appendChild(host);
  guidePanel = host;

  // Event handlers
  const laterBtn = shadow.getElementById('guide-later');
  const startBtn = shadow.getElementById('guide-start');

  const closeGuide = () => {
    panel.style.animation = 'fadeIn 0.2s ease reverse forwards';
    setTimeout(() => {
      host.remove();
      guidePanel = null;
    }, 200);
  };

  laterBtn?.addEventListener('click', closeGuide);
  startBtn?.addEventListener('click', closeGuide);

  // Close on overlay click
  panel.addEventListener('click', (e) => {
    if (e.target === panel) {
      closeGuide();
    }
  });
}

/**
 * Show a quick guide message (tooltip-like)
 */
function showQuickGuide(message: string): void {
  const { host, shadow } = createShadowHost('oddsseer-quick-guide');

  const style = document.createElement('style');
  style.textContent = `
    .quick-guide {
      position: fixed;
      top: 20px;
      right: 80px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
      z-index: 999999;
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;

  const guide = document.createElement('div');
  guide.className = 'quick-guide';
  guide.textContent = message;

  shadow.appendChild(style);
  shadow.appendChild(guide);
  document.body.appendChild(host);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    host.remove();
  }, 3000);
}

/**
 * Hide extension guide
 */
export function hideExtensionGuide(): void {
  if (guidePanel) {
    guidePanel.remove();
    guidePanel = null;
  }
}
