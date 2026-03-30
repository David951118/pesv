import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          950: "#0a0a0f",
          900: "#111118",
          800: "#1e1e2a",
          700: "#2d2d3d",
          600: "#3d3d50",
          500: "#5c5c73",
          400: "#8888a0",
          300: "#b0b0c0",
          200: "#d0d0da",
          100: "#e8e8ee",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
