---
title: "Coding Through an API Proxy: The Fable 5 You Paid For Might Be Swapped Behind Your Back"
summary: "An LLM API proxy labeled Fable 5 might actually be charging you a 1.09x markup for a 9B model. Security research found nearly half of tested proxy endpoints failed model-fingerprint checks, with accuracy plunging from 83% to 37%. When your code stops working, don't mistake a middleman's hidden compute downgrade for the tuition you owe to learn AI."
coverAlt: "API proxy gateway potentially swapping models"
sourceHash: "3eda4ef591d84daa"
---

When you call an LLM to write code and it keeps missing edge cases or misspelling variable names, the first instinct for most developers is to blame their own prompt.

We are used to tweaking `temperature`, adding two hundred lines of context, and rewriting task steps. In software engineering, we naturally assume the underlying network and the compute behind an API endpoint are honest.

But if the endpoint itself is lying, that self-blame is a pure waste of time.

In March 2026, the CISPA Helmholtz Center for Information Security in Germany published an empirical security study on LLM proxy services. Out of 17 providers identified in their ecosystem survey, the research team conducted deep audits on 3 representative proxies. Across 24 tested model endpoints, 45.83% (11 endpoints) failed model-fingerprint verification, and another 12.5% (3 endpoints) produced inconclusive results. [Original paper](https://arxiv.org/abs/2603.01919)

In those tests, several endpoints labeled GPT-5 matched fingerprints closer to the open-source GLM-4-9B. Another provider secretly swapped the underlying model while charging users 1.09 times the official standard rate.

## The `model` Field in the Response Is Written by the Seller

The business logic of an LLM API proxy is straightforward: solve overseas payment and direct network access hurdles for users, forward requests to upstream LLMs, and pass the results back to the client.

Yet this proxy gateway turns compute into a completely opaque black box.

When you rent a physical server, you can check the CPU core count. When you download open-source software, you can verify its SHA-256 hash. When you buy an LLM API, all you get back is a string of JSON text. The dropdown menu in the web dashboard, the billing breakdown, and even `response.model: "fable-5"` in the API response payload are all strings assembled by the proxy provider's own server code.

![Proxy routing diagram: requests are forwarded to the actual model while the returned model field is filled in by the proxy gateway](/posts/images/shadow-api-fake-models/shadow-api-fake-models-01.png)

*Seeing a model name in the response does not mean the model's identity has been verified.*

Asking "Who are you?" in the chat box verifies nothing at all. A proxy only needs to inject a single line into the System Prompt at the gateway layer—or rely on a smaller downstream model playing along with the user's framing—and it will claim without hesitation to be the latest official Fable 5.

**Using a cheap model is fine. Selling it to users under the name of an expensive model is not.**

Code always carries debugging costs, and LLMs make probabilistic mistakes. Relying solely on everyday chat or code-generation outputs, a user has almost no way to inspect the goods on the spot behind a black-box endpoint. When an API gives buggy answers, developers tend to blame the limits of the model itself, effortlessly masking the proxy's model swap.

## Swaps Are Easy to Catch; Silent Degradation from 83.82% to 37% Is Harder

The research team caught these fake endpoints by comparing behavioral distributions using Cosine Distance.

They designed a set of probe questions carrying specific preference biases and niche boundary characteristics, extracted feature vectors from each endpoint's outputs, and calculated the cosine distance against the behavioral distribution of known genuine models. When the cosine distance diverged sharply from normal thresholds, they could determine that the underlying model had been swapped.

![Behavioral fingerprinting principle: asking the same probe questions, extracting response features, and comparing the feature direction of the tested endpoint against a reference model](/posts/images/shadow-api-fake-models/shadow-api-fake-models-02.png)

*The diagram simplifies high-dimensional features into 2D directions: the smaller the angle, the smaller the cosine distance, and the more similar the features. Even a matching fingerprint does not guarantee consistent performance on real tasks.*

Swapping the model outright, however, is just the crudest trick. The study also uncovered a more widespread and harder-to-spot problem: a cliff-like drop in performance. [Test results and limitations](https://arxiv.org/html/2603.01919v2#S6)

The Gemini-2.5-flash endpoints offered by the 3 audited proxy providers matched on fingerprint comparison, yet collapsed across the board on actual complex tasks. On the MedQA medical question-answering benchmark, Google's official endpoint scored 83.82% accuracy, while the 3 proxy endpoints plummeted to around 37%.

To be clear, the paper measured output-level performance divergence; the researchers did not have access to the providers' server rooms to inspect their physical configurations.

In real-world engineering, a halving of performance like this usually stems from quiet cost-cutting tricks by the provider: silently truncating long context at the gateway, forcing fewer reasoning steps, or routing requests to heavily quantized private nodes.

Whichever method is used, the result is the same: even if you verify the model name, what you get is a severely crippled service.

## 187 Polluted Academic Papers and Misguided Technical Decisions

Many people assume using a shady proxy at worst costs them a few dollars in wasted token fees. That view underestimates the damage of degraded endpoints.

The most immediate cost is engineering debugging overhead. You iterate on prompts and add redundant error handling against a downgraded endpoint, turning logic that a frontier model should handle cleanly into manual patchwork.

A worse consequence is misguided technical selection. When a team runs technical spikes or model evaluations through a watered-down proxy endpoint, it is easy to reach the false conclusion that "even the strongest model today can't handle our workload," and abandon a completely viable technical path.

Academia has already stepped on this rake: the CISPA team found that at least 187 published academic papers unknowingly relied on these proxy services for their experiments. The evaluation baselines and conclusions in those papers were effectively built on tampered, downgraded endpoints.

A few low-quality responses from an unknown source ended up distorting the industry's long-term judgment of a model's capabilities.

## How to Catch Fake Endpoints for Pennies

Regular developers don't need to reproduce an entire security paper, but you shouldn't expect one or two brain teasers to verify an endpoint either.

In everyday engineering practice, a few defensive steps offer much higher certainty:

First, understand the principle behind behavioral fingerprinting and run small-scale spot checks. Behavioral fingerprinting cannot be judged from one or two questions; it relies on the statistical distribution of outputs. A typical probe test uses multiple groups (such as 8 groups) of boundary prompts designed around specific token preferences, sampling each group roughly 25 times—about 200 minimal requests in total—to build a token probability distribution vector and measure its cosine distance from a genuine model baseline. Because each request has a tiny context and a capped max output length, running a full sampling pass typically costs only a few cents to a couple of dimes.

Second, maintain a first-party sampling baseline channel. When evaluating models, assessing architectures, or shipping core workloads, keep a direct official account or a trusted major cloud provider (such as Azure, Google Cloud, or AWS) as your baseline. Run spot comparisons with the same fixed set of test cases. If a proxy endpoint's accuracy consistently deviates sharply from the baseline, stop using it immediately.

Third, put the provider at the top of your suspect list when debugging. When a model behaves erratically in your IDE or production system, or keeps dropping details in long-context comprehension, switch back to the official channel and reproduce the issue first. Only spend time rewriting prompts and application code after confirming the official channel exhibits the same problem.

![Dual-channel debugging: running the same batch of test cases through both the official direct endpoint and the proxy endpoint, repeating the tests, and comparing results](/posts/images/shadow-api-fake-models/shadow-api-fake-models-03.png)

*Keep prompts, context, and comparable parameters identical, run the same batch of cases multiple times, and then inspect the differences. Checkmarks and crosses here are illustrative only; differing results alone do not prove a model swap.*

Models are allowed to get questions wrong, but providers are not allowed to swap your compute. Behind a black-box API, don't mistake a middleman's hidden cost-cutting for the tuition you have to pay to learn AI.
