import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import useRequestToFallbackEndpoint from './hooks/useRequestToFallbackEndpoint';
import EndpointChecker from './EndpointChecker/EndpointChecker';
import requests from './request';

function App() {
	const [count, setCount] = useState(0);
	const { response: responseFromFallbackEndpoint } = useRequestToFallbackEndpoint();

	return (
		<>
			<div>
				<a href="https://vitejs.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>Vite + React</h1>
			{import.meta.env.MODE === 'development' && (
				<h2 className="sahne-title">This is update from SahneJS</h2>
			)}
			<div className="card">
				<button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
				<p>
					Edit <code>src/App.jsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">Click on the Vite and React logos to learn more</p>
			<div id="response-from-fallback-endpoint">{responseFromFallbackEndpoint}</div>
			<EndpointChecker requests={requests} />
		</>
	);
}

export default App;
