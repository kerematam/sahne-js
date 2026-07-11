import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	server: {
		strictPort: true,
		ws: {
			protocol: 'ws',
			host: 'localhost',
			clientPort: 5173
		}
	}
});
