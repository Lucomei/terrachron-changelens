# Region POI and Time Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move historical-image selection into each region card, attach a server-side AMap POI summary, and choose the closest historical observation for one optional-precision time point.

**Architecture:** Add a pure temporal domain module that validates year/month/day input and ranks discovered Esri observations by distance from its derived calendar date. Keep the AMap key inside a Vercel `/api/poi` function; the browser calls only the same-origin endpoint. Region state owns POI, the selected time point, and the one selected historical preview, while the old global time panel is removed.

**Tech Stack:** Vue 3, Pinia, Vite, Vercel Functions, native `fetch`, Node test runner, Playwright.

---

### Task 1: Time-point domain behavior

**Files:**
- Create: `src/domain/timepoint.js`
- Create: `tests/timepoint.test.js`

- [ ] **Step 1: Write failing tests** for year-only, year-month, full-date normalization; reject a day without a month; select the nearest known captured date.
- [ ] **Step 2: Run** `node --test tests/timepoint.test.js` and confirm missing-module failure.
- [ ] **Step 3: Implement** `normalizeTimePoint(input)` and `findClosestObservation(observations, input)` without any provider or UI dependency.
- [ ] **Step 4: Run** `node --test tests/timepoint.test.js` and confirm pass.

### Task 2: POI service boundary

**Files:**
- Create: `api/poi.js`
- Create: `src/services/poi.js`
- Create: `tests/poi.test.js`

- [ ] **Step 1: Write failing tests** for client request encoding and text summary construction.
- [ ] **Step 2: Run** `node --test tests/poi.test.js` and confirm missing-module failure.
- [ ] **Step 3: Implement** same-origin client fetching plus a Vercel handler that converts WGS84 to GCJ-02 and reverse-geocodes it with `process.env.AMAP_API_KEY`.
- [ ] **Step 4: Run** `node --test tests/poi.test.js` and confirm pass.

### Task 3: Region-owned query state

**Files:**
- Modify: `src/services/history.js`
- Modify: `src/stores/workspace.js`
- Modify: `src/api.js`
- Modify: `tests/history.test.js`
- Modify: `tests/workspace.test.js`

- [ ] **Step 1: Write failing tests** for nearest historical selection and isolated POI/time-point state.
- [ ] **Step 2: Run** the affected tests and confirm the expected failures.
- [ ] **Step 3: Implement** discovery reuse, nearest result assignment, POI loading, cancellation, and hidden latest-image capture.
- [ ] **Step 4: Run** all Node tests and confirm pass.

### Task 4: Region card interaction

**Files:**
- Modify: `src/components/RegionPanel.vue`
- Modify: `src/App.vue`
- Modify: `src/assets/styles.css`
- Delete: `src/components/HistoryPanel.vue`
- Delete: `src/components/HistoryResultsDialog.vue`
- Modify: `tests/browser.spec.js`

- [ ] **Step 1: Update the browser test first** to expect a POI description, year/month/day controls in the card, a disabled history button before year selection, and a nearest historical preview after the query.
- [ ] **Step 2: Run** `npm run test:e2e` and confirm old UI expectations fail.
- [ ] **Step 3: Implement** card-local controls and concise POI text with a native hover title; remove the right time panel and its history-list dialog; retain historical-vs-current comparison.
- [ ] **Step 4: Run** Node tests, production build, and Playwright suite; inspect screenshots.

### Task 5: Interface documentation and deployment

**Files:**
- Modify: `docs/api.md`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Document** `fetchClosestHistory`, POI state, and the required server environment variable `AMAP_API_KEY` without recording a key in Git.
- [ ] **Step 2: Run** `npm test`, `npm run build`, and `npm run test:e2e`.
- [ ] **Step 3: Commit** the implementation, deploy with `vercel --prod`, and verify the production URL returns HTTP 200.
