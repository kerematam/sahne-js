// @ts-check

import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import fs from 'fs';

const app = express();
const port = 8080;

// Middleware to parse cookies
app.use(cookieParser());

const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/test', (req, res) => {
	res.send('Hello World!');
});

// Middleware to check for x-sahne header with value "true"
function requireXSahneHeader(req, res, next) {
	// console.log('req', req.route.path, req.headers);

	if (req.headers['x-sahne'] === 'true') {
		next();
	} else {
		res.status(403).send('Forbidden: x-sahne header is required with value "true"');
	}
}

// Middleware to check for sahne cookie
function requireSahneCookie(req, res, next) {
	if (req.cookies.sahne) {
		next();
	} else {
		res.status(403).send('Forbidden: sahne cookie is required');
	}
}

// Endpoint to get todos from todos.json
app.get('/api/todos', (req, res) => {
	fs.readFile(path.join(__dirname, './server/data/todos.json'), 'utf8', (err, data) => {
		if (err) {
			console.error(err);
			res.status(500).send('Internal Server Error');
		} else {
			res.json(JSON.parse(data));
		}
	});
});

// requires x-sahne header with value "true"
app.get('/api/require-x-sahne-header', requireXSahneHeader, requireSahneCookie, (req, res) => {
	res.json({ data: 'Header x-sahne is present with value true' });
	// res.send('Header x-sahne is present with value true and sahne cookie is set');
});

// requires x-sahne header with value "true"
// and respond with redirect to another api
app.get('/redirect-to-another-api', (req, res) => {
	res.redirect('/api/another-api');
});

// still requires x-sahne header with value "true"
app.get('/api/another-api', requireXSahneHeader, requireSahneCookie, (req, res) => {
	res.json({ data: 'You have been redirected to another API' });

	// res.send('You have been redirected to another API');
});

app.listen(port, () => {
	console.log(`Server is running at http://localhost:${port}`);
});
