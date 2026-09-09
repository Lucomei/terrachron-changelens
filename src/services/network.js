export async function request(url, { signal, timeout = 25000, ...options } = {}) {
  signal?.throwIfAborted();
  const combined = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
  try {
    const response = await fetch(url, { ...options, signal: combined });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`);
    return response;
  } catch (error) {
    signal?.throwIfAborted();
    if (combined.aborted) throw new Error('服务响应超时，请重试');
    throw error;
  }
}

export async function jsonRequest(url, options) {
  const data = await (await request(url, options)).json();
  if (data.error) throw new Error(data.error.message || '影像服务返回错误');
  return data;
}

export async function mapConcurrent(items, limit, fn, signal) {
  let cursor = 0;
  const output = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        signal?.throwIfAborted();
        const index = cursor++;
        output[index] = await fn(items[index], index);
      }
    }),
  );
  signal?.throwIfAborted();
  return output;
}
