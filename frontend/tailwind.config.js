/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f3e8f5',
          100: '#e1bee7',
          200: '#ce93d8',
          300: '#ba68c8',
          400: '#ab47bc',
          500: '#9c27b0', // NYU Purple base
          600: '#8b1fa2', // NYU Purple
          700: '#7b1fa2',
          800: '#6a1b9a',
          900: '#4a148c', // Dark NYU Purple
        },
        nyu: {
          purple: '#57068C', // Official NYU Purple
          'purple-light': '#8B3A93',
          'purple-dark': '#4A148C',
        },
        status: {
          clear: '#10b981', // green
          'one-strike': '#f59e0b', // yellow/amber
          blocked: '#ef4444', // red
        },
      },
    },
  },
  plugins: [],
};
