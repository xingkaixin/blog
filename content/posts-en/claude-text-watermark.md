---
title: "This Post Was Flagged as 70% AI, Yet Claude's Watermark Ignores Writing Style"
summary: "Scoring 70% on an AI detector does not mean a watermark was found. Claude's text watermark likely hides in statistical biases across token selection rather than writing style."
coverAlt: "This Post Was Flagged as 70% AI, Yet Claude's Watermark Ignores Writing Style"
sourceHash: "d08c11bbd5378dcb"
---

After finishing the first draft of this post, I received an assessment: a 60%–70% probability of being AI-written.

The reasoning was specific: the structure was too neat, the technical details came from public sources, there was no first-person hands-on practice, and the tone lacked variation. The evaluation ended with a suggestion: for absolute certainty, check whether the post contains a Claude watermark.

That suggestion conflates two different kinds of detection. The 60%–70% score is a guess after reading the writing style; a watermark is a signal actively embedded by the generative model and read back by a detector following a rule. Whether the prose reads like AI has no bearing on the latter.

**Claude's watermark likely hides in the statistical bias of many token selections, and the detector has no need to analyze writing style.**

## "Invisible to the Eye" Does Not Mean Zero-Width Characters

According to an [Anthropic support page](https://support.claude.com/en/articles/16266773-how-claude-marks-ai-generated-content) updated on August 10, newer Claude models that support watermarking embed markers directly into text. When copied into an email, document, or web page, the watermark carries over, and it can persist even after parts of the text are edited.

Seeing "invisible to the eye," the first instinct is often to look for zero-width spaces. If it were just a few Unicode characters tucked between words, you could find and strip them without changing a single visible character.

The limitations Anthropic lists do not fit that theory: short text lacks enough signal, heavy rewriting, translation, and mixing in other text can break detection, and the watermark is applied at the model layer—covering Claude, the API, Claude Code, and models hosted by cloud providers.

The [EU's Code of Practice on AI-generated content](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) also sets 200 tokens as the threshold where free-form text must be watermarked, allowing exceptions for very short text. Detection clearly requires accumulating samples; a special character wouldn't need to wait that long.

Zero-width characters can also be wiped out in one pass by converting to plain text, stripping formatting, or normalizing Unicode. By contrast, a statistical signal spread across an entire passage matches the official description: delete a few spots and the remaining signal survives; regenerate every sentence from scratch and only then does the original pattern wash out.

Anthropic has not published the technical details, so what follows is a reverse-engineered look at the likely technical path—not a claim that any single paper is Claude's exact implementation.

## Nudging Every Next-Token Pick by a Vote

In [_A Watermark for Large Language Models_](https://arxiv.org/abs/2301.10226), Kirchenbauer et al. laid out the most intuitive prototype for this kind of watermark.

An LLM generates text one token at a time. At each step, it computes probabilities for the next batch of candidates, picks one, and continues to the next round with the updated context.

Suppose the prompt is "This weekend I plan to go" ("周末我打算去"). The model assigns probabilities to "hiking" ("爬山"), "see an exhibition" ("看展"), "work overtime" ("加班"), and "the moon" ("月球"). "The moon" is grammatically fine, yet its probability will be tiny.

The watermarking system hashes the preceding text with a secret key to split that round's candidate tokens into two temporary sets. For clarity, call them the green list and the red list. The system adds a small score boost to candidates on the green list without banning the red list. If "see an exhibition" and "the moon" land in green, "see an exhibition" becomes more likely to be picked; "the moon" was so improbable to begin with that the boost still won't get it chosen.

Once the model picks a token, the context changes, and the next round re-partitions the lists. A word that was green this time might be red next time. There is no fixed "list of Claude's favorite words," and swapping out a few high-frequency words on their own accomplishes nothing.

This nudge also has to defer to content. When "The capital of France is" can practically only be followed by "Paris," or when code syntax permits only one symbol, the system cannot force a wrong answer just for the watermark. Signal belongs where multiple phrasings make sense. The paper calls that room to choose *high entropy*; the fewer the choices, the weaker the signal that can be hidden.

Claude does not necessarily use the original red-green list algorithm. Google's production [SynthID-Text](https://www.nature.com/articles/s41586-024-08025-4) switches to tournament sampling and can even be configured to leave the original token distribution unchanged on average. Specific schemes vary, but the shared principle is controlling token selection during sampling and reading the statistical pattern back from the whole passage.

![How a watermark forms between candidate tokens, slight score boosts, and statistical bias](/posts/images/claude-text-watermark/claude-text-watermark-01.png)

## The Detector Counts a Stretch of Statistical Bias

Using the red-green list scheme as an example, the detector splits the candidate text with the same tokenizer, then reconstructs each step's lists using the secret key, preceding text, and algorithm version. It has no need to guess the author's style—it only counts how many actual tokens hit the green list.

To keep the math simple, assume half of the candidates in each round are green. In ordinary text of 100 tokens, green hits should fluctuate around 50. A watermarked generation repeatedly leans green and might hit 65 or 70 times. One extra green pick proves nothing; leaning to the same side a hundred times in a row drives the odds of coincidence way down.

This also explains several behaviors Anthropic notes. A short sentence has only a dozen tokens, so normal variance and watermark bias blur together, leaving the detector uncertain. Copy-pasting does not alter the token sequence, so the statistics stay the same. Changing a few words disrupts the calculation around them, while untouched stretches still carry signal. Translating or rewriting from scratch effectively resamples the entire token sequence, wiping out most of the original bias.

Detection only yields a confidence level; it cannot make an absolute judgment the way verifying a file hash does. When text is too short, content is too constrained, or the score lands in a gray zone, the detector may simply stay silent.

## A Watermark Hit Does Not Convict the Author

Claude also applies a separate mark to files. Supported formats such as SVG, PNG, and JPG include C2PA signed metadata recording that the file was processed by Claude and checking whether it was tampered with afterward. Metadata like that is more explicit than a text statistical signal, though re-saving, converting formats, or taking a screenshot can strip it away. Free-form text has no stable metadata container, which is why the signal has to be spread across tokens.

Anthropic defines a detection result as indicating that "content may have been processed by Claude." A student who writes an essay themselves and only asks Claude to fix the grammar may still get watermarked output; another student who has an unwatermarked model ghostwrite the whole paper may test negative. Any school that treats a watermark hit as direct proof of ghostwriting will both falsely accuse the former and miss the latter.

![A watermark shows a tool processed the text, not who authored it](/posts/images/claude-text-watermark/claude-text-watermark-02.png)

So the suggestion in that evaluation—using a watermark for "absolute confirmation"—does not hold up. Detecting a marker only raises confidence that Claude processed the text; finding no marker could mean an older model generated it, the passage is too short, it was rewritten, or it came from another model without watermarks.

Style-based detectors guess the process from the finished product. They cover models that don't actively watermark, at the cost of mistaking "neatly written" for "AI-written." Watermarks only identify models participating in the scheme—narrower in scope, yet far more interpretable as evidence. Neither one can answer who the author is.

Back to that 60%–70% at the start: it describes how the article felt to a reader, without reading any watermark at all. What Claude's watermark detector cares about is the statistical bias scattered across token choices.
