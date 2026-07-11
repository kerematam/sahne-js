export type EndpointRequest = {
	id: string;
	request: () => Promise<boolean>;
};

type ApiResponse = {
	data: unknown;
};

const getData = async (url: string): Promise<unknown> => {
	const response = await fetch(url);
	const { data } = (await response.json()) as ApiResponse;
	return data;
};

const requests: EndpointRequest[] = [
	{
		id: '/api/todos',
		request: async () => {
			try {
				const data = await getData('/api/todos');
				return Array.isArray(data) && data.length === 10;
			} catch (error) {
				console.error(error);
				return false;
			}
		}
	},
	{
		id: '/api/read/me/from/a/file',
		request: async () => {
			try {
				return (
					(await getData('/api/read/me/from/a/file?test=123')) === 'Hello from a file endpoint'
				);
			} catch (error) {
				console.error(error);
				return false;
			}
		}
	},
	{
		id: '/api/require-x-sahne-header',
		request: async () => {
			try {
				return (
					(await getData('/api/require-x-sahne-header')) ===
					'Header x-sahne is present with value true'
				);
			} catch (error) {
				console.error(error);
				return false;
			}
		}
	},
	{
		id: '/redirect-to-another-api',
		request: async () => {
			try {
				return (
					(await getData('/redirect-to-another-api')) === 'You have been redirected to another API'
				);
			} catch (error) {
				console.error(error);
				return false;
			}
		}
	}
];

export default requests;
