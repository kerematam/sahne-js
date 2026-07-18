import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'SahneJS',
	description:
		'Intercept, proxy, and mock browser requests while testing local code against real sites.',
	cleanUrls: true,
	lastUpdated: true,
	head: [
		['meta', { name: 'theme-color', content: '#181411' }],
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:site_name', content: 'SahneJS' }]
	],
	themeConfig: {
		nav: [
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'Examples', link: '/guide/proxy-local-app' },
			{ text: 'Reference', link: '/reference/configuration' },
			{
				text: 'Links',
				items: [
					{ text: 'npm', link: 'https://www.npmjs.com/package/sahne-js' },
					{ text: 'GitHub', link: 'https://github.com/kerematam/sahne-js' }
				]
			}
		],
		sidebar: [
			{
				text: 'Start here',
				items: [
					{ text: 'Introduction', link: '/guide/introduction' },
					{ text: 'Getting started', link: '/guide/getting-started' },
					{ text: 'How Sahne works', link: '/guide/how-it-works' }
				]
			},
			{
				text: 'Guides',
				items: [
					{ text: 'Proxy a local app', link: '/guide/proxy-local-app' },
					{ text: 'Mock responses from files', link: '/guide/mock-from-files' },
					{ text: 'Matching and rule order', link: '/guide/matching-and-rules' },
					{ text: 'Rewrite and override', link: '/guide/rewrite-and-override' },
					{ text: 'Browser modes', link: '/guide/browser-modes' },
					{ text: 'Hooks and lifecycle', link: '/guide/hooks-and-lifecycle' },
					{ text: 'Use without the CLI', link: '/guide/programmatic-api' }
				]
			},
			{
				text: 'Reference',
				items: [
					{ text: 'Configuration', link: '/reference/configuration' },
					{ text: 'CLI', link: '/reference/cli' },
					{ text: 'Public API', link: '/reference/api' },
					{ text: 'Troubleshooting', link: '/reference/troubleshooting' }
				]
			}
		],
		socialLinks: [{ icon: 'github', link: 'https://github.com/kerematam/sahne-js' }],
		search: {
			provider: 'local',
			options: {
				detailedView: true
			}
		},
		editLink: {
			pattern: 'https://github.com/kerematam/sahne-js/edit/main/website/:path',
			text: 'Edit this page on GitHub'
		},
		outline: { level: [2, 3], label: 'On this page' },
		docFooter: { prev: 'Previous', next: 'Next' },
		lastUpdated: { text: 'Updated' },
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2024–present Kerem Atam'
		}
	}
});
