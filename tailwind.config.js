/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        ink: '#171717',
        graphite: '#2b2b2b',
        mist: '#f6f6f3',
        porcelain: '#fbfbf9',
        line: '#e6e3dc',
        teal: '#007f73',
        coral: '#e05a47',
        amber: '#b98213',
        violet: '#6a5acd',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(23, 23, 23, 0.10)',
        line: '0 0 0 1px rgba(23, 23, 23, 0.08)',
      },
    },
  },
  plugins: [],
};
