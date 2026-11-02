import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from './http';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('请求层', () => {
  it('解包成功数据，传递调用方 signal', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(await request('/test', { signal: controller.signal })).toEqual({ id: 1 });
    const signal = fetcher.mock.calls[0]![1].signal as AbortSignal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
  it('正确处理 HTTP 错误、业务失败和非 JSON 响应', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, message: '请登录' }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false, message: '保存失败' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('<html>not API</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(request('/test')).rejects.toMatchObject({ status: 401, message: '请登录' });
    await expect(request('/test')).rejects.toThrow('保存失败');
    await expect(request('/test')).rejects.toThrow('非 JSON');
  });
});
