import { useEffect, useState } from 'react';

const Todos = () => {
	const [todos, setTodos] = useState<any[]>([]);

	useEffect(() => {
		// INFO: This API is not available in the development server. It is included
		// in the dist-for-testing folder to test skipping interception for certain
		// files with `ignoreRequest` option in `sahne.config.js`.
		fetch('/api/todos.json')
			.then((res) => res.json())
			.then((todos) => {
				setTodos(todos);
			});
	}, []);

	return (
		<div>
			<button
				onClick={() => {
					fetch('http://localhost:4173/hello', { headers: { 'X-Custom-Request-Header': 'fuck' } })
						.then((res) => res.json())
						.then(({ data }) => {
							console.log(data);
						});
				}}
			>
				test
			</button>
			<h2>Below data only exist on server</h2>
			{todos.map((todo) => {
				return <div key={todo.id}>{todo.title}</div>;
			})}
		</div>
	);
};

export default Todos;
