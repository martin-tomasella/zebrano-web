/** @type {import('tailwindcss').Config} */
const tok = n => `rgb(var(--z-${n}-c) / <alpha-value>)`
const names = ['canvas','surface','subtle','inset','line','line-2','ink','ink-2','ink-3','ink-4',
  'primary','primary-2','on-primary','gold','success','warning','orange','danger','info','ai',
  'nav','nav-2','nav-ink','nav-ink-2','nav-accent']

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: { z: Object.fromEntries(names.map(n => [n, tok(n)])) },
      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['Instrument Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: { z: 'var(--z-shadow)', 'z-sm': 'var(--z-shadow-sm)', 'z-lg': 'var(--z-shadow-lg)' },
    },
  },
  plugins: [],
}
