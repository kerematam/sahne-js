import { Data } from 'effect';

export class ConfigLoadError extends Data.TaggedError('ConfigLoadError')<{
	readonly path: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class ConfigValidationError extends Data.TaggedError('ConfigValidationError')<{
	readonly message: string;
}> {}

export class BrowserLaunchError extends Data.TaggedError('BrowserLaunchError')<{
	readonly cause: unknown;
	readonly message: string;
}> {}

export class PageSetupError extends Data.TaggedError('PageSetupError')<{
	readonly operation: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class NavigationError extends Data.TaggedError('NavigationError')<{
	readonly url: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class RequestActionError extends Data.TaggedError('RequestActionError')<{
	readonly action: 'abort' | 'continue' | 'respond';
	readonly requestUrl: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class ProxyRequestError extends Data.TaggedError('ProxyRequestError')<{
	readonly requestUrl: string;
	readonly proxyUrl: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class ProxyResponseError extends Data.TaggedError('ProxyResponseError')<{
	readonly proxyUrl: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class FileReadError extends Data.TaggedError('FileReadError')<{
	readonly path: string;
	readonly requestUrl: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export class HookError extends Data.TaggedError('HookError')<{
	readonly hook: string;
	readonly cause: unknown;
	readonly message: string;
}> {}

export type InterceptionError =
	RequestActionError | ProxyRequestError | ProxyResponseError | FileReadError | HookError;

export type RunnerError =
	BrowserLaunchError | PageSetupError | NavigationError | HookError | RequestActionError;

export type SahneError = ConfigLoadError | ConfigValidationError | InterceptionError | RunnerError;

const sahneErrorTags = new Set([
	'ConfigLoadError',
	'ConfigValidationError',
	'BrowserLaunchError',
	'PageSetupError',
	'NavigationError',
	'RequestActionError',
	'ProxyRequestError',
	'ProxyResponseError',
	'FileReadError',
	'HookError'
]);

export const isSahneError = (value: unknown): value is SahneError =>
	typeof value === 'object' &&
	value !== null &&
	'_tag' in value &&
	typeof value._tag === 'string' &&
	sahneErrorTags.has(value._tag);

const getCauseMessage = (cause: unknown): string | undefined => {
	if (typeof cause === 'string') {
		const message = cause.trim();
		return message.length > 0 ? message : undefined;
	}
	if (
		typeof cause === 'object' &&
		cause !== null &&
		'message' in cause &&
		typeof cause.message === 'string'
	) {
		const message = cause.message.trim();
		return message.length > 0 ? message : undefined;
	}
	return undefined;
};

export const formatSahneError = (error: SahneError): string => {
	if (!('cause' in error)) return error.message;

	const causeMessage = getCauseMessage(error.cause);
	return causeMessage && causeMessage !== error.message.trim()
		? `${error.message}\nCause: ${causeMessage}`
		: error.message;
};
