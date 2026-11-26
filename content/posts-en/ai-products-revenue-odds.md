---
title: "Revenue Data from 10,000 Indie Products: AI Products Make Money at Almost the Same Rate as Non-AI"
summary: "Indie hacking and AI product revenue: across 10,150 products on TrustMRR, 49.3% of AI products have revenue vs. 49.0% of non-AI products, and only 2.41% make $100K a year. AI lowered the cost of building, not the odds that someone will pay."
coverAlt: "Revenue data from 10,000 indie products: AI products make money at almost the same rate as non-AI"
sourceHash: "6cd3f56e36a75f83"
---

Across 10,150 products on the indie product revenue leaderboard TrustMRR, 49.3% of AI products generated revenue in the past 30 days, compared to 49.0% of non-AI products. A 0.3 percentage point difference—too small to bother explaining.

The data was pulled by researcher Mifanr on September 4, 2026 via the TrustMRR API, with anonymized data and scripts hosted in the GitHub repository mifanr/trustmrr-research. TrustMRR syncs numbers directly from payment providers like Stripe rather than relying on screenshots. The AI vs. non-AI comparison comes from a September 28 analysis by Tech Startups.

AI classification was keyword-based—anything mentioning AI in its name, description, or category counted, totaling 5,049 products. That's a rough cut. The repository's README includes a separate calculation using only the platform's built-in category field: AI products drop to 21.2% of the total, and the conclusion stays the same.

**In this dataset, whether a product carries an AI label makes almost no difference to the odds of someone paying for it.**

I first saw this data in Sagasu's article, "Hot Take: People Complaining About 'Too Much AI Vibe' Are Missing This Wave of Primitive Accumulation." Sagasu calls the AI dividend a timing arbitrage: production costs fall faster than market prices, and the spread in between is profit. That explains why some people are making money, but it doesn't explain why the share of those 5,049 AI products with revenue is roughly the same as non-AI products. Costs fell for everyone building products at the same time.

China's AI comic-drama market has a similar set of numbers. In a call for case studies for the *China AI Comic-Drama Industry White Paper*, iResearch Data noted that over 60,000 comic-dramas launched across all of 2025, and 96 crossed 100 million views—a 0.16% hit rate. The call didn't specify the counting methodology, so treat it as an order-of-magnitude figure.

In the raw data, 272 products—2.68%—had monthly recurring revenue (MRR) of $8,333 or more, which annualizes to $100,000. Tech Startups checked sync statuses and found 27 records with broken payment connections or no sync in over 30 days. Removing those leaves 245 products, or 2.41%. Stale records skew the top end heavily: the repository README notes that the single largest one accounted for 19.8% of total site MRR, with an expired Stripe API key and a last sync date of April 20, 2026.

MRR only counts subscriptions, which misses one-time payments. ShipFast sells a one-time-purchase code template with $1.27 million in cumulative revenue, yet its MRR column reads 0. That 2.41% figure misses revenue like that. The claim circulating online that "58% of products on TrustMRR make no money" simply equates zero MRR with zero revenue—even though 1,222 of those products actually took in money over the past 30 days. Counting products where all three revenue fields are 0, Mifanr found 2,654 products that have never made a cent, or 26.1%.

Everyone on the leaderboard is a founder willing to share revenue publicly, and the platform only launched in October 2025, so products that shut down earlier aren't included. The true share of zero-revenue products is almost certainly higher—by how much, I can't calculate.

Sagasu wrote in that post that they are in the 51% with no revenue. Sagasu's own project, SkillMint, is an AI Agent payment experiment that didn't have GA4 analytics hooked up, so as of writing the post they still didn't know whether anyone had ever paid that $0.02.

![Building it isn't enough—someone still has to buy it](/posts/images/ai-products-revenue-odds/ai-products-revenue-odds-01.png)

For my next product, I plan to build it backward: put up a page with pricing first, and only write code once someone leaves an email or puts down a deposit. On launch day, payment processing and analytics go live together. SkillMint was missing analytics, which is why there was no way to tell if anyone had even paid that $0.02. Those two practices are what I took away from that example—the data from these 10,000 products doesn't prove either of them.
