import { HTTPRequest } from 'puppeteer';

export type HandleProxyUrl = (url: string, request: HTTPRequest) => string;
