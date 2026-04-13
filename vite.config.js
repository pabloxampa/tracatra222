import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        ruleta: resolve(__dirname, 'ruleta.html'),
        blackjack: resolve(__dirname, 'blackjack.html'),
        slots: resolve(__dirname, 'slots.html'),
        cartera: resolve(__dirname, 'cartera.html'),
      },
    },
  },
})
