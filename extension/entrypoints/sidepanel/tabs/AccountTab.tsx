import React, { useEffect, useState } from 'react';
import { useExtensionStore } from '../../../hooks/useExtensionStore';
import { sendToBackground } from '../../../utils/messaging';
import { formatBackendStatus } from '../../../utils/backend-status';
export function AccountTab() {
  const { settings } = useExtensionStore();
  const zh = settings.language === 'zh';
  const [status, setStatus] = useState<string>('…');
  useEffect(() => { let active = true;
    sendToBackground('GET_BACKEND_STATUS').then(r => { if (active) setStatus(formatBackendStatus(r, zh)); }).catch(() => { if (active) setStatus(formatBackendStatus({ success: false }, zh)); });
    return () => { active = false; };
  }, [zh]);
  return <section className="p-4 text-sm text-extension-text space-y-4">
    <h2 className="text-lg font-medium">{zh ? '本地模式' : 'Local mode'}</h2>
    <p>{zh ? '无需登录。收藏、提醒和设置保存在当前浏览器中。此版本不创建钱包、不接收私钥，也不执行充值或交易。' : 'No sign-in required. Saved markets, alerts and settings stay in this browser. This version does not create wallets, accept private keys, fund accounts or execute trades.'}</p>
    <p>{zh ? '评论分析由自部署后端提供。配置模型密钥与允许来源后，打开市场页可能自动发送公开评论并产生模型费用；关闭页面增强或不配置密钥可停用。' : 'Comment analysis uses your backend. With a model key and allowed origin configured, opening a market page may automatically send public comments to the model and incur charges. Disable page enhancement or leave the key unset to opt out.'}</p>
    <h3 className="font-medium">{zh ? '后端状态' : 'Backend status'}</h3>
    <p role="status" className="p-3 rounded-lg bg-extension-bg-secondary">{status}</p>
  </section>;
}
