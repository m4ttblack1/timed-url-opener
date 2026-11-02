/** @type {import('tailwindcss').Config} */

// Premium theme: near-black surfaces, gold primary, chrome secondary.
const midnightGold = {
  "midnight-gold": {
    "primary": "#d4af37",
    "primary-content": "#0b0b10",
    "secondary": "#c0c5ce",
    "secondary-content": "#0b0b10",
    "accent": "#f5d76e",
    "accent-content": "#0b0b10",
    "neutral": "#1a1a22",
    "neutral-content": "#e6e6ea",
    "base-100": "#0b0b10",
    "base-200": "#14141c",
    "base-300": "#1e1e28",
    "base-content": "#e9e6df",
    "info": "#7dd3fc",
    "info-content": "#0b0b10",
    "success": "#86efac",
    "success-content": "#0b0b10",
    "warning": "#fbbf24",
    "warning-content": "#0b0b10",
    "error": "#f87171",
    "error-content": "#0b0b10",
    "--rounded-box": "0.75rem",
    "--rounded-btn": "0.5rem"
  }
}

module.exports = {
  content: ["./src/**/*.{tsx,html,js,jsx}"],
  darkMode: "media",
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: [
      midnightGold,
      "light",
      "dark",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "cyberpunk",
      "valentine",
      "halloween",
      "garden",
      "forest",
      "aqua",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
      "dim",
      "nord",
      "sunset"
    ],
    darkTheme: "midnight-gold"
  }
}
