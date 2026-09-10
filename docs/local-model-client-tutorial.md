# 甲方本地模型客户端接入教程

本教程说明如何把甲方本地部署的变化检测模型接入 TerraChron ChangeLens。完成后，用户在 `03 / MODEL` 面板点击“发送模型请求”，前端会自动选择甲方本地模型，而不再调用 Agnes 演示代理。

## 你需要准备什么

- 一台能运行甲方模型服务的机器。
- Node.js 22.12+，用于运行前端。
- 浏览器能访问模型服务地址。例如前端运行在 `http://127.0.0.1:3100`，模型服务运行在 `http://127.0.0.1:8000`。

模型服务应提供：

```text
POST http://127.0.0.1:8000/api/v1/analyze
```

## 第一步：配置前端

在项目根目录复制环境变量示例：

```powershell
Copy-Item .env.example .env.local
```

编辑 `.env.local`：

```env
VITE_MODEL_API_BASE=http://127.0.0.1:8000/api/v1
```

重新启动前端：

```powershell
npm run dev
```

看到 `VITE_MODEL_API_BASE` 后，前端会优先使用本地模型客户端。该变量只是浏览器访问地址，不能填写 Token、密码或 API Key。

## 第二步：允许浏览器跨域访问

本地模型服务需要允许前端 Origin，否则浏览器会在请求发出前拦截。FastAPI 示例：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3100"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

如果前端部署在其他域名，请将实际前端域名也加入 `allow_origins`。

## 第三步：实现 `/analyze`

前端调用 `src/services/model-client.js`，以 `multipart/form-data` 发送以下字段：

| 字段            | 必填 | 内容                                      |
| --------------- | ---- | ----------------------------------------- |
| `image`         | 是   | 历史影像 PNG 文件                         |
| `poi_data`      | 是   | 当前区域 POI JSON                         |
| `image_meta`    | 是   | 历史影像 WGS84 范围、日期、来源、像元间距 |
| `task_type`     | 是   | 默认 `comprehensive`                      |
| `result_format` | 是   | 默认 `json`                               |
| `options`       | 是   | 中文、置信度、区域、POI 分析开关          |

历史影像文件名形如 `region_01_historical_2019-11-09.png`。`poi_data` 始终表示**当前** POI。前端不会将当前 POI 声称为历史 POI。

FastAPI 最小实现：

```python
import json
from fastapi import FastAPI, File, Form, UploadFile

app = FastAPI()

@app.post('/api/v1/analyze')
async def analyze(
    image: UploadFile = File(...),
    poi_data: str = Form(...),
    image_meta: str = Form(...),
    task_type: str = Form('comprehensive'),
    result_format: str = Form('json'),
    options: str = Form('{}'),
):
    historical_png = await image.read()
    pois = json.loads(poi_data)
    metadata = json.loads(image_meta)
    # 在这里调用甲方模型。historical_png 是历史影像；pois 是当前 POI。
    return {
        'code': 0,
        'message': 'success',
        'request_id': 'local-example-001',
        'data': {
            'task_type': task_type,
            'result_format': result_format,
            'result': {
                'change': {
                    'changed': True,
                    'before_type': '绿地',
                    'after_type': '建设用地',
                    'description': '模型的中文判断说明。',
                    'confidence': 0.91,
                },
                'findings': [],
            },
            'meta': {'model_version': 'client-local-model'},
        },
    }
```

## 第四步：返回格式

成功响应必须使用 HTTP 200，并且顶层 `code` 为 `0`：

```json
{
  "code": 0,
  "request_id": "request-id",
  "data": {
    "result_format": "json",
    "result": {
      "change": {
        "changed": true,
        "before_type": "绿地",
        "after_type": "建设用地",
        "description": "变化说明",
        "confidence": 0.91
      },
      "findings": []
    },
    "meta": { "model_version": "client-local-model" }
  }
}
```

`result.change` 是显示“是否变化、变化前、变化后”的依据。没有 `change` 时，前端只显示通用模型分析，不会擅自断定发生变化。

## 第五步：接入历史 POI（可选）

项目没有可信历史 POI 数据源时不会发送历史 POI。甲方接入自己的历史 POI 服务后，可在宿主代码中注入：

```js
import { createPinia } from 'pinia';
import { createTerraChronApi } from './src/api.js';

const api = createTerraChronApi(createPinia(), {
  historyPoiLookup: async ({ region, observation, signal }) => {
    const response = await fetch('http://127.0.0.1:9000/history-poi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        center: region.center,
        bbox: region.bbox,
        date: observation.capturedAt,
      }),
      signal,
    });
    if (!response.ok) return null;
    return response.json();
  },
});
```

返回 `null`、空值或抛出异常时，前端会继续模型请求，但不会传递历史 POI。

## 第六步：不用 HTTP 时的客户端替换

如果模型运行在桌面桥接、IPC 或企业 SDK 中，可替换 `modelClient`。实现 `analyzeChange`、`health`、`modelInfo` 即可：

```js
const modelClient = {
  configured: true,
  async analyzeChange({ image, poiData, imageMeta, taskType, resultFormat, signal }) {
    // 把 Blob、POI 和元数据交给本地桥接。
    return {
      code: 0,
      request_id: 'ipc-001',
      data: { result_format: resultFormat, result: {}, meta: {} },
    };
  },
  async health() {
    return { status: 'ready' };
  },
  async modelInfo() {
    return { model: 'client-local-model' };
  },
};
```

```js
const api = createTerraChronApi(createPinia(), { modelClient });
```

## 自检与排错

1. 在页面截取区域并取得历史图像。
2. 打开浏览器开发者工具的 Network，确认请求目标是 `<VITE_MODEL_API_BASE>/analyze`，而不是 `/api/agnes`。
3. 请求应为 `multipart/form-data`，且含 `image`、`poi_data`、`image_meta`。
4. 如果浏览器显示 CORS 错误，检查模型服务的 `allow_origins`。
5. 如果页面显示“模型服务请求失败”，检查 HTTP 状态码与响应的 `message`。
6. 如果结果只显示通用分析，检查是否返回了 `data.result.change`。

## 相关代码与接口

- 本地 HTTP 客户端：[src/services/model-client.js](../src/services/model-client.js)
- 模型选择逻辑：[src/services/model-choice.js](../src/services/model-choice.js)
- 页面到模型的参数组装：[src/api.js](../src/api.js)
- 完整公共接口：[api.md](api.md)
