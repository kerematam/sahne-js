const http = require('http');

const hostname = '127.0.0.1';
const port = 3333;

const server = http.createServer((req, res) => {
	if (req.url === '/api/hello') {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ message: 'Hello, API!' }));
		console.log(req.headers);
	} else if (req.url === '/hello') {
		res.statusCode = 404;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ message: 'Not Found!' }));
	} else if (req.url === '/redirect') {
		res.statusCode = 302;
		res.setHeader('Location', 'http://localhost:4172');
		res.end();
		console.log(req.headers);
	} else {
		res.statusCode = 404;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ message: 'Not Found' }));
	}
});

server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});
