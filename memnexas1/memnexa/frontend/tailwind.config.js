/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        blob: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(30px,-20px) scale(1.1)" } },
        pulsering: { "0%": { transform: "scale(.95)", opacity: ".55" }, "100%": { transform: "scale(1.7)", opacity: "0" } },
        fadeup: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        slide: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(250%)" } },
      },
      animation: {
        float: "float 6s ease-in-out infinite", blob: "blob 14s ease-in-out infinite", pulsering: "pulsering 2.2s ease-out infinite",
        fadeup: "fadeup .6s ease-out both", slide: "slide 1.4s ease-in-out infinite",
      },
      colors: { brand: { DEFAULT: "#6366F1", hover: "#4F46E5", light: "#EEF2FF" } },
    },
  },
  plugins: [],
};
