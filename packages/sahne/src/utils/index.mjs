// @ts-check
import urlMatches from './urlMatches.mjs';
import fs from 'fs';
import fetch from 'node-fetch';

/** *
 * @param {import("puppeteer").HTTPRequest} interceptedRequest
 * @returns {Boolean}
 */
export const isRequestHandled = (interceptedRequest) =>
	interceptedRequest.isInterceptResolutionHandled();

/**
 * Creates a handle proxy function that modifies the request URL based on the provided proxy configuration.
 *
 * @param {Object} options - The options for creating the handle proxy function.
 * @param {string|Function} options.proxy - The proxy URL or a function that modifies the request URL.
 * @param {import("puppeteer").HTTPRequest} options.interceptedRequest - The intercepted request object.
 * @returns {import(".").handleProxyUrl} The handle proxy function.
 */
export const makeHandleProxy = ({ proxy, interceptedRequest }) => {
	if (proxy === undefined) return (requestUrl) => requestUrl;

	if (typeof proxy === 'function') return (requestUrl) => proxy(requestUrl, interceptedRequest);

	const proxyUrlParsed = new URL(proxy);
	const proxyUrlSearch = new URLSearchParams(proxyUrlParsed.search);

	const handleProxyUrl = (requestUrl) => {
		const requestUrlParsed = new URL(requestUrl);

		if (requestUrlParsed.protocol !== proxyUrlParsed.protocol) {
			requestUrlParsed.protocol = proxyUrlParsed.protocol;
		}

		if (requestUrlParsed.hostname !== proxyUrlParsed.hostname) {
			requestUrlParsed.hostname = proxyUrlParsed.hostname;
		}

		if (requestUrlParsed.port !== proxyUrlParsed.port) {
			requestUrlParsed.port = proxyUrlParsed.port;
		}

		if (proxyUrlParsed.pathname !== '/') {
			requestUrlParsed.pathname = proxyUrlParsed.pathname + requestUrlParsed.pathname;
		}

		if (proxyUrlParsed.search) {
			const requestUrlSearch = new URLSearchParams(requestUrlParsed.search);
			for (const [key, value] of proxyUrlSearch) requestUrlSearch.set(key, value);
			requestUrlParsed.search = requestUrlSearch.toString();
		}

		return requestUrlParsed.href;
	};

	return handleProxyUrl;
};

const overrideParam = (override, param, options, isReplace = false) => {
	if (override === undefined) return param;

	if (typeof override === 'function') return override(param, options);

	if (isReplace) return override;

	if (typeof override === 'object') return { ...param, ...override };

	throw new Error(`override should be a function or an object. It is ${typeof override}.`);
};

const handleAction = async ({ name, conditionFn, params, action }) => {
	if (conditionFn === undefined) return;

	if (typeof conditionFn === 'function') {
		const result = await conditionFn(params);
		if (typeof result !== 'boolean') {
			throw new Error(
				`${name} should return boolean. It has returned value with type ${typeof conditionFn}.`
			);
		}

		if (result) await action(params);

		return;
	}

	throw new Error(`${name} is not a function. It is ${typeof conditionFn}.`);
};

export const handleOverrideRequest = ({
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	interceptedRequest,
	proxyUrl
}) => {
	const options = {
		method: interceptedRequest.method(),
		headers: interceptedRequest.headers(),
		body: interceptedRequest.postData()
	};

	const additionalParams = { request: interceptedRequest, proxyUrl };
	const requestOptions = overrideParam(overrideRequestOptions, options, additionalParams);
	const headers = overrideParam(overrideRequestHeaders, options.headers, additionalParams);
	const body = overrideParam(overrideRequestBody, options.body, additionalParams, true);

	return { ...requestOptions, headers, body };
};

export const handleOverrideResponse = async ({
	response,
	responseRaw,
	overrideResponseHeaders,
	overrideResponseBody,
	overrideResponseOptions,
	interceptedRequest
}) => {
	const additionalParams = { response, responseRaw, request: interceptedRequest };
	const responseOptions = overrideParam(overrideResponseOptions, response, additionalParams);
	const headers = overrideParam(overrideResponseHeaders, response.headers, additionalParams);
	const body = overrideParam(overrideResponseBody, response.body, additionalParams, true);

	return { ...responseOptions, headers, body };
};

export const handleResponse = async ({
	interceptedRequest,
	response,
	responseRaw,
	onResponse,
	overrideResponseHeaders,
	overrideResponseBody,
	overrideResponseOptions,
	ignoreOnResponse,
	fallbackOnResponse,
	abortOnResponse
}) => {
	const respondOptions = await handleOverrideResponse({
		response,
		responseRaw,
		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,
		interceptedRequest
	});

	const params = {
		request: interceptedRequest,
		response,
		responseRaw,
		url: new URL(interceptedRequest.url())
	};
	await handleAction({
		name: 'ignoreOnResponse',
		conditionFn: ignoreOnResponse,
		params,
		action: () => interceptedRequest.continue()
	});
	if (isRequestHandled(interceptedRequest)) return true;

	await handleAction({
		name: 'abortOnResponse',
		conditionFn: abortOnResponse,
		params,
		action: () => interceptedRequest.abort()
	});
	if (isRequestHandled(interceptedRequest)) return true;

	let isFallbackCalled = false;
	await handleAction({
		name: 'fallbackOnResponse',
		conditionFn: fallbackOnResponse,
		params,
		action: () => {
			isFallbackCalled = true;
		}
	});
	if (isFallbackCalled || isRequestHandled(interceptedRequest)) return;

	const isHandledOnResponse = await handleOnResponse({
		onResponse,
		interceptedRequest,
		responseRaw,
		response
	});
	if (isHandledOnResponse) return;

	await interceptedRequest.respond(respondOptions);
};

export const handleMatch = ({ baseUrl, url, match, interceptedRequest }) => {
	if (match === undefined) return undefined;

	const matches = Array.isArray(match) ? match : [match];
	const matchChecker = (match) =>
		urlMatches({
			parsedUrl: new URL(url),
			baseUrl,
			urlString: url,
			match,
			request: interceptedRequest
		});

	return matches.some(matchChecker);
};

export const handleRequestConfig = async ({
	match,
	ignore,
	abort,
	fallback,
	onRequest,
	interceptedRequest
}) => {
	const url = interceptedRequest.url();
	const parsedUrl = new URL(url);
	const baseUrl = parsedUrl.origin;

	const isMatched = handleMatch({ baseUrl, url, match, interceptedRequest }) ?? true;
	if (!isMatched) return true;

	const isIgnored = handleMatch({ baseUrl, url, match: ignore, interceptedRequest }) ?? false;
	if (isIgnored) {
		await interceptedRequest.continue();
		return true;
	}

	const isAborted = handleMatch({ baseUrl, url, match: abort, interceptedRequest }) ?? false;
	if (isAborted) {
		await interceptedRequest.abort();
		return true;
	}

	const isFallback = handleMatch({ baseUrl, url, match: fallback, interceptedRequest }) ?? false;
	if (isFallback) return true;

	await handleOnRequest({ onRequest, interceptedRequest });
	if (isRequestHandled(interceptedRequest)) return true;

	return false;
};

export const handleOnRequest = async ({ onRequest, interceptedRequest }) => {
	if (onRequest === undefined) return;

	let isFallbackCalled = false;

	if (typeof onRequest === 'function') {
		await onRequest({
			request: interceptedRequest,
			action: {
				abort: () => interceptedRequest.abort(),
				continue: () => interceptedRequest.continue(),
				respond: (params) => interceptedRequest.respond(params),
				fallback: () => {
					isFallbackCalled = true;
				}
			},
			url: new URL(interceptedRequest.url())
		});

		const isHandled = await interceptedRequest.isInterceptResolutionHandled();
		return isHandled || isFallbackCalled;
	}

	throw new Error(`onRequest is not a function. It is ${typeof onRequest}.`);
};

export const handlePathRewrite = ({ pathRewrite, proxyUrl, interceptedRequest }) => {
	if (pathRewrite === undefined) return proxyUrl;

	if (typeof pathRewrite === 'function') {
		const urlInstance = new URL(proxyUrl);
		urlInstance.pathname = pathRewrite(urlInstance.pathname, interceptedRequest);

		return urlInstance.toString();
	}

	throw new Error(`pathRewrite is not a function. It is ${typeof pathRewrite}.`);
};

export const handleUrlRewrite = ({ urlRewrite, proxyUrl, interceptedRequest }) => {
	if (urlRewrite === undefined) return proxyUrl;

	if (typeof urlRewrite === 'function') return urlRewrite(proxyUrl, interceptedRequest);

	throw new Error(`urlRewrite is not a function. It is ${typeof urlRewrite}.`);
};

export const getResponse = async (responseRaw) => {
	const response = {
		status: responseRaw.status,
		headers: responseRaw.headers.raw(),
		body: Buffer.from(await responseRaw.arrayBuffer()),
		contentType: responseRaw.headers.get('content-type') || ''
	};

	return response;
};

export const handleOnResponse = async ({
	onResponse,
	responseRaw,
	response,
	interceptedRequest
}) => {
	if (onResponse === undefined) return;

	let isFallbackCalled = false;

	if (typeof onResponse === 'function') {
		await onResponse({
			response,
			responseRaw,
			request: interceptedRequest,
			action: {
				abort: () => interceptedRequest.abort(),
				continue: () => interceptedRequest.continue(),
				respond: (params) => interceptedRequest.respond(params),
				fallback: () => {
					isFallbackCalled = true;
				}
			},
			url: new URL(interceptedRequest.url())
		});

		return isRequestHandled(interceptedRequest) || isFallbackCalled;
	}

	throw new Error(`onResponse is not a function. It is ${typeof onResponse}.`);
};

export const handleFilePath = ({ file, interceptedRequest }) => {
	if (typeof file === 'string') return file;
	const url = interceptedRequest.url();
	if (typeof file === 'function') return file(url, interceptedRequest);

	throw new Error(`file is not a string or a function. It is ${typeof file}.`);
};

export const handleProxyUrl = ({
	requestUrl,
	handleProxyUrl,
	pathRewrite,
	urlRewrite,
	interceptedRequest
}) => {
	let proxyUrl = handleProxyUrl(requestUrl);
	proxyUrl = handleUrlRewrite({ urlRewrite, proxyUrl, interceptedRequest });
	proxyUrl = handlePathRewrite({ pathRewrite, proxyUrl, interceptedRequest });

	return proxyUrl;
};

export const handleProxyRequest = async ({
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	interceptedRequest,
	urlRewrite,
	handlers,
	onProxyFail
}) => {
	const proxyUrl = handleProxyUrl({
		requestUrl: interceptedRequest.url(),
		handleProxyUrl: handlers.handleProxyUrl,
		pathRewrite,
		urlRewrite,
		interceptedRequest
	});
	const requestOptions = handleOverrideRequest({
		overrideRequestOptions,
		overrideRequestBody,
		overrideRequestHeaders,
		interceptedRequest,
		proxyUrl
	});

	try {
		const responseRaw = await fetch(proxyUrl, requestOptions);
		const response = await getResponse(responseRaw);
		return { response, responseRaw };
	} catch (error) {
		onProxyFail?.(error, interceptedRequest);
		return {
			response: undefined,
			responseRaw: undefined
		};
	}
};

export const handleFileRequest = async ({ file, interceptedRequest, onFileReadFail }) => {
	const path = handleFilePath({ file, interceptedRequest });
	try {
		const body = await fs.readFileSync(path);
		const response = { body };

		return { response };
	} catch (error) {
		onFileReadFail?.(error, interceptedRequest);
		return { response: undefined };
	}
};

export const handleRequest = async ({
	file,
	proxy,
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	interceptedRequest,
	urlRewrite,
	handlers,
	onProxyFail,
	onFileReadFail
}) => {
	if (proxy) {
		return await handleProxyRequest({
			pathRewrite,
			overrideRequestOptions,
			overrideRequestBody,
			overrideRequestHeaders,
			interceptedRequest,
			urlRewrite,
			handlers,
			onProxyFail
		});
	}

	if (file) {
		return await handleFileRequest({ file, interceptedRequest, onFileReadFail });
	}

	throw new Error(
		'No configuration provided to handle the request. You should either give proxy or file configuration.'
	);
};
