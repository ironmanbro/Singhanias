/* Tailwind build config. To rebuild styles.css after editing index.html:
   npx tailwindcss@3.4.17 -c tailwind.config.js -i input.css -o styles.css --minify */
module.exports = {
  content: ['./index.html', './fx.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FAF6F0', card: '#F4ECE1', terracotta: '#9E3B1C', saffron: '#C85A32',
          gold: '#D99B26', dark: '#2D2522', muted: '#7C6E68', indigo: '#2F4B7C'
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Yatra One"', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'sans-serif']
      }
    }
  }
}
