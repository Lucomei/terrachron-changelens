export function makePoiDescription(regeocode = {}) {
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

export async function fetchPoiDescription([longitude, latitude], { signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({ longitude: String(longitude), latitude: String(latitude) });
  const response = await fetchImpl(`/api/poi?${params}`, { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'POI 描述获取失败');
  return payload;
}
