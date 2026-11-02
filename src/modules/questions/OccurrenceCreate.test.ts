import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { NMessageProvider } from 'naive-ui';
import OccurrenceCreate from './OccurrenceCreate.vue';
import { createSeed } from '@/mocks/seed';

const pending = ref(false);
const save = vi.fn(),
  allowLeave = vi.fn(),
  close = vi.fn(),
  saved = vi.fn();
let isDirty: () => boolean;
vi.mock('@/shared/composables/useDesk', () => ({
  useDesk: () => ({ data: ref(createSeed()) }),
  useDeskActions: () => ({ experience: { isPending: pending, mutateAsync: save } }),
}));
vi.mock('@/shared/composables/useUnsavedChanges', () => ({
  useUnsavedChanges: (dirty: () => boolean) => {
    isDirty = dirty;
    return { allowLeave };
  },
}));
let app: App, host: HTMLDivElement;
beforeEach(async () => {
  pending.value = false;
  save.mockReset().mockResolvedValue({});
  allowLeave.mockReset().mockResolvedValue(true);
  close.mockClear();
  saved.mockClear();
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
  app = createApp({
    render: () =>
      h(NMessageProvider, null, {
        default: () => h(OccurrenceCreate, { questionId: 'q-1', onClose: close, onSaved: saved }),
      }),
  });
  app.mount(host);
  await nextTick();
});
afterEach(() => {
  app.unmount();
  host.remove();
  vi.unstubAllGlobals();
});
async function company(label: string) {
  [...document.querySelectorAll<HTMLButtonElement>('.bubble-choice')]
    .find((b) => b.textContent?.trim() === label)!
    .click();
  await nextTick();
}
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function submit() {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
async function cancel() {
  [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((b) => b.textContent?.trim() === '取消')!
    .click();
  await nextTick();
  await Promise.resolve();
}
describe('快速出现记录弹窗', () => {
  it('默认不选公司，仅公司和内容两项，空白逐项提示；预设公司和内容正确提交', async () => {
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    expect(document.querySelectorAll('.n-form-item-label').length).toBe(2);
    expect(document.querySelector('select, input[type="date"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/关联题目|招聘类型|面试轮次|面经原文/);
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('请选择或输入公司');
    expect(document.body.textContent).toContain('请填写这次问的内容');
    await company('字节跳动');
    await fill(document.querySelector('textarea')!, '  实际问法\n追问  ');
    await submit();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({
      company: '字节跳动',
      role: '',
      round: '',
      source: '',
      original: '',
      interviewDate: null,
      questions: [{ questionId: 'q-1', wording: '实际问法\n追问', followups: '' }],
    });
    expect(saved).toHaveBeenCalledOnce();
    expect(isDirty()).toBe(false);
  });

  it('历史公司复用同一标签库，搜索可缩小气泡范围', async () => {
    expect(document.querySelector('[aria-label="其他公司名称"]')).toBeNull();
    await fill(document.querySelector<HTMLInputElement>('[aria-label="搜索公司标签"]')!, '腾讯');
    expect(document.querySelectorAll('.bubble-choice')).toHaveLength(1);
    await company('腾讯');
    await fill(document.querySelector('textarea')!, ' 历史公司问法 ');
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ company: '腾讯' }));
  });

  it('取消经过未保存确认，继续编辑时保留公司和内容', async () => {
    await company('美团');
    await fill(document.querySelector('textarea')!, '草稿内容');
    allowLeave.mockResolvedValueOnce(false);
    await cancel();
    expect(close).not.toHaveBeenCalled();
    expect(isDirty()).toBe(true);
    expect(document.querySelector('textarea')!.value).toBe('草稿内容');
    await cancel();
    expect(close).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });

  it('提交中禁用公司与内容，禁止重复保存；失败保留草稿，可重试', async () => {
    let rejectSave!: (error: Error) => void;
    save.mockImplementation(() => {
      pending.value = true;
      return new Promise((_resolve, reject) => {
        rejectSave = reject;
      }).finally(() => {
        pending.value = false;
      });
    });
    await company('美团');
    await fill(document.querySelector('textarea')!, '失败后保留的内容');
    await submit();
    expect(document.querySelector('textarea')!.disabled).toBe(true);
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('.bubble-choice')].every((b) => b.disabled),
    ).toBe(true);
    await company('百度');
    await submit();
    await cancel();
    expect(save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    rejectSave(new Error('存储失败'));
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(document.querySelector('textarea')!.value).toBe('失败后保留的内容');
    expect(document.querySelector('.bubble-choice[aria-pressed="true"]')!.textContent).toContain(
      '美团',
    );
    expect(isDirty()).toBe(true);
    expect(saved).not.toHaveBeenCalled();
    save.mockResolvedValue({});
    await submit();
    expect(saved).toHaveBeenCalledOnce();
  });
});
