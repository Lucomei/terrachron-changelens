const CONVERT_URL = 'https://restapi.amap.com/v3/assistant/coordinate/convert';
const REGEO_URL = 'https://restapi.amap.com/v3/geocode/regeo';

function description(regeocode = {}) {
  const formatted = regeocode.formatted_address?.trim();
  const township = regeocode.addressComponent?.township?.trim();
  const names = (items, limit) =>
    (items || [])
      .map((item) => item.name?.trim())
      .filter(Boolean)
      .slice(0, limit)
      .join('、');
  const parts = [formatted];
  if (township && !formatted?.includes(township)) parts.push(township);
  for (const value of [names(regeocode.aois, 2), names(regeocode.roads, 2), names(regeocode.pois, 3)]) {
    if (value) parts.push(value);
  }
  return parts.join('；') || '未获取到周边 POI 描述';
}

async function amap(url, params) {
  const response = await fetch(`${url}?${new URLSearchParams(params)}`);
  const payload = await response.json();
  if (!response.ok || payload.status !== '1') throw new Error(payload.info || '高德地图服务请求失败');
  return payload;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: '只支持 GET 请求' });
  const longitude = Number(request.query.longitude);
  const latitude = Number(request.query.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
    return response.status(400).json({ error: '请提供有效 WGS84 经纬度' });
  if (!process.env.AMAP_API_KEY)
    return response.status(503).json({ error: '服务端尚未配置 AMAP_API_KEY' });
  try {
    const key = process.env.AMAP_API_KEY;
    const converted = await amap(CONVERT_URL, {
      key,
      locations: `${longitude},${latitude}`,
      coordsys: 'gps',
      output: 'JSON',
    });
    const location = converted.locations?.split(';')[0];
    if (!location) throw new Error('坐标转换未返回结果');
    const result = await amap(REGEO_URL, {
      key,
      location,
      radius: '150',
      extensions: 'all',
      roadlevel: '0',
      output: 'JSON',
    });
    const regeocode = result.regeocode || {};
    return response.status(200).json({
      description: description(regeocode),
      formattedAddress: regeocode.formatted_address || '',
      source: 'AMap',
    });
  } catch (error) {
    return response.status(502).json({ error: error.message || '高德地图服务请求失败' });
  }
}
