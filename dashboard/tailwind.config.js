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
        void: {
          DEFAULT: '#08090A',
          deep: '#050607',
          card: '#0D0F12',
          elevated: '#12151A',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-subtle': 'rgba(255, 255, 255, 0.04)',
          'border-strong': 'rgba(255, 255, 255, 0.16)',
        },
        omium: {
          coral: '#e86a38',
          'coral-hover': '#f07848',
          'coral-glow': 'rgba(232, 106, 56, 0.18)',
          sky: '#6ea8fe',
          emerald: '#34d399',
          amber: '#f2c94c',
          rose: '#f87171',
          text: '#f7f8f8',
          secondary: '#8a8f98',
          tertiary: '#5b616e',
        },
        // Keep carbon aliases for existing components
        carbon: {
          950: '#08090A',
          900: '#0D0F12',
          850: '#12151A',
          800: '#181C24',
          700: '#232936',
          600: '#334155',
        },
        neon: {
          cyan: '#6ea8fe',
          emerald: '#34d399',
          amber: '#f2c94c',
          rose: '#f87171',
          violet: '#a78bfa',
          sky: '#38bdf8',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'omium-card': '0 0 0 1px rgba(255, 255, 255, 0.06), 0 4px 20px -2px rgba(0, 0, 0, 0.7)',
        'omium-glow': '0 0 24px -4px rgba(232, 106, 56, 0.25)',
        'omium-cyan': '0 0 24px -4px rgba(110, 168, 254, 0.25)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(232, 106, 56, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(232, 106, 56, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
