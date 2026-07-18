---
layout: home

hero:
  name: SahneJS
  text: Put local code on the real stage.
  tagline: Intercept, proxy, and mock browser requests while your application keeps its real URL, cookies, and production context.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: See how it works
      link: /guide/how-it-works

features:
  - title: Real context, local feedback
    details: Keep the target page and origin while serving selected assets or endpoints from your local development server.
  - title: Rules you can compose
    details: Match with globs, regular expressions, or predicates; then proxy, mock, rewrite, override, abort, or pass through.
  - title: Your Chrome or an isolated browser
    details: Connect to an approved Chrome session for interactive debugging, or launch a clean browser for repeatable runs and CI.
---

<section class="home-demo">
  <div class="home-demo-copy">
    <p class="eyebrow">One configuration file</p>
    <h2>Replace only what you are working on.</h2>
    <p>
      Route frontend assets to Vite, leave production APIs alone, and inspect the result in a real browser. No deployment and no application-specific plugin required.
    </p>
  </div>
  <div class="home-demo-code" aria-label="Example Sahne configuration">
    <pre><code><span class="token-key">export default</span> defineConfig({
  initialUrl: <span class="token-string">'https://app.example.com/dashboard'</span>,
  interceptor: {
    match: <span class="token-string">'https://app.example.com/**'</span>,
    ignore: <span class="token-string">'https://app.example.com/api/**'</span>,
    proxy: <span class="token-string">'http://localhost:5173'</span>
  }
})</code></pre>
  </div>
</section>
