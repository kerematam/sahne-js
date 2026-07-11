import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { Context, Effect, Layer } from 'effect';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';
import { BrowserLaunchError, ProxyRequestError } from './errors.js';

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

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
		readonly launch: (options?: LaunchOptions) => Effect.Effect<Browser, BrowserLaunchError>;
	}
>()('sahne/PuppeteerLauncher') {
	static readonly layer = Layer.succeed(PuppeteerLauncher)({
		launch: (options) =>
			Effect.tryPromise({
				try: () => puppeteer.launch(options),
				catch: (cause) =>
					new BrowserLaunchError({
						cause,
						message: 'Failed to launch Puppeteer'
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
