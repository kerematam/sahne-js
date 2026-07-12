import { Effect, Predicate, Schema } from 'effect';
import { ConfigValidationError } from './errors.js';
import type { InterceptorConfig, SahneConfig } from './types.js';

const pathToken = '{path}';

const makePathMessage = (message: string): string => `${pathToken} ${message}`;

const objectSchema = (message: string) =>
	Schema.Record(Schema.String, Schema.Unknown).annotate({ message });

type RuntimeFunction = (...args: never[]) => unknown;

const isRuntimeFunction = (value: unknown): value is RuntimeFunction => Predicate.isFunction(value);

const functionSchema = Schema.declare<RuntimeFunction>(isRuntimeFunction, {
	expected: 'function'
});

const stringOrFunctionSchema = Schema.declare<string | RuntimeFunction>(
	(value): value is string | RuntimeFunction =>
		typeof value === 'string' || isRuntimeFunction(value)
);

type RuntimeMatch = string | RegExp | RuntimeFunction;

const isRuntimeMatch = (value: unknown): value is RuntimeMatch =>
	typeof value === 'string' || value instanceof RegExp || isRuntimeFunction(value);

const matchSchema = Schema.declare<RuntimeMatch | ReadonlyArray<RuntimeMatch>>(
	(value): value is RuntimeMatch | ReadonlyArray<RuntimeMatch> =>
		isRuntimeMatch(value) || (Array.isArray(value) && value.every(isRuntimeMatch)),
	{
		message: makePathMessage('must be a string, RegExp, function, or array of those values')
	}
);

const initialUrlMessage = 'Sahne config initialUrl must be a non-empty string';
const initialUrlSchema = Schema.String.annotate({
	message: initialUrlMessage
})
	.annotateKey({ messageMissingKey: initialUrlMessage })
	.check(
		Schema.makeFilter((value) => value.length > 0, { message: initialUrlMessage }),
		Schema.makeFilter(
			(value) => {
				try {
					const url = new URL(value);
					return url.protocol === 'http:' || url.protocol === 'https:';
				} catch {
					return false;
				}
			},
			{ message: 'Sahne config initialUrl must be an absolute HTTP or HTTPS URL' }
		)
	);

const puppeteerOptionsSchema = Schema.Struct({
	goto: Schema.optional(objectSchema('puppeteerOptions.goto must be an object')).annotate({
		message: 'puppeteerOptions.goto must be an object'
	}),
	launch: Schema.optional(objectSchema('puppeteerOptions.launch must be an object')).annotate({
		message: 'puppeteerOptions.launch must be an object'
	}),
	connect: Schema.optional(objectSchema('puppeteerOptions.connect must be an object')).annotate({
		message: 'puppeteerOptions.connect must be an object'
	})
})
	.annotate({ message: 'puppeteerOptions must be an object' })
	.check(
		Schema.makeFilter(({ launch, connect }) => launch === undefined || connect === undefined, {
			message: 'puppeteerOptions cannot define both launch and connect'
		})
	);

const remoteDebuggingTimeoutMessage =
	'browser.remoteDebuggingTimeout must be a positive finite number';

const browserOptionsSchema = Schema.Struct({
	mode: Schema.optional(
		Schema.Literals(['auto', 'remote-debugging', 'launch']).annotate({
			message: 'browser.mode must be "auto", "remote-debugging", or "launch"'
		})
	).annotate({ message: 'browser.mode must be "auto", "remote-debugging", or "launch"' }),
	channel: Schema.optional(
		Schema.Literals(['chrome', 'chrome-beta', 'chrome-canary', 'chrome-dev']).annotate({
			message: 'browser.channel must be "chrome", "chrome-beta", "chrome-canary", or "chrome-dev"'
		})
	).annotate({
		message: 'browser.channel must be "chrome", "chrome-beta", "chrome-canary", or "chrome-dev"'
	}),
	remoteDebuggingTimeout: Schema.optional(
		Schema.Number.annotate({ message: remoteDebuggingTimeoutMessage }).check(
			Schema.makeFilter((value) => Number.isFinite(value) && value > 0, {
				message: remoteDebuggingTimeoutMessage
			})
		)
	).annotate({ message: remoteDebuggingTimeoutMessage }),
	indicator: Schema.optional(
		Schema.Literals(['title', 'none']).annotate({
			message: 'browser.indicator must be "title" or "none"'
		})
	).annotate({ message: 'browser.indicator must be "title" or "none"' }),
	closeManagedPageOnExit: Schema.optional(
		Schema.Boolean.annotate({ message: 'browser.closeManagedPageOnExit must be a boolean' })
	).annotate({ message: 'browser.closeManagedPageOnExit must be a boolean' }),
	dangerouslyEnableForAllTabs: Schema.optional(
		Schema.Boolean.annotate({
			message: 'browser.dangerouslyEnableForAllTabs must be a boolean'
		})
	).annotate({ message: 'browser.dangerouslyEnableForAllTabs must be a boolean' })
}).annotate({ message: 'browser must be an object' });

const callbackSchema = Schema.Struct({
	beforeLaunch: Schema.optional(
		functionSchema.annotate({ message: 'callback.beforeLaunch must be a function' })
	).annotate({ message: 'callback.beforeLaunch must be a function' }),
	afterLaunch: Schema.optional(
		functionSchema.annotate({ message: 'callback.afterLaunch must be a function' })
	).annotate({ message: 'callback.afterLaunch must be a function' }),
	beforeGoto: Schema.optional(
		functionSchema.annotate({ message: 'callback.beforeGoto must be a function' })
	).annotate({ message: 'callback.beforeGoto must be a function' }),
	afterGoto: Schema.optional(
		functionSchema.annotate({ message: 'callback.afterGoto must be a function' })
	).annotate({ message: 'callback.afterGoto must be a function' })
}).annotate({ message: 'callback must be an object' });

const interceptorFunction = functionSchema.annotate({
	message: makePathMessage('must be a function')
});

const interceptorSchema = Schema.Struct({
	match: Schema.optional(matchSchema).annotate({
		message: makePathMessage('must be a string, RegExp, function, or array of those values')
	}),
	ignore: Schema.optional(matchSchema).annotate({
		message: makePathMessage('must be a string, RegExp, function, or array of those values')
	}),
	onRequest: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	abort: Schema.optional(matchSchema).annotate({
		message: makePathMessage('must be a string, RegExp, function, or array of those values')
	}),
	next: Schema.optional(matchSchema).annotate({
		message: makePathMessage('must be a string, RegExp, function, or array of those values')
	}),
	onResponse: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	ignoreOnResponse: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	abortOnResponse: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	nextOnResponse: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	onError: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	file: Schema.optional(
		stringOrFunctionSchema.annotate({
			message: makePathMessage('must be a string or function')
		})
	).annotate({ message: makePathMessage('must be a string or function') }),
	proxy: Schema.optional(
		stringOrFunctionSchema.annotate({
			message: makePathMessage('must be a string or function')
		})
	).annotate({ message: makePathMessage('must be a string or function') }),
	pathRewrite: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	urlRewrite: Schema.optional(interceptorFunction).annotate({
		message: makePathMessage('must be a function')
	}),
	overrideResponseHeaders: Schema.optional(Schema.Unknown),
	overrideResponseBody: Schema.optional(Schema.Unknown),
	overrideResponseOptions: Schema.optional(Schema.Unknown),
	overrideRequestHeaders: Schema.optional(Schema.Unknown),
	overrideRequestBody: Schema.optional(Schema.Unknown),
	overrideRequestOptions: Schema.optional(Schema.Unknown)
})
	.annotate({ message: makePathMessage('must be an object') })
	.check(
		Schema.makeFilter(({ file, proxy }) => file === undefined || proxy === undefined, {
			message: makePathMessage('cannot define both file and proxy')
		})
	);

const interceptorListSchema = Schema.Struct({
	interceptor: Schema.Array(interceptorSchema)
});

const configSchema = Schema.Struct({
	initialUrl: initialUrlSchema,
	puppeteerOptions: Schema.optional(puppeteerOptionsSchema).annotate({
		message: 'puppeteerOptions must be an object'
	}),
	browser: Schema.optional(browserOptionsSchema).annotate({
		message: 'browser must be an object'
	}),
	callback: Schema.optional(callbackSchema).annotate({
		message: 'callback must be an object'
	}),
	interceptor: Schema.optional(Schema.Unknown)
})
	.annotate({ message: 'Sahne config must be an object' })
	.check(
		Schema.makeFilter(
			({ browser, puppeteerOptions }) =>
				browser?.mode === undefined || puppeteerOptions?.connect === undefined,
			{ message: 'browser.mode cannot be combined with puppeteerOptions.connect' }
		),
		Schema.makeFilter(
			({ browser, puppeteerOptions }) =>
				browser?.channel === undefined || puppeteerOptions?.connect === undefined,
			{ message: 'browser.channel cannot be combined with puppeteerOptions.connect' }
		),
		Schema.makeFilter(
			({ browser, puppeteerOptions }) =>
				browser?.remoteDebuggingTimeout === undefined || puppeteerOptions?.connect === undefined,
			{
				message: 'browser.remoteDebuggingTimeout cannot be combined with puppeteerOptions.connect'
			}
		),
		Schema.makeFilter(
			({ browser, puppeteerOptions }) =>
				browser?.mode !== 'remote-debugging' || puppeteerOptions?.launch === undefined,
			{
				message: 'browser.mode "remote-debugging" cannot be combined with puppeteerOptions.launch'
			}
		),
		Schema.makeFilter(
			({ browser }) => browser?.mode !== 'launch' || browser.channel === undefined,
			{ message: 'browser.channel cannot be used when browser.mode is "launch"' }
		),
		Schema.makeFilter(
			({ browser }) => browser?.mode !== 'launch' || browser.remoteDebuggingTimeout === undefined,
			{
				message: 'browser.remoteDebuggingTimeout cannot be used when browser.mode is "launch"'
			}
		)
	);

const decodeOptions = {
	errors: 'first',
	onExcessProperty: 'preserve'
} as const;

const formatPath = (path: string): string =>
	path.replace(/^\["([^"\\]+)"\]/, '$1').replace(/\["([^"\\]+)"\]/g, '.$1');

const formatSchemaError = (error: Schema.SchemaError): string => {
	const [message = 'Invalid Sahne config'] = error.message.split('\n');
	if (!message.includes(pathToken)) return message;

	const path = error.message.match(/^\s+at (.+)$/m)?.[1];
	return message.replace(pathToken, path === undefined ? 'config' : formatPath(path));
};

const mapSchemaError = (error: Schema.SchemaError): ConfigValidationError =>
	new ConfigValidationError({ message: formatSchemaError(error) });

const decodeConfig = Schema.decodeUnknownEffect(configSchema, decodeOptions);
const decodeInterceptors = Schema.decodeUnknownEffect(interceptorListSchema, decodeOptions);

const validateInterceptors = (input: unknown): Effect.Effect<void, ConfigValidationError> =>
	decodeInterceptors({ interceptor: Array.isArray(input) ? input : [input] }).pipe(
		Effect.mapError(mapSchemaError),
		Effect.asVoid
	);

export const validateConfigSchema = (
	input: unknown
): Effect.Effect<SahneConfig, ConfigValidationError> =>
	Effect.gen(function* () {
		const decoded = yield* decodeConfig(input).pipe(Effect.mapError(mapSchemaError));
		if (decoded.interceptor !== undefined) yield* validateInterceptors(decoded.interceptor);
		return input as SahneConfig;
	});

export const validateInterceptorConfigSchema = (
	input: InterceptorConfig | ReadonlyArray<InterceptorConfig>
): Effect.Effect<void, ConfigValidationError> => validateInterceptors(input);
