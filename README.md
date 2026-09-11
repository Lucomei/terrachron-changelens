# TerraChron ChangeLens

**地表时序变化识别工作台**：从一个 WGS84 坐标截取最新卫星影像，匹配同区域历史影像，并把双时相影像、当前 POI 和空间元数据交给变化检测模型。

TerraChron ChangeLens 是一个独立的 Vue 3 前端项目。它不在浏览器中训练或运行变化检测模型；它负责可靠地组织输入、发起请求并渲染模型结果。

## 能做什么

- 截取以指定坐标为中心、可自定义地面边长与输出像素的最新 Esri 卫星影像，并显示每像素地面面积。
- 查询 Esri World Imagery Wayback，选择与目标时间点最接近的历史影像。
- 获取当前区域的高德 POI 描述，并在区域卡片悬停时展示完整文本。
- 在 `03 / MODEL` 面板中对照历史影像、最新影像与当前 POI，调用 Agnes 演示代理或甲方本地模型。
- 导出区域、影像与元数据 ZIP，或传递到自有 HTTP 接收服务。

## 快速开始

要求 Node.js 22.12+。

```powershell
cd terrachron
npm install
npm run dev
```

打开 <http://127.0.0.1:3100>。开发服务器只运行前端；需要测试 Vercel Functions 时使用 `vercel dev`。

## 使用流程

1. 输入 WGS84 经度和纬度，或使用地图选点。
2. 设置地面范围和输出像素；面板实时显示每像素代表的地面面积。点击“截取并加入区域库”，系统生成当前区域 PNG 并请求当前 POI。
3. 在区域影像库选择年、月、日，点击“获取历史图像”。
4. 选择区域后，`03 / MODEL` 自动同步历史影像、最新影像和 POI。
5. 编辑提示词并发送模型请求；结果直接在该面板展示。

## 模型接入方式

项目有两种互斥的默认模型通道：

| 场景            | 配置                         | 请求目标          | 密钥位置                  |
| --------------- | ---------------------------- | ----------------- | ------------------------- |
| 演示 / 云端测试 | 不设置 `VITE_MODEL_API_BASE` | 同源 `/api/agnes` | Vercel 的 `AGNES_API_KEY` |
| 甲方本地模型    | 设置 `VITE_MODEL_API_BASE`   | `<base>/analyze`  | 甲方本地服务              |

本地模型地址优先级更高。详细的接入、返回格式、CORS、测试与故障排查，请交给甲方阅读 [本地模型客户端接入教程](docs/local-model-client-tutorial.md)。

## Vercel 环境变量

高德 POI 与 Agnes 演示代理都在服务端读取密钥：

```text
AMAP_API_KEY=高德 Web 服务 Key
AGNES_API_KEY=Agnes API Key
```

在 Vercel 项目的 **Settings → Environment Variables** 中填写，类型选 **Secret**，选择 Production、Preview、Development。保存后重新部署。不要使用 `VITE_` 前缀，也不要将密钥提交到 Git。

## 项目结构

```text
src/
  api.js                         统一的页面与宿主 API
  components/ModelPanel.vue      03 模型输入/输出面板
  services/model-client.js       甲方本地模型 multipart 客户端
  services/agnes-client.js       同源 Agnes 代理客户端
  services/model-choice.js       本地模型与 Agnes 的默认选择
  services/change-result.js      结果标准化
api/
  poi.js                         Vercel 高德 POI 函数
  agnes.js                       Vercel Agnes 代理
docs/
  local-model-client-tutorial.md 甲方本地模型保姆式教程
  api.md                         全部公开接口
```

## 验证

```powershell
npm test
npm run build
npm run test:e2e
```

## 版本与资料

- 版本变更：[CHANGELOG.md](CHANGELOG.md)
- 工作记录：[docs/agents/issue-tracker.md](docs/agents/issue-tracker.md)
- API 参考：[docs/api.md](docs/api.md)
- 影像与数据来源说明见 [docs/design.md](docs/design.md)

## 影像来源

最新影像来自 Esri World Imagery；历史影像来自 Esri World Imagery Wayback；辅助定位使用 OSM。最新底图代表提供方当前发布版本，不保证为当天拍摄。影像使用应遵守各提供方条款。
