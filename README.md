# TerraChron · 地表时序

当前版本：[0.2.0](CHANGELOG.md)。

以地理坐标为中心截取最新卫星影像，查询同一区域的历史影像，并将实际图片和元数据交给后续分析服务。

独立项目，独立 Git 仓库。参考原项目的全屏地图、深蓝浮动面板和独立分色，业务及接口重新实现。

## 运行

要求 Node.js 22.12+（本机验证为 Node.js 24）及 npm。

```powershell
cd E:\vlm-localization-frontend\terrachron
npm install
npm run dev
```

访问 http://127.0.0.1:3100 。`npm run build` 输出 `dist/`，`npm run preview` 本地预览生产构建。使用相对 base，可部署到静态站点子目录。

## 使用

1. 输入 WGS84 经纬度，或点击“地图选点”后点击地图。
2. 点击“截取并加入区域库”，得到 256 m × 256 m 地面区域的 512 × 512 PNG。该像素数不代表源影像的真实分辨率。
3. 区域库固定在右侧，会在后台保存最新截取，并在卡片内显示高德 POI 描述；长描述会省略，悬停会出现不受卡片裁切的完整内容浮层。
4. 在同一张区域卡片选择年份（必填）；月份和日期可选，且选择日期前必须先选择月份。点击“获取历史图像”后，卡片显示实际拍摄日期最接近该时间点的一张历史影像。
5. 使用“比对影像”打开分栏或卷帘窗口；拖动分界线或使用下面的滑条。
6. 点击“数据输出”，选择区域后下载 ZIP，或填写自己的 HTTP 接收地址并发送。

主地图始终为提供方当前版本；所有区域截取都来自 Esri 当前卫星影像，即使地图切到 OSM 街道定位。历史查询、历史预览及比对不改变主底图或覆盖当前截取。

“最新”指提供方当前发布的底图，不表示今日拍摄。区域和图像保存在当前页面会话中；刷新页面前请导出需要保留的数据。

## 数据来源

- 最新影像：Esri World Imagery；辅助定位：OSM。
- 历史影像：Esri World Imagery Wayback。查询当前区域所覆盖全部瓦片的变化版本，再按实际拍摄元数据过滤；不使用发布日期代替拍摄日期。
- Google Earth 有历史影像浏览功能，但核查的公开 Maps 卫星瓦片接口没有受支持的历史日期查询参数，因此不作为历史来源。也不复制原项目未配置凭据的 Google 瓦片地址。
- OSM 历史接口提供地图要素版本，不提供卫星影像档案。
- 首期只有一个已确认可用的历史来源，显示固定来源名称。`src/services/providers/esri.js` 的来源列表增加第二个可用适配器后，界面自动显示下拉框。

Wayback 记录的是底图版本档案，并非卫星每次过境的完整原始数据。影像可能来自卫星或航拍拼接；同一区域可能出现多个拍摄日期。未知日期保持空值，元数据相交范围一并保留。底图瓦片服务未提供可用于像素级判定的统一无数据标记，某地缺少细节时不会被宣称具有高分辨率数据。

当前范围支持纬度 -75° 至 75°，不支持跨日期变更线。地面尺寸使用中心局部横轴墨卡托投影，以每像素位置重投影裁切；不是直接截屏。

外部服务必须可联网访问。请求失败会显示错误，可重试或取消；生产代码没有模拟历史影像回退。测试中的影像 fixture 仅用于可重复的自动化验证。

## 高德 POI Key

高德 Key 只供 Vercel 的 `/api/poi` 服务端函数使用，绝不能使用 `VITE_` 前缀，也不要填入 `.env` 后提交。部署后在 Vercel 项目的 **Settings → Environment Variables** 新建：

```text
Name:  AMAP_API_KEY
Value: 你的高德 Web 服务 API Key
Environments: Production、Preview、Development
```

保存后到 **Deployments** 对最新部署执行 **Redeploy**。本地需要经 Vercel Functions 调试时，使用 `vercel dev` 并在本机环境中设置同名变量；`npm run dev` 只启动 Vite 页面，不会启动 `/api/poi`。

## 对外接口

宿主页面可调用 `window.terrachron`，其他 Vue 项目可以导入 `createTerraChronApi(pinia)`。详细参数、返回值及接收端示例见 [docs/api.md](docs/api.md)。

可选接收地址：复制 `.env.example` 为 `.env.local`，设置 `VITE_TRANSFER_URL`。这只是默认地址，页面中仍能编辑。前端环境变量会进入构建产物，不应放服务端密钥。

ZIP 包含 `manifest.json` 和实际 PNG 文件；POST 使用 `multipart/form-data` 传递清单、文件映射和相同图片文件。没有配置接收服务也可以下载，不会显示虚假的传递成功状态。

## 项目结构

```text
src/
  components/           地图、采样、区域库、历史、比对与传递界面
  composables/          拖拽生命周期
  domain/               地面区域、投影、瓦片覆盖、时间点匹配
  stores/workspace.js   按区域隔离的状态、取消与结果归属
  services/
    providers/esri.js   真实 Esri 目录、区域变化和拍摄元数据
    history.js          时间点最近影像查询与进度
    poi.js              同源 POI 服务调用
    imagery.js          最新或历史瓦片到实际区域 PNG
    transfer.js         元数据清单、ZIP 和 HTTP 文件传递
  api.js                界面和外部调用共用的公开接口
api/poi.js              Vercel 服务端高德坐标转换与逆地理编码
```

## 验证

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

若已有 Chromium，可通过 `CHROMIUM_PATH` 指向浏览器可执行文件。端到端测试覆盖真实前端逻辑，网络层使用显式 fixture；不会调用真实接收服务。

真实服务验证（先运行 `npm run dev`）：

```powershell
node scripts/live-smoke.mjs
```

脚本使用真实 Esri 服务；可选 `BROWSER_PROXY` 指定浏览器代理。截图保存到忽略提交的 `.local/`。2026-09-09 在上海测试点验证了最新区域截取、区域历史查询和比对，拍摄日期包括 2025-04-18、2021-11-25、2019-11-09，另有日期未知档案。该结果仅说明测试地点和当时服务可用，不承诺每个地点有相同历史覆盖。

## 影像署名

界面及输出清单保留 Esri / Vantor / Earthstar Geographics / GIS User Community 等来源。影像内容适用提供方的使用条件；Wayback SDK 的软件开源许可不等于影像内容许可。

参考：[Esri Wayback 官方代码](https://github.com/Esri/wayback-core)、[拍摄日期与发布日期](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata)、[Wayback 导出](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-export)、[Google 卫星瓦片](https://developers.google.com/maps/documentation/tile/satellite)、[OSM API](https://wiki.openstreetmap.org/wiki/Api06)。
