import type { HTTPRequest, ResponseForRequest } from 'puppeteer';
import { Match } from './types';
import { handleError, logDecorator, logger } from './utils/logger';
import { RequestInit } from 'node-fetch';

type Status = {
	proxyUrl?: string;
	filePath?: string;
	match?: Match;
	ignore?: Match;
	abort?: Match;
	fallback?: Match;
	requestOptions?: RequestInit;
};

class Request {
	isFallbackCalled = false;
	#interceptedRequest: HTTPRequest;

	// TODO: add implementation
	logLevel: 'info' | 'debug' | 'error' = 'info';

	/**
	 * states that are set through interception. They are used into logging
	 */
	status: Status = {};
	/**
	 * states that are set through interception. They are used into logging
	 * @param {LoggerState} loggerState
	 * @returns {void}
	 */
	setStatus = (status: Status) => {
		Object.assign(this.status, status);
	};

	constructor(interceptedRequest: HTTPRequest, logLevel: 'info' | 'debug' | 'error' = 'info') {
		this.#interceptedRequest = interceptedRequest;
		this.logLevel = logLevel;
	}

	abort = async () => {
		try {
			await this.#interceptedRequest.abort();
		} catch (error) {
			logger.error('Error while aborting request');
			handleError(error);
		}
	};
	ignore = async () => {
		try {
			await this.#interceptedRequest.continue();
			const requestlUrl = logDecorator.url(this.url());
			const matchRule = logDecorator.match(this.status.ignore);
			const message = `request: ${requestlUrl} is NOT intercepted as it matches with ignore rule: ${matchRule}`;
			logger.info(message);
		} catch (error) {
			await logger.error('Error while ignoring request');
			await handleError(error);
		}
	};
	respond = async (params: ResponseForRequest) => {
		try {
			await this.#interceptedRequest.respond(params);
			const proxiedTo = logDecorator.url(this.status.proxyUrl || this.status.filePath);
			const requestUrl = logDecorator.url(this.url());

			if (this.status.filePath) {
				logger.info(`request: ${requestUrl} ` + `is read from the file: ${proxiedTo}.`);
			} else {
				logger.info(`request: ${requestUrl} ` + `is proxied to ${proxiedTo}.`);
			}
		} catch (error) {
			const proxiedTo = logDecorator.url(this.status.proxyUrl || this.status.filePath);
			const requestUrl = logDecorator.url(this.url());
			logger.error(`request: ${requestUrl} ` + `could NOT be proxied to ${proxiedTo}.`);
			handleError(error);
		}
	};
	fallback = () => {
		this.isFallbackCalled = true;
		const fallbackRule = logDecorator.match(this.status.fallback);
		const requestUrl = logDecorator.url(this.url());
		const message = `request: ${requestUrl} is NOT intercepted as it matches with fallback rule: ${fallbackRule}`;
		logger.info(message);
	};

	/**
	 * @description - Returns all the action methods
	 * @returns {Object} - Object containing all the action methods
	 */
	getActionMethods = () => {
		return {
			abort: this.abort,
			ignore: this.ignore,
			respond: this.respond,
			fallback: this.fallback
		};
	};

	url = () => this.#interceptedRequest.url();
	isRequestHandled = () =>
		this.isFallbackCalled || this.#interceptedRequest.isInterceptResolutionHandled();

	transferObject = () => this.#interceptedRequest;
	method = () => this.#interceptedRequest.method();
	headers = () => this.#interceptedRequest.headers();
	postData = () => this.#interceptedRequest.postData();

	log = {
		proxyRequestError: (error: unknown) => {
			const proxyUrl = logDecorator.url(this.status.proxyUrl);
			const requestlUrl = logDecorator.url(this.url());
			const message = `Failed to make proxy request to: ${proxyUrl} while intercepting request: ${requestlUrl}`;
			const messages = [
				message,
				'\nEnsure that:',
				`  - proxy server is running at ${proxyUrl}.`,
				`  - proxy rule is valid for ${requestlUrl}.\n`
			].join('\n');
			logger.error(messages);
			handleError(error);
		},
		fileReadError: (error: unknown) => {
			const filePath = logDecorator.url(this.status.filePath);
			const requestlUrl = logDecorator.url(this.url());
			const message = `Failed to read file path from: ${filePath} while intercepting request: ${requestlUrl}`;
			const messages = [
				message,
				'\nEnsure that:',
				`  - file exist at ${filePath}.`,
				`  - proxy rule is valid for ${requestlUrl}.\n`
			].join('\n');
			logger.error(messages);
			handleError(error);
		}
	};
}

export default Request;
