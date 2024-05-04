import puppeteer from 'puppeteer';

export function defineConfig(config: { test: string }) {
	return config;
}

export async function run(args: any) {
	const browser = await puppeteer.launch({
		defaultViewport: null,
		headless: false
	});
	const [page] = await browser.pages();

	await page.goto('https://google.com');

	// console.log('fuck');
}
