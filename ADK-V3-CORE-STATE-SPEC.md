# ADK v3: Core State & Anti-Stub System Architecture

**Status:** Planned vs. Actual Analysis
**Date:** 2026-02-02
**Context:** Separation of concerns for ADK v3 (Session Persistence & Quality Assurance)

---

## 1. System: Core State (Tier 1 Memory)

The "Core State" is the fundamental solution to **Context Drift**. In long-running agent sessions, the model "forgets" specific details (like which file is currently being edited) as the context window fills up with chat history.

### 1.1 The Planned Architecture (Ideal)

* **Concept:** A "Working Memory" (RAM) separate from the "Long-term Memory" (Disk/Markdown).
* **Format:** A lightweight, highly structured JSON object.
* **Injection Strategy:** Injected into the **System Prompt** (top-level instruction) at every single turn, ensuring the model always knows its immediate reality.
* **Artifact Location:** `.claude/plans/features/{feature_name}/memory/core-state.json`

#### Planned Data Structure

```typescript
interface CoreState {
  // 1. Where am I?
  currentTask: {
    id: string;          // e.g., "task-1.2-implement-auth"
    status: 'in_progress' | 'verifying' | 'blocked';
    startedAt: string;
  };

  // 2. What am I touching? (Session Context)
  sessionFiles: {
    path: string;        // e.g., "src/auth/login.ts"
    operation: 'read' | 'edit' | 'create';
    lastModified: string;
  }[];

  // 3. What did I just decide? (Short-term Decision Log)
  // Keeps the last ~5 critical micro-decisions to prevent looping.
  recentDecisions: string[];

  // 4. Hard Constraints (Active Rules)
  constraints: string[]; // e.g., ["NO_MOCK_DATA", "USE_ZOD_VALIDATION"]
}
```

### 1.2 The Current Reality (Codebase Status)

* **Existing Components:**
  * `src/utils/state-manager.ts`: Manages `state.json`, but this tracks **high-level progress** (Project/Feature/Phase), not immediate session context.
  * `src/utils/tiered-memory.ts`: Implements a 4-tier memory (Project > Feature > Phase > Session), but it relies on **concatenating Markdown files**. It does not support the structured JSON injection required for Core State.
* **Missing Components:**
  * ❌ `src/utils/memory/core-state.ts`: The logic to read/write/update the specific JSON structure above is missing.
  * ❌ **System Prompt Injection:** `src/utils/claude-v3.ts` does not yet have logic to read `core-state.json` and insert it into the `system` parameter of the API call.

---

## 2. System: Anti-Stub (Quality Assurance)

The "Anti-Stub" system is a set of **active protocols** designed to prevent "Lazy Coding"—the tendency of LLMs to generate comments like `// TODO: Implement logic` instead of actual code.

### 2.1 The Planned Architecture (Ideal)

This system operates on two levels: **Prevention** (Prompts) and **Interception** (Middleware).

#### Level 1: "Read-Before-Write" Protocol

* **Rule:** The Agent is mechanically forbidden from overwriting a file (`write_file`) unless it has explicitly read it (`read_file`) within the current session history.
* **Goal:** Prevents the agent from hallucinating file content and overwriting valid code with stubs.

#### Level 2: Real-time Output Validation

* **Rule:** Before any tool output is accepted or file is saved, the system scans the content for "Stub Patterns".
* **Patterns to Block:**
  * `// TODO` / `// FIXME`
  * `throw new Error("Not implemented")`
  * `return null; // Placeholder`
  * Function bodies containing only `...` or `pass`.

### 2.2 The Current Reality (Codebase Status)

* **Existing Components:**
  * `src/utils/quality-gates.ts`: Contains logic to *calculate* risk and technical debt, but it is **passive** (used for generating reports), not active blocking.
  * `src/utils/ai-review.ts`: Compares two AI outputs, but focuses on "Agreement" rather than stub detection.
* **Missing Components:**
  * ❌ `src/utils/memory/anti-stub.ts` (or similar): No module exists to define and enforce these blocking regex patterns.
  * ❌ **Middleware Interceptor:** The execution loop in `src/utils/claude-v3.ts` simply passes output through. There is no step that says "If output contains stub, reject and ask AI to fix".
  * ❌ **Prompt Integration:** The system prompts are currently generic. They lack the specific "Anti-Stub" directive module.

---

## 3. Implementation Plan (Next Steps)

To realize the v3 vision, the following tasks must be executed:

### Step 1: Core State Implementation

1. **Create Module:** `src/utils/memory/core-state.ts`.
2. **Define Interface:** Implement the `CoreState` TS interface.
3. **Hook into CLI:** Update `src/commands/feature-v3.ts` to initialize this state on startup.

### Step 2: Anti-Stub Middleware

1. **Define Rules:** Create `src/utils/prompts/anti-stub.ts` with strict system instructions.
2. **Create Validator:** Implement a function `validateOutput(content: string): { valid: boolean; error?: string }`.
3. **Integrate Loop:** Modify `executeClaudeCommandV3` to run this validator. If it fails, send the error back to the model automatically (Self-Correction Loop).

### Step 3: Prompt Engineering

1. Modify the system prompt generation to explicitly include:

    ```xml
    <core-state>
    { ...json... }
    </core-state>

    <anti-stub-protocol>
    ACTIVE. You are forbidden from creating todos.
    </anti-stub-protocol>
    ```
