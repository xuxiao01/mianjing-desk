import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { NMessageProvider } from 'naive-ui';
import QuestionMetaEditor from './QuestionMetaEditor.vue';
import { createSeed } from '@/mocks/seed';

const save = vi.fn(),
  close = vi.fn(),
  saved = vi.fn(),
  allowLeave = vi.fn();
const busy = ref(false),
  records = ref(1);
let dirty: () => boolean;
vi.mock('@/shared/composables/useUnsavedChanges', () => ({
  useUnsavedChanges: (fn: () => boolean) => {
    dirty = fn;
    return { allowLeave };
  },
}));
let app: App, host: HTMLDivElement;
function mountEditor(mode: 'company' | 'count' = 'company') {
  app = createApp({
    render: () =>
      h(NMessageProvider, null, {
        default: () =>
          h(QuestionMetaEditor, {
            question: createSeed().questions[0]!,
            mode,
            tags: ['腾讯', '百度'],
            catalog: getCompanyCatalog(createSeed()),
            recordCount: records.value,
            busy: busy.value,
            save,
            onClose: close,
            onSaved: saved,
          }),
      }),
  });
  app.mount(host);
}
beforeEach(async () => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  busy.value = false;
  records.value = 1;
  save.mockReset().mockResolvedValue(true);
  close.mockClear();
  saved.mockClear();
  allowLeave.mockReset().mockResolvedValue(true);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  mountEditor();
  await nextTick();
});
afterEach(() => {
  app.unmount();
  host.remove();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  vi.unstubAllGlobals();
});
async function button(label: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
  );
  if (!found) throw new Error('没有按钮：' + label);
  found.click();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
async function input(label: string, value: string) {
  const found = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  found.value = value;
  found.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
describe('公司与次数编辑弹窗', () => {
  it('当前题目只选择和删除标签，不再局部改名', async () => {
    await button('腾讯');
    await button('百度');
    await button('美团');
    await button('快手');
    await button('保存');
    expect(save).toHaveBeenCalledWith({ companyTags: ['美团', '快手'] });
    expect(saved).toHaveBeenCalledOnce();
    expect(document.querySelector('[aria-label="公司标签名称"]')).toBeNull();
  });
  it('清空可以保存，未保存取消时可以继续编辑', async () => {
    await button('腾讯');
    await button('百度');
    expect(dirty()).toBe(true);
    allowLeave.mockResolvedValueOnce(false);
    await button('取消');
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.bubble-choice[aria-pressed="true"]')).toHaveLength(0);
    await button('保存');
    expect(save).toHaveBeenCalledWith({ companyTags: [] });
  });
  it('提交失败保留草稿；提交中禁止重复保存和修改', async () => {
    await button('美团');
    let finish!: (value: boolean) => void;
    save.mockImplementationOnce(() => {
      busy.value = true;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
      }).finally(() => {
        busy.value = false;
      });
    });
    await button('保存');
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('.bubble-choice')].every((b) => b.disabled),
    ).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[aria-label="管理公司标签"]')!.disabled).toBe(
      true,
    );
    await button('保存');
    await button('取消');
    expect(save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    finish(false);
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(saved).not.toHaveBeenCalled();
    expect(
      [...document.querySelectorAll('.bubble-choice')]
        .find((b) => b.textContent?.trim() === '美团')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(dirty()).toBe(true);
    await button('保存');
    expect(saved).toHaveBeenCalledOnce();
  });
  it('公司模式仅显示一组标签，恢复原选择后不算修改', async () => {
    const dialog = document.querySelector('[aria-label="编辑公司标签"]')!;
    expect(dialog.textContent).not.toContain(createSeed().questions[0]!.title);
    expect(dialog.textContent).not.toMatch(/已选公司|选择公司|不影响出现记录|有未保存的修改/);
    expect(dialog.querySelector('input')).toBeNull();
    expect(dialog.querySelector('.company-picker-selected')).toBeNull();
    expect(document.querySelector('[aria-label="管理公司标签"]')?.getAttribute('title')).toBe(
      '管理公司标签',
    );
    await button('腾讯');
    expect(dirty()).toBe(true);
    await button('腾讯');
    expect(dirty()).toBe(false);
    await button('保存');
    expect(save).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
  it('次数校验最新明细下限及整数，只提交总次数', async () => {
    app.unmount();
    mountEditor('count');
    await nextTick();
    await input('总次数', '0');
    await button('保存');
    expect(document.body.textContent).toContain('总次数不能低于 1');
    await input('总次数', '1.5');
    await button('保存');
    expect(document.body.textContent).toContain('请输入非负整数');
    await input('总次数', '9007199254740992');
    await button('保存');
    expect(document.body.textContent).toContain('安全范围');
    await input('总次数', '2');
    records.value = 3;
    await nextTick();
    await button('保存');
    expect(document.body.textContent).toContain('总次数不能低于 3');
    expect(save).not.toHaveBeenCalled();
    await input('总次数', '5');
    await button('保存');
    expect(save).toHaveBeenCalledWith({ totalCount: 5 });
  });
});
