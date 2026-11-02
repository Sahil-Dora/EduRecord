/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neumorphic surface base
        surface: {
          base: '#e6e9ef',
          light: '#eceff5',
          dark: '#d1d6e0',
        },
        primary: {
          50: '#eef2f8',
          100: '#d6e0ee',
          200: '#b3c6df',
          300: '#8aa6cc',
          400: '#5e83b5',
          500: '#4a6fa5',
          600: '#3a5a8e',
          700: '#2f4a76',
          800: '#283f64',
          900: '#233653',
          950: '#1a2740',
        },
        neutral: {
          50: '#f2f4f8',
          100: '#e6e9ef',
          200: '#d1d6e0',
          300: '#b0b8c8',
          400: '#8a94a8',
          500: '#6b7588',
          600: '#545d70',
          700: '#404756',
          800: '#2d3142',
          900: '#1e2130',
          950: '#12141d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neu-raised': '6px 6px 12px rgba(163, 177, 198, 0.45), -6px -6px 12px rgba(255, 255, 255, 0.9)',
        'neu-raised-sm': '4px 4px 8px rgba(163, 177, 198, 0.4), -4px -4px 8px rgba(255, 255, 255, 0.85)',
        'neu-raised-lg': '8px 8px 16px rgba(163, 177, 198, 0.5), -8px -8px 16px rgba(255, 255, 255, 0.95)',
        'neu-inset': 'inset 4px 4px 8px rgba(163, 177, 198, 0.4), inset -4px -4px 8px rgba(255, 255, 255, 0.85)',
        'neu-inset-sm': 'inset 3px 3px 6px rgba(163, 177, 198, 0.35), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
      },
    },
  },
  plugins: [],
}
