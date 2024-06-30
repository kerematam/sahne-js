const typescript = require('@rollup/plugin-typescript');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const peerDepsExternal = require('rollup-plugin-peer-deps-external');
const json = require('@rollup/plugin-json');
const builtins = require('rollup-plugin-node-builtins');

module.exports = [
	{
		// Configuration for the CLI
		input: 'src/cli.ts', // Your CLI entry point
		plugins: [
			peerDepsExternal(),
			nodeResolve({ preferBuiltins: true }),
			commonjs(),
			typescript(),
			json()
		],
		external: ['@web/config-loader'],
		output: [
			{
				dir: './dist',
				format: 'cjs',
				banner: '#!/usr/bin/env node', // Ensures the output is executable
				sourcemap: true,
				entryFileNames: '[name].cjs'
			}
			// TODO: use it in the future
			// {
			// 	dir: './dist',
			// 	format: 'es',
			// 	banner: '#!/usr/bin/env node', // Ensures the output is executable
			// 	sourcemap: true,
			// 	// preserveModules: true,
			// 	entryFileNames: '[name].mjs'
			// }
		]
	},
	{
		// Configuration for the library
		input: 'src/index.ts', // Main library entry point
		plugins: [peerDepsExternal(), nodeResolve({ preferBuiltins: true }), commonjs(), typescript()],
		output: [
			{
				dir: './dist',
				format: 'cjs',
				sourcemap: true,
				entryFileNames: '[name].cjs'
			},
			{
				dir: './dist',
				format: 'es',
				sourcemap: true,
				entryFileNames: '[name].mjs'
			}
		]
	}
];
