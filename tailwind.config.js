/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',
      red: {
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
      },
      dark: {
        50: '#f8f8f8',
        100: '#f0f0f0',
        200: '#e0e0e0',
        300: '#d0d0d0',
        400: '#a0a0a0',
        500: '#666',
        600: '#555',
        700: '#444',
        800: '#2a2a2a',
        900: '#1a1a1a',
        950: '#101010',
      },
      blue: {
        400: '#4a9eff',
        500: '#3b82f6',
      }
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
    },
    extend: {},
  },
}
