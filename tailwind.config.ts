import type { Config } from 'tailwindcss'

// Design tokens. To rebrand the dashboard, change "primary" and "secondary" below and the two
// matching lines at the top of src/lib/colors.ts. That is the whole job.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0c0c0f',
        surface: '#151519',
        'surface-2': '#1c1c22',
        line: 'rgba(255,255,255,0.09)',
        text: '#ededf0',
        muted: '#8b8b96',
        brand: {
          primary: '#E3A857',
          secondary: '#9B8AFB',
          black: '#000000',
          white: '#FFFFFF',
        },
        accent: {
          primary: '#E3A857',
          secondary: '#9B8AFB',
          green: '#22c55e',
          teal: '#2dd4bf',
          orange: '#D2691E',
          slate: '#64748b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        display: ['"Outfit"', '"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        mini: '10px',
        chip: '10px',
      },
      maxWidth: {
        content: '1280px',
      },
      boxShadow: {
        'glow-green': '0 0 0 1px rgba(34,197,94,0.35), 0 0 24px rgba(34,197,94,0.18)',
        'glow-teal': '0 0 0 1px rgba(45,212,191,0.35), 0 0 24px rgba(45,212,191,0.18)',
        'glow-secondary': '0 0 0 1px rgba(236,45,139,0.35), 0 0 24px rgba(236,45,139,0.18)',
        'glow-orange': '0 0 0 1px rgba(245,158,11,0.35), 0 0 24px rgba(245,158,11,0.18)',
        'glow-primary': '0 0 0 1px rgba(0,174,239,0.35), 0 0 24px rgba(0,174,239,0.18)',
      },
      letterSpacing: {
        number: '-0.02em',
        wordmark: '0.12em',
      },
    },
  },
  plugins: [],
}

export default config
