# Four Additional Profile Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Generate self-hosted SVG equivalents for the four README cards other than Stats without modifying README.md.

**Architecture:** Reuse the existing TypeScript generator and Actions workflow. Add typed aggregate data fetchers, deterministic fixture data, four card models/renderers, and generate one SVG per card under `generated/`.

**Tech Stack:** Node.js 22, TypeScript, GitHub GraphQL API, inline SVG, Node test runner.

## Global Constraints

- README.md must not be modified.
- SVGs must be self-contained: no external CSS, images, JavaScript, or runtime server dependency.
- GitHub tokens must never appear in SVGs, logs, fixtures, or errors.
- Existing Stats behavior and tests must remain passing.
- Generated files must be committed by the existing GitHub Actions workflow.

## Tasks

### Task 1: Add shared card data and fixture aggregates

Extend typed data contracts and fixture values for profile details, repository languages, commit languages, and productive time. Add failing tests first, then minimal implementations.

### Task 2: Add GitHub GraphQL adapters

Add validated GraphQL fetchers for the four aggregates. Use contribution-calendar data for profile details, commit contribution timestamps for productive time, repository language edges for repository languages, and per-year commit contributions grouped by repository for commit languages. Keep errors sanitized and test each adapter with deterministic fetch mocks.

### Task 3: Add four card models and SVG renderers

Implement inline SVG renderers for profile details, repository-language donut, commit-language donut, and productive-time heatmap. Keep the blueberry palette and use escaped text plus deterministic geometry.

### Task 4: Wire generation, workflow, and verification

Generate all five SVGs locally, update the workflow to commit all generated cards, add integration tests, run the full suite/typecheck/generator, verify README.md is unchanged, then commit and push.
