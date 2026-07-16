import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B1220", 900: "#101A2E", 800: "#16233D",
          700: "#1F3054", 600: "#2C4270",
        },
        brand: {
          50: "#EEF4FF", 100: "#DCE7FE", 300: "#94B4FA",
          500: "#3D6BF3", 600: "#2B52D8", 700: "#2242AE",
        },
        mint: { 400: "#34D8A4", 500: "#17C08D", 600: "#0FA476" },
        amber: { 400: "#FBBF24", 500: "#F59E0B" },
        coral: { 400: "#FB7185", 500: "#F04E63", 600: "#D63A50" },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,18,32,.06), 0 8px 24px -12px rgba(11,18,32,.12)",
        pop: "0 12px 40px -12px rgba(11,18,32,.28)",
      },
    },
  },
  plugins: [],
};
export default config;
