// @ts-check

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
const escapedChars = new Set([
	'$',
	'^',
	'+',
	'.',
	'*',
	'(',
	')',
	'|',
	'\\',
	'?',
	'{',
	'}',
	'[',
	']'
]);

/**
 * Converts a glob pattern to a regular expression.
 * @param {string} glob - The glob pattern.
 * @returns {RegExp} - The regular expression.
 */
function globToRegex(glob) {
	const tokens = ['^'];
	let inGroup = false;
	for (let i = 0; i < glob.length; ++i) {
		const c = glob[i];
		if (c === '\\' && i + 1 < glob.length) {
			const char = glob[++i];
			tokens.push(escapedChars.has(char) ? '\\' + char : char);
			continue;
		}
		if (c === '*') {
			const beforeDeep = glob[i - 1];
			let starCount = 1;
			while (glob[i + 1] === '*') {
				starCount++;
				i++;
			}
			const afterDeep = glob[i + 1];
			const isDeep =
				starCount > 1 &&
				(beforeDeep === '/' || beforeDeep === undefined) &&
				(afterDeep === '/' || afterDeep === undefined);
			if (isDeep) {
				tokens.push('((?:[^/]*(?:/|$))*)');
				i++;
			} else {
				tokens.push('([^/]*)');
			}
			continue;
		}

		switch (c) {
			case '?':
				tokens.push('.');
				break;
			case '[':
				tokens.push('[');
				break;
			case ']':
				tokens.push(']');
				break;
			case '{':
				inGroup = true;
				tokens.push('(');
				break;
			case '}':
				inGroup = false;
				tokens.push(')');
				break;
			case ',':
				if (inGroup) {
					tokens.push('|');
					break;
				}
				tokens.push('\\' + c);
				break;
			default:
				tokens.push(escapedChars.has(c) ? '\\' + c : c);
		}
	}
	tokens.push('$');
	return new RegExp(tokens.join(''));
}

/**
 * INFO: The implementation is taken from Playwright repo as it is not exposed from npm package.
 * Path: packages/playwright-core/src/utils/network.ts
 *
 * Constructs a URL based on a base URL and a given URL.
 * @param {string | undefined} baseURL - The base URL.
 * @param {string} givenURL - The given URL.
 * @returns {string} - The constructed URL.
 */
function constructURLBasedOnBaseURL(baseURL, givenURL) {
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
export default function urlMatches({ parsedUrl, baseUrl, urlString, match, request }) {
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
