import { useEffect, useState } from 'react';

const useRequestToFallbackEndpoint = () => {
	const [response, setResponse] = useState([]);
	const [error, setError] = useState(false);

	useEffect(() => {
		fetch('/fallback/blabla')
			.then((res) => res.json())
			.then((res) => {
				setError(false);
				setResponse(res.data);
			})
			.catch((err) => {
				setError(true);
			});
	}, []);

	console.log('response', response);

	return { response, error };
};

export default useRequestToFallbackEndpoint;
