import { Match } from '../types';

export const cliColors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	underscore: '\x1b[4m',
	blink: '\x1b[5m',
	reverse: '\x1b[7m',
	hidden: '\x1b[8m',

	fg: {
		black: '\x1b[30m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		magenta: '\x1b[35m',
		cyan: '\x1b[36m',
		white: '\x1b[37m',
		gray: '\x1b[90m',
		crimson: '\x1b[38m'
	},
	bg: {
		black: '\x1b[40m',
		red: '\x1b[41m',
		green: '\x1b[42m',
		yellow: '\x1b[43m',
		blue: '\x1b[44m',
		magenta: '\x1b[45m',
		cyan: '\x1b[46m',
		white: '\x1b[47m',
		gray: '\x1b[100m',
		crimson: '\x1b[48m'
	}
};

const red = (text: string) => cliColors.fg.red + text + cliColors.reset;
const blue = (text: string) => cliColors.fg.blue + text + cliColors.reset;
const green = (text: string) => cliColors.fg.green + text + cliColors.reset;

const matchRuleToString = (rule?: Match) => {
	if (typeof rule === 'string') return rule;
	if (typeof rule === 'function') return rule.toString();

	return '';
};

export const logDecorator = {
	url: (url: string | undefined) => {
		if (url === undefined) return '';
		return blue(url);
	},
	match: (match: Match | undefined) => {
		if (match === undefined) return '';
		const matchStr = matchRuleToString(match);
		return green(matchStr);
	}
};

const error = (message: string) => {
	console.log(`${new Date().toISOString()} ${red('error:')} ${message}`);
};
const info = (message: string) => {
	console.log(`${new Date().toISOString()} ${blue('info:')} ${message}`);
};

export const logger = { error, info };


export function handleError(error: unknown): void {
	if (error instanceof Error) {
		console.error(error.message);
		console.error(error.name);
		console.error(error.stack);
	} else if (typeof error === 'string') {
		console.error(error);
	} else if (typeof error === 'object' && error !== null) {
		console.error(JSON.stringify(error));
	} else {
		console.error('Unknown error type:', error);
	}
}
