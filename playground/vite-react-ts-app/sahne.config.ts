import { defineConfig } from 'sahne-js';

const target = 'http://localhost:4173';

export default defineConfig({
	initialUrl: target,
	interceptor: {
		match: `${target}/**`,
		ignore: `${target}/api/**`,
		proxy: 'http://localhost:5173'
	}
});
