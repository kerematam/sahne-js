const typescript = require('@rollup/plugin-typescript');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const peerDepsExternal = require('rollup-plugin-peer-deps-external');
const json = require("@rollup/plugin-json");

module.exports = [
	{
		// Configuration for the CLI
		input: 'src/cli.ts', // Your CLI entry point
		plugins: [
			peerDepsExternal(),
			nodeResolve(),
			commonjs(),
			typescript(),
			json()
		],
		output: {
			file: 'dist/cli.js',
			format: 'cjs',
			banner: '#!/usr/bin/env node', // Ensures the output is executable
			sourcemap: true
		}
	},
	{
		// Configuration for the library
		input: 'src/main.ts', // Main library entry point
		plugins: [
			peerDepsExternal(),
			nodeResolve(),
			commonjs(),
			typescript(),
		],
		output: [
			{
				file: 'dist/bundle.cjs.js',
				format: 'cjs',
				sourcemap: true
			},
			{
				file: 'dist/bundle.esm.js',
				format: 'es',
				sourcemap: true
			}
		]
	}
];
