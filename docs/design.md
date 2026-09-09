# TerraChron · 地表时序

状态：用户已确认，实施中。2026-09-09。

## 目标与视觉

独立 Vue 3、Vite、Pinia、OpenLayers 应用，参考原项目的全屏地图、深蓝半透明浮动面板、蓝色描边与拖拽交互。以区域采样及历史影像查询替代视觉定位业务，不复用 VLM 接口。

左侧截取浮窗：输入 WGS84 经纬度或地图点选，以坐标为中心创建地面尺寸 256 m × 256 m 的区域。尺寸为地面距离，使用局部米制坐标构造范围并转换；默认输出 512 × 512 像素，不代表源影像达到 0.5 m 分辨率。

右侧区域库：每个区域拥有独立 ID、颜色、中心、边界、POI 描述、时间点和历史状态。区域库为固定宽度浮窗，新增区域只在其内部列表滚动。POI 摘要超长时省略，悬停在页面顶层显示完整内容。选择年份（必填）、月份或日期（可选）后获取该区域中拍摄日期最近的一张历史影像，并可进入分栏或卷帘比对。

主地图和当前截取始终使用提供方当前发布的最新影像。历史版本只用于区域卡片预览、比对和导出，不替换主地图底图；“最新”不表示今日拍摄。

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

- components：地图、区域采样、右侧区域库、区域内时间点查询、影像比对、数据输出。
- stores：mapStore、regionStore；状态按 regionId 隔离。
- composables：地图初始化、区域图层、面板拖拽与请求生命周期。
- services/providers：来源能力及 Esri 适配器。
- services：区域裁切、历史查询、导出、传递适配器。
- domain：地面范围、坐标转换和时间点匹配。

## 对外数据与接口契约

提供可调用方法，不仅展示界面：

- createRegion({ center, sizeMeters, outputSize })：区域、当前影像与 POI 查询。
- fetchClosestHistory({ regionId, timePoint, providerId, signal })：距离时间点最近的历史记录及元数据。
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
