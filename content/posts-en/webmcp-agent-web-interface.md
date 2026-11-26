---
title: "Agents Are Still Hunting for Buttons, While WebMCP Has Websites Handing Over Tools"
summary: "WebMCP lets web pages register frontend functions directly for browser agents. Instead of using vision models to guess pixels and click buttons, it natively reuses frontend state machines and auth sessions—though commercial incentives will likely confine it to internal enterprise tools and SaaS."
coverAlt: "Web pages proactively handing over structured tools to an agent"
sourceHash: "16b77559e259dddb"
---

Anyone who has written E2E automation scripts has mixed feelings watching the recent hype around Browser Use.

We know this story all too well. First we computed XPath expressions with Selenium, then we grabbed CSS selectors with Puppeteer, and now we've just slapped a multimodal LLM on top to look at screenshots and click the screen. Yet the moment the frontend ships a release that hashes class names, or wraps a button in an invisible `div` for analytics tracking, your midnight cron job still breaks.

Making an LLM stare at multi-megapixel screenshots to guess where a button lives isn't cutting-edge intelligence—it's pure compute waste.

## The Frontend Could Just Hand Over the Keys

Clicking that "Batch Approve" button on the page does nothing more than trigger a piece of JavaScript already bound in memory.

The data is sitting in the store, the validation rules are in the schema, and Axios interceptors have already attached the auth token.

Yet today's vision agents take a massive detour:
the frontend renders data into the DOM, the browser turns the DOM into pixels, the agent takes a screenshot and sends it to a model, the model estimates rough `(x, y)` coordinates, and then it simulates a mouse click over CDP.

The moment an animation hasn't finished, a container has a scrollbar, or the screen resolution shifts slightly, the model clicks into thin air—followed by long retries and infinite loops.

Drafted by a W3C Community Group, WebMCP is basically the frontend getting tired of being brute-force reverse-engineered by external scripts and handing the agent a key right inside the browser's native environment.

When a page mounts, it registers its available methods directly in the current tab:

```ts
// 封装成一个标准的 React Hook
function useExpenseTools() {
  useEffect(() => {
    if (!('modelContext' in document)) return;

    const tool = document.modelContext.registerTool({
      name: 'batchApprove',
      description: '批量审批选中的报销单据',
      inputSchema: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } }
        },
        required: ['ids']
      },
      execute: async ({ ids }) => {
        const res = await expenseApi.batchApprove(ids);
        setList(prev => prev.filter(item => !ids.includes(item.id)));
        return { success: true, count: res.affected };
      }
    });

    return () => tool.unregister();
  }, []);
}
```

Once the agent enters the page, it gets a structured schema for function calling right away. The model outputs arguments, and the frontend runs JavaScript in the current process—updating component state and sending authenticated requests.

No coordinate math, no resolution sensitivity, and no caring how the CSS is written.

![Browser Use's pixel detour vs. WebMCP's structured tools](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-01.png)

## Why Not Just Call Backend APIs Directly?

Whenever this comes up, someone always asks: if you already have structured arguments, why not spin up an MCP server and call the backend REST APIs directly?

Because plenty of business logic and data never hits the database in the first place.

Take a multi-step procurement request form. When a user picks a vendor in step one, the frontend immediately fetches a custom price sheet and calculates tax discounts in memory. All of that intermediate state lives purely in frontend memory. If you go through backend APIs, the backend has to build a dedicated shadow service just to maintain that draft state machine. With WebMCP, the agent simply fills out that step for the user right on the current page.

More importantly, there's peace of mind.

Handing delete or payout permissions to a black-box background script makes anyone nervous. Inside the browser, however, when an agent calls a WebMCP function, UI updates render live right in front of you. It sets twenty filters, fills out the entire form, and pauses right before "Confirm & Submit."

Leaving that final click to human eyes is currently the only form of enterprise automation that lets people sleep at night.

![WebMCP uses the current page state while MCP connects to standalone backend services](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-02.png)

## Don't Expect Commercial Websites to Adopt It

WebMCP is smooth from an engineering standpoint, but it will likely only thrive inside internal enterprise systems and SaaS tools.

![Internal systems proactively expose WebMCP while public websites still force agents to hunt for buttons](/posts/images/webmcp-agent-web-interface/webmcp-agent-web-interface-03.png)

Expecting public commercial platforms like Meituan or Trip.com to adopt WebMCP is as unrealistic as expecting them to keep RSS feeds alive.

Commercial platforms live on dwell time, ad impressions, and membership popups. If they hooked up WebMCP so an agent could walk in, grab the lowest price in milliseconds, and skip the entire recommendation feed, how would they monetize?

Unless Chrome turns WebMCP into a hard traffic-ranking signal, public websites won't write `registerTool` for you—they'll tighten browser fingerprinting and anti-bot defenses to block automated requests instead.

So the split is clear:

In the admin panels, ERPs, and heavy productivity tools you control, register clean tools with WebMCP and stop guessing pixels alongside a model. As for public websites packed with anti-scraping and dynamic obfuscation, keep brute-forcing them with clunky Browser Use.

A good protocol won't change the tug-of-war of commercial incentives, but inside our own systems, we can at least head in the right direction.
