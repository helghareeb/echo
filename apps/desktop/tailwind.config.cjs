/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        arabic: ["arabic", "shamel", "sans-serif"],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"],
    logs: false,
  },
};
