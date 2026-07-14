import './App.css'

function App() {
  return (
    <main>
      <header className="site-header page-width">
        <a className="wordmark" href="#top">SAHNEJS</a>
        <a
          className="nav-button"
          href="https://github.com/kerematam/sahne-js#readme"
          target="_blank"
          rel="noreferrer"
        >
          Documentation <span aria-hidden="true">↗</span>
        </a>
      </header>

      <article className="docs page-width">
        <section className="intro" id="top">
          <p className="overline">NETWORK INTERCEPTION &amp; MOCKING</p>
          <h1>CLI for network interception and mocking.</h1>
          <p className="intro-copy">
            SahneJS intercepts browser network requests. Use it to mock API responses,
            manipulate HTTP headers and payloads, or proxy selected traffic to a local
            development server.
          </p>

          <div className="install-block" aria-label="Installation command">
            <div className="code-meta">
              <span>INSTALL</span>
              <span>NODE.JS 22.18+</span>
            </div>
            <pre><code><span className="prompt">$</span> npm install --save-dev puppeteer sahne-js</code></pre>
          </div>
        </section>

        <section className="capabilities" aria-labelledby="capabilities-title">
          <div className="section-heading">
            <p className="overline">CORE CAPABILITIES</p>
            <h2 id="capabilities-title">Control what the browser sends and receives.</h2>
            <p>
              Define interception rules in <code>sahne.config.ts</code>, then run the SahneJS CLI.
              Rules can match URLs with strings, globs, regular expressions, arrays, or functions.
            </p>
          </div>

          <div className="capability-list">
            <section className="capability" aria-labelledby="mock-title">
              <div className="capability-copy">
                <span className="index">01</span>
                <h3 id="mock-title">Mock API responses</h3>
                <p>
                  Intercept a target endpoint, bypass the live server, and resolve the request
                  with a local file. This is useful for error states, uncommon responses, and APIs
                  that are still being developed.
                </p>
              </div>
              <div className="code-block">
                <div className="code-meta"><span>sahne.config.ts</span><span>LOCAL FILE</span></div>
                <pre><code><span className="kw">import</span> {'{'} defineConfig {'}'} <span className="kw">from</span> <span className="str">&apos;sahne-js&apos;</span>{`\n\n`}<span className="kw">export default</span> defineConfig({'{'}{`\n`}  initialUrl: <span className="str">&apos;https://app.example.com&apos;</span>,{`\n`}  interceptor: {'{'}{`\n`}    match: <span className="str">&apos;/api/account&apos;</span>,{`\n`}    file: <span className="str">&apos;./fixtures/account.json&apos;</span>,{`\n`}  {'}'},{`\n`}{'}'})</code></pre>
              </div>
            </section>

            <section className="capability" aria-labelledby="proxy-title">
              <div className="capability-copy">
                <span className="index">02</span>
                <h3 id="proxy-title">Replace prod bundles with local dev code</h3>
                <p>
                  Route requests for production JavaScript, CSS, and other UI assets to your local development server.
                  Keep the prod domain, auth, cookies and APIs while the browser loads local UI source code.
                </p>
              </div>
              <div className="code-block">
                <div className="code-meta"><span>sahne.config.ts</span><span>LOCALHOST</span></div>
                <pre><code><span className="kw">import</span> {'{'} defineConfig {'}'} <span className="kw">from</span> <span className="str">&apos;sahne-js&apos;</span>{`\n\n`}<span className="kw">export default</span> defineConfig({'{'}{`\n`}  initialUrl: <span className="str">&apos;https://app.example.com&apos;</span>,{`\n`}  interceptor: {'{'}{`\n`}    match: <span className="str">&apos;https://app.example.com/**&apos;</span>,{`\n`}    ignore: <span className="str">&apos;https://app.example.com/api/**&apos;</span>,{`\n`}    proxy: <span className="str">&apos;http://localhost:5173&apos;</span>,{`\n`}  {'}'},{`\n`}{'}'})</code></pre>
              </div>
            </section>

            <section className="capability" aria-labelledby="override-title">
              <div className="capability-copy">
                <span className="index">03</span>
                <h3 id="override-title">Manipulate headers and payloads</h3>
                <p>
                  Modify traffic before it reaches the server or the browser. Add cookies,
                  change custom headers, or rewrite request and response bodies to reproduce
                  specific backend conditions.
                </p>
              </div>
              <div className="code-block">
                <div className="code-meta"><span>sahne.config.ts</span><span>OVERRIDE</span></div>
                <pre><code><span className="kw">export default</span> defineConfig({'{'}{`\n`}  interceptor: {'{'}{`\n`}    match: <span className="str">&apos;/api/checkout&apos;</span>,{`\n`}    overrideRequestHeaders: (headers) =&gt; ({'{'}{`\n`}      ...headers,{`\n`}      <span className="str">&apos;x-debug-mode&apos;</span>: <span className="str">&apos;true&apos;</span>,{`\n`}    {'}'}),{`\n`}    overrideResponseBody: (body) =&gt; body,{`\n`}  {'}'},{`\n`}{'}'})</code></pre>
              </div>
            </section>

            <section className="capability" aria-labelledby="e2e-title">
              <div className="capability-copy">
                <span className="index">04</span>
                <h3 id="e2e-title">Use it in E2E tests</h3>
                <p>
                  Import <code>Interceptor</code> directly into an existing Puppeteer script.
                  This keeps automated UI tests independent from network latency, unstable
                  services, and external dependencies.
                </p>
              </div>
              <div className="code-block">
                <div className="code-meta"><span>test.ts</span><span>PUPPETEER</span></div>
                <pre><code><span className="kw">import</span> {'{'} Interceptor {'}'} <span className="kw">from</span> <span className="str">&apos;sahne-js&apos;</span>{`\n\n`}<span className="kw">const</span> interceptor = <span className="kw">new</span> Interceptor(config){`\n\n`}<span className="kw">await</span> page.setRequestInterception(<span className="bool">true</span>){`\n`}page.on(<span className="str">&apos;request&apos;</span>, (request) =&gt; {'{'}{`\n`}  <span className="kw">void</span> interceptor.handleRequest(request){`\n`}{'}'})</code></pre>
              </div>
            </section>
          </div>
        </section>
      </article>
    </main>
  )
}

export default App
