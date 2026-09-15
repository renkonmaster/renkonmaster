# Upstream-Faithful Profile Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate five repository-owned SVG cards that closely reproduce the upstream `blueberry` cards and update them daily without changing README.md.

**Architecture:** Keep the existing typed GitHub data adapters and deterministic fixture mode. Port the upstream card geometry and theme into focused, self-contained SVG renderers, then make the workflow validate its user token and generate all five files.

**Tech Stack:** Node.js 22, TypeScript, GitHub GraphQL API, inline SVG, Node test runner, GitHub Actions

## Global Constraints

- README.md must not be modified.
- Private repository data and Private-derived aggregate values must not be fetched or rendered.
- SVGs must contain no external CSS, images, fonts, JavaScript, or runtime service dependency.
- `PROFILE_GITHUB_TOKEN` must never appear in source, generated files, fixtures, errors, or logs.
- The five output names under `generated/` remain unchanged.
- Productive Time uses UTC+9.

---

## File Structure

- `src/render/theme.ts`: shared blueberry colors, typography, card shell, formatting helpers.
- `src/render/profile-details.ts`: upstream-faithful wide contribution card.
- `src/render/language.ts`: shared language donut renderer for both language cards.
- `src/render/productive-time.ts`: productive-time radial chart renderer.
- `src/render/svg.ts`: existing Stats renderer, updated only where shared helpers preserve its output.
- `src/data/github.ts`: public-only GraphQL queries and safe operation-aware errors.
- `src/generate.ts`: five-card orchestration.
- `tests/render-reference.test.ts`: geometry/theme regression tests.
- `tests/github.test.ts`: public-only filtering and safe diagnostics tests.
- `tests/generate.test.ts`: five-file integration test.
- `.github/workflows/generate-cards.yml`: token validation, daily generation, commit.

### Task 1: Capture the upstream visual contract

**Files:**
- Create: `src/render/theme.ts`
- Create: `tests/render-reference.test.ts`
- Modify: `src/render/svg.ts`

**Interfaces:**
- Produces: `BLUEBERRY_THEME`, `CARD_FONT`, `svgCardStart(width, height)`, `svgCardEnd()`.
- Consumes: the upstream MIT-licensed blueberry theme and SVG templates as reference material.

- [ ] **Step 1: Record exact upstream constants**

Read the upstream theme and five template files completely. Record card dimensions, background/title/text/icon colors, font stack, chart radius, label positions, and number formatting in assertions in `tests/render-reference.test.ts`.

- [ ] **Step 2: Run the regression test and verify failure**

Run: `npm test -- tests/render-reference.test.ts`

Expected: FAIL because `src/render/theme.ts` and the reference renderers do not exist.

- [ ] **Step 3: Implement shared theme primitives**

Export the exact constants and a self-contained card shell from `src/render/theme.ts`. Reuse them from the Stats renderer only if `generated/profile-stats.svg` remains byte-for-byte stable.

- [ ] **Step 4: Verify the contract and Stats regression**

Run: `npm test -- tests/render-reference.test.ts tests/svg.test.ts`

Expected: PASS, with the Stats fixture output unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/render/theme.ts src/render/svg.ts tests/render-reference.test.ts
git commit -m "test: capture upstream card visual contract"
```

### Task 2: Rebuild the four incomplete renderers

**Files:**
- Create: `src/render/profile-details.ts`
- Create: `src/render/language.ts`
- Create: `src/render/productive-time.ts`
- Modify: `src/generate.ts`
- Modify: `tests/additional.test.ts`
- Modify: `tests/render-reference.test.ts`

**Interfaces:**
- Consumes: `ProfileDetailsCardModel`, `LanguageCardModel`, `ProductiveTimeCardModel`, and shared theme primitives.
- Produces: `renderProfileDetailsSvg(model)`, `renderLanguageSvg(model)`, `renderProductiveTimeSvg(model)`.

- [ ] **Step 1: Add failing layout assertions**

Assert the exact width/viewBox, titles, key coordinates, chart primitives, top-language percentage labels, contribution-calendar layout, productive-time radial segments, and absence of external references for all four cards.

- [ ] **Step 2: Verify the assertions fail against current renderers**

Run: `npm test -- tests/additional.test.ts tests/render-reference.test.ts`

Expected: FAIL because the current custom donut, bar chart, and profile layout differ from upstream.

- [ ] **Step 3: Implement the profile-details renderer**

Port the upstream wide-card structure using local SVG primitives, deterministic contribution cells, escaped user text, and fixture data.

- [ ] **Step 4: Implement the shared language renderer**

Port the upstream donut geometry, legend ordering, percentage/value formatting, and overflow behavior. Use the same renderer for `most-commit-language` and `repos-per-language` with their distinct titles.

- [ ] **Step 5: Implement the productive-time renderer**

Replace the 24-column bar chart with the upstream radial time distribution, UTC+9 label, total commit count, and busiest-hour annotation.

- [ ] **Step 6: Wire the focused renderers into generation**

Update imports in `src/generate.ts`; remove `src/render/additional.ts` only after `rg` confirms no remaining imports.

- [ ] **Step 7: Verify all renderer tests pass**

Run: `npm test -- tests/additional.test.ts tests/render-reference.test.ts tests/svg.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/render src/generate.ts tests/additional.test.ts tests/render-reference.test.ts
git commit -m "feat: faithfully render all profile cards"
```

### Task 3: Make public-data collection and failures deterministic

**Files:**
- Modify: `src/data/github.ts`
- Modify: `tests/github.test.ts`
- Modify: `.github/workflows/generate-cards.yml`

**Interfaces:**
- Consumes: `PROFILE_GITHUB_TOKEN` as `GITHUB_TOKEN` in the generator process.
- Produces: public-only aggregates and sanitized errors naming the failed GraphQL operation.

- [ ] **Step 1: Add failing API safety and diagnostic tests**

Add tests proving private repositories are excluded, public fields retain upstream semantics, an invalid token yields a safe authentication classification, and a GraphQL failure identifies the operation without including response text or token values.

- [ ] **Step 2: Reproduce the existing failure classification**

Run: `npm test -- tests/github.test.ts`

Expected: FAIL because `requestGraphql` currently emits only the generic `GitHub GraphQL request failed` message.

- [ ] **Step 3: Add operation-aware sanitized errors**

Pass a fixed operation name into `requestGraphql`. Preserve HTTP status and safe GraphQL error type/code while discarding upstream message text and variables.

- [ ] **Step 4: Validate the token before card generation**

Add a workflow step that fails clearly when `PROFILE_GITHUB_TOKEN` is absent and runs a minimal authenticated GraphQL viewer query without printing its value or response payload.

- [ ] **Step 5: Verify API and workflow behavior locally**

Run: `npm test -- tests/github.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/github.ts tests/github.test.ts .github/workflows/generate-cards.yml
git commit -m "fix: diagnose profile card GraphQL failures safely"
```

### Task 4: Generate, compare, and validate all five cards

**Files:**
- Modify: `generated/profile-details.svg`
- Modify: `generated/most-commit-language.svg`
- Modify: `generated/repos-per-language.svg`
- Modify: `generated/profile-stats.svg` only if live public values changed
- Modify: `generated/productive-time.svg`
- Modify: `tests/generate.test.ts`

**Interfaces:**
- Consumes: all five public-data adapters and renderers.
- Produces: the five committed SVG artifacts.

- [ ] **Step 1: Extend the five-file integration test**

Assert fixture generation returns exactly the five expected paths and every file has a valid matching `viewBox`, title, closing `</svg>`, and no external reference.

- [ ] **Step 2: Verify the integration test fails if any artifact contract differs**

Run: `npm test -- tests/generate.test.ts`

Expected: FAIL before regenerated outputs or contract updates are complete.

- [ ] **Step 3: Generate fixture SVGs**

Run: `DATA_SOURCE=fixture GITHUB_USERNAME=renkonmaster npm run generate`

- [ ] **Step 4: Render PNG previews and compare with upstream cards**

Render local and upstream-reference SVGs at their intrinsic dimensions. Compare dimensions, bounding boxes, palette, typography, and chart geometry; adjust only mismatches covered by regression assertions.

- [ ] **Step 5: Run the complete local verification**

Run: `npm test && npm run typecheck && git diff --check`

Expected: all commands succeed.

- [ ] **Step 6: Verify forbidden changes and secrets**

Run: `git diff --exit-code HEAD -- README.md` and scan tracked/generated diffs for token-like strings and external resource references.

Expected: README has no diff; no secret or external SVG dependency is present.

- [ ] **Step 7: Commit generated artifacts**

```bash
git add generated tests/generate.test.ts
git commit -m "chore: regenerate faithful profile cards"
```

### Task 5: Verify GitHub Actions end to end

**Files:**
- No source changes expected; if the live run exposes a new defect, return to Task 3 with a failing test first.

**Interfaces:**
- Consumes: committed workflow and `PROFILE_GITHUB_TOKEN` Repository Secret.
- Produces: a successful `workflow_dispatch` run and, when data changed, an automated generated-card commit.

- [ ] **Step 1: Push the implementation commits**

Push the current branch only after confirming the target branch and remote are correct.

- [ ] **Step 2: Dispatch the workflow**

Run: `gh workflow run generate-cards.yml --repo renkonmaster/renkonmaster`

- [ ] **Step 3: Watch the run to completion**

Run: `gh run watch --repo renkonmaster/renkonmaster --exit-status <run-id>`

Expected: success through tests, typecheck, generation, and conditional commit.

- [ ] **Step 4: Inspect generated-file changes**

Confirm the workflow changed only `generated/*.svg`, or made no commit when live output was unchanged.

- [ ] **Step 5: Final verification**

Run: `npm test && npm run typecheck && git status --short`

Expected: tests and typecheck pass; only intentional implementation changes remain.
