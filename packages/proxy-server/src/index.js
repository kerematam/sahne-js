var socks = require('socksv5');

var srv = socks.createServer(function (info, accept, deny) {
	console.log('info', info.dstAddr);
	accept();
});

srv.listen(1080, 'localhost', function (args) {
	console.log('SOCKS server listening on port 1080');
});

srv.useAuth(socks.auth.None());
