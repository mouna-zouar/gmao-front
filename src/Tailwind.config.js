/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "'Segoe UI'", "sans-serif"],
      },
      colors: {
        gmao: {
          DEFAULT: "#0f766e",
          bg: "#eefaf8",
        },
      },
    },
  },
  plugins: [],
};