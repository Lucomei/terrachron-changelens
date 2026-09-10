# Change Detection Model Integration Design

## Goal

Let each region submit its selected historical image, current POI context and WGS84 image metadata to an externally configured local model service. The model service uses Qwen 2.5 or another implementation behind the supplied V1.0 REST contract to determine whether the area changed and, when supported by the response, describe the change from its prior state to its current state.

## Boundaries

The frontend does not run a model, estimate pixel-feature differences, infer a change when the model does not say so, or expose a model endpoint publicly. It supplies the historical image and present-day POI context to the configured service. The app continues to run with no endpoint configured so the source can be handed to the model owner before their local service is available.

## Request Contract

`src/services/model-client.js` will own all HTTP transport. Its `analyzeChange` method sends the document's `multipart/form-data` fields to `${VITE_MODEL_API_BASE}/analyze`:

- `image`: cached PNG for the chosen historical observation.
- `poi_data`: a JSON `{ pois: [...] }` payload built from AMap's reverse-geocode POIs, AOIs and roads, preserving raw properties. The existing text summary remains display-only.
- `image_meta`: region `bbox`, `EPSG:4326`, historical `captured_at`, imagery source and estimated ground sampling distance.
- `task_type`: `comprehensive` by default; the client accepts a supported task override.
- `result_format`: `json` by default; the client supports `markdown` without a special network path.
- `options`: Chinese output plus confidence, region and POI analysis flags.

Model health and model-info helpers use the same base URL. A blank base URL produces a local, actionable configuration error and makes the detection action unavailable.

## Result Contract

`src/services/change-result.js` will turn both documented result formats into a view model. `markdown` is retained as plain report text. JSON always exposes the generic summary, findings, regions, artifacts and inference metadata. If a future adapter provides `result.change`, its `changed`, `before_type`, `after_type`, `description`, `confidence` and optional regions are shown as the primary change conclusion. If that extension is absent, the UI labels the generic model result as analysis rather than claiming a detected change.

## User Flow

After a region has a historical preview, its card shows “模型变化检测”. Clicking it sends the selected historical image and current POI context. The button shows the request state and prevents duplicate submission. A resizable result dialog presents the historical image, selected date, current POI summary, request ID, model duration and either the change conclusion, structured findings, artifact links or Markdown report. Errors preserve the existing historical image and POI state.

## Public API

The app exposes `window.terrachron.analyzeChange({ regionId, taskType, resultFormat, signal })`, `checkModelHealth()` and `getModelInfo()`. Consumers can replace the `modelClient` dependency during app construction for non-browser transport, test doubles or a local desktop bridge.

## Verification

Unit tests cover exact multipart fields, WGS84 bbox ordering, no-endpoint failure and both response formats. Browser tests cover the unavailable state, successful JSON result rendering and error presentation through explicit network fixtures. Build and existing image-history tests remain green.
