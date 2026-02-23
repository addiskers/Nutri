/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#b455a0',
        'text-dark': '#0f1729',
        'text-gray': '#65758b',
        'border-gray': '#e1e7ef',
        'bg-light': '#f3f3f3',
      },
      fontFamily: {
        'ibm-plex': ['"IBM Plex Sans"', 'sans-serif'],
        'poppins': ['Poppins', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

