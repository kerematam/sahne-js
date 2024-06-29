// @ts-check
import React, { useState, useEffect } from 'react';

const EndpointChecker = ({ requests }) => {
	const [results, setResults] = useState(() => {
		/** @type {Array<{ id: string, error?: any, result: boolean}>} */
		const initialResults = [];
		return initialResults;
	});

	useEffect(() => {
		const checkEndpoints = async () => {
			/** @type {Promise<{boolean}>[]} */
			const requestList = requests.map(({ id, request }) => request());

			const results = await Promise.allSettled(requestList);
			setResults(
				results.map((result, index) => {
					if (result.status === 'fulfilled') {
						console.log('result', result.value);
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
	}, [requests]);

	return (
		<div>
			<h2>Endpoint Checker</h2>
			<table >
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
							{/* <td style={{ width: 400, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex' }}>
								{result.status === 'fail' ? (
									<span style={{ color: 'red' }}>{result.error}</span>
								) : (
									<pre>{JSON.stringify(result.data, null, 2)}</pre>
								)}
							</td> */}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export default EndpointChecker;
