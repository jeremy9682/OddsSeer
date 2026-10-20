import React from 'react';
import {
  Globe,
  Moon,
  Sun,
  Monitor,
  Bell,
  MousePointer2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useExtensionStore } from '../../../hooks/useExtensionStore';

export function SettingsTab() {
  const { settings, setSettings } = useExtensionStore();

  const t = settings.language === 'zh' ? {
    general: '通用设置',
    language: '语言',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
    features: '功能开关',
    floatingBall: '悬浮球',
    floatingBallDesc: '在页面右侧显示快捷悬浮球',
    pageEnhancement: '页面增强',
    pageEnhancementDesc: '自动识别并标注预测市场信息',
    textSelection: '划词分析',
    textSelectionDesc: '选中文本后显示相关市场',
    notifications: '通知提醒',
    notificationsDesc: '接收关注市场的价格变动通知',
    about: '关于',
    version: '版本',
    feedback: '反馈建议',
    privacy: '隐私政策'
  } : {
    general: 'General',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    features: 'Features',
    floatingBall: 'Floating Ball',
    floatingBallDesc: 'Show quick access floating ball',
    pageEnhancement: 'Page Enhancement',
    pageEnhancementDesc: 'Auto-detect and highlight prediction markets',
    textSelection: 'Text Selection',
    textSelectionDesc: 'Show related markets on text selection',
    notifications: 'Notifications',
    notificationsDesc: 'Receive price alerts for saved markets',
    about: 'About',
    version: 'Version',
    feedback: 'Feedback',
    privacy: 'Privacy Policy'
  };

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={t.features}
      onClick={() => onChange(!enabled)}
      className={`
        relative w-10 h-6 rounded-full transition-colors
        ${enabled ? 'bg-polymarket-primary' : 'bg-extension-border'}
      `}
    >
      <span
        className={`
          absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
          ${enabled ? 'left-5' : 'left-1'}
        `}
      />
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* General Settings */}
      <section className="p-4 border-b border-extension-border">
        <h3 className="text-sm font-medium text-extension-text mb-3">{t.general}</h3>
        
        {/* Language */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-extension-text-muted" />
            <span className="text-sm text-extension-text">{t.language}</span>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ language: e.target.value as 'zh' | 'en' })}
            className="px-3 py-1 text-sm rounded-lg border border-extension-border bg-extension-bg text-extension-text"
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Theme */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            {settings.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-extension-text-muted" />
            ) : settings.theme === 'light' ? (
              <Sun className="w-4 h-4 text-extension-text-muted" />
            ) : (
              <Monitor className="w-4 h-4 text-extension-text-muted" />
            )}
            <span className="text-sm text-extension-text">{t.theme}</span>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
            className="px-3 py-1 text-sm rounded-lg border border-extension-border bg-extension-bg text-extension-text"
          >
            <option value="light">{t.light}</option>
            <option value="dark">{t.dark}</option>
            <option value="system">{t.system}</option>
          </select>
        </div>
      </section>

      {/* Features */}
      <section className="p-4 border-b border-extension-border">
        <h3 className="text-sm font-medium text-extension-text mb-3">{t.features}</h3>
        
        <div className="space-y-3">
          {/* Floating Ball */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <MousePointer2 className="w-4 h-4 text-extension-text-muted" />
                <span className="text-sm text-extension-text">{t.floatingBall}</span>
              </div>
              <p className="text-xs text-extension-text-muted ml-6">{t.floatingBallDesc}</p>
            </div>
            <ToggleSwitch
              enabled={settings.enableFloatingBall}
              onChange={(v) => setSettings({ enableFloatingBall: v })}
            />
          </div>

          {/* Page Enhancement */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-extension-text-muted" />
                <span className="text-sm text-extension-text">{t.pageEnhancement}</span>
              </div>
              <p className="text-xs text-extension-text-muted ml-6">{t.pageEnhancementDesc}</p>
            </div>
            <ToggleSwitch
              enabled={settings.enablePageEnhancement}
              onChange={(v) => setSettings({ enablePageEnhancement: v })}
            />
          </div>

          {/* Text Selection */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <MousePointer2 className="w-4 h-4 text-extension-text-muted" />
                <span className="text-sm text-extension-text">{t.textSelection}</span>
              </div>
              <p className="text-xs text-extension-text-muted ml-6">{t.textSelectionDesc}</p>
            </div>
            <ToggleSwitch
              enabled={settings.enableTextSelection}
              onChange={(v) => setSettings({ enableTextSelection: v })}
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-extension-text-muted" />
                <span className="text-sm text-extension-text">{t.notifications}</span>
              </div>
              <p className="text-xs text-extension-text-muted ml-6">{t.notificationsDesc}</p>
            </div>
            <ToggleSwitch
              enabled={settings.enableNotifications}
              onChange={(v) => setSettings({ enableNotifications: v })}
            />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-extension-text mb-3">{t.about}</h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-extension-text-muted">{t.version}</span>
            <span className="text-sm text-extension-text">0.1.0</span>
          </div>
          
          <p className="text-xs text-extension-text-muted leading-relaxed">{settings.language === 'zh' ? '网页扫描和划词搜索由你点击触发；查询发往配置的后端或公共市场接口。预测市场增强页会读取公开市场数据与评论。' : 'Page scans and selection searches run when you click. Queries go to your configured backend or public market APIs. Market enhancement pages read public market data and comments.'}</p>
        </div>
      </section>
    </div>
  );
}

