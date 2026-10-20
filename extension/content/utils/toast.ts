import { escapeHtml } from './dom';
/**
 * Toast notification utility for content scripts
 */

import { createShadowHost } from './dom';

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }

  const { host, shadow } = createShadowHost('oddsseer-toast-container');

  const style = document.createElement('style');
  style.textContent = `
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 10px;
      background: white;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #334155;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      max-width: 320px;
    }

    .toast.success {
      border-left: 3px solid #10b981;
    }

    .toast.error {
      border-left: 3px solid #ef4444;
    }

    .toast.warning {
      border-left: 3px solid #f59e0b;
    }

    .toast.info {
      border-left: 3px solid #3b82f6;
    }

    .toast-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    .toast-close {
      padding: 2px;
      border: none;
      background: none;
      cursor: pointer;
      color: #94a3b8;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .toast-close:hover {
      opacity: 1;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .toast {
        background: #1e293b;
        color: #e2e8f0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      }

      .toast-close {
        color: #64748b;
      }
    }
  `;

  const container = document.createElement('div');
  container.className = 'toast-container';

  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(host);

  toastContainer = container;
  return container;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  duration?: number;
  closable?: boolean;
}

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  const { duration = 3000, closable = true } = options;
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    ${closable ? '<button class="toast-close">×</button>' : ''}
  `;

  // Close button handler
  if (closable) {
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => removeToast(toast));
  }

  container.appendChild(toast);

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
}

function removeToast(toast: HTMLElement): void {
  toast.style.animation = 'slideOut 0.3s ease-in forwards';
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/**
 * Clear all toasts
 */
export function clearAllToasts(): void {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
}
