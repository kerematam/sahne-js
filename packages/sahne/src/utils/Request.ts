import type { HTTPRequest, ResponseForRequest } from 'puppeteer';

class Request {
	isFallbackCalled = false;
	#interceptedRequest: HTTPRequest;

	constructor(interceptedRequest: HTTPRequest) {
		this.#interceptedRequest = interceptedRequest;
	}

	abort = () => this.#interceptedRequest.abort();
	ignore = () => this.#interceptedRequest.continue();
	respond = (params: ResponseForRequest) => this.#interceptedRequest.respond(params);
	fallback = () => {
		this.isFallbackCalled = true;
	};
	getActionMethods = () => {
		return {
			abort: this.abort,
			ignore: this.ignore,
			respond: this.respond,
			fallback: this.fallback
		};
	};

	url = () => this.#interceptedRequest.url();
	isRequestHandled = () => this.isFallbackCalled || this.#interceptedRequest.isInterceptResolutionHandled();

	transferObject = () => this.#interceptedRequest;
	method = () => this.#interceptedRequest.method();
	headers = () => this.#interceptedRequest.headers();
	postData = () => this.#interceptedRequest.postData();
}

export default Request;
