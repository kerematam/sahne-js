import { useEffect, useState } from 'react';
import type { EndpointRequest } from '../request';

type EndpointResult = {
	id: string;
	error?: string;
	result: boolean;
};

const EndpointChecker = ({ requests }: { requests: EndpointRequest[] }) => {
	const [results, setResults] = useState<EndpointResult[]>([]);

	useEffect(() => {
		const checkEndpoints = async () => {
			const settledRequests = await Promise.allSettled(requests.map(({ request }) => request()));

			setResults(
				settledRequests.map((result, index) => ({
					id: requests[index].id,
					result: result.status === 'fulfilled' && result.value,
					error:
						result.status === 'rejected'
							? result.reason instanceof Error
								? result.reason.message
								: String(result.reason)
							: undefined
				}))
			);
		};

		void checkEndpoints();
	}, [requests]);

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
