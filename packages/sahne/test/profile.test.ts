import { assert, describe, it } from '@effect/vitest';
import { rejects } from 'node:assert/strict';
import type { Browser, Target } from 'puppeteer';
import { createChromeProfilePage } from '../src/profile.js';

type Tab = { url: string; context: string; closed: boolean; navigations: string[] };

const fixture = (
	defaultContextId: string | undefined = 'work',
	paths: Record<string, string> = {
		personal: '/profiles/Default',
		work: '/profiles/Profile 2'
	}
) => {
	const tabs: Tab[] = [];
	const creates: Array<{ browserContextId: string }> = [];
	const rejectedContexts = new Map<string, string>();
	let detached = false;
	let legacyCreates = 0;
	let failTarget = false;
	let failProfileRead = false;
	const unreadableContexts = new Set<string>();
	const session = {
		detach: async () => {
			detached = true;
		},
		send: async (
			method: string,
			params?: { url: string; browserContextId: string; targetId: string }
		) => {
			if (method === 'Target.getBrowserContexts')
				return { browserContextIds: ['incognito'], defaultBrowserContextId: defaultContextId };
			if (method === 'Target.getTargets')
				return {
					targetInfos: Object.keys(paths).map((id) => ({ type: 'page', browserContextId: id }))
				};
			if (method === 'Target.createTarget' && params) {
				creates.push({ browserContextId: params.browserContextId });
				const rejection = rejectedContexts.get(params.browserContextId);
				if (rejection !== undefined) throw new Error(rejection);
				tabs.push({
					url: params.url,
					context: params.browserContextId,
					closed: false,
					navigations: []
				});
				return { targetId: String(tabs.length - 1) };
			}
			if (method === 'Target.closeTarget' && params) {
				tabs[Number(params.targetId)].closed = true;
				return { success: true };
			}
			throw new Error(`Unexpected command ${method}`);
		}
	};
	const browser = {
		target: () => ({ createCDPSession: async () => session }),
		newPage: async () => {
			legacyCreates++;
			return { legacy: true };
		},
		waitForTarget: async (predicate: (target: Target) => boolean) => {
			if (failTarget) throw new Error('target discovery failed');
			const tab = tabs.find((tab) => predicate({ url: () => tab.url } as Target));
			if (!tab) throw new Error('missing target');
			return {
				page: async () => ({
					context: tab.context,
					goto: async (url: string) => {
						tab.navigations.push(url);
					},
					$eval: async () => {
						if (failProfileRead || unreadableContexts.has(tab.context))
							throw new Error(`profile path unavailable in ${tab.context}`);
						return paths[tab.context];
					}
				})
			};
		}
	} as unknown as Browser;
	return {
		browser,
		tabs,
		creates,
		rejectedContexts,
		state: () => ({ detached, legacyCreates }),
		failTarget: () => {
			failTarget = true;
		},
		failProfileRead: () => {
			failProfileRead = true;
		},
		unreadableContexts
	};
};

describe('Chrome profile tab creation', () => {
	it("pins the connected default context instead of Chrome's last-used profile", async () => {
		const f = fixture();
		await createChromeProfilePage(f.browser);
		assert.deepEqual(f.creates, [{ browserContextId: 'work' }]);
		assert.deepEqual(f.tabs[0].navigations, []);
		assert.deepEqual(f.state(), { detached: true, legacyCreates: 0 });
	});

	it('selects a different exposed profile and closes only the rejected probe', async () => {
		const f = fixture('personal');
		await createChromeProfilePage(f.browser, 'Profile 2');
		assert.deepEqual(f.creates, [{ browserContextId: 'personal' }, { browserContextId: 'work' }]);
		assert.isTrue(f.tabs[0].closed);
		assert.isFalse(f.tabs[1].closed);
		assert.deepEqual(f.tabs[1].navigations, ['chrome://version/', 'about:blank']);
		assert.strictEqual(f.state().legacyCreates, 0);
	});

	it('fails without falling back when the requested profile is unavailable', async () => {
		const f = fixture();
		await rejects(
			createChromeProfilePage(f.browser, 'Profile 99'),
			/Available profiles: Profile 2, Default/
		);
		assert.isTrue(f.tabs.every((tab) => tab.closed));
		assert.isTrue(f.state().detached);
		assert.strictEqual(f.state().legacyCreates, 0);
	});

	it('does not mistake an incognito context for its authenticated profile', async () => {
		const f = fixture('personal', {
			personal: '/profiles/Default',
			incognito: '/profiles/Profile 2'
		});
		await rejects(createChromeProfilePage(f.browser, 'Profile 2'), /not available/);
		assert.deepEqual(f.creates, [{ browserContextId: 'personal' }]);
	});

	it('skips listed contexts Chrome refuses to open and still reports verified profiles', async () => {
		const f = fixture();
		f.rejectedContexts.set(
			'personal',
			'Protocol error (Target.createTarget): Failed to find browser context with id personal'
		);
		await rejects(createChromeProfilePage(f.browser, 'Missing'), /Available profiles: Profile 2\./);
		assert.deepEqual(f.creates, [{ browserContextId: 'work' }, { browserContextId: 'personal' }]);
		assert.strictEqual(f.tabs.length, 1);
		assert.isTrue(f.tabs[0].closed);
		assert.isTrue(f.state().detached);
	});

	it('does not hide unrelated target creation failures as an unavailable profile', async () => {
		const f = fixture();
		f.rejectedContexts.set('work', 'connection closed');
		await rejects(createChromeProfilePage(f.browser, 'Profile 2'), /connection closed/);
		assert.strictEqual(f.tabs.length, 0);
		assert.isTrue(f.state().detached);
	});

	it('recognizes Windows profile paths', async () => {
		const f = fixture('work', { work: 'C:\\Users\\user\\Chrome\\Profile 2' });
		await createChromeProfilePage(f.browser, 'Profile 2');
		assert.isFalse(f.tabs[0].closed);
	});

	it('closes an orphan target if Puppeteer cannot discover its page', async () => {
		const f = fixture();
		f.failTarget();
		await rejects(createChromeProfilePage(f.browser, 'Profile 2'), /target discovery failed/);
		assert.isTrue(f.tabs[0].closed);
		assert.isTrue(f.state().detached);
	});

	it('skips a context it cannot verify and still selects the requested profile', async () => {
		const f = fixture('personal');
		f.unreadableContexts.add('personal');
		await createChromeProfilePage(f.browser, 'Profile 2');
		assert.deepEqual(f.creates, [{ browserContextId: 'personal' }, { browserContextId: 'work' }]);
		assert.isTrue(f.tabs[0].closed);
		assert.isFalse(f.tabs[1].closed);
		assert.deepEqual(f.tabs[1].navigations, ['chrome://version/', 'about:blank']);
	});

	it('reports unverifiable contexts when the requested profile is missing', async () => {
		const f = fixture();
		f.unreadableContexts.add('personal');
		await rejects(
			createChromeProfilePage(f.browser, 'Missing'),
			/Available profiles: Profile 2\. Could not verify 1 other context\(s\): profile path unavailable in personal\./
		);
		assert.isTrue(f.tabs.every((tab) => tab.closed));
		assert.isTrue(f.state().detached);
	});

	it('closes the probe if profile verification fails', async () => {
		const f = fixture();
		f.failProfileRead();
		await rejects(createChromeProfilePage(f.browser, 'Profile 2'), /profile path unavailable/);
		assert.isTrue(f.tabs[0].closed);
		assert.isTrue(f.state().detached);
	});

	it('preserves legacy creation only when no profile was requested and no default context exists', async () => {
		const f = fixture();
		// Simulate older Chrome without the experimental defaultBrowserContextId field.
		const target = f.browser.target;
		f.browser.target = (() => ({
			createCDPSession: async () => ({
				send: async () => ({ browserContextIds: [], targetInfos: [] }),
				detach: async () => {}
			})
		})) as unknown as typeof target;
		await createChromeProfilePage(f.browser);
		assert.strictEqual(f.state().legacyCreates, 1);
		await rejects(createChromeProfilePage(f.browser, 'Profile 2'), /Available profiles: none/);
		assert.strictEqual(f.state().legacyCreates, 1);
	});
});
