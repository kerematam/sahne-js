import { Buffer } from 'node:buffer';
import { Effect, FileSystem } from 'effect';
import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import Request from '../Request.js';
import { FileReadError, HookError, ProxyResponseError, type InterceptionError } from '../errors.js';
import { ProxyTransport } from '../services.js';
import type {
	ActionOnResponseParams,
	CommonConfig,
	ConfigForFile,
	Match,
	MaybePromise,
	OnResponseParams,
	ProcessedInterceptorConfig,
	ProxyConfig
} from '../types.js';
import type { HandleProxyUrl } from './types.js';
import urlMatches from './urlMatches.js';

type ProxyType = ProxyConfig['proxy'];

export type RuleOutcome =
	{ readonly _tag: 'Resolved' } | { readonly _tag: 'NextRule' } | { readonly _tag: 'Unmatched' };

type RequestConfigOutcome = RuleOutcome | { readonly _tag: 'Matched' };

type SourceResponse = {
	readonly response: ResponseForRequest;
	readonly responseFromProxyRequest?: Response;
};

const resolved: RuleOutcome = { _tag: 'Resolved' };
const nextRule: RuleOutcome = { _tag: 'NextRule' };
const unmatched: RuleOutcome = { _tag: 'Unmatched' };
const matched: RequestConfigOutcome = { _tag: 'Matched' };

export const isRequestHandled = (interceptedRequest: HTTPRequest): boolean =>
	interceptedRequest.isInterceptResolutionHandled();

export const makeHandleProxy = ({ proxy }: { proxy: ProxyType }): HandleProxyUrl => {
	if (proxy === undefined) return (requestUrl) => requestUrl;
	if (typeof proxy === 'function') return proxy;

	return (requestUrl) => {
		const proxyUrlParsed = new URL(proxy);
		const proxyUrlSearch = new URLSearchParams(proxyUrlParsed.search);
		const requestUrlParsed = new URL(requestUrl);

		requestUrlParsed.protocol = proxyUrlParsed.protocol;
		requestUrlParsed.hostname = proxyUrlParsed.hostname;
		requestUrlParsed.port = proxyUrlParsed.port;

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
};

type OverrideFunction = (...args: never[]) => unknown;

const overrideParam = <T, U>(
	name: string,
	override: OverrideFunction | object | undefined | null | string,
	param: T,
	options: U,
	isReplace = false
): Effect.Effect<T, HookError> =>
	Effect.try({
		try: () => {
			if (override === undefined) return param;
			if (typeof override === 'function') {
				return (override as (param: T, options: U) => T)(param, options);
			}
			if (typeof override === 'object' && override !== null && !isReplace) {
				return { ...param, ...(override as Partial<T>) } as T;
			}
			if (isReplace) return override as T;
			throw new TypeError(`${name} must be a function or an object`);
		},
		catch: (cause) =>
			new HookError({
				hook: name,
				cause,
				message: `Failed while evaluating ${name}`
			})
	});

const invokeHook = <A>(
	name: string,
	evaluate: () => MaybePromise<A>
): Effect.Effect<A, HookError> =>
	Effect.tryPromise({
		try: async () => await evaluate(),
		catch: (cause) =>
			new HookError({
				hook: name,
				cause,
				message: `Failed while executing ${name}`
			})
	});

const handleAction = <T>({
	name,
	condition,
	params,
	action
}: {
	readonly name: string;
	readonly condition?: (params: T) => MaybePromise<boolean>;
	readonly params: T;
	readonly action: (params: T) => Effect.Effect<void, InterceptionError>;
}): Effect.Effect<void, InterceptionError> => {
	if (condition === undefined) return Effect.void;
	if (typeof condition !== 'function') {
		return Effect.fail(
			new HookError({
				hook: name,
				cause: condition,
				message: `${name} must be a function`
			})
		);
	}

	return Effect.gen(function* () {
		const result = yield* invokeHook(name, () => condition(params));
		if (typeof result !== 'boolean') {
			return yield* new HookError({
				hook: name,
				cause: result,
				message: `${name} must return a boolean`
			});
		}
		if (result) yield* action(params);
	});
};

export const handleOverrideRequest = ({
	request,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	proxyUrl
}: {
	readonly overrideRequestOptions?: ProxyConfig['overrideRequestOptions'];
	readonly overrideRequestBody?: ProxyConfig['overrideRequestBody'];
	readonly overrideRequestHeaders?: ProxyConfig['overrideRequestHeaders'];
	readonly request: Request;
	readonly proxyUrl: string;
}): Effect.Effect<RequestInit, HookError> =>
	Effect.gen(function* () {
		const param = {
			method: request.method(),
			headers: request.headers(),
			body: request.postData()
		};
		const additionalParams = { request: request.transferObject(), proxyUrl };
		const requestOptions = yield* overrideParam(
			'overrideRequestOptions',
			overrideRequestOptions,
			param,
			additionalParams
		);
		const headers = yield* overrideParam(
			'overrideRequestHeaders',
			overrideRequestHeaders,
			param.headers,
			additionalParams
		);
		const body = yield* overrideParam(
			'overrideRequestBody',
			overrideRequestBody,
			param.body,
			additionalParams,
			true
		);

		return { ...requestOptions, headers, body } as RequestInit;
	});

export const handleOverrideResponse = ({
	response,
	responseFromProxyRequest,
	overrideResponseHeaders,
	overrideResponseBody,
	overrideResponseOptions,
	request
}: {
	readonly response: ResponseForRequest;
	readonly responseFromProxyRequest?: Response;
	readonly overrideResponseHeaders?: CommonConfig['overrideResponseHeaders'];
	readonly overrideResponseBody?: CommonConfig['overrideResponseBody'];
	readonly overrideResponseOptions?: CommonConfig['overrideResponseOptions'];
	readonly request: Request;
}): Effect.Effect<ResponseForRequest, HookError> =>
	Effect.gen(function* () {
		const additionalParams = {
			response,
			responseFromProxyRequest,
			request: request.transferObject()
		};
		const responseOptions = yield* overrideParam(
			'overrideResponseOptions',
			overrideResponseOptions,
			response,
			additionalParams
		);
		const headers = yield* overrideParam(
			'overrideResponseHeaders',
			overrideResponseHeaders,
			response.headers,
			additionalParams
		);
		const body = yield* overrideParam(
			'overrideResponseBody',
			overrideResponseBody,
			response.body,
			additionalParams,
			true
		);

		return { ...responseOptions, headers, body };
	});

export const handleMatch = ({
	baseUrl,
	url,
	match,
	request,
	name = 'match'
}: {
	readonly baseUrl: string;
	readonly url: string;
	readonly match?: Match | Match[];
	readonly request: Request;
	readonly name?: string;
}): Effect.Effect<Match | undefined, HookError> => {
	if (match === undefined) return Effect.succeed(undefined);
	const matches = Array.isArray(match) ? match : [match];

	return Effect.gen(function* () {
		for (const rule of matches) {
			const isMatched = yield* invokeHook(name, () =>
				urlMatches({
					parsedUrl: new URL(url),
					baseUrl,
					urlString: url,
					match: rule,
					request: request.transferObject()
				})
			);
			if (isMatched) return rule;
		}
		return undefined;
	});
};

export const handleOnRequest = ({
	onRequest,
	request
}: {
	readonly onRequest?: CommonConfig['onRequest'];
	readonly request: Request;
}): Effect.Effect<void, HookError> => {
	if (onRequest === undefined) return Effect.void;
	if (typeof onRequest !== 'function') {
		return Effect.fail(
			new HookError({
				hook: 'onRequest',
				cause: onRequest,
				message: 'onRequest must be a function'
			})
		);
	}

	return invokeHook('onRequest', () =>
		onRequest({
			action: request.getActionMethods(),
			url: new URL(request.url()),
			request: request.transferObject()
		})
	);
};

export const handleRequestConfig = ({
	request,
	match,
	ignore,
	abort,
	next,
	onRequest
}: {
	readonly request: Request;
	readonly match?: Match | Match[];
	readonly ignore?: Match | Match[];
	readonly abort?: Match | Match[];
	readonly next?: Match | Match[];
	readonly onRequest?: CommonConfig['onRequest'];
}): Effect.Effect<RequestConfigOutcome, InterceptionError> =>
	Effect.gen(function* () {
		const parsedUrl = yield* invokeHook('requestUrl', () => new URL(request.url()));
		parsedUrl.search = '';
		const url = parsedUrl.toString();
		const baseUrl = parsedUrl.origin;

		const ignoreRule = yield* handleMatch({
			baseUrl,
			url,
			match: ignore,
			request,
			name: 'ignore'
		});
		if (ignoreRule !== undefined) {
			request.setStatus({ ignore: ignoreRule });
			yield* request.ignoreEffect;
			return resolved;
		}

		const abortRule = yield* handleMatch({
			baseUrl,
			url,
			match: abort,
			request,
			name: 'abort'
		});
		if (abortRule !== undefined) {
			request.setStatus({ abort: abortRule });
			yield* request.abortEffect;
			return resolved;
		}

		const nextRuleMatch = yield* handleMatch({
			baseUrl,
			url,
			match: next,
			request,
			name: 'next'
		});
		if (nextRuleMatch !== undefined) {
			request.setStatus({ next: nextRuleMatch });
			yield* request.nextEffect;
			return nextRule;
		}

		const matchRule = yield* handleMatch({ baseUrl, url, match, request });
		if (matchRule === undefined) return unmatched;
		request.setStatus({ match: matchRule });

		yield* handleOnRequest({ onRequest, request });
		if (request.isResolutionHandled()) return resolved;
		if (request.isNextCalled) return nextRule;
		return matched;
	});

export const handlePathRewrite = ({
	pathRewrite,
	proxyUrl,
	request
}: {
	readonly pathRewrite: ProxyConfig['pathRewrite'];
	readonly proxyUrl: string;
	readonly request: Request;
}): string => {
	if (pathRewrite === undefined) return proxyUrl;
	if (typeof pathRewrite !== 'function') throw new TypeError('pathRewrite must be a function');
	const url = new URL(proxyUrl);
	url.pathname = pathRewrite(url.pathname, request.transferObject());
	return url.toString();
};

export const handleUrlRewrite = ({
	urlRewrite,
	proxyUrl,
	request
}: {
	readonly urlRewrite: ProxyConfig['urlRewrite'];
	readonly proxyUrl: string;
	readonly request: Request;
}): string => {
	if (urlRewrite === undefined) return proxyUrl;
	if (typeof urlRewrite !== 'function') throw new TypeError('urlRewrite must be a function');
	return urlRewrite(proxyUrl, request.transferObject());
};

export const handleFilePath = ({
	file,
	request
}: {
	readonly file: ConfigForFile['file'];
	readonly request: Request;
}): Effect.Effect<string, HookError> =>
	invokeHook('file', () => {
		if (typeof file === 'string') return file;
		if (typeof file === 'function') return file(request.url(), request.transferObject());
		throw new TypeError('file must be a string or a function');
	});

export const handleProxyUrl = ({
	requestUrl,
	handleProxyUrl,
	pathRewrite,
	urlRewrite,
	request
}: {
	readonly requestUrl: string;
	readonly handleProxyUrl: HandleProxyUrl;
	readonly pathRewrite: ProxyConfig['pathRewrite'];
	readonly urlRewrite: ProxyConfig['urlRewrite'];
	readonly request: Request;
}): Effect.Effect<string, HookError> =>
	invokeHook('proxyUrl', () => {
		let proxyUrl = handleProxyUrl(requestUrl, request.transferObject());
		proxyUrl = handleUrlRewrite({ urlRewrite, proxyUrl, request });
		return handlePathRewrite({ pathRewrite, proxyUrl, request });
	});

export const getResponse = (
	responseFromProxyRequest: Response,
	proxyUrl: string
): Effect.Effect<ResponseForRequest, ProxyResponseError> =>
	Effect.tryPromise({
		try: async () => {
			const headers: Record<string, string | string[]> = Object.fromEntries(
				responseFromProxyRequest.headers.entries()
			);
			const setCookieHeaders = responseFromProxyRequest.headers.getSetCookie();
			if (setCookieHeaders.length > 0) headers['set-cookie'] = setCookieHeaders;

			return {
				status: responseFromProxyRequest.status,
				headers,
				body: Buffer.from(await responseFromProxyRequest.arrayBuffer()),
				contentType: responseFromProxyRequest.headers.get('content-type') ?? ''
			};
		},
		catch: (cause) =>
			new ProxyResponseError({
				proxyUrl,
				cause,
				message: `Failed to read the proxy response from ${proxyUrl}`
			})
	});

const handleProxyRequest = ({
	request,
	pathRewrite,
	overrideRequestOptions,
	overrideRequestBody,
	overrideRequestHeaders,
	urlRewrite,
	handlers
}: {
	readonly request: Request;
	readonly pathRewrite: ProxyConfig['pathRewrite'];
	readonly overrideRequestOptions: ProxyConfig['overrideRequestOptions'];
	readonly overrideRequestBody: ProxyConfig['overrideRequestBody'];
	readonly overrideRequestHeaders: ProxyConfig['overrideRequestHeaders'];
	readonly urlRewrite: ProxyConfig['urlRewrite'];
	readonly handlers: { readonly handleProxyUrl: HandleProxyUrl };
}): Effect.Effect<SourceResponse, InterceptionError, ProxyTransport> =>
	Effect.gen(function* () {
		const proxyUrl = yield* handleProxyUrl({
			requestUrl: request.url(),
			handleProxyUrl: handlers.handleProxyUrl,
			pathRewrite,
			urlRewrite,
			request
		});
		const requestOptions = yield* handleOverrideRequest({
			overrideRequestOptions,
			overrideRequestBody,
			overrideRequestHeaders,
			request,
			proxyUrl
		});
		request.setStatus({ proxyUrl, requestOptions });

		const transport = yield* ProxyTransport;
		const responseFromProxyRequest = yield* transport.execute(
			request.url(),
			proxyUrl,
			requestOptions
		);
		const response = yield* getResponse(responseFromProxyRequest, proxyUrl);
		return { response, responseFromProxyRequest };
	});

export const handleFileRequest = ({
	file,
	request
}: {
	readonly file: ConfigForFile['file'];
	readonly request: Request;
}): Effect.Effect<SourceResponse, InterceptionError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const path = yield* handleFilePath({ file, request });
		request.setStatus({ filePath: path });
		const fs = yield* FileSystem.FileSystem;
		const body = yield* fs.readFile(path).pipe(
			Effect.mapError(
				(cause) =>
					new FileReadError({
						path,
						requestUrl: request.url(),
						cause,
						message: `Failed to read ${path} for ${request.url()}`
					})
			)
		);

		return {
			response: {
				body: Buffer.from(body),
				status: 200,
				headers: {},
				contentType: path.endsWith('.json') ? 'application/json' : 'text/plain'
			}
		};
	});

export const handleRequest = ({
	request,
	config
}: {
	readonly request: Request;
	readonly config: ProcessedInterceptorConfig;
}): Effect.Effect<SourceResponse, InterceptionError, FileSystem.FileSystem | ProxyTransport> => {
	if (config.file !== undefined) {
		return handleFileRequest({ file: config.file, request });
	}

	return handleProxyRequest({
		request,
		pathRewrite: config.pathRewrite,
		overrideRequestOptions: config.overrideRequestOptions,
		overrideRequestBody: config.overrideRequestBody,
		overrideRequestHeaders: config.overrideRequestHeaders,
		urlRewrite: config.urlRewrite,
		handlers: config.handlers
	});
};

export const handleOnResponse = ({
	onResponse,
	responseFromProxyRequest,
	response,
	request
}: {
	readonly onResponse?: CommonConfig['onResponse'];
	readonly responseFromProxyRequest?: Response;
	readonly response: ResponseForRequest;
	readonly request: Request;
}): Effect.Effect<void, HookError> => {
	if (onResponse === undefined) return Effect.void;
	if (typeof onResponse !== 'function') {
		return Effect.fail(
			new HookError({
				hook: 'onResponse',
				cause: onResponse,
				message: 'onResponse must be a function'
			})
		);
	}

	const params: OnResponseParams = {
		response,
		responseFromProxyRequest,
		request: request.transferObject(),
		action: request.getActionMethods(),
		url: new URL(request.url())
	};
	return invokeHook('onResponse', () => onResponse(params));
};

export const handleResponse = ({
	request,
	response,
	responseFromProxyRequest,
	config
}: {
	readonly request: Request;
	readonly response: ResponseForRequest;
	readonly responseFromProxyRequest?: Response;
	readonly config: ProcessedInterceptorConfig;
}): Effect.Effect<RuleOutcome, InterceptionError> =>
	Effect.gen(function* () {
		const respondOptions = yield* handleOverrideResponse({
			response,
			responseFromProxyRequest,
			overrideResponseHeaders: config.overrideResponseHeaders,
			overrideResponseBody: config.overrideResponseBody,
			overrideResponseOptions: config.overrideResponseOptions,
			request
		});
		const params: ActionOnResponseParams = {
			request: request.transferObject(),
			response,
			responseFromProxyRequest,
			url: new URL(request.url())
		};

		yield* handleAction({
			name: 'ignoreOnResponse',
			condition: config.ignoreOnResponse,
			params,
			action: () => request.ignoreEffect
		});
		if (request.isResolutionHandled()) return resolved;

		yield* handleAction({
			name: 'abortOnResponse',
			condition: config.abortOnResponse,
			params,
			action: () => request.abortEffect
		});
		if (request.isResolutionHandled()) return resolved;

		yield* handleAction({
			name: 'nextOnResponse',
			condition: config.nextOnResponse,
			params,
			action: () => request.nextEffect
		});
		if (request.isNextCalled) return nextRule;

		yield* handleOnResponse({
			onResponse: config.onResponse,
			request,
			responseFromProxyRequest,
			response
		});
		if (request.isResolutionHandled()) return resolved;
		if (request.isNextCalled) return nextRule;

		yield* request.respondEffect(respondOptions);
		return resolved;
	});

export const handleOnError = ({
	request,
	error,
	onError
}: {
	readonly request: Request;
	readonly error: InterceptionError;
	readonly onError?: CommonConfig['onError'];
}): Effect.Effect<ResponseForRequest | void, HookError> => {
	if (onError === undefined) return Effect.void;
	if (typeof onError !== 'function') {
		return Effect.fail(
			new HookError({
				hook: 'onError',
				cause: onError,
				message: 'onError must be a function'
			})
		);
	}

	return invokeHook('onError', () =>
		onError(error, {
			request: request.transferObject(),
			action: request.getActionMethods(),
			url: new URL(request.url())
		})
	);
};

export const logInterceptionError = (error: InterceptionError): Effect.Effect<void> =>
	Effect.logError(error.message).pipe(Effect.annotateLogs({ errorTag: error._tag }));
