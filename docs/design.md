# TerraChron · 地表时序

状态：方案待用户确认，应用尚未实现。2026-09-09。

## 目标与视觉

独立 Vue 3、Vite、Pinia、OpenLayers 应用，参考原项目的全屏地图、深蓝半透明浮动面板、蓝色描边与拖拽交互。以区域采样及历史影像查询替代视觉定位业务，不复用 VLM 接口。

左侧区域库：输入 WGS84 经纬度或地图点选，预览以坐标为中心、地面尺寸 256 m × 256 m 的区域，点击截取后加入图库。每个区域有独立 ID、颜色、中心、边界、预览及历史记录。尺寸为地面距离，不能直接将 Web Mercator 坐标加减 128 当作地面米数；使用局部米制坐标构造范围并转换。输出像素数与地面尺寸分开记录，建议默认 512 × 512，不代表源数据达到 0.5 m 分辨率。

右侧历史面板：每个区域保存独立开始日期、结束日期、选中记录、请求状态；日期输入配合可选择的时间轴。点击“获取历史图像”返回同一区域的历史缩略图、拍摄日期、发布日期和来源。选中历史记录同步地图，支持分栏与卷帘比对，列表延迟加载图像。

## 来源与日期

Esri World Imagery Wayback 为首期历史来源。官方 wayback-core 支持版本列表、指定位置更新查询和拍摄日期元数据查询。Wayback 是底图版本档案，并非所有卫星过境原始影像的完整档案。

历史查询默认按实际拍摄日期筛选：查询版本及区域元数据后再过滤，不能先按版本发布日期排除可能符合条件的影像。日期未知记录不混入有明确拍摄日期的结果，可在独立“日期未知”区域查看。发布日期始终独立显示，不能替代拍摄日期。

256 m 范围可能跨越多份影像，元数据需保留覆盖范围与多个拍摄日期；中心点元数据只能标记为中心点信息，不宣称整幅同日拍摄。去重需考虑整个区域涉及的瓦片，不能仅凭中心瓦片未更新排除区域变化。

Google Earth 提供历史影像浏览界面，但在核查的公开 Google Maps 卫星瓦片 API 文档中未查到受支持的历史日期查询接口，因此不计为可接入历史来源。OSM 的历史 API 是地图要素版本记录，不提供卫星历史影像；其编辑背景影像来自第三方。首期仅 Esri 为已确认历史来源。

来源注册表将浏览底图能力、历史检索能力和导出能力分开。只有至少两家可用历史来源时，在“获取历史图像”旁显示来源选择框；单来源显示来源名称。OSM 可用于地图定位，但区域库中的影像始终从卫星影像来源采样。

## 技术方案选择

1. 推荐：前端直接接入支持跨域访问的公开历史服务，独立 provider 适配层负责检索，数据服务负责裁切、元数据和传递。部署简单，保留后端接入路径。
2. 前端加自建服务：集中裁切、缓存、任务与凭据管理；适合后续规模化处理，但增加部署工作。
3. 扩展其他遥感档案：增加真正按卫星拍摄时间检索的来源，涉及额外数据集、分辨率或账号条件，不作为首期默认范围。

## 模块

- components：地图、区域采样、区域库、历史时间轴、历史列表、影像比对、数据输出。
- stores：mapStore、regionStore；状态按 regionId 隔离。
- composables：地图初始化、区域图层、面板拖拽与请求生命周期。
- services/providers：来源能力及 Esri 适配器。
- services：区域裁切、历史查询、导出、传递适配器。
- utils：地面范围与坐标转换、日期和图像处理。

## 对外数据与接口契约

提供可调用方法，不仅展示界面：

- createRegion({ center, sizeMeters, outputSize })：区域与当前影像。
- queryHistory({ regionId, startDate, endDate, providerId, signal })：历史记录及元数据。
- getImageAsset({ regionId, observationId, signal })：可传递的 Blob 和文件名。
- exportSelection({ regionIds, observationIds })：JSON 清单及图片文件的可下载数据包。
- sendSelection({ endpoint, regionIds, observationIds, signal })：通过可配置 HTTP POST 传递数据包；未配置接收端时清晰提示，仍能导出。

数据包使用 version 字段。区域含 id、颜色、WGS84 中心、GeoJSON 边界、地面尺寸、输出像素尺寸。影像含 observationId、regionId、providerId、releaseId、capturedAt（可空）、publishedAt、日期覆盖说明、原始元数据、分辨率、署名、来源引用、影像文件映射及请求时间范围。实际图片通过 multipart/form-data 的文件部分传递，清单通过 manifest JSON 部分传递；blob URL 仅为本地预览，不作为外部可下载地址。

这里只定义接收协议与发送适配器，不虚构已存在的接收服务。若来源不支持当前环境的裁切导出，返回明确错误与来源引用，不把元数据导出宣称为图片导出。提供方影像使用条件与软件开源许可分别保留，界面及数据包携带来源署名。

## 错误与验收

经纬度、日期范围校验；极区、跨日期变更线等超出实现支持范围时明确提示。无影像、日期未知、网络失败、跨域限制、单条失败分别呈现。切换区域或删除区域不造成结果串写；支持取消请求，限制并发并回收 Blob URL。

验证区域物理尺寸、日期筛选、区域状态隔离、数据包可序列化及图片传递、失败与取消路径；完成构建和浏览器主要交互验证。真实服务联通结果与离线测试结果分别报告。

## 已核实资料

- https://github.com/Esri/wayback-core
- https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata
- https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-export
- https://developers.google.com/maps/documentation/tile/satellite
- https://developers.google.com/maps/documentation/tile/session_tokens
- https://support.google.com/earth/answer/148094?hl=en
- https://wiki.openstreetmap.org/wiki/Api06
- https://wiki.openstreetmap.org/wiki/Aerial_imagery_quickstart
