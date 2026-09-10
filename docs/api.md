# TerraChron 对外接口

界面使用与外部调用相同的 API。应用挂载后可访问 `window.terrachron`；模块集成可从 `src/api.js` 导入 `createTerraChronApi(pinia)`。

## 建立区域并获取最新影像

```js
const api = window.terrachron;
const region = await api.createRegion({ center: [121.4737, 31.2304] });
if (region.latest.status !== 'ready') throw new Error(region.latest.error);
const current = await api.getImageAsset({ regionId: region.id });
// current.blob: image/png Blob；current.url: 仅此页面有效的预览 URL。
```

`center` 是 `[经度, 纬度]`，WGS84。固定地面尺寸 256 米、512 像素输出；无任意尺寸参数。`createRegion` 返回区域状态，包括 id、名称、颜色、中心、GeoJSON 边界、投影、范围、最新截取和历史状态。创建时坐标非法会抛错，网络截取错误记录在 `latest.status/error`，便于保留区域重试。

`await api.refreshLatest(regionId)` 重试或刷新当前截取，历史结果不变。`api.cancel(regionId, 'latest')` 取消截取。

## 按时间点获取最近历史影像

界面和新集成应使用 `fetchClosestHistory`。`year` 必填；`month`、`day` 允许留空，填写 `day` 前必须填写 `month`。年、月精度分别使用当年 7 月 1 日、当月 15 日作为匹配点，完整日期按当天匹配；返回实际拍摄日期距离最短的一条记录。

```js
const history = await api.fetchClosestHistory({
  regionId: region.id,
  timePoint: { year: '2020', month: '07', day: '' },
});
const closest = history.closest;
// closest.observation 是记录，closest.capturedAt 是实际拍摄日期。
```

首次截取还会经同源 `/api/poi` 查询周边描述，结果保存在 `region.poi`。Vercel 项目必须配置服务器环境变量 `AMAP_API_KEY`；该值不属于前端环境变量，不能以 `VITE_` 开头。

## 本地模型变化检测接口

模型服务由甲方在本地部署，前端不保存模型 URL 以外的凭据。设置 `VITE_MODEL_API_BASE` 后，区域卡片中的“模型变化检测”会调用 `${VITE_MODEL_API_BASE}/analyze`；未设置时按钮保持禁用。

```js
const analysis = await api.analyzeChange({
  regionId: region.id,
  taskType: 'comprehensive',
  resultFormat: 'json',
});
// analysis.status: idle | loading | ready | error | cancelled
// analysis.result: 标准化后的 Markdown 或 JSON 结果
```

请求为 `multipart/form-data`，字段与甲方 V1.0 文档一致：

| 字段 | 内容 |
| --- | --- |
| `image` | 已选择历史记录的 PNG 文件 |
| `poi_data` | `{ pois: [...] }`；包含当前区域地址、POI 原始上下文和来源信息 |
| `image_meta` | `bbox: [minLon, minLat, maxLon, maxLat]`、`crs: EPSG:4326`、历史拍摄日期、来源和 0.5 m/pixel 采样间距 |
| `task_type` | 默认 `comprehensive`，可改为服务端支持的任务 |
| `result_format` | `json` 或 `markdown` |
| `options` | 中文输出、置信度、区域和 POI 分析开关 |

成功响应必须为 `{ code: 0, request_id, data }`。`data.result_format === 'markdown'` 时前端保留报告文本；JSON 结果显示摘要和 findings。只有模型明确返回 `data.result.change` 时，前端才显示“是否变化”“变化前类型”和“变化后类型”；通用分析结果不会被前端擅自解释为变化结论。

可供宿主或桌面桥接调用的方法：

```js
await api.checkModelHealth();
await api.getModelInfo();
await api.analyzeChange({ regionId });
```

`createTerraChronApi(pinia, { modelClient })` 接受替代客户端。甲方可注入其本地桥接、认证或测试实现，保持界面、区域状态和结果渲染不变。

## 旧版区间查询兼容接口

```js
const history = await api.queryHistory({
  regionId: region.id,
  startDate: '2018-01-01',
  endDate: '2024-12-31',
  providerId: 'esri-wayback',
});
if (history.status === 'error') throw new Error(history.error);
const records = history.observations;
const unknownDates = history.unknown;
```

日期采用 `YYYY-MM-DD`，起止日期均包含。先发现区域的变化版本，再查询每个版本的拍摄元数据；发布日期不作为拍摄过滤条件。多日期拼接中任一日期匹配即返回，同时 `partialDateMatch` 标明是否有日期超出区间。

返回 `status`（idle/loading/ready/error/cancelled）、`observations`、`unknown`、`warnings`、`queryRange` 与进度。界面查询面板仅展示摘要，成功后“查看历史影像”打开独立可拉伸分页浮窗，每页最多 5 条；服务失败保留原有结果和原查询范围，状态变为 error；元数据单条失败作为 unknown 和 warnings 返回。用 `api.cancel(regionId)` 取消历史查询；同一区域开始新查询会取消前一个。

每条记录保留 `id`、`regionId`、`providerId`、`releaseId`、`capturedAt`（单一日期或 null）、`capturedDates`（全部已知日期）、`publishedAt`、`metadata`、`tileTemplate`、署名及查询范围。`metadata.sources` 含拍摄来源、原始字段和相交多边形；`hasUnknownDates` 标明有未知拍摄时间的覆盖。

## 获取可传递文件

```js
const controller = new AbortController();
const asset = await api.getImageAsset({
  regionId: region.id,
  observationId: records[0].id,
  signal: controller.signal,
});
// asset.blob 可直接作为 FormData 的文件部分发送。
// asset.source 是来源瓦片模板，asset.zoom 是取样层级。
```

不传 `observationId` 得到当前截取，传历史 id 得到独立历史 PNG。图片文件按需生成并缓存到当前区域。区域被删除或传入 signal 取消时，不继续写入其图像状态。错误抛出，不返回伪图片。

## 导出或发送

```js
const selection = {
  regionIds: [region.id],
  observationIds: records.slice(0, 2).map((record) => record.id),
};
const pkg = await api.exportSelection(selection);
// pkg.zip: application/zip Blob
// pkg.manifest: 可序列化对象
// pkg.files: [{ path, blob }]

await api.sendSelection({
  ...selection,
  endpoint: 'https://your-service.example/imagery',
});
```

每个选中区域始终包括当前截取。省略 `observationIds` 使用界面勾选的历史记录；传空数组仅导出当前截取。可在第二参数传 `{ signal, onProgress }`；`onProgress` 收到 `{ done, regionName }`。

ZIP 中 `manifest.json` 使用 `version: '1.0'`、`crs: 'EPSG:4326'`，包含 regions/images 数组。

- regions：id、name、color、center、geometry、bbox、sizeMeters、outputSize、pixelProjection、localExtent、queryRange。
- images：regionId、observationId、kind、file、mimeType、byteLength、providerId、releaseId、capturedAt、capturedDates、publishedAt、snapshotAt、metadata、queryRange、source、sourceZoom、attribution。

像素左上角对应 localExtent 的 `[-128, 128]`，像素步长为 `[0.5, -0.5]` 米，投影由 `pixelProjection` 定义。GeoJSON 边界是 WGS84。PNG 是渲染 RGB 影像，不是原始多光谱 GeoTIFF。

当前截取的 `capturedAt` 为 null：其生成时间记录为 snapshotAt，绝不冒充拍摄日期。元数据相交结果可能重叠，不宣称每个像素都有唯一日期。

## HTTP 接收契约

请求：`POST <endpoint>`，浏览器自动设置 `multipart/form-data; boundary=...`。

| 字段     | 类型           | 含义                                            |
| -------- | -------------- | ----------------------------------------------- |
| manifest | JSON 字符串    | 与 ZIP 相同的清单                               |
| fileMap  | JSON 字符串    | 清单 file 路径到 multipart 文件名的映射         |
| files    | 可重复文件字段 | 真实 PNG 二进制，路径 `/` 在文件名中替换为 `__` |

接收服务需允许前端站点 Origin。非 2xx 响应被视为失败；成功返回 `{ status, body }`，body 为接收端响应文本。系统不自动重试 POST，以免重复提交。

Python 接收端的最小解析示例（集成说明，应用不会启动此后端）：

```python
import json
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3100"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

@app.post("/imagery")
async def receive(
    manifest: str = Form(...),
    fileMap: str = Form(...),
    files: list[UploadFile] = File(...),
):
    metadata = json.loads(manifest)
    mapping = json.loads(fileMap)
    payloads = {file.filename: await file.read() for file in files}
    images = [(image, payloads[mapping[image["file"]]]) for image in metadata["images"]]
    # images 中每项是 (影像元数据, PNG bytes)，可传给你的分析逻辑。
    return {"received": len(images), "version": metadata["version"]}
```

`api.getRegions()` 获取当前区域列表（id、名称、颜色、中心、GeoJSON 范围）。`src/services/history.js` 和 `src/services/transfer.js` 也可独立导入；第三方影像适配器实现 `id/label/discover/metadata`，记录提供对应的瓦片模板。
