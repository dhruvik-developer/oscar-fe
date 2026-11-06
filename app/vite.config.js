import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { networkInterfaces } from 'node:os';

/** This PC's Wi-Fi / LAN address, so a QR scanned on a phone reaches the dev server. */
function lanAddress() {
  const addresses = Object.values(networkInterfaces()).flat()
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  return addresses.find((a) => a.startsWith('192.168.')) || addresses[0] || '';
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_LAN_IP': JSON.stringify(lanAddress()),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
