/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mario: {
          red: '#E52521',
          blue: '#049CD8',
          yellow: '#FBD000',
          green: '#43B047',
          brown: '#A46422',
        },
        retro: {
          bg: '#5C94FC',
          ground: '#C84C0C',
          block: '#D88C08',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        game: ['"VT323"', 'monospace'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'coin-spin': 'spin 1s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
