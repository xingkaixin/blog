---
title: "Doing Research with OpenAI Can Also Mean Competing Against It"
summary: "The dispute between OpenAI and a mathematician over the Navier-Stokes equations exposes a harsher reality than data leaks: even without touching your private data, a model provider can become your direct competitor in the same race using stronger unreleased models and compute. Buying a tool is not forming an alliance, so you have to protect yourself with local version trails and dual-track isolation."
coverAlt: "Doing Research with OpenAI Can Also Mean Competing Against It"
sourceHash: "2684f3d2aa74efeb"
---

On September 6, NYU mathematician Tristan Buckmaster received a call that left him deeply unsettled.

On the other end was someone from OpenAI. They told him their internal model had achieved a mathematical breakthrough on the famous Navier–Stokes equations—a direction that closely overlapped with the problem Buckmaster's team had been working on for a long time.

Buckmaster asked on the spot: his team's core derivation drafts from the past few months had been stored in his Codex account—had OpenAI accessed any of that content?

He had used grant money to pay for a commercial AI tool and relied on it to assist with his derivations. Yet in an instant, the company selling the tool showed up at his door with a major result of its own.

Once the story blew up publicly, it was quickly framed in emotional terms: "a mathematician fed his secrets to AI, and the vendor scooped him." But looking at the facts, it is not that simple.

In a public statement, Buckmaster acknowledged that he could not prove his data had actually been accessed by OpenAI's models or staff. In an official update on September 10, OpenAI also explicitly denied it: an internal investigation found that none of Buckmaster's Codex logs from the two months prior to the announcement could have influenced the research system, including through model training.

Based solely on the timestamps of their tweets, there is no way to prove plagiarism.

Yet what truly stings for research and engineering teams goes much deeper than whether data was peeked at: even with 100% technical data isolation, the vendor providing your tools has effectively become your direct competitor.

OpenAI was quite candid in its announcement: on September 1, after hearing rumors of a breakthrough on a major math problem, they immediately deployed a powerful unreleased internal model to tackle the same Millennium Prize Problem.

Open problems in science are fair game for anyone to explore. Expecting a frontier AI lab to permanently steer clear of every topic its paying customers are working on is neither realistic nor logical.

What many researchers overlook, however, is a critical distinction: paying for API access to a tool is nothing like entering an equal research partnership. Subscribing to a vendor's service does not mean they will give you their most capable models, nor does it mean you have formed any kind of research alliance.

**"Not training on my data" and "not competing with me" answer two completely different questions.**

![Data isolation does not mean non-competition](/posts/images/ai-provider-research-competitor/ai-provider-research-competitor-01.png)

The former is a promise about data privacy and compliance; the latter is freedom over business strategy and R&D direction.

Both can be true at the same time: a vendor can avoid touching a single line of your private material and still sprint alongside you in the exact same lane—backed by more advanced unreleased models, larger compute clusters, and internal research teams working in the same area.

Focusing solely on "did my data leak?" misses the fundamental shift behind this conflict: once a tool participates in the thinking process itself, the relationship between provider and user changes.

A spell-checker only needs to see a few isolated words, whereas an Agent that helps derive proofs and write algorithms has to ingest deep context. To get the AI to understand where you are actually stuck, you hand over half-baked hypotheses, unfinished experiments, and trial-and-error logs.

The sensitivity of those assets is on a completely different level. Anyone can look up published papers, and a simple error traceback rarely hides any secrets. But why a failed attempt ruled out a certain technical path, or why a set of anomalous results is worth digging into—that is often a team's core research moat.

Once that context keeps flowing into the chat box, the mental comfort of "we're just buying software" falls apart.

If a team also accepts early hands-on support from the vendor's technical staff, the boundaries blur even further. When a forward-deployed engineer helps debug an API issue, are they just fixing a bug, or are they also picking up on pain points at the frontier of your field? Are you testing an early model, or unwittingly serving as a free tester validating their technical feasibility?

By the time results are about to bear fruit, trying to untangle who gets credit is usually too late. Who publishes first, who gets priority, and who owns the lead inevitably turn into a messy dispute.

Swearing off AI altogether out of fear is not realistic either. The efficiency leverage these tools bring to reasoning and derivation is real; refusing to use them only hands a speed advantage to your peers.

Facing this kind of asymmetric competition, the only effective defense is not hoping for vendor ethics, but building physical safeguards through engineering.

Public literature and generic code can safely go to public commercial models. But unpublished core hypothesis validation, key derivation leaps, and raw experimental records need strict local dual-track isolation. Even within the same vendor's product lineup, having a no-training guarantee on an enterprise API does not mean web interfaces or early-access accounts carry the same protection.

Even more important is maintaining a local chain of versioned evidence.

When a core insight took shape, whether a key derivation step came from a human team member or a model suggestion, and which exact edits an Agent provided—all of it needs an immutable commit history in a local version control system completely under your own control.

![Separate public materials from local research records](/posts/images/ai-provider-research-competitor/ai-provider-research-competitor-02.png)

This may not stop anyone else from pursuing the same research, but when attribution is challenged, it at least gives you an irrefutable trail of evidence.

Buying a tool is not forming an alliance. The smarter the tool gets and the deeper it reaches into your work, the more you have to treat it as a potential rival that could overtake you right before the finish line.
