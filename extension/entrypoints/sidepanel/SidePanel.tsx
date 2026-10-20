import React, { useEffect, useState } from 'react';
import {
  Star,
  Settings,
  Loader2,
  ExternalLink,
  User
} from 'lucide-react';
import { useExtensionStore } from '../../hooks/useExtensionStore';
import { createMessageListener, sendToBackground } from '../../utils/messaging';
import { MyMarketsTab } from './tabs/MyMarketsTab';
import { SettingsTab } from './tabs/SettingsTab';
import { AccountTab } from './tabs/AccountTab';

// Tab 配置
const TABS = [
  { id: 'markets' as const, labelZh: '我的市场', labelEn: 'My Markets', icon: Star },
  { id: 'account' as const, labelZh: '账户', labelEn: 'Account', icon: User },
  { id: 'settings' as const, labelZh: '设置', labelEn: 'Settings', icon: Settings }
];

export function SidePanel() {
  const {
    settings,
    sidebarTab,
    setSidebarTab,
    selectedMarket,
    setSelectedMarket,
    pageContext,
    setPageContext,
    isAnalyzing,
    error
  } = useExtensionStore();


  const [isLoading, setIsLoading] = useState(true);

  // 监听来自 Content Script 和 Background 的消息
  useEffect(() => {
    createMessageListener({
      MARKET_SELECTED: async () => {
        const response = await sendToBackground('GET_SELECTED_MARKET');
        setSelectedMarket(response.success ? response.data || null : null);
      },
      SET_PAGE_CONTEXT: (payload) => {
        if (payload?.context) {
          setPageContext(payload.context);
        }
      },

    });

    // 检测系统主题并更新图标
    const updateThemeIcon = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      sendToBackground('UPDATE_ICON_THEME', { isDark });
    };

    // 初始化时更新图标
    updateThemeIcon();

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateThemeIcon);

    // 初始化完成
    setIsLoading(false);

    return () => {
      mediaQuery.removeEventListener('change', updateThemeIcon);
    };
  }, []);

  // 获取当前页面上下文和已选中的市场
  useEffect(() => {
    const initialize = async () => {
      // 获取页面上下文
      const contextResponse = await sendToBackground('GET_PAGE_CONTEXT');
      if (contextResponse.success && contextResponse.data) {
        setPageContext(contextResponse.data);
      }

      // 获取之前选中的市场（如果有）
      const marketResponse = await sendToBackground('GET_SELECTED_MARKET');
      console.log('[SidePanel] GET_SELECTED_MARKET response:', marketResponse);
      if (marketResponse.success) {
        setSelectedMarket(marketResponse.data || null);
      }
    };
    initialize();
  }, []);

  const t = settings.language === 'zh' ? {
    title: 'OddsSeer',
    subtitle: '预测市场智能助手',
    loading: '加载中...'
  } : {
    title: 'OddsSeer',
    subtitle: 'Prediction Market Assistant',
    loading: 'Loading...'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-extension-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-polymarket-primary" />
          <p className="text-sm text-extension-text-muted">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-extension-bg">

      {/* Tab Navigation */}
      <nav className="flex-shrink-0 flex border-b border-extension-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-1 text-xs
                transition-colors duration-200
                ${isActive
                  ? 'text-polymarket-primary border-b-2 border-polymarket-primary bg-polymarket-primary/5'
                  : 'text-extension-text-muted hover:text-extension-text hover:bg-extension-bg-secondary'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{settings.language === 'zh' ? tab.labelZh : tab.labelEn}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden">
        {sidebarTab === 'markets' && <MyMarketsTab />}
        {sidebarTab === 'account' && <AccountTab />}
        {sidebarTab === 'settings' && <SettingsTab />}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 border-t border-extension-border bg-extension-bg-secondary">
        <div className="flex items-center justify-between text-xs text-extension-text-muted">
          <span>
            {settings.language === 'zh' ? '本地模式 · 无需账户' : 'Local mode · No account needed'}
          </span>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-polymarket-primary transition-colors"
          >
            Polymarket <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}

