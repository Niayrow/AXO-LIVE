import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        om: {
          coral: "#E8574A",
          "coral-dark": "#D44A3E",
          green: "#3A7D5C",
          "green-light": "#E8F5EE",
          charcoal: "#2D3436",
          muted: "#636E72",
          surface: "#F7F8FA",
          border: "#E8ECF0",
        },
      },
      fontFamily: {
        nunito: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        om: "16px",
        "om-lg": "20px",
      },
      boxShadow: {
        om: "0 4px 24px rgba(45, 52, 54, 0.08)",
        "om-lg": "0 8px 32px rgba(45, 52, 54, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
