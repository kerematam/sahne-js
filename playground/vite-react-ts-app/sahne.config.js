// @ts-check
import { defineConfig } from 'sahne-js';

const target = 'http://localhost:4173';

export default defineConfig({
	initialUrl: target,
	puppeteerOptions: {},
	interceptor: [
		{
			match: 'http://localhost:4173/**',
			ignore: 'http://localhost:4173/api/**',
			proxy: 'http://localhost:5173'
		}
	]
});
