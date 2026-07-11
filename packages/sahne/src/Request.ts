import { Effect } from 'effect';
import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import { RequestActionError } from './errors.js';
import type { Action, Match } from './types.js';

type Status = {
	proxyUrl?: string;
	filePath?: string;
	match?: Match;
	ignore?: Match;
	abort?: Match;
	next?: Match;
	requestOptions?: RequestInit;
};

const matchToString = (match: Match | undefined): string => {
	if (match === undefined) return '';
	return typeof match === 'string' ? match : match.toString();
};

class Request {
	#interceptedRequest: HTTPRequest;
	isNextCalled = false;
	status: Status = {};

	constructor(interceptedRequest: HTTPRequest) {
		this.#interceptedRequest = interceptedRequest;
	}

	setStatus = (status: Status): void => {
		Object.assign(this.status, status);
	};

	abortEffect = Effect.suspend(() =>
		Effect.tryPromise({
			try: () => this.#interceptedRequest.abort(),
			catch: (cause) =>
				new RequestActionError({
					action: 'abort',
					requestUrl: this.url(),
					cause,
					message: `Failed to abort ${this.url()}`
				})
		})
	);

	continueEffect = Effect.suspend(() =>
		Effect.tryPromise({
			try: () => this.#interceptedRequest.continue(),
			catch: (cause) =>
				new RequestActionError({
					action: 'continue',
					requestUrl: this.url(),
					cause,
					message: `Failed to continue ${this.url()}`
				})
		})
	);

	ignoreEffect = this.continueEffect.pipe(
		Effect.andThen(
			Effect.suspend(() =>
				Effect.logInfo(
					`Request ${this.url()} was not intercepted because it matched ignore rule ${matchToString(this.status.ignore)}`
				)
			)
		)
	);

	respondEffect = (params: ResponseForRequest) =>
		Effect.tryPromise({
			try: () => this.#interceptedRequest.respond(params),
			catch: (cause) =>
				new RequestActionError({
					action: 'respond',
					requestUrl: this.url(),
					cause,
					message: `Failed to respond to ${this.url()}`
				})
		}).pipe(
			Effect.andThen(
				Effect.logInfo(
					this.status.filePath
						? `Request ${this.url()} was read from ${this.status.filePath}`
						: `Request ${this.url()} was proxied to ${this.status.proxyUrl ?? this.url()}`
				)
			)
		);

	nextEffect = Effect.sync(() => {
		this.isNextCalled = true;
	}).pipe(
		Effect.andThen(
			Effect.suspend(() =>
				Effect.logInfo(
					`Request ${this.url()} continued to the next rule after matching ${matchToString(this.status.next)}`
				)
			)
		)
	);

	getActionMethods = (): Action => ({
		abort: () => Effect.runPromise(this.abortEffect),
		ignore: () => Effect.runPromise(this.ignoreEffect),
		respond: (params) => Effect.runPromise(this.respondEffect(params)),
		next: () => Effect.runSync(this.nextEffect)
	});

	url = (): string => this.#interceptedRequest.url();
	isRequestHandled = (): boolean =>
		this.isNextCalled || this.#interceptedRequest.isInterceptResolutionHandled();
	isResolutionHandled = (): boolean => this.#interceptedRequest.isInterceptResolutionHandled();

	transferObject = (): HTTPRequest => this.#interceptedRequest;
	method = (): string => this.#interceptedRequest.method();
	headers = (): Record<string, string> => this.#interceptedRequest.headers();
	postData = (): string | undefined => this.#interceptedRequest.postData();
}

export default Request;
