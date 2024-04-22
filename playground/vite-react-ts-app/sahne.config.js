// @ts-check
import { defineConfig } from 'sahne-js';
// const fetch = require('node-fetch');
import fetch, { Headers } from 'node-fetch';

const target = 'https://google.com';

export default defineConfig({
	initialUrl: target,
	puppeteerOptions: {
		launch: {
			args: ['--proxy-server=socks5h://localhost:1080']
		}
	},
	// interceptor: [
	// 	{
	// 		match: 'http://localhost:4173/**',
	// 		fallback: 'http://localhost:4173/hello',
	// 		proxy: 'http://localhost:5173',
	// 		onProxyFail: (error) => {
	// 			console.log('onProxyFail', error);
	// 		}
	// 	},
	// 	{
	// 		match: 'http://localhost:4173/hello',
	// 		file: './1.json'
	// 	}
	// ]
});
