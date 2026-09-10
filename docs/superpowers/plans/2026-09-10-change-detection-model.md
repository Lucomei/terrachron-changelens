# Change Detection Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submit a selected historical image and current POI context to an externally configured local model service and render its change-detection result.

**Architecture:** A model client owns the V1.0 multipart transport; a result adapter normalizes Markdown and JSON responses; the UI only reads the normalized result stored on its owning region. The endpoint remains optional and can be replaced by the model owner through an environment variable or client injection.

**Tech Stack:** Vue 3, Pinia, Vite, native Fetch and FormData, Node test runner, Playwright.

---

### Task 1: Model transport and POI payload

**Files:**
- Create: `src/services/model-client.js`
- Modify: `api/poi.js`
- Modify: `src/services/poi.js`
- Create: `tests/model-client.test.js`

- [ ] Write tests asserting `analyzeChange` sends `image`, `poi_data`, `image_meta`, `task_type`, `result_format` and `options`, and rejects a missing endpoint.
- [ ] Run `node --test tests/model-client.test.js` and confirm the missing module fails.
- [ ] Implement a configurable client, AMap raw POI preservation, and metadata mapping without placing a model URL in component code.
- [ ] Re-run the test and commit the transport slice.

### Task 2: Normalized change result

**Files:**
- Create: `src/services/change-result.js`
- Create: `tests/change-result.test.js`

- [ ] Write tests for JSON with `result.change`, generic JSON without a change extension, and Markdown reports.
- [ ] Run `node --test tests/change-result.test.js` and confirm it fails.
- [ ] Implement result normalization that never infers a change from generic findings.
- [ ] Re-run the test and commit the adapter slice.

### Task 3: Region state and public API

**Files:**
- Modify: `src/stores/workspace.js`
- Modify: `src/api.js`
- Modify: `src/main.js`
- Modify: `tests/workspace.test.js`

- [ ] Write a failing state-isolation test for a model request belonging to its region.
- [ ] Implement cancellable model request state plus public `analyzeChange`, `checkModelHealth` and `getModelInfo` methods.
- [ ] Run affected Node tests and commit the state slice.

### Task 4: Detection action and result rendering

**Files:**
- Create: `src/components/ModelResultDialog.vue`
- Modify: `src/components/RegionPanel.vue`
- Modify: `src/App.vue`
- Modify: `src/assets/styles.css`
- Modify: `tests/browser.spec.js`

- [ ] Update browser fixtures and assertions for unavailable endpoint, submit action, JSON result and model error.
- [ ] Run the focused Playwright test and confirm it fails before UI implementation.
- [ ] Add the per-region action, progress state and resizable result dialog.
- [ ] Run the browser suite, inspect the screenshot and commit the UI slice.

### Task 5: Handoff documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/api.md`
- Modify: `docs/agents/issue-tracker.md`

- [ ] Document `VITE_MODEL_API_BASE`, CORS requirements, optional client injection, request fields and result compatibility rules.
- [ ] Run `npm test`, `npm run build` and `npm run test:e2e`.
- [ ] Commit release documentation and record the handoff state.
