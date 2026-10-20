/**
 * 消息桥接工具
 * 用于 Content Script <-> Background <-> SidePanel 通信
 */

import type { Message, MessageResponse, MessageType } from './types';

/**
 * 检查扩展上下文是否有效
 */
function isExtensionContextValid(): boolean {
  try {
    // 尝试访问 chrome.runtime.id，如果上下文无效会抛出错误
    return !!(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * 发送消息到 Background Script（带重试机制）
 */
export async function sendToBackground<T = any, R = any>(
  type: MessageType,
  payload?: T,
  options?: { maxRetries?: number; retryDelay?: number }
): Promise<MessageResponse<R>> {
  const maxRetries = options?.maxRetries ?? 2;
  const retryDelay = options?.retryDelay ?? 1000;
  
  // 检查扩展上下文是否有效（热重载后可能失效）
  if (!isExtensionContextValid()) {
    console.error('[Messaging] ❌ Extension context invalid before sending:', type);
    return {
      success: false,
      error: 'Extension context invalidated. Please refresh the page.'
    };
  }
  
  const message: Message<T> = {
    type,
    payload,
    timestamp: Date.now()
  };
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Messaging] 🔄 Retry attempt ${attempt}/${maxRetries} for ${type}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // 重新检查上下文
        if (!isExtensionContextValid()) {
          console.error('[Messaging] ❌ Context invalidated during retry');
          return {
            success: false,
            error: 'Extension context invalidated. Please refresh the page.'
          };
        }
      }
      
      console.log(`[Messaging] 📤 Sending to background: ${type}`, payload ? { payloadKeys: Object.keys(payload) } : 'no payload');
      
      const response = await chrome.runtime.sendMessage(message);
      
      console.log(`[Messaging] 📥 Response from background for ${type}:`, {
        hasResponse: !!response,
        success: response?.success,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        error: response?.error
      });
      
      return response || { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 检查是否是可重试的错误
      const isRetryableError = errorMessage.includes('message channel closed') ||
                               errorMessage.includes('Receiving end does not exist') ||
                               errorMessage.includes('Could not establish connection');
      
      if (errorMessage.includes('Extension context invalidated')) {
        console.warn('[Messaging] ⚠️ Context invalidated, please refresh the page');
        return {
          success: false,
          error: errorMessage
        };
      }
      
      // 如果是可重试的错误且还有重试次数，继续重试
      if (isRetryableError && attempt < maxRetries) {
        console.warn(`[Messaging] ⚠️ Retryable error for ${type}, will retry:`, errorMessage);
        continue;
      }
      
      console.error('[Messaging] ❌ Failed to send message to background:', error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  // 理论上不会到达这里，但为了类型安全
  return {
    success: false,
    error: 'Max retries exceeded'
  };
}

/**
 * 发送消息到当前标签页的 Content Script
 */
export async function sendToContentScript<T = any, R = any>(
  tabId: number,
  type: MessageType,
  payload?: T
): Promise<MessageResponse<R>> {
  try {
    const message: Message<T> = {
      type,
      payload,
      timestamp: Date.now()
    };
    
    const response = await chrome.tabs.sendMessage(tabId, message);
    return response || { success: true };
  } catch (error) {
    console.error('[Extension] Failed to send message to content script:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 发送消息到所有打开的扩展页面（SidePanel, Popup 等）
 * 在 Manifest V3 中，使用 chrome.runtime.sendMessage 广播
 */
export async function broadcastToExtensionPages<T = any>(
  type: MessageType,
  payload?: T
): Promise<void> {
  const message: Message<T> = {
    type,
    payload,
    timestamp: Date.now()
  };
  
  // Manifest V3: 使用 runtime.sendMessage 广播到所有扩展页面
  // SidePanel, Popup 等都会通过 onMessage 监听到
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // 忽略 "Could not establish connection" 错误
    // 这通常意味着没有打开的扩展页面在监听
    const errorMessage = String(error);
    if (!errorMessage.includes('Could not establish connection') &&
        !errorMessage.includes('Receiving end does not exist')) {
      console.warn('[Messaging] Broadcast error:', error);
    }
  }
}

/**
 * 创建消息监听器
 */
export function createMessageListener(
  handlers: Partial<Record<MessageType, (payload: any, sender: chrome.runtime.MessageSender) => Promise<any> | any>>
): void {
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string' || sender.id !== chrome.runtime.id) return false;
    const handler = handlers[message.type];
    
    if (handler) {
      const result = handler(message.payload, sender);
      
      // 如果是 Promise，异步处理
      if (result instanceof Promise) {
        // 标记响应是否已发送，防止重复发送
        let responseSent = false;
        
        const safeResponse = (response: any) => {
          if (responseSent) {
            console.warn(`[MessageListener] ⚠️ Response already sent for ${message.type}, skipping`);
            return;
          }
          responseSent = true;
          try {
            sendResponse(response);
          } catch (e) {
            // 如果 sendResponse 失败（通道已关闭），记录但不抛出
            console.error(`[MessageListener] ❌ sendResponse failed for ${message.type}:`, e);
          }
        };
        
        result
          .then(data => {
            console.log(`[MessageListener] 📤 Sending async response for ${message.type}:`, {
              success: true,
              hasData: !!data,
              dataKeys: data ? Object.keys(data) : [],
              dataSuccess: data?.success,
              hasNestedData: !!data?.data
            });
            safeResponse({ success: true, data });
          })
          .catch(error => {
            console.error(`[MessageListener] ❌ Error for ${message.type}:`, error);
            safeResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          });
        return true; // 表示会异步响应
      }
      
      // 同步响应
      console.log(`[MessageListener] 📤 Sending sync response for ${message.type}`);
      sendResponse({ success: true, data: result });
    }
    
    return false;
  });
}

/**
 * 存储工具函数 (使用 extStorage 避免与 wxt/storage 冲突)
 */
export const extStorage = {
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? defaultValue;
  },
  
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
  
  async getAll(): Promise<Record<string, any>> {
    return chrome.storage.local.get();
  },
  
  // 监听存储变化
  onChange(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }
};

/**
 * 打开侧边栏
 */
export async function openSidePanel(windowId?: number): Promise<void> {
  try {
    const currentWindowId = windowId ?? (await chrome.windows.getCurrent()).id;
    if (currentWindowId) {
      await chrome.sidePanel.open({ windowId: currentWindowId });
    }
  } catch (error) {
    console.error('[Extension] Failed to open side panel:', error);
  }
}

/**
 * 获取当前标签页
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * 注入 CSS 到页面
 */
export async function injectCSS(tabId: number, css: string): Promise<void> {
  await chrome.scripting.insertCSS({
    target: { tabId },
    css
  });
}

/**
 * 创建桌面通知
 */
export function createNotification(
  id: string,
  options: {
    title: string;
    message: string;
    iconUrl?: string;
    type?: 'basic' | 'image' | 'list' | 'progress';
  }
): void {
  chrome.notifications.create(id, {
    type: options.type || 'basic',
    iconUrl: options.iconUrl || chrome.runtime.getURL('icon/128.png'),
    title: options.title,
    message: options.message
  });
}

