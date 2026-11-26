---
title: "Anthropic Merges 30,000 Changes a Day, and Git Broke First"
summary: "Git, CI, and merge queues: Anthropic's daily merges grew from 2,500 to 30,000, pushing them to migrate their monorepo off Git; GitHub saw over five times more commits in September than a year earlier. Most teams don't need to leave Git, but three changes are worth considering."
coverAlt: "Anthropic Merges 30,000 Changes a Day, and Git Broke First"
sourceHash: "03ea06aa1ca6e9fb"
---

Anthropic's monorepo merged over 30,000 code changes a day in September, up from around 2,500 in May. In their October 13 engineering blog post, they noted that source control, builds, and CI were the first to fall behind—all of which had originally been built for human scale. In the end, they migrated the repository off Git.

The new system they built is called Scion, and seven people completed the migration in five months. The blog post mentions merge volume grew 10x during the migration, though 2,500 to 30,000 works out to 12x—the two figures likely cover different time windows. They also note themselves that Scion is only suited for massive monorepos shared by tens of thousands of engineers or huge numbers of agents, and shouldn't be used to replace Git for general purposes.

GitHub also published a post on October 6 titled Building Git infrastructure for agent-scale development. In September, GitHub saw 7.38 billion commits—more than five times the volume a year earlier—with both pushes and Actions runs topping 3 billion.

That GitHub post also describes how agents use Git: committing or creating a checkpoint after almost every action in a loop. Under that pattern, agent speed bottlenecks on the latency of a single push. GitHub stores 5 replicas per repository by default; every write involves all replicas, so push speed is gated by the slowest one.

Trunk-based development and merge queues also concentrate writes onto the same ref. After a push, CI and code scanning pull the latest commits from that branch—at a rate GitHub puts at thousands of times per minute.

Anthropic's clients are almost exclusively agents and CI jobs. Git makes every clone a full repository, which lets you work offline, but these clients stay connected to the server and never need offline access—yet still have to pull a full copy. Their main branch history is close to 100 GB, a compressed working copy exceeds 25 GB, and CI runs roughly 25 million checkouts a day. They calculated that doing a full pull every time would exceed 600 PB a day. I checked 25 million times 25 GB—that's 625 PB, so the math lines up.

Before the migration, they relied on hundreds of internal Git mirrors to absorb that load.

Scion's client only keeps a bounded object cache and fetches files on demand. Checking blame, browsing history, or running merges and rebases are all server calls. For example, when CI needs the diff between a commit and its merge base, it just asks the server, so many CI jobs don't need a local repository at all. After the migration, the infrastructure's CPU and memory footprint dropped to 1/200th of the old Git mirrors, freeing up another 25% of CPU on the CI side.

The standard approach for a merge queue is a global repository lock, which Anthropic said they couldn't use because hundreds or thousands of changes could already be merged before a single test run finished. They switched to running automated tests post-merge and pre-deploy. Concurrent changes do conflict, and by their account, Claude usually resolves those conflicts faster than a human would even notice them. They expect more teams to run into this class of problem within 6 to 12 months.

**Most teams have nowhere near this many repositories or agents, so I don't recommend moving off Git.** There are a few ideas from Scion worth borrowing—all inferred from its design, not things I've tested in practice.

Some CI jobs only need to read a diff or look up a blame, yet still do a full clone of the repository. Switching to shallow clone, sparse checkout, or calling the platform API for the diff is much cheaper than cloning. Before changing anything, compare the time spent in the checkout step in your job logs against the total job duration.

![CI fetching only the needed diff from the server](/posts/images/agent-scale-git/agent-scale-git-01.png)

If you run multiple agents locally and each has its own clone, you can switch to `git worktree` so they share a single object store.

I would leave merge queues for last. Moving slow integration tests to post-merge, pre-deploy shortens the queue, at the cost of having untested commits on main—if pre-deploy tests fail, someone has to immediately track down which change broke them. Teams where main regularly stays red for half a day without anyone stepping in shouldn't make this change.
