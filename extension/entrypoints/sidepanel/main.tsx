import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanel } from './SidePanel';
import { initializeStore } from '../../hooks/useExtensionStore';
import '../../styles/globals.css';

function App() {
  useEffect(() => {
    // 初始化存储
    initializeStore();
    
    // 检测系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    
    // 初始设置
    document.documentElement.classList.toggle('dark', mediaQuery.matches);
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <SidePanel />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

