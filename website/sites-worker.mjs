const assetRequest = (request, pathname) => {
	const url = new URL(request.url);
	url.pathname = pathname;
	return new Request(url, request);
};

const withStatus = (response, status) =>
	new Response(response.body, {
		status,
		headers: response.headers
	});

const worker = {
	async fetch(request, env) {
		const url = new URL(request.url);
		const response = await env.ASSETS.fetch(request);
		if (response.status !== 404 || !['GET', 'HEAD'].includes(request.method)) return response;

		const finalSegment = url.pathname.split('/').at(-1) ?? '';
		if (!finalSegment.includes('.')) {
			const htmlPath = url.pathname.endsWith('/')
				? `${url.pathname}index.html`
				: `${url.pathname}.html`;
			const htmlResponse = await env.ASSETS.fetch(assetRequest(request, htmlPath));
			if (htmlResponse.status !== 404) return htmlResponse;
		}

		const notFound = await env.ASSETS.fetch(assetRequest(request, '/404.html'));
		return notFound.status === 404 ? response : withStatus(notFound, 404);
	}
};

export default worker;
