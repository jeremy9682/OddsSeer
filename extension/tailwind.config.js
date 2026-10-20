/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./entrypoints/**/*.{js,ts,jsx,tsx,html}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./content/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Polymarket 品牌色
        polymarket: {
          primary: '#4F46E5',
          secondary: '#7C3AED',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444'
        },
        // 插件主题色
        extension: {
          bg: 'var(--ext-bg, #ffffff)',
          'bg-secondary': 'var(--ext-bg-secondary, #f8fafc)',
          text: 'var(--ext-text, #0f172a)',
          'text-muted': 'var(--ext-text-muted, #64748b)',
          border: 'var(--ext-border, #e2e8f0)',
          accent: 'var(--ext-accent, #4F46E5)'
        }
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      },
      boxShadow: {
        'float': '0 8px 30px rgba(0, 0, 0, 0.12)',
        'popup': '0 4px 20px rgba(0, 0, 0, 0.15)'
      }
    }
  },
  plugins: []
};

