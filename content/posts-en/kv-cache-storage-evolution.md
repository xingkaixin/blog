---
title: "Why Can KV Cache Last for Days and Cost 98% Less?"
summary: "At 32K tokens, a 70B model's KV cache takes roughly 10 GB; DeepSeek shrinks it with MLA so it fits on disk, while OpenAI charges a 2.5x write fee for its 12-hour tier that only saves money past two rewrites—provided the prefix stays stable."
coverAlt: "Why Can KV Cache Last for Days and Cost 98% Less?"
sourceHash: "0f620b0916699dc5"
---

Checking the [DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing/) on November 12, 2026, Flash off-peak cache-hit pricing is $0.003 per million tokens versus $0.15 for a miss—hits cost just 2% of misses, a 98% discount. Storage is free, and unused cache entries typically stick around for hours to days.

When OpenAI launched [Prompt Caching](https://openai.com/index/api-prompt-caching/) in October 2024, cache hits only gave a 50% discount, and idle entries were cleared in five to ten minutes—always within an hour. It wasn't until October 20, 2026 that the [Responses API added a 12-hour tier](https://developers.openai.com/api/docs/changelog), priced at 2.5x the standard input rate on writes.

Both providers are reusing caches across requests, yet retention times and bills differ by orders of magnitude. The root cause comes down to how much hardware space the cache takes up and which storage tier the provider puts it in.

## Too Big for VRAM: Shrinking the KV Cache First

Server-side cache blocks store the KV states a model has already computed. When a new request matches a prefix, the inference engine loads that saved state directly, skips recomputing the shared prefix, and only processes the newly appended input—while still generating output one token at a time.

Going by Llama 2 70B's [public config](https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py), the model has 80 layers and 8 KV heads of 128 dimensions each. At two-byte precision, each token stores a Key and a Value per layer: `2 × 80 × 8 × 128 × 2` bytes, or 320 KiB.

Over 32,000 tokens, that adds up to roughly 10 GB before counting framework overhead. And that is already with 64 query heads sharing 8 KV groups; if every query head stored its own copy, the size would be 8x larger.

The model weights alone take roughly 140 GB at two-byte precision, already more than a single 80 GB H100 can hold. Online serving also has to support concurrent sessions at the same time—GPU VRAM cannot afford to keep 10 GB idle caches sitting around for hours.

To keep caches longer and push read prices down, you first have to shrink the state stored per token. In May 2024, DeepSeek-V2 changed the per-layer cache layout in its [MLA (Multi-head Latent Attention) technical report](https://arxiv.org/html/2405.04434v5): instead of saving full multi-head Keys and Values, it stores only a low-rank compressed latent vector plus a small Key slice for positional encoding, then folds projection matrices together directly during inference.

Compared against its own 67B dense model, DeepSeek-V2 cut KV cache size by 93.3%. That compression comes from V2's architecture itself—you cannot apply that 93.3% number across all models or infer that other providers use the same structure.

## Disk Storage Is Cheap, but Hits Are Still Conditional

Once the cache is shrunk down, putting it on disk becomes practical. DeepSeek's August 2, 2024 [disk caching announcement](https://api-docs.deepseek.com/news/news0802/) credited low-cost disk caching to V2's MLA, noting that caching turns on automatically with no code or API changes and no extra storage charge. The page still shows the old $0.014 hit and $0.14 miss prices alongside a note that pricing has since been updated.

In the announcement's 128K-token long-prompt example, cache hits cut time to first token from 13 seconds to 0.5 seconds. That saves the wait before the answer starts streaming; full generation does not speed up proportionally, because reading state back from disk still requires moving data.

The later open-source [3FS](https://github.com/deepseek-ai/3FS) filesystem combines SSDs and RDMA networking into shared storage and explicitly lists inference KV cache as a use case, replacing smaller, pricier DRAM caches.

Free disk caching comes with no retention guarantee. DeepSeek's [current docs](https://api-docs.deepseek.com/guides/kv_cache/) state that unused caches are typically cleared after a few hours to a few days, with no guaranteed hit rate. If you run the same long document again the next morning, your application still needs to tolerate occasional miss latency and cost.

Even when a cache is still on disk, outgoing requests will not necessarily hit right away. Identical prefixes first have to be persisted as complete cache blocks, which takes a few seconds to build; blocks are cut at input boundaries, output boundaries, and fixed token intervals in long prompts.

The docs give a three-turn example: turn 1 sends A+B, turn 2 sends A+C, and the shared prefix A may not yet be ready for reuse; only after the system detects and finishes writing A does turn 3 (sending A+D) get a hit.

Prefix matching also has to be exact starting from token 0—no amount of repeated text in the middle will hit on its own.

Back in September, I wrote up an internal Coding Agent debugging case in a [post on prefix caching](/en/posts/harness-kv-cache-prefix/): the top of the System Prompt called `new Date().toLocaleString()` to insert the system time, so every turn changed the timestamp and forced the entire long document after it to be recomputed unchanged.

Move the timestamp to the end of the current turn's message and keep the fixed role prompt and tool definitions at the very top in a consistent order, and the bill drops right away. At Flash off-peak rates, a fixed 100K-token prefix costs 1.5 cents per turn on a miss versus 0.03 cents on a hit.

![Both turns start with the same role prompt, tool definitions, and document while placing the changing timestamp at the end, allowing the cached shared prefix to be reused](/posts/images/kv-cache-storage-evolution/kv-cache-storage-evolution-02.png)

Across 50 consecutive turns, if only the first turn misses, that fixed prefix costs about 3 cents total in input fees; if the timestamp at the top breaks reuse on every turn, the cost jumps to 75 cents, before counting each turn's new input and output tokens.

## OpenAI's Other Math: Charging Write Fees by Retention Tier

OpenAI took a different pricing path, using retention tiers and write markups to cover cache storage costs. Starting October 20, 2026, the Responses API offers a default 30-minute tier and an optional 12-hour retention tier for GPT-5.6 and later models. Both tiers share the same read price—on GPT-6.1 Sol short-context caching, reads cost 5% of standard input, while writes cost 1.25x and 2.5x standard input respectively.

Comparing just the write cost of a single fixed prefix over 12 hours—assuming the 12-hour tier keeps hitting while the 30-minute tier expires and has to be rewritten—the cumulative write multipliers look like this:

| 30-minute tier total writes | 30-minute tier cumulative write fee | 12-hour tier cumulative write fee |
| --- | ---: | ---: |
| 1 time | 1.25x | 2.5x |
| 2 times | 2.5x | 2.5x |
| 3 times | 3.75x | 2.5x |

Thirty minutes is only the minimum retention window; entries may stay cached longer after half an hour, and reads, outputs, and new tokens are billed separately. Paying double the write fee for the 12-hour tier only saves money when the short tier would be rewritten more than twice within 12 hours; if a prefix is only used once or twice, the default 30-minute tier comes out cheaper.

**Whether a KV cache lasts for days and how much it saves starts with keeping the prefix stable from token 0, and then comes down to how the provider prices writes and evicts idle entries.** Moving dynamic timestamps to the end of requests and locking tool definition order before launch—then picking a retention tier based on task span and rewrite frequency—matters far more than just comparing read-discount percentages.
