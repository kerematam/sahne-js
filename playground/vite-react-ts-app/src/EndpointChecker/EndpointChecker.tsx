import { useState, useEffect } from 'react';
import './EndpointChecker.css';

type EndpointResult = {
	id: string;
	error?: string;
	result: boolean;
};

const requests: Array<{ id: string; request: () => Promise<boolean> }> = [
	{
		id: '/api/1.json',
		request: async () => {
			try {
				const response = await fetch('/api/1.json');
				const data = (await response.json()) as unknown;

				return Array.isArray(data) && data.length > 0;
			} catch {
				return false;
			}
		}
	}
];

const EndpointChecker = () => {
	const [results, setResults] = useState<EndpointResult[]>([]);

	useEffect(() => {
		const checkEndpoints = async () => {
			const requestList = requests.map(({ request }) => request());

			const settledRequests = await Promise.allSettled(requestList);
			setResults(
				settledRequests.map((result, index) => {
					if (result.status === 'fulfilled') {
						return {
							id: requests[index].id,
							result: !!result.value
						};
					} else {
						return {
							id: requests[index].id,
							error: result.reason instanceof Error ? result.reason.message : String(result.reason),
							result: false
						};
					}
				})
			);
		};

		void checkEndpoints();
	}, []);

	return (
		<div>
			<h2>Endpoint Checker</h2>
			<table>
				<thead>
					<tr>
						<th>Endpoint</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{results.map(({ id, result }) => (
						<tr key={id}>
							<td>{id}</td>
							<td style={{ color: result ? 'green' : 'red' }} id={id}>
								{result ? 'Success' : 'Fail'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default EndpointChecker;
