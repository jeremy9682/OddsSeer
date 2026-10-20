/**
 * 插件全局状态管理 (Zustand)
 */

import { create } from 'zustand';
import { extStorage, sendToBackground } from '../utils/messaging';
import type {
  UserSettings,
  MarketEvent,
  AIAnalysisResult,
  AnalysisStep,
  MonitorTask,
  PageContext
} from '../utils/types';

// 默认设置
const DEFAULT_SETTINGS: UserSettings = {
  language: 'zh',
  theme: 'system',
  enableFloatingBall: true,
  enablePageEnhancement: true,
  enableTextSelection: true,
  enableNotifications: true,
  floatingBallPosition: { x: 20, y: 20 },
  preferredModel: 'deepseek/deepseek-chat',
  priceAlertThreshold: 5,
  isPro: false,
  dailyAnalysisCount: 0,
  dailyAnalysisLimit: 3
};

interface ExtensionState {
  // 用户设置
  settings: UserSettings;
  setSettings: (settings: Partial<UserSettings>) => Promise<void>;
  loadSettings: () => Promise<void>;
  
  // 当前页面上下文
  pageContext: PageContext | null;
  setPageContext: (context: PageContext | null) => void;
  
  // 当前选中的市场
  selectedMarket: MarketEvent | null;
  setSelectedMarket: (market: MarketEvent | null) => void;
  
  // 分析状态
  isAnalyzing: boolean;
  setIsAnalyzing: (value: boolean) => void;
  analysisSteps: AnalysisStep[];
  setAnalysisSteps: (steps: AnalysisStep[]) => void;
  addAnalysisStep: (step: AnalysisStep) => void;
  analysisResult: AIAnalysisResult | null;
  setAnalysisResult: (result: AIAnalysisResult | null) => void;
  
  // 监控任务
  monitors: MonitorTask[];
  loadMonitors: () => Promise<void>;
  addMonitor: (monitor: MonitorTask) => Promise<void>;
  removeMonitor: (id: string) => Promise<void>;
  
  // 侧边栏状态
  sidebarTab: 'markets' | 'account' | 'settings';
  setSidebarTab: (tab: 'markets' | 'account' | 'settings') => void;
  
  // 错误状态
  error: string | null;
  setError: (error: string | null) => void;
  
  // 重置状态
  resetAnalysis: () => void;
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  // 用户设置
  settings: DEFAULT_SETTINGS,
  
  setSettings: async (newSettings) => {
    const currentSettings = get().settings;
    const mergedSettings = { ...currentSettings, ...newSettings };
    set({ settings: mergedSettings });
    await extStorage.set('settings', mergedSettings);
  },
  
  loadSettings: async () => {
    const savedSettings = await extStorage.get<UserSettings>('settings');
    if (savedSettings) {
      set({ settings: { ...DEFAULT_SETTINGS, ...savedSettings } });
    }
  },
  
  // 页面上下文
  pageContext: null,
  setPageContext: (context) => set({ pageContext: context }),
  
  // 选中的市场
  selectedMarket: null,
  setSelectedMarket: (market) => set({ selectedMarket: market }),
  
  // 分析状态
  isAnalyzing: false,
  setIsAnalyzing: (value) => set({ isAnalyzing: value }),
  
  analysisSteps: [],
  setAnalysisSteps: (steps) => set({ analysisSteps: steps }),
  addAnalysisStep: (step) => set((state) => ({
    analysisSteps: [...state.analysisSteps.filter(s => s.step !== step.step), step]
  })),
  
  analysisResult: null,
  setAnalysisResult: (result) => set({ analysisResult: result }),
  
  // 监控任务
  monitors: [],
  
  loadMonitors: async () => {
    const monitors = await extStorage.get<MonitorTask[]>('monitors', []);
    set({ monitors: monitors || [] });
  },
  
  addMonitor: async (monitor) => {
    const response = await sendToBackground('ADD_MONITOR', monitor);
    if (!response.success) throw new Error(response.error || 'Could not save monitor');
    set({ monitors: response.data });
  },

  removeMonitor: async (id) => {
    const response = await sendToBackground('REMOVE_MONITOR', { id });
    if (!response.success) throw new Error(response.error || 'Could not remove monitor');
    set({ monitors: response.data });
  },

  // 侧边栏
  sidebarTab: 'markets',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  
  // 错误
  error: null,
  setError: (error) => set({ error }),
  
  // 重置
  resetAnalysis: () => set({
    isAnalyzing: false,
    analysisSteps: [],
    analysisResult: null,
    error: null
  })
}));

// 初始化加载设置
export async function initializeStore(): Promise<void> {
  const store = useExtensionStore.getState();
  await store.loadSettings();
  await store.loadMonitors();
}


chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.monitors) useExtensionStore.setState({ monitors: changes.monitors.newValue || [] });
});
