import { useState, useEffect } from 'react';
import './EndpointChecker.css';

/**
 * List of requests to check
 * id: unique identifier for the request
 * request: function that returns a promise that resolves to a boolean
 */
const requests = [
	{
		id: '/api/1.json',
		request: async () => {
			try {
				const response = await fetch('/api/1.json');
				const data = await response.json();

				return data.length > 0;
			} catch (e) {
				return false;
			}
		}
	}
];

const EndpointChecker = () => {
	const [results, setResults] = useState([]);

	useEffect(() => {
		const checkEndpoints = async () => {
			const requestList = requests.map(({ request }) => request());

			const results = await Promise.allSettled(requestList);
			setResults(
				results.map((result, index) => {
					if (result.status === 'fulfilled') {
						return {
							id: requests[index].id,
							result: !!result.value
						};
					} else {
						return {
							id: requests[index].id,
							error: result.reason.message,
							result: false
						};
					}
				})
			);
		};

		checkEndpoints();
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
					{results.map(({ id, result }, index) => (
						<tr key={index}>
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
