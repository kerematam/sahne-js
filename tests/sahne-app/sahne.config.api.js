// @ts-check
import { defineConfig } from 'sahne-js';

const target = 'http://localhost:8080';
const devTarget = 'http://localhost:5173';

export default defineConfig({
	initialUrl: target,
	interceptor: [
		{
			ignore: ({ origin }) => origin !== target
		},
		{
			match: () => true,
			proxy: devTarget,
			next: `/api/**`,
			ignore: `/redirect-to-another-api`
		},
		{
			match: `/api/read/me/from/a/file`,
			file: './mock.json',
			// passed here, just to see if it is working
			overrideResponseHeaders: (headers) => headers,
			overrideResponseBody: (body) => body
		},
		{
			match: [`/api/require-x-sahne-header`, `/api/another-api`],
			overrideRequestHeaders: (headers) => ({ ...headers, 'x-sahne': 'true', cookie: 'sahne=true' })
		}
	]
});
