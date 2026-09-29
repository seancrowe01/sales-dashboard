import type { Config } from 'tailwindcss'

// Design tokens. To rebrand the dashboard, change "primary" and "secondary" below and the two
// matching lines at the top of src/lib/colors.ts. That is the whole job.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#0f1526',
        'surface-2': '#121a2e',
        line: 'rgba(148,163,184,0.14)',
        text: '#f1f5f9',
        muted: '#8b95a7',
        brand: {
          primary: '#4F8CFF',
          secondary: '#A855F7',
          black: '#000000',
          white: '#FFFFFF',
        },
        accent: {
          primary: '#4F8CFF',
          secondary: '#A855F7',
          green: '#22c55e',
          teal: '#2dd4bf',
          orange: '#F59E0B',
          slate: '#64748b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
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
