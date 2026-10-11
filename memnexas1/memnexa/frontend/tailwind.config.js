/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: { brand: { DEFAULT: "#6366F1", hover: "#4F46E5", light: "#EEF2FF" } },
    },
  },
  plugins: [],
};
