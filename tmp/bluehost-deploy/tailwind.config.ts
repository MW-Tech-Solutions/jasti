import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        jostum: {
          50: "#eef7f2",
          100: "#d7ebdf",
          200: "#b1d8c1",
          300: "#86c1a0",
          400: "#59a87a",
          500: "#3f8e62",
          600: "#2f6f4d",
          700: "#275740",
          800: "#214737",
          900: "#1c3a2f",
        },
        slate: {
          25: "#fafafa",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        lift: "0 12px 24px rgba(15, 23, 42, 0.14)",
      },
      borderRadius: {
        xl: "0.9rem",
      },
      fontFamily: {
        sans: ["\"Plus Jakarta Sans\"", "ui-sans-serif", "system-ui"],
        display: ["\"Newsreader\"", "ui-serif", "Georgia"],
      },
    },
  },
  plugins: [],
}

export default config
