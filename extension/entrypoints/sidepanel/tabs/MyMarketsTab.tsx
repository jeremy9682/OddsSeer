import React, { useState, useEffect } from 'react';
import {
  Star,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Bell,
  BellOff,
  ExternalLink,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useExtensionStore } from '../../../hooks/useExtensionStore';
import { sendToBackground } from '../../../utils/messaging';
import type { MonitorTask } from '../../../utils/types';

interface MarketPriceData {
  yesPrice: number | null;
  noPrice: number | null;
  priceChange24h?: number;
  loading: boolean;
  error?: string;
}

export function MyMarketsTab() {
  const { settings, monitors, addMonitor, removeMonitor, selectedMarket } = useExtensionStore();
  const [priceData, setPriceData] = useState<Record<string, MarketPriceData>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingAlert, setEditingAlert] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const t = settings.language === 'zh' ? {
    title: '我的市场',
    subtitle: '追踪和监控感兴趣的市场',
    noMarkets: '暂无追踪的市场',
    noMarketsHint: '在 Polymarket 页面点击事件添加追踪',
    addCurrent: '添加当前市场',
    remove: '移除',
    setAlert: '设置提醒',
    removeAlert: '关闭提醒',
    alertWhen: '价格变动超过',
    save: '保存',
    cancel: '取消',
    refresh: '刷新价格',
    refreshing: '刷新中...',
    viewOnPolymarket: '在 Polymarket 查看',
    priceAlert: '价格提醒',
    alertActive: '提醒已开启',
    noAlert: '未设置提醒',
    yes: 'Yes',
    no: 'No',
    change24h: '24h',
    lastUpdate: '更新于',
  } : {
    title: 'My Markets',
    subtitle: 'Track and monitor markets you care about',
    noMarkets: 'No markets tracked',
    noMarketsHint: 'Click on events in Polymarket to add tracking',
    addCurrent: 'Add Current Market',
    remove: 'Remove',
    setAlert: 'Set Alert',
    removeAlert: 'Remove Alert',
    alertWhen: 'Alert when price changes by',
    save: 'Save',
    cancel: 'Cancel',
    refresh: 'Refresh Prices',
    refreshing: 'Refreshing...',
    viewOnPolymarket: 'View on Polymarket',
    priceAlert: 'Price Alert',
    alertActive: 'Alert Active',
    noAlert: 'No Alert',
    yes: 'Yes',
    no: 'No',
    change24h: '24h',
    lastUpdate: 'Updated',
  };

  // Fetch prices for all monitored markets
  const fetchPrices = async (marketIds?: string[]) => {
    const idsToFetch = marketIds || monitors.map(m => m.marketId);
    if (idsToFetch.length === 0) return;

    setIsRefreshing(true);

    // Initialize loading state
    const loadingState: Record<string, MarketPriceData> = {};
    idsToFetch.forEach(id => {
      loadingState[id] = { yesPrice: null, noPrice: null, loading: true };
    });
    setPriceData(prev => ({ ...prev, ...loadingState }));

    // Fetch prices in parallel
    await Promise.all(
      idsToFetch.map(async (marketId) => {
        try {
          const response = await sendToBackground('FETCH_MARKET_REALTIME_PRICE', {
            marketId,
            source: monitors.find(m => m.marketId === marketId)?.source || selectedMarket?.source || 'polymarket'
          });

          if (response.success && response.data?.success !== false) {
            setPriceData(prev => ({
              ...prev,
              [marketId]: {
                yesPrice: response.data?.yesPrice ?? null,
                noPrice: response.data?.noPrice ?? null,
                priceChange24h: response.data?.priceChange24h,
                loading: false
              }
            }));
          } else {
            setPriceData(prev => ({
              ...prev,
              [marketId]: {
                yesPrice: null,
                noPrice: null,
                loading: false,
                error: 'Failed to load'
              }
            }));
          }
        } catch (error) {
          setPriceData(prev => ({
            ...prev,
            [marketId]: {
              yesPrice: null,
              noPrice: null,
              loading: false,
              error: 'Error'
            }
          }));
        }
      })
    );

    setIsRefreshing(false);
  };

  // Load prices on mount and when monitors change
  useEffect(() => {
    if (monitors.length > 0) {
      fetchPrices();
    }
  }, [monitors.length]);

  // Add current market to watchlist
  const handleAddMarket = async () => {
    if (!selectedMarket) return;

    // Check if already exists
    if (monitors.some(m => m.marketId === selectedMarket.id)) {
      return;
    }


    const monitor: MonitorTask = {
      id: `market-${Date.now()}`,
      marketId: selectedMarket.id,
      marketTitle: selectedMarket.title,
      source: selectedMarket.source,
      type: 'price_change',
      condition: {},  // No alert by default
      createdAt: Date.now()
    };

    await addMonitor(monitor);
    // Fetch price for new market
    fetchPrices([selectedMarket.id]);
  };

  // Update alert threshold for a market
  const handleSetAlert = async (monitor: MonitorTask) => {
    await addMonitor({
      ...monitor,
      condition: {
        threshold: alertThreshold
      }
    });
    setEditingAlert(null);
  };

  // Remove alert but keep tracking
  const handleRemoveAlert = async (monitor: MonitorTask) => {
    await addMonitor({
      ...monitor,
      condition: {},
      triggered: false
    });
  };

  const isMarketAdded = selectedMarket && monitors.some(m => m.marketId === selectedMarket.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-extension-border">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium text-extension-text flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            {t.title}
          </h3>
          <div className="flex items-center gap-1">
            {monitors.length > 0 && (
              <button
                onClick={() => fetchPrices()}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg text-extension-text-muted hover:bg-extension-bg-secondary transition-colors disabled:opacity-50"
                title={t.refresh}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {selectedMarket && !isMarketAdded && (
              <button
                onClick={handleAddMarket}
                className="p-1.5 rounded-lg bg-polymarket-primary/10 text-polymarket-primary hover:bg-polymarket-primary/20 transition-colors"
                title={t.addCurrent}
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-extension-text-muted">{t.subtitle}</p>
      </div>

      {/* Markets List */}
      <div className="flex-1 overflow-y-auto">
        {monitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-extension-bg-secondary flex items-center justify-center mb-3">
              <Star className="w-6 h-6 text-extension-text-muted" />
            </div>
            <p className="text-sm text-extension-text-muted mb-1">{t.noMarkets}</p>
            <p className="text-xs text-extension-text-muted">{t.noMarketsHint}</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {monitors.map((monitor) => {
              const price = priceData[monitor.marketId];
              const isExpanded = expandedId === monitor.id;
              const hasAlert = monitor.condition.threshold !== undefined;

              return (
                <div
                  key={monitor.id}
                  className="rounded-xl border border-extension-border bg-extension-bg-secondary overflow-hidden"
                >
                  {/* Main Row */}
                  <div
                    className="p-3 cursor-pointer hover:bg-extension-bg-secondary/80"
                    onClick={() => setExpandedId(isExpanded ? null : monitor.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium text-extension-text line-clamp-2 flex-1">
                        {monitor.marketTitle}
                      </h4>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-extension-text-muted flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-extension-text-muted flex-shrink-0" />
                      )}
                    </div>

                    {/* Price Display */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {price?.loading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-6 bg-extension-bg animate-pulse rounded" />
                          </div>
                        ) : price?.yesPrice != null ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-lg font-bold text-green-600">
                                {Math.round(price.yesPrice * 100)}%
                              </span>
                              <span className="text-xs text-extension-text-muted">{t.yes}</span>
                            </div>
                            {price.priceChange24h !== undefined && (
                              <div className={`flex items-center gap-0.5 text-xs ${
                                price.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {price.priceChange24h >= 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {price.priceChange24h >= 0 ? '+' : ''}{price.priceChange24h.toFixed(1)}%
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-extension-text-muted">--</span>
                        )}
                      </div>

                      {/* Alert Status Badge */}
                      {hasAlert && (
                        <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          monitor.triggered
                            ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {monitor.triggered ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <Bell className="w-3 h-3" />
                          )}
                          ±{monitor.condition.threshold}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-extension-border/50">
                      {/* Alert Setting Form */}
                      {editingAlert === monitor.id ? (
                        <div className="mb-3 p-2 bg-extension-bg rounded-lg">
                          <label className="text-xs text-extension-text-muted block mb-2">
                            {t.alertWhen}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={alertThreshold}
                              onChange={(e) => setAlertThreshold(Number(e.target.value))}
                              min={1}
                              max={50}
                              className="w-16 px-2 py-1 text-sm rounded border border-extension-border bg-extension-bg text-extension-text"
                            />
                            <span className="text-sm text-extension-text-muted">%</span>
                            <div className="flex-1" />
                            <button
                              onClick={() => handleSetAlert(monitor)}
                              className="px-3 py-1 text-xs font-medium rounded bg-polymarket-primary text-white hover:opacity-90"
                            >
                              {t.save}
                            </button>
                            <button
                              onClick={() => setEditingAlert(null)}
                              className="px-3 py-1 text-xs rounded border border-extension-border text-extension-text-muted hover:bg-extension-bg-secondary"
                            >
                              {t.cancel}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={monitor.source === 'kalshi' ? `https://kalshi.com/events/${encodeURIComponent(monitor.marketId)}` : `https://polymarket.com/event/${encodeURIComponent(monitor.marketId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-extension-bg hover:bg-extension-border transition-colors text-extension-text"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t.viewOnPolymarket}
                        </a>

                        {hasAlert ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAlert(monitor);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-extension-bg hover:bg-extension-border transition-colors text-extension-text-muted"
                          >
                            <BellOff className="w-3 h-3" />
                            {t.removeAlert}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAlertThreshold(5);
                              setEditingAlert(monitor.id);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors text-blue-600 dark:text-blue-400"
                          >
                            <Bell className="w-3 h-3" />
                            {t.setAlert}
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMonitor(monitor.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
