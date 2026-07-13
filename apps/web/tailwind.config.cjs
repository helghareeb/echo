/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { arabic: ["arabic", "shamel", "sans-serif"] },
    },
  },
  plugins: [require("daisyui")],
  daisyui: { themes: ["light", "dark"], logs: false },
};
