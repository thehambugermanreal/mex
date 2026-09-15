import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  appType: 'mpa',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
