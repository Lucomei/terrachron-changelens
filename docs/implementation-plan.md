# TerraChron Implementation Plan

**Goal:** 交付最新区域截取、独立历史查询与图片数据传递的完整前端。

**Architecture:** Vue 组件使用 Pinia 区域状态；影像服务屏蔽 Esri 查询和瓦片裁切。最新快照与历史记录各自持有文件，主地图只引用当前底图。

**Tech Stack:** Vue 3、Vite、Pinia、OpenLayers、proj4、fflate、Node test runner、Playwright。

## 1. 地面范围和项目基础

- [ ] package.json、vite.config.js、index.html：建立独立 npm 项目，端口 3100。
- [ ] tests/geometry.test.js：先验证赤道与高纬度区域地面边长、非法经纬度；运行 `node --test tests/geometry.test.js` 观察失败。
- [ ] src/domain/geometry.js：`createFootprint(center)` 输出局部米制投影、WGS84 边界和瓦片覆盖；再次运行测试通过。

## 2. 历史数据服务

- [ ] tests/history.test.js：通过 `searchHistory(region, range, provider)` 验证拍摄日期晚发布、未知日期、取消及跨瓦片变化。
- [ ] src/services/history.js、providers/esri.js、network.js：查询真实档案，限制并发，保留日期覆盖元数据；运行对应测试。
- [ ] src/services/imagery.js：最新瓦片与历史瓦片使用独立 URL；按区域投影生成 512 px PNG，拒绝不完整裁切。

## 3. 区域状态与导出

- [ ] tests/workspace.test.js：创建两个区域，切换当前区域后异步结果仍回写原区域；删除时取消。
- [ ] src/stores/workspace.js：区域独立时间、状态、记录、当前图片与历史文件缓存。
- [ ] tests/transfer.test.js：通过公开导出方法检验清单、PNG 文件、multipart 内容和 HTTP 失败。
- [ ] src/services/transfer.js、src/api.js：ZIP 与 POST 共用同一清单，不输出不可跨进程使用的 Blob URL。

## 4. 用户界面

- [ ] src/App.vue、assets/styles.css：全屏地图、深蓝浮动面板、品牌顶栏、状态和传递入口。
- [ ] components/MapCanvas.vue、CapturePanel.vue、RegionPanel.vue：输入和点选区域、最新截取、独立颜色、可见性和删除。
- [ ] components/HistoryPanel.vue、ObservationCard.vue、CompareDialog.vue、TransferDialog.vue：每区域时间范围、结果缩略图、历史独立分栏/卷帘比对、导出及发送。
- [ ] composables/useDraggable.js：拖拽与清理，移动端可用。

## 5. 验证和交付

- [ ] tests/browser.spec.js：通过浏览器公共流程检查选择区域、截取、历史列表、主底图不变、下载、取消及小屏布局。外部接口使用明确标记的测试 fixture 保证可重复；真实服务探测单独记录。
- [ ] `npm test`、`npm run build`、`npm run test:e2e`。
- [ ] docs/api.md、README.md、.env.example：运行方法、真实服务限制与接收协议。
- [ ] codematt 双轴审查，修复后提交到当前独立仓库分支。
