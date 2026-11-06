import { describe, expect, it, vi } from 'vitest';
import { captureReadingAnchor, restoreReadingAnchor, nearReadingEnd } from './readingViewport';

function viewport() {
  const container = document.createElement('div');
  container.innerHTML = '<div data-question-id="a"></div><div data-question-id="b"></div>';
  Object.defineProperties(container, {
    clientHeight: { value: 500 },
    scrollHeight: { value: 1800 },
    scrollTo: { value: vi.fn() },
  });
  container.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  container.children[0]!.getBoundingClientRect = () => ({ top: 20, bottom: 90 }) as DOMRect;
  container.children[1]!.getBoundingClientRect = () => ({ top: 90, bottom: 170 }) as DOMRect;
  container.scrollTop = 320;
  container.scrollLeft = 140;
  return container;
}
describe('沉浸列表滚动位置', () => {
  it('从首个可见题目恢复相对位置，保留横向滚动', () => {
    const container = viewport();
    const anchor = captureReadingAnchor(container);
    expect(anchor).toEqual({ id: 'b', offset: -10, top: 320, left: 140 });
    container.children[1]!.getBoundingClientRect = () => ({ top: 190, bottom: 270 }) as DOMRect;
    restoreReadingAnchor(container, anchor);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 420, left: 140, behavior: 'instant' });
  });
  it('锚点移出结果时保留旧距离并限制在有效范围', () => {
    const container = viewport();
    const anchor = captureReadingAnchor(container);
    container.innerHTML = '';
    restoreReadingAnchor(container, { ...anchor, top: 9000 });
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 1300, left: 140, behavior: 'instant' });
  });
  it('240px以内才预加载；未布局的容器不触发加载', () => {
    const container = viewport();
    expect(nearReadingEnd(container)).toBe(false);
    container.scrollTop = 1060;
    expect(nearReadingEnd(container)).toBe(true);
    expect(nearReadingEnd(document.createElement('div'))).toBe(false);
  });
});

it('窄屏按窗口顶部计算阅读锚点，恢复页面滚动并使用窗口高度判断加载', () => {
  const container = viewport();
  container.getBoundingClientRect = () => ({ top: -320 }) as DOMRect;
  container.children[0]!.getBoundingClientRect = () => ({ top: -80, bottom: -5 }) as DOMRect;
  container.children[1]!.getBoundingClientRect = () => ({ top: -5, bottom: 75 }) as DOMRect;
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('innerHeight', 500);
  try {
    const anchor = captureReadingAnchor(container, true);
    expect(anchor).toEqual({ id: 'b', offset: -5, top: 320, left: 140 });
    container.children[1]!.getBoundingClientRect = () => ({ top: 95, bottom: 175 }) as DOMRect;
    restoreReadingAnchor(container, anchor, true);
    expect(scroll).toHaveBeenCalledWith({ top: 420, left: 140, behavior: 'instant' });
    expect(nearReadingEnd(container, true)).toBe(false);
    container.scrollTop = 1060;
    expect(nearReadingEnd(container, true)).toBe(true);
  } finally {
    scroll.mockRestore();
    vi.unstubAllGlobals();
  }
});
