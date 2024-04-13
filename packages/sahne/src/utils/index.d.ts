import { HTTPRequest } from 'puppeteer';

export type UrlMatchesOptions = {
	parsedUrl: URL;
	baseUrl: string;
	urlString: string;
	match: Match;
	request: HTTPRequest;
};

export type UrlMatches = (options: UrlMatchesOptions) => boolean;

export type IsRequestHandled = (url: HTTPRequest) => boolean;

export type handleProxyUrl = (url: string) => string;
