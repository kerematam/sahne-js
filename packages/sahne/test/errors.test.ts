import { assert, describe, it } from '@effect/vitest';
import { BrowserLaunchError, formatSahneError, PageSetupError } from '../src/errors.js';

describe('error formatting', () => {
	it('includes a browser launch cause without its stack', () => {
		const output = formatSahneError(
			new BrowserLaunchError({
				cause: new Error('Could not find Chrome 150'),
				message: 'Failed to launch Puppeteer'
			})
		);

		assert.strictEqual(output, 'Failed to launch Puppeteer\nCause: Could not find Chrome 150');
		assert.notInclude(output, 'at ');
		assert.notInclude(output, 'FiberFailure');
	});

	it('does not repeat an identical cause', () => {
		const output = formatSahneError(
			new PageSetupError({
				operation: 'browser.pages',
				cause: new Error('Puppeteer returned no initial page'),
				message: 'Puppeteer returned no initial page'
			})
		);

		assert.strictEqual(output, 'Puppeteer returned no initial page');
	});

	it('does not stringify an opaque cause', () => {
		const output = formatSahneError(
			new BrowserLaunchError({
				cause: { browser: 'chrome' },
				message: 'Failed to launch Puppeteer'
			})
		);

		assert.strictEqual(output, 'Failed to launch Puppeteer');
	});
});
