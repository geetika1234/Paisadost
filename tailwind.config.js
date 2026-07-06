/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF5EF',
          100: '#D3E8D7',
          200: '#A8D1AF',
          300: '#7AAF84',
          400: '#4D8F5A',
          500: '#3A7248',
          600: '#2E5835',
          700: '#1F3D26',
          800: '#162B1B',
          900: '#0E1C11',
        },
        accent: {
          50:  '#FFF4EC',
          100: '#FFE2C4',
          200: '#FFC48A',
          300: '#FFA050',
          400: '#F08030',
          500: '#D96820',
          600: '#C05010',
        },
        loss: '#DC2626',
        gain: '#16A34A',
        warn: '#D97706',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
