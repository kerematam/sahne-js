#!/usr/bin/env node

import * as NodeChildProcessSpawner from '@effect/platform-node-shared/NodeChildProcessSpawner';
import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import * as NodePath from '@effect/platform-node-shared/NodePath';
import * as NodeRuntime from '@effect/platform-node-shared/NodeRuntime';
import * as NodeStdio from '@effect/platform-node-shared/NodeStdio';
import * as NodeTerminal from '@effect/platform-node-shared/NodeTerminal';
import { Cause, Console, Effect, Layer, Option } from 'effect';
import { readFileSync } from 'node:fs';
import { CliError, CliOutput, Command, Flag } from 'effect/unstable/cli';
import { loadConfig } from './config.js';
import { formatSahneError, isSahneError } from './errors.js';
import { runEffect } from './run.js';
import { ProxyTransport, PuppeteerLauncher } from './services.js';
import type { SahneBrowserMode } from './types.js';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { readonly version: string };

const configFile = Flag.string('file').pipe(
	Flag.withAlias('f'),
	Flag.withDescription('Config file to use'),
	Flag.optional
);

const browserMode = Flag.choice('browser', ['auto', 'remote-debugging', 'launch']).pipe(
	Flag.withDescription('Browser mode: auto, remote-debugging, or launch'),
	Flag.optional
);

const command = Command.make(
	'sahne',
	{ browser: browserMode, file: configFile },
	({ browser, file }) =>
		Effect.gen(function* () {
			const config = yield* loadConfig(Option.isSome(file) ? file.value : undefined);
			yield* Effect.scoped(
				runEffect(config, {
					browserMode: Option.isSome(browser) ? (browser.value as SahneBrowserMode) : undefined
				})
			);
		})
);

const nodeBaseServices = Layer.mergeAll(
	NodeFileSystem.layer,
	NodePath.layer,
	NodeStdio.layer,
	NodeTerminal.layer
);
const nodeCliServices = Layer.provideMerge(NodeChildProcessSpawner.layer, nodeBaseServices);
const liveServices = Layer.mergeAll(nodeCliServices, ProxyTransport.layer, PuppeteerLauncher.layer);

const defaultFormatter = CliOutput.defaultFormatter();
const formatter = CliOutput.layer({
	...defaultFormatter,
	formatVersion: (_name, version) => version
});

const args = process.argv.slice(2).map((argument) => (argument === '-V' ? '--version' : argument));

const program = Command.runWith(command, { version: packageJson.version })(args).pipe(
	Effect.provide(formatter),
	Effect.tapCause((cause) => {
		if (Cause.hasInterruptsOnly(cause)) return Effect.void;
		const failure = Cause.findErrorOption(cause);
		if (
			Option.isSome(failure) &&
			CliError.isCliError(failure.value) &&
			failure.value._tag === 'ShowHelp'
		) {
			return Effect.void;
		}
		if (Option.isSome(failure) && isSahneError(failure.value)) {
			return Console.error(formatSahneError(failure.value));
		}
		return Console.error(Cause.pretty(cause));
	}),
	Effect.provide(liveServices)
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
