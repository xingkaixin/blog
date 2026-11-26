---
title: "The Better AI Gets for Me, the More It Scares Me"
summary: "In Chiang Mai, I built a voice-note app with AI in a week—it works great, I use it every day, yet I never shipped it. For the first time, 'making it' and 'understanding it' have been split apart, and life inside the bubble is too comfortable to leave on my own."
coverAlt: "The Better AI Gets for Me, the More It Scares Me"
sourceHash: "84da8f4029e625bc"
---

Chiang Mai, halfway through the trip. Sitting in a café, a feature idea suddenly hit me.

This happens a lot—an idea pops into my head, and I know if I don't write it down right away, it'll be gone in a few hours. I pulled out my phone, tapped a button on the screen, and started talking. As I spoke, text appeared on the screen, snapping into a new note. When I finished, I tapped stop, and the note was saved. The whole thing took maybe thirty seconds.

It's a voice-note app I built myself—finished during my week in Chiang Mai. It was usable halfway through the trip, and I've been using it ever since.

It solved a real problem I've had for years. Driving, walking, showering—whenever I can't reach a keyboard, ideas slip away. My old workaround was recording voice memos with the phone's built-in app, then listening back, transcribing, and organizing them whenever I had time. It worked, barely. Worse, I'd keep putting it off until I forgot to listen at all, and by the time I remembered, the recording had lost whatever spark it was meant to capture.

Now I just talk, and it turns into a text note. Searchable, easy to revisit, and if I want to hear how I originally phrased it, the audio is still right there.

I use it every single day.

Yet I haven't shipped it.

It sits on my phone alone, and I have no plans to release it anytime soon. Over the past few days, I've been thinking about why.

![Using the voice-note app in a Chiang Mai café](/posts/images/enjoying-ai-too-much-scares-me/enjoying-ai-too-much-scares-me-01.png)

---

## I

It didn't take long to build this app.

Before this, I had almost no experience with real-time speech transcription. I knew such models existed and had used voice input before, but as for how it actually works—how a sound wave turns into characters, how it decides where to split sentences, why it suddenly drops a word in a noisy room—I had no idea.

What I actually did was simple: I wired up a cloud provider's real-time speech API, piped its streaming output into my UI, and built local storage to create, view, and search notes. Later, I integrated a second provider's API and added a toggle between them, just in case one went down.

It sounds like I "know" speech transcription. I don't. What I know is how to call an API, how to make product trade-offs, and how to switch between two vendors. **As for how the thing itself actually happens—turning sound into text—I didn't write a single line of that code, and I never intended to.**

In fact, the only reason I finished so fast is precisely because I didn't need to understand it. Model deployment, model selection, performance tuning, version updates—all the genuinely hard parts sit behind a wall managed by the cloud API. On my side of the wall, I just hook up a pipe and use whatever comes out.

**Five years ago, this would have been unthinkable.**

Five years ago, if a developer wanted to build speech transcription, they had to understand it. They had to know which model to pick, how to deploy it, how to handle real-time streams, how to deal with network jitter, and how to do noise reduction on-device. "Making it" and "understanding it" were the same thing. If you didn't understand it, you couldn't build it; building it meant you understood it.

Not anymore. **For the first time in the AI era, making something and understanding it have been split into two separate things.**

![A wall separating making something from understanding it](/posts/images/enjoying-ai-too-much-scares-me/enjoying-ai-too-much-scares-me-02.png)

---

## II

At the start of this post, I said I didn't ship the app.

So it's not because it doesn't work well—it works great. And it's not because it's unfinished—it already covers all my daily needs. It's because I know that **working in my hands doesn't mean it will work in someone else's.**

When I use it myself, I know its edges. I know transcription breaks down on the subway because the signal drops. I know it struggles with Cantonese accents because it gets confused whenever I slip in a few Cantonese words. I know it drops characters when I talk too fast. None of that bothers me—if it messes up, I just say it again, or type the missing word.

If I ship it, though, users' edges aren't my edges. An accent I've never encountered, a spotty network I never worried about, a level of concurrency I never tested—how it behaves in those situations, I simply **don't know**.

I can't even articulate where it will fail. **Because the part that actually does the work sits on the other side of that wall, out of my hands.**

Putting something in front of real users when you can't even describe its failure modes is dishonest. **Dishonest to myself, and dishonest to them.**

So there it stays. I use it every day, and it creates value for me every day. But it can't cross the line into a public release.

---

## III

What scares me isn't when AI makes mistakes—mistakes I can fix, learn from, and work around.

What scares me is **when it doesn't make mistakes.**

Because when it works smoothly, I start believing I understand. I mistake "I can build things with it" for "I understand how this works." In some casual conversation—say someone asks how my voice transcription works—I'll launch into "I hooked up a cloud API and handle it via streaming," feeling like I answered the question. What I actually answered was "how I used it," not "how I understand it."

Before AI, those two things were one and the same. After AI, they came apart.

And this doesn't only happen when I'm building an app.

Take a few other examples. Every day, I have AI read articles for me—say an English technical post I don't have time to read word for word. I ask for a summary, read it, and close the tab. The next day, when I bring it up in conversation, I can recite its points—but did I "read" that article? **Did I read the article itself, or another AI's retelling of it?**

I ask AI to look up a piece of news. It gives me the timeline, the different sides, the key dates. I read it and feel informed. But **do I understand the event itself, or just AI's packaging of it?**

I have AI build a small tool for me—a Chrome extension, a script, an internal micro-service. It runs and solves my problem. But **if it starts acting weird one day, can I debug it? Have I ever actually read its internal logic?**

In every single scenario, I get what I wanted. **In every single scenario, I don't truly own it.**

That's the bubble I'm talking about. The thing is in my hands, yet its insides are invisible to me. Most of the time nothing goes wrong, and I enjoy the convenience. Still, it's a bubble—it only holds as long as I don't poke it. **And the only reason it hasn't popped yet isn't that there are no flaws inside; it's just that I haven't hit the moment that pops it.**

![Comfort and isolation inside the bubble](/posts/images/enjoying-ai-too-much-scares-me/enjoying-ai-too-much-scares-me-03.png)

---

## IV

Here I have to be honest about one thing.

I'm not going to stop using AI because of this.

It's genuinely too good. Without AI, I couldn't have built that voice-note app—or it would have taken me ages. Without AI, I couldn't get through all the technical posts I read every day. Without AI, I couldn't keep up with the industry updates I follow now.

**What scares me isn't that the bubble exists. It's that life inside the bubble is so comfortable that I won't walk out of it on my own.**

I know clearly that I'm living in a bubble. I know there's a cost to it. And yet I won't go back.

That's the most unsettling part. **I'm consciously choosing a state I know is flawed**—because the upside is huge, and the downside stays invisible most of the time.

---

## V

Still, giving up completely isn't the answer. I can't accept that.

So what I've worked out this week comes down to one thing: **at the very least, know where the edges of the bubble are.**

Not to understand everything—understanding everything in the AI era is no longer realistic. Just to know **under what conditions the bubble might pop**.

Back to my voice-note app: using it myself is fine; shipping it isn't, because shipping means exposing it to a world whose edges I can't map. **That line between "okay" and "not okay" is crystal clear in my head.**

Back to reading articles: I'll read AI summaries, but **the moment I want to rely on an article's argument to make a judgment, I go back and read the original.** The bubble holds at the "quick overview" layer; it doesn't necessarily hold at the "decision-making" layer.

Back to the small tools AI builds for me: fine if they're just for me, but **the moment they're meant to serve anyone else, I force myself to read what the code is actually doing.** Even a rough pass, just so I know which parts I haven't fully grasped.

None of this is some grand methodology. It's just the bare minimum self-awareness for a developer in the AI era: **don't pretend to understand what I don't, and don't push what I don't understand into places I can't control.**

![Three boundary rules](/posts/images/enjoying-ai-too-much-scares-me/enjoying-ai-too-much-scares-me-04.png)

---

## VI

In my last few days in Chiang Mai, I'm still using my voice-note app.

It still works great. It's still unshipped.

Neither of those things is going to change.

**Because I know I'm inside a bubble—it just hasn't popped today.**

And the least I can do is not pretend it isn't one.
