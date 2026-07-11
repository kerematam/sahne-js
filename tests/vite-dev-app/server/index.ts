import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const port = 8080;
const rootDirectory = process.cwd();

app.use(cookieParser());
app.use(express.static(path.join(rootDirectory, 'dist')));

const requireXSahneHeader = (request: Request, response: Response, next: NextFunction) => {
	if (request.headers['x-sahne'] === 'true') {
		next();
		return;
	}

	response.status(403).send('Forbidden: x-sahne header is required with value "true"');
};

const requireSahneCookie = (request: Request, response: Response, next: NextFunction) => {
	if (request.cookies.sahne) {
		next();
		return;
	}

	response.status(403).send('Forbidden: sahne cookie is required');
};

app.get('/api/test', (_request, response) => {
	response.send('Hello World!');
});

app.get('/api/todos', (_request, response) => {
	fs.readFile(path.join(rootDirectory, 'server/data/todos.json'), 'utf8', (error, data) => {
		if (error) {
			console.error(error);
			response.status(500).send('Internal Server Error');
			return;
		}

		response.json(JSON.parse(data));
	});
});

app.get(
	'/api/require-x-sahne-header',
	requireXSahneHeader,
	requireSahneCookie,
	(_request, response) => {
		response.json({ data: 'Header x-sahne is present with value true' });
	}
);

app.get('/redirect-to-another-api', (_request, response) => {
	response.redirect('/api/another-api');
});

app.get('/api/another-api', requireXSahneHeader, requireSahneCookie, (_request, response) => {
	response.json({ data: 'You have been redirected to another API' });
});

app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});
