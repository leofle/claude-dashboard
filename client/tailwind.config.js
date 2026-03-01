/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gh: {
          bg: '#0d1117',
          card: '#161b22',
          border: '#30363d',
          green: '#3fb950',
          blue: '#58a6ff',
          yellow: '#d29922',
          red: '#f85149',
          muted: '#8b949e',
          text: '#e6edf3',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
