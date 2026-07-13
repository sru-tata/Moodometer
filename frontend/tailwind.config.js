/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1B29",
        moodplum: "#3D2C5F",
        moodviolet: "#7C5CBF",
        moodlilac: "#B9A6E0",
        moodmint: "#4FD6B9",
        moodcoral: "#F2664B",
        moodgold: "#F2B84B",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(61, 44, 95, 0.25)",
      },
    },
  },
  plugins: [],
};
