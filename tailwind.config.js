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
        "sans": ["Arial", "Helvetica", "sans-serif"],
        "display": ["Arial", "Helvetica", "sans-serif"]
      },
      borderRadius: {
        "lg": "0.5rem",
        "xl": "0.625rem",
        "2xl": "0.875rem",
        "3xl": "1rem",
      },
    },
  },
  plugins: [],
}
