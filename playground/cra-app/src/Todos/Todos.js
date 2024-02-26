import { useEffect, useState } from "react";

const Todos = () => {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    // INFO: This API is not available on the development server. It is included
    // in the dist-for-testing folder to test skipping interception for certain
    // files using the `ignoreRequest` option in `sahne.config.js`.
    fetch("/mock-api/todos.json")
      .then((res) => res.json())
      .then((todos) => {
        setTodos(todos);
      });
  }, []);

  return (
    <div>
      <h3 style={{ color: "blue" }}>
        The data below only exists on the server, so it won't be intercepted by
        the local bundle.
      </h3>
      {todos.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  );
};

export default Todos;
