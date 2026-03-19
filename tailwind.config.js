/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00d4a0',
          dark: '#00a87e',
          light: '#33ddaf'
        },
        dark: {
          bg: '#0a0f1e',
          surface: '#111827',
          card: '#1a2332',
          border: '#1e3048'
        }
      },
      fontFamily: {
        sans: ['Ubuntu', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
}
