const requests = [
	{
		id: '/api/todos',
		request: async () => {
			try {
				const res = await fetch('/api/todos');
				const { data } = await res.json();

				if (data.length === 10) return true;
				return false;
			} catch (e) {
				console.error(e);
				return false;
			}
		}
	},
	{
		id: '/api/read/me/from/a/file',
		request: async () => {
			try {
				const res = await fetch('/api/read/me/from/a/file');
				const { data } = await res.json();

				if (data === 'Hello from a file endpoint') return true;
				return false;
			} catch (e) {
				console.error(e);
				return false;
			}
		}
	},
	{
		id: '/api/require-x-sahne-header',
		request: async () => {
			try {
				const res = await fetch('/api/require-x-sahne-header');
				const { data } = await res.json();

				if (data === 'Header x-sahne is present with value true') return true;
				return false;
			} catch (e) {
				console.error(e);
				return false;
			}
		}
	},
	{
		id: '/redirect-to-another-api',
		request: async () => {
			try {
				const res = await fetch('/redirect-to-another-api');
				const { data } = await res.json();

				if (data === 'You have been redirected to another API') return true;
				return false;
			} catch (e) {
				console.error(e);
				return false;
			}
		}
	}
];

export default requests;
