type BackendStatusReply = {
  success?: boolean;
  data?: { success?: boolean; capabilities?: { search?: string } };
};

export function formatBackendStatus(reply: BackendStatusReply, zh: boolean): string {
  if (!reply.success || !reply.data || reply.data.success === false) return zh ? '后端离线' : 'Backend offline';
  switch (reply.data.capabilities?.search) {
    case 'hybrid': return zh ? '后端在线 · 混合检索已配置' : 'Backend online · Hybrid search configured';
    case 'public_keyword': return zh ? '后端在线 · 公共市场搜索' : 'Backend online · Public market search';
    case 'unavailable': return zh ? '后端在线 · 检索不可用（请检查配置）' : 'Backend online · Search unavailable (check configuration)';
    default: return zh ? '后端在线 · 检索状态未知' : 'Backend online · Search status unknown';
  }
}
