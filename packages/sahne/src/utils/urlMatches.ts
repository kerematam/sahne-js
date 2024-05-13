/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HTTPRequest } from 'puppeteer';
import type { Match } from '../types';
import { globToRegex } from './glob';

/**
 * INFO: The implementation is taken from Playwright repo as it is not exposed from npm package.
 * Path: packages/playwright-core/src/utils/network.ts
 *
 * Constructs a URL based on a base URL and a given URL.
 * @param {string | undefined} baseURL - The base URL.
 * @param {string} givenURL - The given URL.
 * @returns {string} - The constructed URL.
 */
export function constructURLBasedOnBaseURL(baseURL: string | undefined, givenURL: string): string {
	try {
		return new URL(givenURL, baseURL).toString();
	} catch (e) {
		return givenURL;
	}
}

/**
 * Checks if the URL matches the given match parameter.
 *
 * @param {import("./types").UrlMatchesOptions} options
 * @returns {boolean}
 */
export default function urlMatches({
	parsedUrl,
	baseUrl,
	urlString,
	match,
	request
}: {
	parsedUrl: URL;
	baseUrl: string;
	urlString: string;
	match: Match;
	request: HTTPRequest;
}): boolean {
	if (match === undefined || match === '') {
		return true;
	}
	if (typeof match === 'string' && !match.startsWith('*')) {
		match = constructURLBasedOnBaseURL(baseUrl, match);
	}
	if (typeof match === 'string') {
		match = globToRegex(match);
	}
	if (match instanceof RegExp) {
		return match.test(urlString);
	}
	if (typeof match === 'string' && match === urlString) {
		return true;
	}
	if (!parsedUrl) {
		return false;
	}
	if (typeof match === 'string') {
		return parsedUrl.pathname === match;
	}
	if (typeof match !== 'function') {
		throw new Error('url parameter should be string, RegExp or function');
	}

	return match(parsedUrl, request);
}
