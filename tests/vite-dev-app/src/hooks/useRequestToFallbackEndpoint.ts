import { useEffect, useState } from 'react';

const useRequestToFallbackEndpoint = () => {
	const [response, setResponse] = useState('');
	const [error, setError] = useState(false);

	useEffect(() => {
		fetch('/fallback/blabla')
			.then((result) => result.json() as Promise<{ data: string }>)
			.then(({ data }) => {
				setError(false);
				setResponse(data);
			})
			.catch(() => {
				setError(true);
			});
	}, []);

	return { response, error };
};

export default useRequestToFallbackEndpoint;
