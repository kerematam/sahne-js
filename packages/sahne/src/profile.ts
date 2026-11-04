import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { Browser, CDPSession, Page } from 'puppeteer';

export const profileDirectoryMessage =
	'Chrome profile directory must be a non-empty directory name, such as "Default" or "Profile 2", not a path';

export const profileDirectorySchema = Schema.String.annotate({
	message: profileDirectoryMessage
}).check(
	Schema.makeFilter(
		(value) => value.trim().length > 0 && !/[\\/\0]/.test(value) && !['.', '..'].includes(value),
		{ message: profileDirectoryMessage }
	)
);

const closeTarget = (session: CDPSession, targetId: string): Promise<void> =>
	// Cleanup must never replace the error that triggered it.
	session.send('Target.closeTarget', { targetId }).then(
		() => undefined,
		() => undefined
	);

const errorMessage = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);

const createPageInContext = async (
	browser: Browser,
	session: CDPSession,
	browserContextId: string
): Promise<{ page: Page; targetId: string }> => {
	const url = `about:blank#sahne-${randomUUID()}`;
	const { targetId } = await session.send('Target.createTarget', {
		url,
		browserContextId,
		background: true
	});
	try {
		const target = await browser.waitForTarget((candidate) => candidate.url() === url, {
			timeout: 10_000
		});
		const page = await target.page();
		if (page === null) throw new Error('Chrome did not expose the newly created profile tab');
		return { page, targetId };
	} catch (cause) {
		await closeTarget(session, targetId);
		throw cause;
	}
};

const readProfileDirectory = async (page: Page): Promise<string> => {
	await page.goto('chrome://version/', { waitUntil: 'domcontentloaded', timeout: 10_000 });
	const profilePath = await page.$eval('#profile_path', (element) => element.textContent?.trim());
	const directory = profilePath?.split(/[\\/]/).at(-1);
	if (!directory) throw new Error("Chrome did not expose the tab's profile path");
	return directory;
};

/** Create only owned tabs; never navigate or intercept an existing user tab. */
export const createChromeProfilePage = async (
	browser: Browser,
	profileDirectory?: string
): Promise<Page> => {
	const session = await browser.target().createCDPSession();
	try {
		const { defaultBrowserContextId, browserContextIds } = await session.send(
			'Target.getBrowserContexts'
		);
		if (profileDirectory === undefined) {
			// Chrome otherwise uses its globally last-used profile, which can differ
			// from the profile that granted this debugging connection access.
			return defaultBrowserContextId === undefined
				? await browser.newPage()
				: (await createPageInContext(browser, session, defaultBrowserContextId)).page;
		}

		const { targetInfos } = await session.send('Target.getTargets');
		const contextIds = new Set<string>();
		if (defaultBrowserContextId !== undefined) contextIds.add(defaultBrowserContextId);
		for (const target of targetInfos) {
			// getBrowserContexts lists non-default (incognito/automation) contexts.
			// They can share a profile path, but do not share its authenticated state.
			if (
				target.type === 'page' &&
				target.browserContextId !== undefined &&
				!browserContextIds.includes(target.browserContextId)
			) {
				contextIds.add(target.browserContextId);
			}
		}

		const available = new Set<string>();
		const unverified: unknown[] = [];
		for (const contextId of contextIds) {
			let candidate: { page: Page; targetId: string };
			try {
				candidate = await createPageInContext(browser, session, contextId);
			} catch (cause) {
				// Chrome can list targets whose context is unavailable to this
				// connection (or was closed between enumeration and creation).
				if (
					cause instanceof Error &&
					cause.message.includes('Failed to find browser context with id')
				)
					continue;
				throw cause;
			}
			const { page, targetId } = candidate;
			let directory: string;
			try {
				directory = await readProfileDirectory(page);
			} catch (cause) {
				// One unreadable context (closed mid-probe, chrome:// blocked by
				// policy) must not hide the requested profile in another context.
				unverified.push(cause);
				await closeTarget(session, targetId);
				continue;
			}
			available.add(directory);
			if (directory !== profileDirectory) {
				await closeTarget(session, targetId);
				continue;
			}
			try {
				await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10_000 });
			} catch (cause) {
				await closeTarget(session, targetId);
				throw cause;
			}
			return page;
		}
		// Nothing could be verified: the connection itself is probably broken.
		if (available.size === 0 && unverified.length > 0) throw unverified[0];
		const skipped =
			unverified.length === 0
				? ''
				: ` Could not verify ${unverified.length} other context(s): ${unverified
						.map(errorMessage)
						.join('; ')}.`;
		throw new Error(
			`Chrome profile "${profileDirectory}" is not available in this debugging session. ` +
				`Available profiles: ${[...available].join(', ') || 'none'}.${skipped} ` +
				'Open the requested profile, enable chrome://inspect/#remote-debugging there, and reconnect. ' +
				'Use the directory at the end of Profile Path in chrome://version/, not the display name.'
		);
	} finally {
		await session.detach().catch(() => {});
	}
};
