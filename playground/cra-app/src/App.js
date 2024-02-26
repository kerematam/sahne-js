import logo from './logo.svg';
import './App.css';
import Todos from './Todos/Todos';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <h1 style={{ color: "red" }}>This is Update from SahneJS</h1>
        <Todos />
      </header>
    </div>
  );
}

export default App;
