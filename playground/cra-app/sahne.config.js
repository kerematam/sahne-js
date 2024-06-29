// @ts-check
const { defineConfig } = require('sahne-js');

const target = 'http://localhost:8080';

module.exports = defineConfig({
	initialUrl: target,
	puppeteerOptions: {},
	interceptor: [
		{
			match: `${target}/**`,
			ignore: `${target}/api/**`,
			proxy: 'http://localhost:3000'
		}
	]
});
