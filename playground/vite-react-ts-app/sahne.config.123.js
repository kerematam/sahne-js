// @ts-check
import { defineConfig } from 'sahne-js';

const target = 'http://localhost:4173';

export default defineConfig({
	initialUrl: target,
	puppeteerOptions: {
		launch: {
			args: ['--proxy-server=socks5h://localhost:1080']
		}
	},
	interceptor: [
		{
			match: 'http://localhost:4173/**',
			fallback: 'http://localhost:4173/hello',
			proxy: 'http://localhost:5173',
			onProxyFail: (error) => {
				console.log('onProxyFail', error);
			},
			overrideRequestBody: () => null
		},
		{
			match: 'http://localhost:4173/hello',
			file: './1.json'
		}
	]
});
