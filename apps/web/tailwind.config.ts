import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          app: "#0F0F0F",
          canvas: "#0A0A0A",
          panel: "#141414",
          elevated: "#1C1C1C",
          hover: "#222222",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.12)",
        },
        fg: {
          DEFAULT: "#EDEDED",
          2: "#A1A1A1",
          3: "#6B6B6B",
        },
        ai: {
          DEFAULT: "#D9A55B",
          soft: "rgba(217,165,91,0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "6px" },
    },
  },
  plugins: [],
};
export default config;
