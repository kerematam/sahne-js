import { HTTPRequest } from 'puppeteer';
import type { Match } from '../types';

export type UrlMatchesOptions = {
	parsedUrl: URL;
	baseUrl: string;
	urlString: string;
	match: Match;
	request: HTTPRequest;
};

export type UrlMatches = (options: UrlMatchesOptions) => boolean;

export type IsRequestHandled = (url: HTTPRequest) => boolean;

export type HandleProxyUrl = (url: string) => string;
