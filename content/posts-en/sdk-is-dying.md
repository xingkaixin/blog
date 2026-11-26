---
title: "Calling 8 Endpoints Shouldn't Cost Megabytes of Dependencies: How AI Flips the Math on Thin SDKs"
summary: "SDK dependencies are making backends bloated and fragile. Many services only use a handful of endpoints yet pull in tens of megabytes of dependencies, while thin SDKs routinely swallow real debugging evidence from Nginx and API gateways. Separate thick SDKs (deep runtime instrumentation) from thin SDKs (pure API wrappers), and narrow the boundary with a few dozen lines of a unified HTTP client."
coverAlt: "Calling 8 Endpoints Shouldn't Cost Megabytes of Dependencies: How AI Flips the Math on Thin SDKs"
sourceHash: "cc438f8cf194a018"
---

![Cover: Thin SDKs wrap raw HTTP evidence into hollow exceptions](/posts/images/sdk-is-dying/sdk-is-dying-cover.png)

Last month, while debugging an intermittent refund failure in production, Sentry gave me an astonishingly hollow error: `StripeConnectionError: An error occurred with our connection to Stripe`.

I clicked into the stack trace and found nothing underneath except retry logic wrapped inside the SDK. I wanted the raw HTTP status code Stripe returned—not there. I wanted the `Request-Id` from the response headers so I could ask support to pull the logs—not there either. What stood in front wasn't even Stripe's server, but a Cloudflare bot challenge returning a block of HTML. When the SDK blew up trying to parse it as JSON, it neatly swallowed the underlying raw error without a trace.

In the end, I had to edit the source inside `node_modules/stripe` to add `console.log` statements and set breakpoints. While I was in there, I checked its size: 6.5MB.

Across our entire backend, we only call 8 Stripe endpoints.

## Machine-Generated Wrappers Get in the Way When Things Break

Installing the official SDK when integrating a third-party API used to be muscle memory for saving effort. Yet most vendors' public SDKs these days are essentially code-generation machines fed by OpenAPI specs.

To please everyone, they have to stuff in deprecated endpoints from five years ago, shims for obscure runtimes, and hundreds of types you will never touch. `@slack/web-api` weighs 7.7MB, `@linear/sdk` is 34MB, and `googleapis` pushes toward 200MB.

Bundle bloat is just an annoyance at build time. What actually hurts is how these SDKs reprocess exceptions.

Network calls in production can never guarantee clean JSON every time. Gateway timeouts spit out 504 HTML, WAF rate limits return 429 plain text, and a crashing reverse proxy drops the TCP connection outright. To an SDK's type abstraction, all of those first-hand failure scenes look like "invalid responses," so it wraps every single one into the same vague exception class.

When you ask Claude Code to investigate locally, or read the logs yourself, all the primary evidence has already been filtered out by that middle layer. Your agent is left guessing blindly at an empty shell of an exception.

![SDK exceptions vs. raw HTTP evidence](/posts/images/sdk-is-dying/sdk-is-dying-01.png)

## Casual Imports Fracture Your Architecture Boundaries

Official SDKs carry another hidden cost: they make calling an external service so cheap that anyone can fire one off anywhere in business logic.

Search the codebase and you will find `new Stripe(...)` directly inside a controller, or a Slack client casually imported inside a cron job. Everyone gets to call APIs effortlessly, and the result is predictable:
* Every call site wraps its own `try/catch` block;
* On a 429 rate limit, one place writes a `sleep` while another throws a 500;
* Latency tracking, `TraceId` propagation, and log redaction all depend on whoever wrote the code remembering to do them.

A rate limit from Stripe and a rate limit from WorkOS mean the exact same thing to the business, yet in code they show up as two completely different SDK exceptions.

Before long, you end up plastering layer after layer of `catchRateLimitError` around the outside of your business logic just to catch all the scattered call sites.

## Write 50 Lines of fetch Yourself—The Contract Gets Cleaner

Alvin's (`@alvinsng`) team previously stripped the official Stripe, WorkOS, and Slack SDKs out of their production dependencies and replaced them with a self-built base class of a few dozen lines.

The approach is dead simple:
```ts
export class BaseHttpClient {
  constructor(private baseUrl: string, private authHeader: () => string) {}

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': this.authHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const rawBody = await res.text();
      // Preserve the full status code, headers, and raw body—never swallow evidence
      throw new HttpError(res.status, res.headers, rawBody);
    }

    return res.json() as T;
  }
}
```

Each third-party service extends this base class, declaring only its `baseUrl` and the handful of specific methods it actually uses.

![Total cost of thin SDKs vs. a custom HTTP client](/posts/images/sdk-is-dying/sdk-is-dying-02.png)

The shift is immediate:
1. **The raw scene is always preserved**: Whether an upstream gateway spits out HTML or returns a specific header, the thrown error carries the complete network context from the scene of the failure—no guesswork needed.
2. **Every exit goes through one place**: Retries, timeouts, metrics, and trace reporting live in those few dozen lines of code, so every third-party call across the project follows the same rules.
3. **Out of the dependency swamp**: No more spending your days upgrading packages just to wait on an SDK to patch an obscure vulnerability in a transitive dependency.

What about types? You can keep the SDK in `devDependencies`, or simply hand the official docs to an agent and have it write out the few request/response types you need. Keep pure HTTP at runtime, and type safety at dev time.

## Keep What Matters, Cut the Rest

None of this means deleting everything with "SDK" in its name.

Libraries like Sentry or Datadog have to hook into the Node.js event loop, intercept uncaught exceptions, and propagate traces across async contexts. That kind of deep runtime instrumentation is infrastructure—writing it yourself is asking for pain, so it stays.

But for Stripe, Slack, or Linear—thin wrappers over a handful of REST endpoints—there is no reason to blindly pull in tens of megabytes of black box.

Writing integration code used to be tedious grunt work, which is why teams gladly paid the SDK tax for convenience. Now you can drop the API docs into an agent and get a strongly typed wrapper in seconds.

Before integrating a third-party service, check whether it is a low-level runtime component or just a thin shell making HTTP requests. If it is the latter, a few dozen lines of transparent code you wrote yourself are far more reassuring than megabytes of black box.

---

This channel explores leaner architectures and hands-on engineering practices in the age of AI-assisted coding. Up next, I will keep sharing concrete trade-offs around API boundary consolidation, transparent debugging, minimal dependencies, and engineering automation. Follow along if that sounds useful.
