/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bullet: {
          bg: 'var(--bullet-bg, #080c14)',
          panel: 'var(--bullet-panel, #0d131f)',
          surface: 'var(--bullet-surface, #131b2e)',
          elevated: 'var(--bullet-elevated, #1a243c)',
          border: 'var(--bullet-border, #23304b)',
          borderLight: 'var(--bullet-border-light, #324263)',
          amber: '#f59e0b',
          amberDark: '#b45309',
          cyan: '#06b6d4',
          emerald: '#10b981',
          rose: '#f43f5e',
          textMuted: 'var(--bullet-text-muted, #94a3b8)',
          textBright: 'var(--bullet-text-bright, #f8fafc)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

