import { useEffect, useState } from 'react';

const Todos = () => {
	const [todos, setTodos] = useState([]);
	const [error, setError] = useState(false);

	useEffect(() => {
		// INFO: This API is not available in the development server. It is included
		// in the dist-for-testing folder to test skipping interception for certain
		// files with `ignoreRequest` option in `sahne.config.js`.
		fetch('/api/todos.json')
			.then((res) => res.json())
			.then((res) => {
				setError(false);
				setTodos(res.data);
			})
			.catch((err) => {
				setError(true);
			});
	}, []);

	if (error) {
		return <div>Failed to fetch data</div>;
	}

	return (
		<div id="todos">
			<h2>Below data retrieved from a request that is NOT intecepted</h2>
			{todos.map((todo) => {
				return (
					<div id="todo-item" key={todo.id}>
						{todo.title}
					</div>
				);
			})}
		</div>
	);
};

export default Todos;
