import { defineConfig } from 'sahne-js';

const target = 'http://localhost:4173';

export default defineConfig({
	initialUrl: target,
	interceptor: [
		{
			match: 'http://localhost:4173/**',
			ignore: '/mock-api/*',
			proxyOrigin: 'http://localhost:5173'
		}
	]
});
