---
title: "AI Is Writing Formal Proofs for Code Now—Who Checks the Proofs?"
summary: "Anthropic and Theorem used Rocq and oft check to verify goal types and axioms across 180 million lines of proofs. Because those proofs only bind to a binary SHA-256 and entry assertions, assumptions and the build chain still require human review."
coverAlt: "AI Is Writing Formal Proofs for Code Now—Who Checks the Proofs?"
sourceHash: "ad66b8910d591074"
---

A [research report](https://www.anthropic.com/research/formal-verification) published by Anthropic and Theorem in October 2026 states that Claude generated formal proofs for 239 test harnesses across 123 open-source libraries, totaling around 180 million lines of proof code checked by the Rocq theorem prover. The public repository only releases a subset of these, and next to the LZO compression example in the repo README, an all-caps note reads: "ONLY THE LENGTH".

Following the link to the LZO test harness [source code](https://github.com/theorem-labs/oss-verify-proofs/blob/main/projects/lzo/lzo_compress_target/source/lzo_compress_target.c#L100), the assertion right after decompression returns sits on line 100:

```c
assert(r == LZO_E_OK && decompressed_len == size);
```

This assertion only checks the decompression return code and the restored length; it does not compare the original input with the decompressed output. Both `abc` and `xyz` are three bytes long, yet their contents are completely different. To verify that decompression actually restores the original data, a byte-for-byte comparison is missing from the source code.

## What Isn't in the Assertion Won't Be Guaranteed by the Proof

Even the claim that "all inputs have their length checked" does not hold. Lines 45–47 of the harness first clamp any `size` exceeding `1 << 20` (1 MiB) down to `1 << 20`, and lines 86–92 skip inputs that do not shrink after compression. Bytes beyond 1 MiB and incompressible samples never reach the line 100 assertion.

According to the [proven targets index](https://github.com/theorem-labs/oss-verify-proofs/blob/main/index/PROOFS.md) and the LZO harness [README](https://github.com/theorem-labs/oss-verify-proofs/blob/main/projects/lzo/lzo_compress_target/README.md) read as of November 12, 2026, claims such as LZO's `plain_halts` remain `open`.

This review only inspected the report, repository documentation, harness source code, and checker scripts; I did not run Rocq independently. An `open` status does not necessarily mean the program has a bug—it may simply mean proof search has not found a derivation yet.

Even if this proposition passes verification later, it only guarantees that every covered execution terminates with exit status 0 or 2 without triggering the line 100 assertion failure. Anything not written into the assertion will naturally not be guaranteed by the proof.

The claims in the repository also distinguish between `halts` and `agreement` properties. `halts` requires all covered executions to terminate with an exit code within the allowed set; `agreement` requires observable behavior between the normal build and the sanitizer build to match without hitting defined errors, though it does not rule out non-termination. To understand what a proof actually guarantees, you first have to see which proposition name it is attached to.

## Checking 180 Million Lines Without Reading Them, Locked Down by a Script

Faced with 180 million lines of proof code, developers cannot review it by eye, so the project delegates acceptance to the checker script [`tools/oft/check.py`](https://github.com/theorem-labs/oss-verify-proofs/blob/main/tools/oft/check.py).

`oft check` first verifies the SHA-256 digest of the target binary, constructs the memory image and goal proposition, and then invokes the Rocq kernel to check the submitted derivation against formal rules. According to the repository notes, a single check on a 16-core machine takes up to 20 GiB of RAM.

Once a proof is submitted, the wrapper code plugs it directly into the type definition of the goal proposition. If the types do not match, Rocq rejects it on the spot, leaving no way to sneak in a weaker conclusion.

The checker script also runs `Print Assumptions`, redirects the axioms the proof actually depends on into a separate file, and checks every entry against an allowlist. The script reads only this isolated file rather than mixing it with normal build logs, rejecting any axiom outside the allowlist. That closes the loophole of sneaking the target conclusion in as an extra axiom.

![Verification flow: compare the goal proposition type first, then separately check the list of axioms the proof actually depends on](/posts/images/ai-formal-verification/ai-formal-verification-01.png)

## After Passing Machine Checks, Three Layers of Assumptions Still Need Human Verification

Even after types and axioms pass, the hardcoded assumptions in the proposition must be checked one by one. Taking LZO's `plain_halts` as an example, the claim assumes the system will not refuse allocations as long as memory stays within 16 GiB, the runtime environment does not intercept requests, and the driver intercepts invalid arguments, unreadable files, or inputs reaching 64 MiB with exit code 2 before entering the test harness.

Compliant axioms do not mean your production deployment satisfies those conditions.

On top of that, the checker only recognizes compiled binary bytes: the proof targets the machine code matching that SHA-256 digest, regardless of how it was compiled from C source. The [trusted computing base documentation](https://github.com/theorem-labs/oss-verify-proofs/blob/main/docs/trust.md) explicitly excludes the compiler, the build process, and the source-to-binary correspondence from the trusted base.

To confirm the proof corresponds to the source code in front of you, you have to inspect the upstream repo and commit, compiler, container image, compile and link flags, and binary SHA-256 recorded under `proofs/provenance/`, then follow the rebuild guide to reproduce the hash. Otherwise, even if all binary proofs pass, you still cannot confirm the binary came from the source code in the repository.

Even after skipping line-by-line proof review, humans still have to trust the entire verification chain, including the Rocq kernel, allowed axioms, binary mapping tools, wrapper scripts, and the formal semantic model LPS.

The [system model documentation](https://github.com/theorem-labs/oss-verify-proofs/blob/main/docs/semantics.md) notes that LPS models statically linked, single-threaded `riscv64` Linux processes; the system model is currently incomplete, and the study is scoped within specific resource bounds without covering all syscalls or multithreaded behavior on real Linux.

**Formal proofs sign off on properties of a specific binary under bounded assumptions; unasserted requirements and the source-to-binary build process must still be verified separately.** For a data-restoration requirement like LZO, the next step is to add a byte-for-byte check like `memcmp` into the test harness, recompile and verify the binary SHA-256, and re-run the checker to confirm the new assertion is captured in the goal proposition.
