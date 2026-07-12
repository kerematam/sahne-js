import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { Context, Effect, Layer } from 'effect';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import { BrowserConnectError, BrowserLaunchError, ProxyRequestError } from './errors.js';

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];
type ConnectOptions = Parameters<typeof puppeteer.connect>[0];

const require = createRequire(import.meta.url);
const puppeteerVersion = (require('puppeteer/package.json') as { readonly version: string })
	.version;

export class PuppeteerConnectTimeoutError extends Error {
	readonly timeout: number;

	constructor(timeout: number) {
		super(`Timed out after ${timeout}ms while waiting for Puppeteer to connect`);
		this.name = 'PuppeteerConnectTimeoutError';
		this.timeout = timeout;
	}
}

const connectPuppeteer = async (
	options: ConnectOptions,
	timeout: number | undefined
): Promise<Browser> => {
	const pendingConnection = puppeteer.connect(options);
	if (timeout === undefined) return pendingConnection;

	let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
	const timeoutFailure = new Promise<never>((_resolve, reject) => {
		timeoutHandle = setTimeout(() => reject(new PuppeteerConnectTimeoutError(timeout)), timeout);
	});

	try {
		return await Promise.race([pendingConnection, timeoutFailure]);
	} catch (cause) {
		if (cause instanceof PuppeteerConnectTimeoutError) {
			void pendingConnection.then((browser) => browser.disconnect()).catch(() => undefined);
		}
		throw cause;
	} finally {
		if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
	}
};

export class ProxyTransport extends Context.Service<
	ProxyTransport,
	{
		readonly execute: (
			requestUrl: string,
			proxyUrl: string,
			options: RequestInit
		) => Effect.Effect<Response, ProxyRequestError>;
	}
>()('sahne/ProxyTransport') {
	static readonly layer = Layer.succeed(ProxyTransport)({
		execute: (requestUrl, proxyUrl, options) =>
			Effect.tryPromise({
				try: (interruptionSignal) => {
					const configuredSignal = options.signal;
					const signal = configuredSignal
						? AbortSignal.any([interruptionSignal, configuredSignal])
						: interruptionSignal;

					return fetch(proxyUrl, { ...options, signal });
				},
				catch: (cause) =>
					new ProxyRequestError({
						requestUrl,
						proxyUrl,
						cause,
						message: `Failed to proxy ${requestUrl} to ${proxyUrl}`
					})
			})
	});
}

export class PuppeteerLauncher extends Context.Service<
	PuppeteerLauncher,
	{
		readonly version: string;
		readonly launch: (options?: LaunchOptions) => Effect.Effect<Browser, BrowserLaunchError>;
		readonly connect: (
			options: ConnectOptions,
			timeout?: number
		) => Effect.Effect<Browser, BrowserConnectError>;
	}
>()('sahne/PuppeteerLauncher') {
	static readonly layer = Layer.succeed(PuppeteerLauncher)({
		version: puppeteerVersion,
		launch: (options) =>
			Effect.tryPromise({
				try: () => puppeteer.launch(options),
				catch: (cause) =>
					new BrowserLaunchError({
						cause,
						message: 'Failed to launch Puppeteer'
					})
			}),
		connect: (options, timeout) =>
			Effect.tryPromise({
				try: () => connectPuppeteer(options, timeout),
				catch: (cause) =>
					new BrowserConnectError({
						cause,
						message: 'Failed to connect Puppeteer to the existing browser'
					})
			})
	});
}

export const InterceptionLive = Layer.mergeAll(NodeFileSystem.layer, ProxyTransport.layer);

export const RunnerLive = Layer.mergeAll(
	NodeFileSystem.layer,
	ProxyTransport.layer,
	PuppeteerLauncher.layer
);
