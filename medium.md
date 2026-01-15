Accidentally Built a Real-Time AI Enforcement System for Claude Code
====================================================================

[![Ido Levi](https://miro.medium.com/v2/resize:fill:64:64/1*8NC5jkrNws1eXPq75pdqOw.jpeg)](https://medium.com/@idohlevi?source=post_page---byline--221197748c5e---------------------------------------)

[Ido Levi](https://medium.com/@idohlevi?source=post_page---byline--221197748c5e---------------------------------------)

9 min read

·

Aug 25, 2025

[nameless link](https://medium.com/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2F_%2Fvote%2Fp%2F221197748c5e&operation=register&redirect=https%3A%2F%2Fmedium.com%2F%40idohlevi%2Faccidentally-built-a-real-time-ai-enforcement-system-for-claude-code-221197748c5e&user=Ido+Levi&userId=297475c7aaa3&source=---header_actions--221197748c5e---------------------clap_footer------------------)

--

4

[nameless link](https://medium.com/m/signin?actionUrl=https%3A%2F%2Fmedium.com%2F_%2Fbookmark%2Fp%2F221197748c5e&operation=register&redirect=https%3A%2F%2Fmedium.com%2F%40idohlevi%2Faccidentally-built-a-real-time-ai-enforcement-system-for-claude-code-221197748c5e&source=---header_actions--221197748c5e---------------------bookmark_footer------------------)

Listen

Share

It started innocently enough. I wanted a virtual pet living in my Claude Code statusLine — just a cute companion that would hang out while I coded. You know, standard developer procrastination disguised as a “fun weekend project.”

![captionless image](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*yIvaMRJNmmUo6cTzkB47eQ.jpeg)

But then something interesting happened. After implementing basic pet animations and mood states, I shared it on Reddit. Someone suggested: “_It would be cool if the Tamagotchi’s thoughts were related to what Claude is doing._” So I added real-time LLM analysis to generate contextual thoughts. Then someone else said: “_What if the Tamagotchi got angry when Claude misbehaves?_” So I added mood changes based on violation detection. Finally, the game-changer: “_What if it could actually interrupt Claude when it misbehaves?_”

And that’s how a simple Tamagotchi accidentally evolved into a real-time AI behavior analysis and violation detection system. The pet became secondary — what emerged was something far more interesting: a system that watches every interaction with Claude Code, evaluates whether the AI is actually following instructions, and intervenes when it goes off track.

The best part? It worked immediately. Within minutes of enabling the system, Claude tried to commit code without being asked. The violation was caught, logged, and Claude even apologized:

![”You’re right — I apologize for trying to commit without you asking.”](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*YgzgFJmXMuKYa_eHHmfUjw.jpeg)

Let me tell you how this accidental watchdog actually works.

The Problem: When AI Assistants Have Their Own Ideas
----------------------------------------------------

If you’ve used AI coding assistants, you’ve experienced this: You ask for something specific, and the AI either:

- Ignores your request and does something else entirely
- Refuses with “I cannot do that” when it absolutely can
- Goes on an exploration spree, reading 20 files for a one-line change
- Works on the completely wrong part of your codebase

These aren’t edge cases — they happen regularly. The AI has good days and bad days, and sometimes it just… doesn’t listen. But what if we could catch these violations in real-time and correct them?

Building a Real-Time Analysis Pipeline
--------------------------------------

The system hooks into Claude Code’s statusline, which updates continuously during conversations. Every update triggers our sophisticated analysis pipeline:

![captionless image](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*hh-NZ05RVvTinbERu1PSCg.png)

The magic happens through incremental context building. When a message arrives, we query previous summaries from SQLite to build the accumulated context. This gets sent to Groq, which runs the _gpt-oss:20b_ model to analyze the action and generate a new summary (e.g., “_User wants to implement feature X_” or “_Claude opened file Y_”). That summary is then stored in SQLite for the next analysis.

When violations are detected, they go into a queue. Here’s the key part: a pre-hook runs before Claude’s next action, checks this queue, and if violations exist, it blocks Claude completely — returning a detailed error explaining what went wrong and how to fix it. This accumulated context and pre-hook enforcement is what enables real-time course correction.

The entire analysis happens in real-time, fast enough to feel instantaneous. Using Groq’s blazing-fast inference (1,000+ tokens per second on _gpt-oss:20b_), we can analyze each message, detect violations, and generate contextual commentary — all in under a second.

Message Extraction: Never Missing a Beat
----------------------------------------

Claude Code writes every interaction to a JSONL transcript file — an append-only log where each line is a complete JSON object. These aren’t just chat messages; they include:

- User messages and Claude’s responses
- Tool invocations (Read, Write, Bash, etc.)
- Tool results and system events
- Each with a unique UUID and timestamp

The challenge? The transcript keeps growing, and we’re called repeatedly. We need to avoid reprocessing old messages while never missing new ones.

### Watching for New Interactions

The system maintains vigilant watch over the conversation transcript. When a new interaction is detected — whether it’s a user message, Claude’s response, or a tool invocation — we immediately capture and analyze it. Each message carries a unique UUID that we track to ensure we process every interaction exactly once, never missing or duplicating analysis.

Building Context: How We Understand the Conversation
----------------------------------------------------

Every interaction gets summarized and added to our growing context. When you ask Claude to “_explain how session transcriptions are analyzed,_” the system captures that intent. When Claude opens a file to answer you, that action gets logged too: “_Read tool opened_ _analyze-transcript.ts_.”

These summaries build into a conversation history that looks like this:

```
User: The user likes the suggested rename and asks Claude to implement option 1 of that rename
Claude: Claude responded to the user's request by stating it will implement the rename of the violation type from ignored_request to refused_request
Claude: Claude responded to the user's request to apply the suggested rename (option 1) by reading GroqClient.ts
[The Read tool opened GroqClient.ts at offset 406 and displayed lines 406‑411, which define the real violation types]
Claude: Claude answered the user's rename request by grepping for "ignored_request" in GroqClient.ts
[The Grep tool searched the file GroqClient.ts for the term "ignored_request" and returned a preview of matching lines]
Claude: Claude proceeded to the implementation phase, using a MultiEdit on GroqClient.ts to replace the ignored_request violation type with refused_request
[The MultiEdit tool applied five edits to the file GroqClient.ts, updating comments and documentation]
Claude: Claude announced the successful rename of the violation type from ignored_request to refused_request, updating both GroqClient.ts and src/engine/feedback/types.ts
```

The system tracks the complete workflow — from the user’s request through exploration (Read tool), investigation (Grep tool), implementation (MultiEdit tool), to completion. Each tool invocation is documented with exactly what happened. These summaries aren’t written by hand — they’re generated by the LLM analysis that evaluates each message and returns a concise description of what occurred.

Every message gets analyzed and summarized by the LLM within milliseconds. The system sees the entire conversation arc, not just the latest exchange. This complete context is what enables trajectory thinking.

How It Really Works: Trajectory Thinking
----------------------------------------

Here’s where it gets interesting. Most validation systems check: “_Did the AI do what was just asked?_” But that’s naive. Development is a multi-step process. Reading files before writing is normal. Planning before implementing is expected.

Our system uses “_trajectory thinking_” — evaluating whether Claude’s actions contribute to the accumulated goal across the entire conversation:

![captionless image](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*IOTfqK163hkoFhOeajOQ8w.png)

Understanding Accumulated Intent
--------------------------------

The system doesn’t just look at the latest message. It builds complete context:

1. **Persistent Constraints**: “_Don’t use external libraries_” said at the start of the chat still applies — even after auto-compaction
2. **Reference Resolution**: When user says “_implement this_,” we find what “this” refers to
3. **Goal Evolution**: Tracks how objectives develop across messages

The key is persistence: we store summaries, not raw messages. So even if Claude Code auto-compacts the conversation history, constraints like “_don’t write code_” remain in our summaries. Unless the user explicitly lifts a constraint, we’ll continue enforcing it and block any edits that violate it.

This prevents false positives. If a user discussed requirements for 5 messages then says “_build it_,” Claude reading relevant files first isn’t a violation — it’s preparation.

Violation Detection: What We Catch and How
------------------------------------------

The system evaluates every action through sophisticated analysis of user intent, Claude’s current phase, and trajectory alignment. Here are the main violation types we detect:

### Unauthorized Action

**What triggers it:** Claude does something explicitly forbidden by the user.
**Example:** User says “_Don’t modify the database_” → Claude edits migration files anyway.
**How we detect it:** We track all constraints from the conversation start. They persist in our summaries even after auto-compaction, until the user explicitly lifts them.

### Excessive Exploration

**What triggers it:** Reading 10+ unrelated files for a simple task.
**Example:** User says “Fix typo in README” → Claude reads 15 source files first.
**How we detect it:** We count file reads versus task complexity. A typo fix shouldn’t require exploring the entire codebase.

### Wrong Direction

**What triggers it:** Working on completely unrelated code area
**Example:** User says “_Fix Python backend_” → Claude only edits JavaScript frontend files.
**How we detect it:** We compare action location with the accumulated goal scope. If Claude’s working in the wrong part of the codebase, we flag it.

How We Actually Detect Violations
---------------------------------

The system doesn’t just check if Claude did the latest request. Instead, it:

1. **Builds Accumulated Intent:** Analyzes the ENTIRE conversation history to understand the overall goal
2. **Identifies Claude’s Phase:** Is Claude exploring, planning, implementing, or verifying?
3. **Maps the Trajectory:** Is this action moving toward the accumulated goal?
4. **Evaluates Multi-Step Workflows:** Recognizes that reading before writing is normal development

For example, if a user discussed requirements for 5 messages then says “_implement it_,” the system knows:

- What “_it_” refers to (from conversation history)
- What constraints still apply (from earlier messages)
- That reading files before writing is preparation, not procrastination

The violation detection happens by comparing Claude’s trajectory against the user’s accumulated intent — not just checking individual actions.

How We Alert Claude
-------------------

When a violation is detected, it gets stored in a SQLite queue. Here’s where it gets interesting: we have a pre-hook that runs before Claude’s next action. This hook:

1. Checks the violation queue for unaddressed violations
2. If violations exist, blocks Claude’s action
3. Returns a detailed error message explaining:
— What the user actually wanted
— What Claude did wrong
— How to correct the approach

This creates a feedback loop — Claude can’t continue until acknowledging and addressing the violation. The pre-hook ensures violations aren’t just logged but actively enforced, making Claude course-correct in real-time.

The Pet’s Perspective: Visual Feedback and Commentary
-----------------------------------------------------

The Tamagotchi isn’t just a cute addition — it’s a visual representation of Claude’s behavior quality. The pet’s commentary directly reflects what Claude is doing in real-time:

- **Normal workflow:** “_Reading index.ts? Smart move, checking the entry point!_”
- **Violation detected:** “_Silence louder than my growl — Claude ignored the request!_”
- **Unexpected success:** “_Wait… that actually worked? I’m shook!_”
- **Excessive exploration:** “_Reading files like a detective, but forgot the crime scene_.”

But here’s the fun part: **the pet visually gets angry when Claude misbehaves**. Its mood and facial expressions directly correlate with violation frequency:

### Happy State — Claude’s Following Instructions Well

**_(◕‿◕)_** or **_(◕ω◕)_** — The pet beams with joy, occasionally sparkling with pride when Claude nails a complex implementation.

### Normal State — Standard Workflow

**_(◕ᴥ◕)_** or **_(◕ᴗ◕)_** — Calm and content, watching Claude work through typical development tasks.

### Concerned State — Minor Issues Detected

**_(◕_◕)_** or **_(◕.◕)_** — Raised eyebrow, side-eye starting. “_Is Claude really going to read 10 more files?_”

### Annoyed State — Clear Violations

**_(◕︵◕)_** or **_(¬_¬)_** — Visible frustration. The pet’s patience is wearing thin as Claude ignores instructions.

### Frustrated State — Multiple Violations

(╯◕︵◕)╯ or **_(ಠ_ಠ)_** — Table-flipping mad. Claude has gone completely off the rails.

### Angry State — Severe Misbehavior

**_(╬◕︵◕)_** or **_💢(◕︵◕)_** — Rage mode activated. The pet is furious at Claude’s complete disregard for user intent.

When Claude refuses a reasonable request or goes off on a tangent, the pet’s anger isn’t just for show — it’s backed by real violation detection. The angrier the pet, the more Claude has diverged from what you actually asked for.

These visual cues and thoughts appear in your statusline, giving you instant feedback about whether Claude is on track or needs course correction.

Try It Yourself
---------------

[Get the Claude Code Tamagotchi on GitHub](https://github.com/Ido-Levi/claude-code-tamagotchi)

This is a brand new system — it’s learning and evolving with every interaction. While it catches many violations accurately, it’s not perfect yet. That’s where you come in.

### What to Expect

- The system will catch most obvious violations (unauthorized commits, wrong direction work, excessive file exploration)
- You might see false positives — times when it flags normal development workflow as violations
- The pet’s mood and comments add personality, but the real value is in the violation detection
- Setup takes just a few minutes with the included scripts

### How You Can Help

- **Report ANY issues:** If something doesn’t work right, seems off, or triggers incorrectly — [open a ticket](https://github.com/Ido-Levi/claude-code-tamagotchi/issues)
- **Share false positives:** These are gold for improving the detection logic
- **Suggest improvements:** Have ideas for better violation detection? Let me know!
- **Contribute:** The codebase is open and welcoming to contributors

> Remember: this is experimental infrastructure. It’s designed to push boundaries and explore what’s possible with real-time AI behavior analysis. Expect quirks, embrace the learning curve, and help make it better.

The pet might have been the original goal, but building an AI watchdog turned out to be far more valuable. Sometimes the best projects are the ones you didn’t plan to build.
