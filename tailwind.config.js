/* Tailwind build config. To rebuild styles.css after editing index.html:
   npx tailwindcss@3.4.17 -c tailwind.config.js -i input.css -o styles.css --minify */
module.exports = {
  content: ['./index.html', './fx.js', './build-your-dabba/*.{html,js}', './admin/*.{html,js}', './extras.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F5EBDD', card: '#EADCC6', terracotta: '#641E2B', saffron: '#8C3A4B',
          gold: '#B99A58', dark: '#3C3029', muted: '#6B5A50', indigo: '#3C3029'
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Yatra One"', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'sans-serif']
      }
    }
  }
}
