import { defineConfig } from 'wxt';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  vite: () => ({ esbuild: { drop: ['console', 'debugger'] } }),
  manifest: () => {
    const api = new URL(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787');
    if (api.username || api.password || api.search || api.hash || api.pathname !== '/') throw new Error('VITE_API_URL must be an origin without credentials');
    if (api.protocol !== 'https:' && !(api.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(api.hostname))) throw new Error('Backend must use HTTPS or local loopback HTTP');
    return {
      name: 'OddsSeer', version: '0.1.0', minimum_chrome_version: '116',
      description: 'Contextual prediction market search and analysis across the web',
      permissions: ['storage', 'sidePanel', 'activeTab', 'contextMenus', 'notifications', 'alarms'],
      host_permissions: [`${api.origin}/*`, 'https://gamma-api.polymarket.com/*', 'https://clob.polymarket.com/*', 'https://data-api.polymarket.com/*', 'https://api.elections.kalshi.com/*'],
      content_security_policy: { extension_pages: "script-src 'self'; object-src 'self';" },
      side_panel: { default_path: 'sidepanel.html' },
      icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
      action: { default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' }, default_title: 'Open OddsSeer' },
    };
  }
});
