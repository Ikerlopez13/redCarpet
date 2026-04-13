/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "primary": "#FF3131",
        "background-light": "#f6f8f6",
        "background-dark": "#0d0d0d",
        "card-dark": "#1a1212",
        "safety-orange": "#ff9800",
        "safety-red": "#f44336",
      },
      fontFamily: {
        "sans": ["Inter", "sans-serif"],
        "display": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "xl": "0.75rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
}
