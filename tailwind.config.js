/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        soundwave: {
          "0%": { height: "10%" },
          "100%": { height: "100%" },
        },
      },
      animation: {
        soundwave: "soundwave 0.5s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
