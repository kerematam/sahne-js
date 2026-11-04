import * as NodeFileSystem from '@effect/platform-node-shared/NodeFileSystem';
import { assert, describe, it } from '@effect/vitest';
import { Effect, Layer, Logger } from 'effect';
import { EventEmitter } from 'node:events';
import type {
	Browser,
	ConnectOptions,
	LaunchOptions,
	NewDocumentScriptEvaluation,
	Page,
	Target
} from 'puppeteer';
import { runEffect, type RunEffectOptions } from '../src/run.js';
import { ProxyTransport, PuppeteerLauncher } from '../src/services.js';
import type { SahneConfig } from '../src/types.js';

const titlePrefix = '🟢 Sahne — ';

class FakePage extends EventEmitter {
	readonly navigations: string[] = [];
	readonly interceptionStates: boolean[] = [];
	readonly operations: string[];
	preloadInstallCalls = 0;
	preloadRemoveCalls = 0;
	titleInstallCalls = 0;
	titleRestoreCalls = 0;
	bringToFrontCalls = 0;
	closeCalls = 0;
	viewportCalls = 0;
	closed = false;
	failInterception = false;
	failPreloadRemoval = false;
	profilePath = '/profiles/Profile 2';
	$eval = async (): Promise<string> => this.profilePath;
	currentTitle: string;
	currentUrl: string;
	indicatorPrefix: string | undefined;

	constructor(
		readonly id: string,
		operations: string[],
		url = 'about:blank',
		title = ''
	) {
		super();
		this.operations = operations;
		this.currentUrl = url;
		this.currentTitle = title;
	}

	setViewport = async (): Promise<void> => {
		this.viewportCalls += 1;
		this.operations.push(`${this.id}:viewport`);
	};

	setRequestInterception = async (enabled: boolean): Promise<void> => {
		if (enabled && this.failInterception) throw new Error('interception setup failed');
		this.interceptionStates.push(enabled);
		this.operations.push(`${this.id}:interception:${String(enabled)}`);
	};

	evaluateOnNewDocument = async (
		_pageFunction: unknown,
		prefix: string
	): Promise<NewDocumentScriptEvaluation> => {
		this.preloadInstallCalls += 1;
		this.indicatorPrefix = prefix;
		this.operations.push(`${this.id}:indicator:preload`);
		return { identifier: `${this.id}-indicator` };
	};

	removeScriptToEvaluateOnNewDocument = async (): Promise<void> => {
		this.preloadRemoveCalls += 1;
		this.operations.push(`${this.id}:indicator:remove-preload`);
		if (this.failPreloadRemoval) throw new Error('preload removal failed');
	};

	evaluate = async (
		_pageFunction: unknown,
		prefix: string,
		_stateKey: string,
		restore?: boolean
	) => {
		if (restore === undefined) {
			this.titleInstallCalls += 1;
			this.indicatorPrefix = prefix;
			this.currentTitle = `${prefix}${this.currentTitle}`;
			this.operations.push(`${this.id}:indicator:install`);
		} else {
			if (restore && this.currentTitle.startsWith(prefix)) {
				this.currentTitle = this.currentTitle.slice(prefix.length);
				this.titleRestoreCalls += 1;
			}
			this.operations.push(`${this.id}:indicator:cleanup:${String(restore)}`);
		}
	};

	goto = async (url: string): Promise<null> => {
		this.navigations.push(url);
		this.currentUrl = url;
		this.currentTitle = `${this.indicatorPrefix ?? ''}Application`;
		this.operations.push(`${this.id}:goto:${url}`);
		return null;
	};

	setApplicationTitle = (title: string): void => {
		this.currentTitle = `${this.indicatorPrefix ?? ''}${title}`;
	};

	bringToFront = async (): Promise<void> => {
		this.bringToFrontCalls += 1;
		this.operations.push(`${this.id}:front`);
	};

	title = async (): Promise<string> => this.currentTitle;
	url = (): string => this.currentUrl;
	isClosed = (): boolean => this.closed;

	close = async (): Promise<void> => {
		this.closeCalls += 1;
		this.closed = true;
		this.operations.push(`${this.id}:close`);
		this.emit('close');
	};

	asPage = (): Page => this as unknown as Page;
}

class FakeTarget {
	constructor(readonly targetPage: FakePage | null) {}

	url = (): string => this.targetPage?.url() ?? '';
	page = async (): Promise<Page | null> => this.targetPage?.asPage() ?? null;
	asTarget = (): Target => this as unknown as Target;
}

class FakeBrowser extends EventEmitter {
	connected = true;
	defaultContextId: string | undefined;
	readonly createdContextIds: Array<string | undefined> = [];
	target = () => ({
		createCDPSession: async () => ({
			detach: async () => {},
			send: async (
				method: string,
				params?: { url?: string; targetId?: string; browserContextId?: string }
			) => {
				if (method === 'Target.getBrowserContexts')
					return {
						browserContextIds: [],
						defaultBrowserContextId: this.defaultContextId
					};
				if (method === 'Target.getTargets') return { targetInfos: [] };
				if (method === 'Target.createTarget') {
					this.createdContextIds.push(params?.browserContextId);
					const page = (await this.newPage()) as unknown as FakePage;
					page.currentUrl = params?.url ?? 'about:blank';
					return { targetId: page.id };
				}
				if (method === 'Target.closeTarget') {
					await this.allPages.find((page) => page.id === params?.targetId)?.close();
					return { success: true };
				}
				throw new Error(`Unexpected CDP method: ${method}`);
			}
		})
	});
	waitForTarget = async (predicate: (target: Target) => boolean): Promise<Target> => {
		const target = this.allPages.map((page) => new FakeTarget(page).asTarget()).find(predicate);
		if (!target) throw new Error('Target not found');
		return target;
	};
	closeCalls = 0;
	disconnectCalls = 0;
	newPageCalls = 0;
	pagesCalls = 0;
	failManagedInterception = false;
	failManagedPreloadRemoval = false;
	readonly operations: string[];
	readonly allPages: FakePage[];

	constructor(initialPages: FakePage[] = []) {
		super();
		this.operations = initialPages[0]?.operations ?? [];
		this.allPages = initialPages;
	}

	pages = async (): Promise<Page[]> => {
		this.pagesCalls += 1;
		this.operations.push('browser:pages');
		return this.allPages.map((page) => page.asPage());
	};

	newPage = async (): Promise<Page> => {
		this.newPageCalls += 1;
		this.operations.push('browser:newPage');
		const page = new FakePage(`managed-${this.newPageCalls}`, this.operations);
		page.failInterception = this.failManagedInterception;
		page.failPreloadRemoval = this.failManagedPreloadRemoval;
		this.allPages.push(page);
		this.emit('targetcreated', new FakeTarget(page).asTarget());
		return page.asPage();
	};

	createExternalPage = (id = 'external'): FakePage => {
		const page = new FakePage(id, this.operations, 'https://external.test', 'External');
		this.allPages.push(page);
		this.emit('targetcreated', new FakeTarget(page).asTarget());
		return page;
	};

	close = async (): Promise<void> => {
		this.closeCalls += 1;
		this.connected = false;
		this.operations.push('browser:close');
		this.emit('disconnected');
	};

	disconnect = async (): Promise<void> => {
		this.disconnectCalls += 1;
		this.connected = false;
		this.operations.push('browser:disconnect');
		this.emit('disconnected');
	};

	asBrowser = (): Browser => this as unknown as Browser;
}

const stopAfterGoto = (): never => {
	throw new Error('stop after goto');
};

const runnerLayer = ({
	browser,
	launch,
	connect,
	puppeteerVersion = '25.3.0'
}: {
	readonly browser: FakeBrowser;
	readonly launch: (options?: LaunchOptions) => void;
	readonly connect: (options: ConnectOptions, timeout?: number) => void;
	readonly puppeteerVersion?: string;
}) =>
	Layer.mergeAll(
		NodeFileSystem.layer,
		ProxyTransport.layer,
		Layer.succeed(PuppeteerLauncher)({
			version: puppeteerVersion,
			launch: (options) => {
				launch(options);
				return Effect.succeed(browser.asBrowser());
			},
			connect: (options, timeout) => {
				connect(options, timeout);
				return Effect.succeed(browser.asBrowser());
			}
		})
	);

const execute = async ({
	browser,
	config,
	launch = () => {},
	connect = () => {},
	logs,
	options,
	puppeteerVersion
}: {
	readonly browser: FakeBrowser;
	readonly config: SahneConfig;
	readonly launch?: (options?: LaunchOptions) => void;
	readonly connect?: (options: ConnectOptions, timeout?: number) => void;
	readonly logs?: string[];
	readonly options?: RunEffectOptions;
	readonly puppeteerVersion?: string;
}): Promise<void> => {
	let effect = Effect.scoped(runEffect(config, options)).pipe(
		Effect.provide(runnerLayer({ browser, launch, connect, puppeteerVersion }))
	);
	if (logs !== undefined) {
		effect = Effect.withLogger(
			effect,
			Logger.make(({ message }) => {
				logs.push(String(message));
			})
		);
	}
	await Effect.runPromiseExit(effect);
};

const connectedConfig = (overrides: Partial<SahneConfig> = {}): SahneConfig => ({
	initialUrl: 'https://example.test',
	puppeteerOptions: { connect: { channel: 'chrome' } },
	interceptor: { match: '**' },
	callback: { afterGoto: stopAfterGoto },
	...overrides
});

describe('connected browser page ownership', () => {
	it('creates and manages one fresh page without touching an existing page', async () => {
		const operations: string[] = [];
		const personal = new FakePage('personal', operations, 'https://personal.test', 'Personal');
		const browser = new FakeBrowser([personal]);
		let hookPage: Page | undefined;
		let launchCalls = 0;
		let connectOptions: ConnectOptions | undefined;

		await execute({
			browser,
			config: connectedConfig({
				callback: {
					beforeGoto: (_browser, page) => {
						hookPage = page;
					},
					afterGoto: stopAfterGoto
				}
			}),
			launch: () => {
				launchCalls += 1;
			},
			connect: (options) => {
				connectOptions = options;
			}
		});

		const managed = browser.allPages[1];
		assert.ok(managed);
		assert.strictEqual(launchCalls, 0);
		assert.strictEqual(connectOptions?.channel, 'chrome');
		assert.strictEqual(browser.pagesCalls, 0);
		assert.strictEqual(browser.newPageCalls, 1);
		assert.strictEqual(hookPage, managed.asPage());
		assert.deepEqual(personal.navigations, []);
		assert.deepEqual(personal.interceptionStates, []);
		assert.strictEqual(personal.preloadInstallCalls, 0);
		assert.strictEqual(personal.closeCalls, 0);
		assert.deepEqual(managed.navigations, ['https://example.test']);
		assert.deepEqual(managed.interceptionStates, [true, false]);
		assert.strictEqual(managed.preloadInstallCalls, 1);
		assert.strictEqual(managed.titleInstallCalls, 1);
		assert.strictEqual(managed.closeCalls, 1);
		assert.strictEqual(managed.bringToFrontCalls, 1);
		assert.isBelow(
			browser.operations.indexOf('managed-1:interception:true'),
			browser.operations.indexOf('managed-1:goto:https://example.test')
		);
		assert.isBelow(
			browser.operations.indexOf('managed-1:indicator:install'),
			browser.operations.indexOf('managed-1:goto:https://example.test')
		);
		assert.strictEqual(browser.disconnectCalls, 1);
		assert.strictEqual(browser.closeCalls, 0);
	});

	it('leaves unrelated future pages untouched by default', async () => {
		const browser = new FakeBrowser();
		let external: FakePage | undefined;

		await execute({
			browser,
			config: connectedConfig({
				callback: {
					afterGoto: async () => {
						external = browser.createExternalPage();
						await new Promise<void>((resolve) => setImmediate(resolve));
						stopAfterGoto();
					}
				}
			})
		});

		assert.ok(external);
		assert.deepEqual(external.interceptionStates, []);
		assert.deepEqual(external.navigations, []);
		assert.strictEqual(external.preloadInstallCalls, 0);
		assert.strictEqual(external.closeCalls, 0);
	});

	it('disconnects when the developer closes the managed page', async () => {
		const browser = new FakeBrowser();

		await execute({
			browser,
			config: connectedConfig({
				callback: {
					afterGoto: async (_browser, page) => {
						await page.close();
					}
				}
			})
		});

		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.strictEqual(managed.closeCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 1);
		assert.strictEqual(browser.closeCalls, 0);
	});

	it('marks only the managed title and restores it when the page is retained', async () => {
		const browser = new FakeBrowser();

		await execute({
			browser,
			config: connectedConfig({
				browser: { closeManagedPageOnExit: false },
				callback: {
					afterGoto: (_browser, page) => {
						(page as unknown as FakePage).setApplicationTitle('Updated by HMR');
						stopAfterGoto();
					}
				}
			})
		});

		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.strictEqual(managed.preloadInstallCalls, 1);
		assert.strictEqual(managed.titleInstallCalls, 1);
		assert.strictEqual(managed.preloadRemoveCalls, 1);
		assert.strictEqual(managed.titleRestoreCalls, 1);
		assert.strictEqual(managed.currentTitle, 'Updated by HMR');
		assert.strictEqual(managed.closeCalls, 0);
	});

	it('supports disabling the managed title indicator', async () => {
		const browser = new FakeBrowser();

		await execute({
			browser,
			config: connectedConfig({ browser: { indicator: 'none' } })
		});

		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.strictEqual(managed.preloadInstallCalls, 0);
		assert.strictEqual(managed.titleInstallCalls, 0);
		assert.strictEqual(managed.currentTitle, 'Application');
	});

	it('restores the current title even when preload removal fails', async () => {
		const browser = new FakeBrowser();
		browser.failManagedPreloadRemoval = true;
		const logs: string[] = [];

		await execute({
			browser,
			logs,
			config: connectedConfig({
				browser: { closeManagedPageOnExit: false },
				callback: {
					afterGoto: (_browser, page) => {
						(page as unknown as FakePage).setApplicationTitle('Retained');
						stopAfterGoto();
					}
				}
			})
		});

		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.strictEqual(managed.preloadRemoveCalls, 1);
		assert.strictEqual(managed.titleRestoreCalls, 1);
		assert.strictEqual(managed.currentTitle, 'Retained');
		assert.strictEqual(managed.closeCalls, 0);
		assert.strictEqual(
			logs.filter((message) => message.includes('Failed to fully remove')).length,
			1
		);
	});

	it('closes a partially prepared managed page when setup fails', async () => {
		const browser = new FakeBrowser();
		browser.failManagedInterception = true;

		await execute({ browser, config: connectedConfig() });

		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.deepEqual(managed.navigations, []);
		assert.strictEqual(managed.closeCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 1);
		assert.strictEqual(browser.closeCalls, 0);
	});

	it('dangerously enables existing and future pages without claiming them', async () => {
		const operations: string[] = [];
		const personal = new FakePage('personal', operations, 'https://personal.test', 'Personal');
		const browser = new FakeBrowser([personal]);
		const logs: string[] = [];
		let external: FakePage | undefined;

		await execute({
			browser,
			logs,
			config: connectedConfig({
				browser: { dangerouslyEnableForAllTabs: true },
				callback: {
					afterGoto: async () => {
						external = browser.createExternalPage();
						await new Promise<void>((resolve) => setImmediate(resolve));
						stopAfterGoto();
					}
				}
			})
		});

		const managed = browser.allPages.find((page) => page.id.startsWith('managed'));
		assert.ok(managed);
		assert.ok(external);
		for (const page of [personal, external]) {
			assert.deepEqual(page.interceptionStates, [true, false]);
			assert.deepEqual(page.navigations, []);
			assert.strictEqual(page.preloadInstallCalls, 0);
			assert.strictEqual(page.closeCalls, 0);
		}
		assert.deepEqual(managed.interceptionStates, [true, false]);
		assert.deepEqual(managed.navigations, ['https://example.test']);
		assert.strictEqual(managed.preloadInstallCalls, 1);
		assert.strictEqual(managed.closeCalls, 1);
		assert.strictEqual(
			logs.filter((message) => message.includes('dangerouslyEnableForAllTabs')).length,
			1
		);
	});
});

describe('launched browser behavior', () => {
	it('keeps global new-page interception and closes the owned browser', async () => {
		const operations: string[] = [];
		const initial = new FakePage('initial', operations);
		const browser = new FakeBrowser([initial]);
		let future: FakePage | undefined;
		let launchOptions: LaunchOptions | undefined;
		let connectCalls = 0;

		await execute({
			browser,
			config: {
				initialUrl: 'https://example.test',
				puppeteerOptions: { launch: { headless: true } },
				interceptor: { match: '**' },
				callback: {
					afterGoto: async () => {
						future = browser.createExternalPage('future');
						await new Promise<void>((resolve) => setImmediate(resolve));
						stopAfterGoto();
					}
				}
			},
			launch: (options) => {
				launchOptions = options;
			},
			connect: () => {
				connectCalls += 1;
			}
		});

		assert.ok(future);
		assert.strictEqual(connectCalls, 0);
		assert.isTrue(launchOptions?.headless);
		assert.deepEqual(initial.navigations, ['https://example.test']);
		assert.deepEqual(initial.interceptionStates, [true, false]);
		assert.deepEqual(future.interceptionStates, [true, false]);
		assert.strictEqual(future.viewportCalls, 1);
		assert.strictEqual(browser.closeCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 0);
	});
});

describe('high-level browser modes', () => {
	it('uses Chrome stable remote debugging by default in an interactive terminal', async () => {
		const browser = new FakeBrowser();
		let connectOptions: ConnectOptions | undefined;
		let connectTimeout: number | undefined;
		let launchCalls = 0;

		await execute({
			browser,
			config: {
				initialUrl: 'https://example.test',
				interceptor: { match: '**' },
				callback: { afterGoto: stopAfterGoto }
			},
			options: {
				environment: { stdinIsTTY: true, stdoutIsTTY: true }
			},
			launch: () => {
				launchCalls += 1;
			},
			connect: (options, timeout) => {
				connectOptions = options;
				connectTimeout = timeout;
			}
		});

		assert.strictEqual(launchCalls, 0);
		assert.strictEqual(connectOptions?.channel, 'chrome');
		assert.deepEqual(connectOptions?.defaultViewport, { width: 0, height: 0 });
		assert.strictEqual(connectTimeout, 60_000);
		assert.strictEqual(browser.newPageCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 1);
	});

	it('uses the configured channel in remote-debugging mode even in CI', async () => {
		const browser = new FakeBrowser();
		let connectOptions: ConnectOptions | undefined;
		let connectTimeout: number | undefined;

		await execute({
			browser,
			config: {
				initialUrl: 'https://example.test',
				browser: {
					mode: 'remote-debugging',
					channel: 'chrome-beta',
					remoteDebuggingTimeout: 12_345
				},
				callback: { afterGoto: stopAfterGoto }
			},
			options: {
				environment: { ci: 'true', stdinIsTTY: false, stdoutIsTTY: false }
			},
			connect: (options, timeout) => {
				connectOptions = options;
				connectTimeout = timeout;
			}
		});

		assert.strictEqual(connectOptions?.channel, 'chrome-beta');
		assert.strictEqual(connectTimeout, 12_345);
		assert.strictEqual(browser.newPageCalls, 1);
	});

	it('launches an isolated browser for default auto mode in CI', async () => {
		const operations: string[] = [];
		const initial = new FakePage('initial', operations);
		const browser = new FakeBrowser([initial]);
		let launchCalls = 0;
		let connectCalls = 0;

		await execute({
			browser,
			config: {
				initialUrl: 'https://example.test',
				callback: { afterGoto: stopAfterGoto }
			},
			options: {
				environment: { ci: 'true', stdinIsTTY: false, stdoutIsTTY: false }
			},
			launch: () => {
				launchCalls += 1;
			},
			connect: () => {
				connectCalls += 1;
			}
		});

		assert.strictEqual(launchCalls, 1);
		assert.strictEqual(connectCalls, 0);
		assert.strictEqual(browser.closeCalls, 1);
	});

	it('lets auto mode launch on Puppeteer versions before channel discovery support', async () => {
		const operations: string[] = [];
		const initial = new FakePage('initial', operations);
		const browser = new FakeBrowser([initial]);
		const logs: string[] = [];
		let launchCalls = 0;

		await execute({
			browser,
			logs,
			puppeteerVersion: '24.31.0',
			config: {
				initialUrl: 'https://example.test',
				callback: { afterGoto: stopAfterGoto }
			},
			options: {
				environment: { stdinIsTTY: true, stdoutIsTTY: true }
			},
			launch: () => {
				launchCalls += 1;
			}
		});

		assert.strictEqual(launchCalls, 1);
		assert.strictEqual(
			logs.filter((message) => message.includes('does not support Chrome remote-debugging')).length,
			1
		);
	});

	for (const [label, browserOptions] of [
		['explicit remote debugging', { mode: 'remote-debugging' }],
		[
			'remote debugging with an explicit profile',
			{ mode: 'remote-debugging', profileDirectory: 'Profile 2' }
		]
	] as const) {
		it(`rejects ${label} on unsupported Puppeteer`, async () => {
			const browser = new FakeBrowser();
			let launchCalls = 0;
			let connectCalls = 0;

			await execute({
				browser,
				puppeteerVersion: '24.31.0',
				config: {
					initialUrl: 'https://example.test',
					browser: browserOptions
				},
				launch: () => {
					launchCalls += 1;
				},
				connect: () => {
					connectCalls += 1;
				}
			});

			assert.strictEqual(launchCalls, 0);
			assert.strictEqual(connectCalls, 0);
		});
	}
});

describe('Puppeteer connection passthrough', () => {
	for (const [name, connect] of [
		['channel', { channel: 'chrome' }],
		['browserURL', { browserURL: 'http://127.0.0.1:9222' }],
		['browserWSEndpoint', { browserWSEndpoint: 'ws://127.0.0.1/devtools/browser/test' }]
	] as const) {
		it(`passes ${name} through to Puppeteer`, async () => {
			const browser = new FakeBrowser();
			let received: ConnectOptions | undefined;
			await execute({
				browser,
				config: connectedConfig({ puppeteerOptions: { connect } }),
				connect: (options) => {
					received = options;
				}
			});
			assert.deepEqual(received, connect);
		});
	}
});

describe('profile selection in the runner', () => {
	it('verifies the selected profile before interception, hooks, and app navigation', async () => {
		const browser = new FakeBrowser();
		browser.defaultContextId = 'work-profile';
		const logs: string[] = [];
		let beforeGoto = false;
		await execute({
			browser,
			logs,
			config: connectedConfig({
				browser: { profileDirectory: 'Profile 2' },
				callback: {
					beforeGoto: () => {
						beforeGoto = true;
					},
					afterGoto: stopAfterGoto
				}
			})
		});
		const managed = browser.allPages[0];
		assert.ok(managed);
		assert.isTrue(beforeGoto);
		assert.deepEqual(managed.navigations, [
			'chrome://version/',
			'about:blank',
			'https://example.test'
		]);
		assert.isBelow(
			browser.operations.indexOf('managed-1:goto:chrome://version/'),
			browser.operations.indexOf('managed-1:interception:true')
		);
		assert.include(logs, 'Selected Chrome profile: Profile 2');
		assert.strictEqual(managed.closeCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 1);
	});

	it('cleans up a wrong profile even when retaining managed tabs was requested', async () => {
		const browser = new FakeBrowser();
		browser.defaultContextId = 'work-profile';
		let beforeGoto = false;
		await execute({
			browser,
			config: connectedConfig({
				browser: { profileDirectory: 'Default', closeManagedPageOnExit: false },
				callback: {
					beforeGoto: () => {
						beforeGoto = true;
					}
				}
			})
		});
		const probe = browser.allPages[0];
		assert.ok(probe);
		assert.isFalse(beforeGoto);
		assert.deepEqual(probe.navigations, ['chrome://version/']);
		assert.deepEqual(probe.interceptionStates, []);
		assert.strictEqual(probe.closeCalls, 1);
		assert.strictEqual(browser.disconnectCalls, 1);
		assert.strictEqual(browser.closeCalls, 0);
	});
});

describe('explicit connection lifecycle', () => {
	for (const connect of [{ channel: 'chrome' }, { browserURL: 'http://localhost:9222' }] as const) {
		it(`uses the same profile selection and timeout for ${Object.keys(connect)[0]}`, async () => {
			const browser = new FakeBrowser();
			browser.defaultContextId = 'work-profile';
			let received: ConnectOptions | undefined;
			let timeout: number | undefined;
			let launches = 0;
			await execute({
				browser,
				config: connectedConfig({
					puppeteerOptions: { connect },
					browser: { profileDirectory: 'Profile 2', remoteDebuggingTimeout: 1234 }
				}),
				options: {
					environment: { browserMode: 'launch', ci: 'true', stdinIsTTY: false, stdoutIsTTY: false }
				},
				connect: (options, duration) => {
					received = options;
					timeout = duration;
				},
				launch: () => {
					launches++;
				}
			});
			assert.strictEqual(received, connect);
			assert.strictEqual(timeout, 1234);
			assert.strictEqual(launches, 0);
			assert.deepEqual(browser.allPages[0]?.navigations, [
				'chrome://version/',
				'about:blank',
				'https://example.test'
			]);
			assert.strictEqual(browser.disconnectCalls, 1);
			assert.strictEqual(browser.closeCalls, 0);
		});
	}

	it('pins the default connected context even without an explicit profile', async () => {
		const browser = new FakeBrowser();
		browser.defaultContextId = 'work-profile';
		let timeout: number | undefined;
		await execute({
			browser,
			config: connectedConfig(),
			connect: (_options, duration) => {
				timeout = duration;
			}
		});
		assert.strictEqual(timeout, 60_000);
		assert.deepEqual(browser.createdContextIds, ['work-profile']);
		assert.deepEqual(browser.allPages[0]?.navigations, ['https://example.test']);
		assert.strictEqual(browser.allPages[0]?.closeCalls, 1);
	});

	it('falls back to a regular new tab when the default context cannot be pinned', async () => {
		const browser = new FakeBrowser();
		browser.target = () => {
			throw new Error('Target.getBrowserContexts is not supported');
		};
		const logs: string[] = [];
		await execute({ browser, logs, config: connectedConfig() });
		assert.strictEqual(browser.newPageCalls, 1);
		assert.deepEqual(browser.allPages[0]?.navigations, ['https://example.test']);
		assert.ok(
			logs.some(
				(line) =>
					line.includes('opening a regular new tab instead') &&
					line.includes('Target.getBrowserContexts is not supported')
			),
			logs.join('\n')
		);
		assert.strictEqual(browser.allPages[0]?.closeCalls, 1);
	});

	it('does not fall back when an explicitly requested profile cannot be selected', async () => {
		const browser = new FakeBrowser();
		browser.target = () => {
			throw new Error('Target.getBrowserContexts is not supported');
		};
		let beforeGoto = false;
		await execute({
			browser,
			config: connectedConfig({
				browser: { profileDirectory: 'Profile 2' },
				callback: {
					beforeGoto: () => {
						beforeGoto = true;
					}
				}
			})
		});
		assert.strictEqual(browser.newPageCalls, 0);
		assert.isFalse(beforeGoto);
		assert.strictEqual(browser.disconnectCalls, 1);
	});

	it('selects the profile before enabling interception for all tabs', async () => {
		const operations: string[] = [];
		const personal = new FakePage('personal', operations, 'https://personal.test', 'Personal');
		const browser = new FakeBrowser([personal]);
		browser.defaultContextId = 'work-profile';
		await execute({
			browser,
			config: connectedConfig({
				browser: { profileDirectory: 'Profile 2', dangerouslyEnableForAllTabs: true }
			})
		});
		const managed = browser.allPages[1];
		assert.ok(managed);
		assert.deepEqual(managed.navigations, [
			'chrome://version/',
			'about:blank',
			'https://example.test'
		]);
		assert.isBelow(
			operations.indexOf('managed-1:goto:about:blank'),
			operations.indexOf('personal:interception:true')
		);
		assert.deepEqual(managed.interceptionStates, [true, false]);
	});

	it('keeps BiDi page creation free of Chrome CDP calls', async () => {
		const browser = new FakeBrowser();
		browser.target = () => {
			throw new Error('CDP must not be used for BiDi');
		};
		await execute({
			browser,
			config: connectedConfig({
				puppeteerOptions: {
					connect: { browserURL: 'http://localhost:9222', protocol: 'webDriverBiDi' }
				}
			})
		});
		assert.deepEqual(browser.allPages[0]?.navigations, ['https://example.test']);
		assert.strictEqual(browser.allPages[0]?.closeCalls, 1);
	});

	it('rejects unsupported channel discovery before connecting or launching', async () => {
		const browser = new FakeBrowser();
		let connections = 0;
		let launches = 0;
		await execute({
			browser,
			config: connectedConfig(),
			puppeteerVersion: '24.31.0',
			connect: () => {
				connections++;
			},
			launch: () => {
				launches++;
			}
		});
		assert.strictEqual(connections, 0);
		assert.strictEqual(launches, 0);
	});
});
