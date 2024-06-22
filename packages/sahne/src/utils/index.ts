import urlMatches from './urlMatches';
import fs from 'fs';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';
import Request from '../Request';

import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import type { CommonConfig, ConfigForFile, Match, ProxyConfig, TransferObject } from '../types';
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
	request,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	proxyUrl
}: {
	overrideRequestOptions?: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody?: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders?: ProxyConfig['overrideRequestHeaders'];
	request: InstanceType<typeof Request>;
	proxyUrl: string;
}): RequestInit => {
	const param = {
		method: request.method(),
		headers: request.headers() as Record<string, string>,
		body: request.postData()
	};
	const additionalParams = { request: request.transferObject(), proxyUrl };
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
	request
}: {
	response: ResponseForRequest;
	responseFromProxyRequest?: Response;
	overrideResponseHeaders?: CommonConfig['overrideResponseHeaders'];
	overrideResponseBody?: CommonConfig['overrideResponseBody'];
	overrideResponseOptions?: CommonConfig['overrideResponseOptions'];
	request: InstanceType<typeof Request>;
}): Promise<ResponseForRequest> => {
	const additionalParams = {
		response,
		responseFromProxyRequest,
		request: request.transferObject()
	};
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
	request,
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
	request: InstanceType<typeof Request>;
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
		request
	});
	const params = {
		request: request.transferObject(),
		response,
		responseFromProxyRequest,
		url: new URL(request.url())
	};

	await handleAction({
		name: 'ignoreOnResponse',
		conditionFn: ignoreOnResponse,
		params,
		action: request.ignore
	});
	if (request.isRequestHandled()) return true;

	await handleAction({
		name: 'abortOnResponse',
		conditionFn: abortOnResponse,
		params,
		action: request.abort
	});
	if (request.isRequestHandled()) return true;

	await handleAction({
		name: 'fallbackOnResponse',
		conditionFn: fallbackOnResponse,
		params,
		action: request.fallback
	});
	if (request.isRequestHandled()) return true;
	const isHandledOnResponse = await handleOnResponse({
		onResponse,
		request,
		responseFromProxyRequest,
		response
	});
	if (isHandledOnResponse) return true;
	await request.respond(respondOptions);
	return false;
};

export const handleMatch = ({
	baseUrl,
	url,
	match,
	request
}: {
	baseUrl: string;
	url: string;
	match?: Match | Match[];
	request: InstanceType<typeof Request>;
}): undefined | Match => {
	if (match === undefined) return undefined;

	const matches = Array.isArray(match) ? match : [match];
	const matchChecker = (match: Match) => {
		const isMatched = urlMatches({
			parsedUrl: new URL(url),
			baseUrl,
			urlString: url,
			match,
			request: request.transferObject()
		});
		if (isMatched) return match;
	};

	return matches.find(matchChecker);
};

/**
 * Handles the configuration for the intercepted request.
 * @param params - The parameters for handling the config.
 * @returns {Promise<boolean>} true if request handled
 */
export const handleRequestConfig = async ({
	request,
	match,
	ignore,
	abort,
	fallback,
	onRequest
}: {
	request: InstanceType<typeof Request>;
	match?: Match | Match[];
	ignore?: Match | Match[];
	abort?: Match | Match[];
	fallback?: Match | Match[];
	onRequest?: CommonConfig['onRequest'];
}): Promise<boolean | undefined> => {
	const url = request.url();
	const parsedUrl = new URL(url);
	const baseUrl = parsedUrl.origin;

	const ignoreRule = handleMatch({ baseUrl, url, match: ignore, request });
	if (ignoreRule !== undefined) {
		request.setStatus({ ignore: ignoreRule });
		await request.ignore();
		return true;
	}

	const abortRule = handleMatch({ baseUrl, url, match: abort, request });
	if (abortRule !== undefined) {
		request.setStatus({ abort: abortRule });
		await request.abort();
		return true;
	}

	const fallbackRule = handleMatch({ baseUrl, url, match: fallback, request });
	if (fallbackRule !== undefined) {
		request.setStatus({ fallback: fallbackRule });
		await request.fallback();
		return true;
	}

	const matchRule = handleMatch({ baseUrl, url, match, request });
	if (matchRule !== undefined) {
		request.setStatus({ match: matchRule });
		return false;
	}

	await handleOnRequest({ onRequest, request });
	if (request.isRequestHandled()) return true;

	return false;
};

export const handleOnRequest = async ({
	onRequest,
	request
}: {
	onRequest?: CommonConfig['onRequest'];
	request: InstanceType<typeof Request>;
}): Promise<boolean | undefined> => {
	if (onRequest === undefined) return;

	if (typeof onRequest === 'function') {
		await onRequest({
			action: request.getActionMethods(),
			url: new URL(request.url()),
			request: request.transferObject()
		});

		return request.isRequestHandled();
	}

	throw new Error(`onRequest is not a function. It is ${typeof onRequest}.`);
};

export const handlePathRewrite = ({
	pathRewrite,
	proxyUrl,
	request
}: {
	pathRewrite: ProxyConfig['pathRewrite'];
	proxyUrl: string;
	request: InstanceType<typeof Request>;
}): string => {
	if (pathRewrite === undefined) return proxyUrl;

	if (typeof pathRewrite === 'function') {
		const urlInstance = new URL(proxyUrl);
		urlInstance.pathname = pathRewrite(urlInstance.pathname, request.transferObject());

		return urlInstance.toString();
	}

	throw new Error(`pathRewrite is not a function. It is ${typeof pathRewrite}.`);
};

export const handleUrlRewrite = ({
	urlRewrite,
	proxyUrl,
	request
}: {
	urlRewrite: ProxyConfig['urlRewrite'];
	proxyUrl: string;
	request: InstanceType<typeof Request>;
}): string => {
	if (urlRewrite === undefined) return proxyUrl;

	if (typeof urlRewrite === 'function') return urlRewrite(proxyUrl, request.transferObject());

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
	request
}: {
	onResponse?: CommonConfig['onResponse'];
	responseFromProxyRequest?: Response;
	response: ResponseForRequest;
	request: InstanceType<typeof Request>;
}): Promise<boolean | undefined> => {
	if (onResponse === undefined) return;

	if (typeof onResponse === 'function') {
		await onResponse({
			response,
			responseFromProxyRequest,
			request: request.transferObject(),
			action: request.getActionMethods(),
			url: new URL(request.url())
		});

		return request.isRequestHandled();
	}

	throw new Error(`onResponse is not a function. It is ${typeof onResponse}.`);
};

export const handleFilePath = ({
	file,
	request
}: {
	file: ConfigForFile['file'];
	request: InstanceType<typeof Request>;
}): string => {
	if (typeof file === 'string') return file;
	const url = request.url();
	if (typeof file === 'function') return file(url, request.transferObject());

	throw new Error(`file is not a string or a function. It is ${typeof file}.`);
};

export const handleProxyUrl = ({
	requestUrl,
	handleProxyUrl,
	pathRewrite,
	urlRewrite,
	request
}: {
	requestUrl: string;
	handleProxyUrl: HandleProxyUrl;
	pathRewrite: ProxyConfig['pathRewrite'];
	urlRewrite: ProxyConfig['urlRewrite'];
	request: InstanceType<typeof Request>;
}): string => {
	let proxyUrl = handleProxyUrl(requestUrl, request.transferObject());
	proxyUrl = handleUrlRewrite({ urlRewrite, proxyUrl, request });
	proxyUrl = handlePathRewrite({ pathRewrite, proxyUrl, request });

	return proxyUrl;
};

const handleProxyRequest = async ({
	request,
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	urlRewrite,
	handlers,
	onError
}: {
	request: InstanceType<typeof Request>;
	pathRewrite: ProxyConfig['pathRewrite'];
	overrideRequestOptions: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders: ProxyConfig['overrideRequestHeaders'];
	urlRewrite: ProxyConfig['urlRewrite'];
	handlers: { handleProxyUrl: HandleProxyUrl };
	onError?: CommonConfig['onError'];
}): Promise<{
	response?: ResponseForRequest;
	responseFromProxyRequest?: Response;
	error?: unknown;
}> => {
	const proxyUrl = handleProxyUrl({
		requestUrl: request.url(),
		handleProxyUrl: handlers.handleProxyUrl,
		pathRewrite,
		urlRewrite,
		request
	});
	const requestOptions = handleOverrideRequest({
		overrideRequestOptions,
		overrideRequestBody,
		overrideRequestHeaders,
		request,
		proxyUrl
	});

	try {
		request.setStatus({ proxyUrl, requestOptions });
		const responseFromProxyRequest = await fetch(proxyUrl, requestOptions);
		const response = await getResponse(responseFromProxyRequest);

		return { response, responseFromProxyRequest };
	} catch (error) {
		request.log.fileReadError(error);

		return { error };
	}
};

export const handleFileRequest = async ({
	file,
	request
}: {
	file: ConfigForFile['file'];
	request: InstanceType<typeof Request>;
}): Promise<{ response?: ResponseForRequest; error?: unknown }> => {
	const path = handleFilePath({ file, request });
	request.setStatus({ filePath: path });
	try {
		const body = await fs.readFileSync(path);
		// TODO: add better content type detection
		const contentType = path.endsWith('.json') ? 'application/json' : 'text/plain';
		const response = { body, status: 200, headers: {}, contentType };

		return { response };
	} catch (error) {
		request.log.fileReadError(error);

		return { error };
	}
};

export const handleOnError = async ({
	request,
	error,
	onError
}: {
	request: InstanceType<typeof Request>;
	error: unknown;
	onError?: CommonConfig['onError'];
}) => {
	if (onError === undefined) return;

	if (typeof onError === 'function') {
		const response = await onError(error, {
			request: request.transferObject(),
			action: request.getActionMethods(),
			url: new URL(request.url())
		});

		return response;
	}

	throw new Error(`onError is not a function. It is ${typeof onError}.`);
};

export const handleRequest = async ({
	request,
	file,
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	urlRewrite,
	handlers
}: {
	request: InstanceType<typeof Request>;
	file?: ConfigForFile['file'];
	pathRewrite: ProxyConfig['pathRewrite'];
	overrideRequestOptions: ProxyConfig['overrideRequestOptions'];
	overrideRequestBody: ProxyConfig['overrideRequestBody'];
	overrideRequestHeaders: ProxyConfig['overrideRequestHeaders'];
	urlRewrite: ProxyConfig['urlRewrite'];
	handlers: { handleProxyUrl: HandleProxyUrl };
}): Promise<{
	response?: ResponseForRequest;
	responseFromProxyRequest?: Response;
	error?: unknown;
}> => {
	if (file) {
		const { response, error } = await handleFileRequest({ file, request });

		return { response, error };
	} else {
		const { response, responseFromProxyRequest, error } = await handleProxyRequest({
			request,
			pathRewrite,
			overrideRequestOptions,
			overrideRequestBody,
			overrideRequestHeaders,
			urlRewrite,
			handlers
		});

		return { response, responseFromProxyRequest, error };
	}
};
