import urlMatches from './urlMatches';
import fs from 'fs';
import fetch from 'node-fetch';
import cliColors from './cliColors';
import { Buffer } from 'buffer';
import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import type { CommonConfig, ConfigForFile, Match, ProxyConfig } from '../types';
import type { RequestInit, Response } from 'node-fetch';
import type { HandleProxyUrl } from './types';

type ProxyType = ProxyConfig['proxy'];

export const isRequestHandled = (interceptedRequest: HTTPRequest): boolean =>
	interceptedRequest.isInterceptResolutionHandled();

/**
 * Creates a handle proxy function that modifies the request URL based on the provided proxy configuration.
 *
 * @param {Object} options - The options for creating the handle proxy function.
 * @param {undefined|string|Function} options.proxy - The proxy URL or a function that modifies the request URL.
 * @param {import("puppeteer").HTTPRequest} options.interceptedRequest - The intercepted request object.
 * @returns {HandleProxyUrl} The handle proxy function.
 */
export const makeHandleProxy = ({ proxy }: { proxy: ProxyType }): HandleProxyUrl => {
	if (proxy === undefined) return (requestUrl) => requestUrl;

	if (typeof proxy === 'function') {
		const handleProxyUrl = (requestUrl: string, interceptedRequest: HTTPRequest) =>
			proxy(requestUrl, interceptedRequest);

		return handleProxyUrl;
	}
	const proxyUrlParsed = new URL(proxy);
	const proxyUrlSearch = new URLSearchParams(proxyUrlParsed.search);

	const handleProxyUrl = (requestUrl: string) => {
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

interface Options {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

/**
 * A function to override or merge parameters based on the provided override.
 * The override can be a function, an object, or undefined.
 *
 * @template T - Type of the primary parameter.
 * @template U - Type of the options parameter (optional).
 *
 * @param {Function | object | undefined | null | string} override - A function or an object used to override the primary parameter, or undefined.
 * @param {T} param - The primary parameter to be modified or overridden.
 * @param {U} [options] - Optional additional data passed to the override function.
 * @param {boolean} [isReplace=false] - If true, the override will replace the entire primary parameter.
 * @returns {T} - The resulting modified parameter.
 *
 * @throws {Error} If the `override` is not a function or an object.
 */
function overrideParam<T, U = Options>(
	override: Function | object | undefined | null | string,
	param: T,
	options: U,
	isReplace: boolean = false
): T {
	if (override === undefined) return param as T;

	if (typeof override === 'function') {
		return override(param as (param: T, options: U) => T, options as U) as T;
	}

	if (typeof override === 'object' && !isReplace) {
		return { ...param, ...(override as Partial<T>) } as T;
	}

	if (isReplace) {
		return override as T;
	}

	throw new Error(`override should be a function or an object. It is ${typeof override}.`);
}

const handleAction = async <T = object>({
	name,
	conditionFn,
	params,
	action
}: {
	name: string;
	conditionFn?: (params: T) => boolean;
	params: T;
	action: (params: T) => void;
}): Promise<void> => {
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
}: {
	overrideRequestOptions?: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody?: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders?: ProxyConfig['overrideRequestHeaders'];
	interceptedRequest: HTTPRequest;
	proxyUrl: string;
}): RequestInit => {
	const param = {
		method: interceptedRequest.method(),
		headers: interceptedRequest.headers() as Record<string, string>,
		body: interceptedRequest.postData()
	};

	const additionalParams = { request: interceptedRequest, proxyUrl };

	const requestOptions = overrideParam(overrideRequestOptions, param, additionalParams);
	const headers = overrideParam(overrideRequestHeaders, param.headers, additionalParams);
	const body = overrideParam(overrideRequestBody, param.body, additionalParams, true);

	return { ...requestOptions, headers, body };
};

export const handleOverrideResponse = async ({
	response,
	responseFromProxyRequest,
	overrideResponseHeaders,
	overrideResponseBody,
	overrideResponseOptions,
	interceptedRequest
}: {
	response: ResponseForRequest;
	responseFromProxyRequest?: Response;
	overrideResponseHeaders?: CommonConfig['overrideResponseHeaders'];
	overrideResponseBody?: CommonConfig['overrideResponseBody'];
	overrideResponseOptions?: CommonConfig['overrideResponseOptions'];
	interceptedRequest: HTTPRequest;
}): Promise<ResponseForRequest> => {
	const additionalParams = { response, responseFromProxyRequest, request: interceptedRequest };
	const responseOptions = overrideParam(
		overrideResponseOptions,
		response as ResponseForRequest,
		additionalParams
	);
	const headers = overrideParam(
		overrideResponseHeaders,
		response.headers as ResponseForRequest['headers'],
		additionalParams
	);
	const body = overrideParam(overrideResponseBody, response.body, additionalParams, true);

	return { ...responseOptions, headers, body };
};

/**
 * Handles the response of the intercepted request.
 * @param params - The parameters for handling the response.
 * @returns {Promise<boolean>} true if request handled
 */
export const handleResponse = async ({
	interceptedRequest,
	response,
	responseFromProxyRequest,
	onResponse,
	overrideResponseHeaders,
	overrideResponseBody,
	overrideResponseOptions,
	ignoreOnResponse,
	fallbackOnResponse,
	abortOnResponse
}: {
	interceptedRequest: HTTPRequest;
	response: ResponseForRequest;
	responseFromProxyRequest?: Response;
	onResponse: CommonConfig['onResponse'];
	overrideResponseHeaders?: CommonConfig['overrideResponseHeaders'];
	overrideResponseBody?: CommonConfig['overrideResponseBody'];
	overrideResponseOptions?: CommonConfig['overrideResponseOptions'];
	ignoreOnResponse?: CommonConfig['ignoreOnResponse'];
	fallbackOnResponse?: CommonConfig['fallbackOnResponse'];
	abortOnResponse?: CommonConfig['abortOnResponse'];
}): Promise<boolean | undefined> => {
	const respondOptions = await handleOverrideResponse({
		response,
		responseFromProxyRequest,
		overrideResponseHeaders,
		overrideResponseBody,
		overrideResponseOptions,
		interceptedRequest
	});
	const params = {
		request: interceptedRequest,
		response,
		responseFromProxyRequest,
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
	if (isFallbackCalled || isRequestHandled(interceptedRequest)) return true;
	const isHandledOnResponse = await handleOnResponse({
		onResponse,
		interceptedRequest,
		responseFromProxyRequest,
		response
	});
	if (isHandledOnResponse) return true;
	await interceptedRequest.respond(respondOptions);

	return false;
};

export const handleMatch = ({
	baseUrl,
	url,
	match,
	interceptedRequest
}: {
	baseUrl: string;
	url: string;
	match?: Match | Match[];
	interceptedRequest: HTTPRequest;
}): boolean | undefined => {
	if (match === undefined) return undefined;

	const matches = Array.isArray(match) ? match : [match];
	const matchChecker = (match: Match) =>
		urlMatches({
			parsedUrl: new URL(url),
			baseUrl,
			urlString: url,
			match,
			request: interceptedRequest
		});

	return matches.some(matchChecker);
};

/**
 * Handles the configuration for the intercepted request.
 * @param params - The parameters for handling the config.
 * @returns {Promise<boolean>} true if request handled
 */
export const handleRequestConfig = async ({
	match,
	ignore,
	abort,
	fallback,
	onRequest,
	interceptedRequest
}: {
	match?: Match | Match[];
	ignore?: Match | Match[];
	abort?: Match | Match[];
	fallback?: Match | Match[];
	onRequest?: CommonConfig['onRequest'];
	interceptedRequest: HTTPRequest;
}): Promise<boolean | undefined> => {
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

export const handleOnRequest = async ({
	onRequest,
	interceptedRequest
}: {
	onRequest?: CommonConfig['onRequest'];
	interceptedRequest: HTTPRequest;
}): Promise<boolean | undefined> => {
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

export const handlePathRewrite = ({
	pathRewrite,
	proxyUrl,
	interceptedRequest
}: {
	pathRewrite: ProxyConfig['pathRewrite'];
	proxyUrl: string;
	interceptedRequest: HTTPRequest;
}): string => {
	if (pathRewrite === undefined) return proxyUrl;

	if (typeof pathRewrite === 'function') {
		const urlInstance = new URL(proxyUrl);
		urlInstance.pathname = pathRewrite(urlInstance.pathname, interceptedRequest);

		return urlInstance.toString();
	}

	throw new Error(`pathRewrite is not a function. It is ${typeof pathRewrite}.`);
};

export const handleUrlRewrite = ({
	urlRewrite,
	proxyUrl,
	interceptedRequest
}: {
	urlRewrite: ProxyConfig['urlRewrite'];
	proxyUrl: string;
	interceptedRequest: HTTPRequest;
}): string => {
	if (urlRewrite === undefined) return proxyUrl;

	if (typeof urlRewrite === 'function') return urlRewrite(proxyUrl, interceptedRequest);

	throw new Error(`urlRewrite is not a function. It is ${typeof urlRewrite}.`);
};

export const getResponse = async (responseFromProxyRequest: Response) => {
	const response = {
		status: responseFromProxyRequest.status,
		headers: responseFromProxyRequest.headers.raw(),
		body: Buffer.from(await responseFromProxyRequest.arrayBuffer()),
		contentType: responseFromProxyRequest.headers.get('content-type') || ''
	};

	return response;
};

export const handleOnResponse = async ({
	onResponse,
	responseFromProxyRequest,
	response,
	interceptedRequest
}: {
	onResponse?: CommonConfig['onResponse'];
	responseFromProxyRequest?: Response;
	response: ResponseForRequest;
	interceptedRequest: HTTPRequest;
}): Promise<boolean | undefined> => {
	if (onResponse === undefined) return;

	let isFallbackCalled = false;

	if (typeof onResponse === 'function') {
		await onResponse({
			response,
			responseFromProxyRequest,
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

export const handleFilePath = ({
	file,
	interceptedRequest
}: {
	file: ConfigForFile['file'];
	interceptedRequest: HTTPRequest;
}): string => {
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
}: {
	requestUrl: string;
	handleProxyUrl: HandleProxyUrl;
	pathRewrite: ProxyConfig['pathRewrite'];
	urlRewrite: ProxyConfig['urlRewrite'];
	interceptedRequest: HTTPRequest;
}): string => {
	let proxyUrl = handleProxyUrl(requestUrl, interceptedRequest);
	proxyUrl = handleUrlRewrite({ urlRewrite, proxyUrl, interceptedRequest });
	proxyUrl = handlePathRewrite({ pathRewrite, proxyUrl, interceptedRequest });

	return proxyUrl;
};

const handleProxyRequest = async ({
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	interceptedRequest,
	urlRewrite,
	handlers,
	onError
}: {
	pathRewrite: ProxyConfig['pathRewrite'];
	overrideRequestOptions: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders: ProxyConfig['overrideRequestHeaders'];
	interceptedRequest: HTTPRequest;
	urlRewrite: ProxyConfig['urlRewrite'];
	handlers: { handleProxyUrl: HandleProxyUrl };
	onError?: CommonConfig['onError'];
}): Promise<{ response: ResponseForRequest; responseFromProxyRequest?: Response }> => {
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
		const responseFromProxyRequest = await fetch(proxyUrl, requestOptions);
		const response = await getResponse(responseFromProxyRequest);

		return { response, responseFromProxyRequest };
	} catch (error) {
		onError?.(error, interceptedRequest);
		console.error(
			cliColors.bg.red,
			'Error:',
			cliColors.reset,
			`Failed to make proxy request to:`,
			cliColors.fg.cyan,
			proxyUrl,
			cliColors.reset,
			`while intercepting request:`,
			cliColors.fg.cyan,
			interceptedRequest.url(),
			cliColors.reset
		);
		console.log(`\nPlease ensure that:`);
		console.log(`  - proxy server is running at ${proxyUrl}.`);
		console.log(`  - proxy rule is valid for ${interceptedRequest.url()}.`);
		console.log('\n');

		return {
			response: {
				body: `Failed during proxy request to ${interceptedRequest.url()}.`,
				status: 500,
				headers: {},
				contentType: ''
			},
			responseFromProxyRequest: undefined
		};
	}
};

export const handleFileRequest = async ({
	file,
	interceptedRequest,
	onError
}: {
	file: ConfigForFile['file'];
	interceptedRequest: HTTPRequest;
	onError?: CommonConfig['onError'];
}): Promise<{ response: ResponseForRequest }> => {
	const path = handleFilePath({ file, interceptedRequest });
	try {
		const body = await fs.readFileSync(path);
		// TODO: add better content type detection
		const contentType = path.endsWith('.json') ? 'application/json' : 'text/plain';
		const response = { body, status: 200, headers: {}, contentType };

		return { response };
	} catch (error) {
		onError?.(error, interceptedRequest);
		const errorMessage = `Error during reading file ${path}.`;
		console.error(cliColors.bg.red, errorMessage, cliColors.reset);

		// TODO: add better error handling
		const response = {
			body: `Error: Could not read file ${file}, ${error}`,
			status: 500,
			headers: {},
			contentType: ''
		};

		return { response };
	}
};

export const handleRequest = async ({
	file,
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	interceptedRequest,
	urlRewrite,
	handlers,
	onError
}: {
	file?: ConfigForFile['file'];
	pathRewrite: ProxyConfig['pathRewrite'];
	overrideRequestOptions: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders: ProxyConfig['overrideRequestHeaders'];
	interceptedRequest: HTTPRequest;
	urlRewrite: ProxyConfig['urlRewrite'];
	handlers: { handleProxyUrl: HandleProxyUrl };
	onError?: CommonConfig['onError'];
}): // TODO: make conditional type definition according to the file parameter
Promise<{ response: ResponseForRequest; responseFromProxyRequest?: Response }> => {
	if (file) {
		const { response } = await handleFileRequest({ file, interceptedRequest, onError });

		return { response };
	} else {
		const { response, responseFromProxyRequest } = await handleProxyRequest({
			pathRewrite,
			overrideRequestOptions,
			overrideRequestBody,
			overrideRequestHeaders,
			interceptedRequest,
			urlRewrite,
			handlers,
			onError
		});

		return { response, responseFromProxyRequest };
	}
};
