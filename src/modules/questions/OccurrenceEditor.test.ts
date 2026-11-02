import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { NMessageProvider } from 'naive-ui';
import OccurrenceEditor from './OccurrenceEditor.vue';
import { createSeed } from '@/mocks/seed';

const pending = ref(false);
const update = vi.fn();
const allowLeave = vi.fn();
const close = vi.fn(),
  saved = vi.fn();
let isDirty: () => boolean;
vi.mock('@/shared/composables/useDesk', () => ({
  useDeskActions: () => ({ occurrence: { isPending: pending, mutateAsync: update } }),
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
  update.mockReset().mockResolvedValue({});
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
  const seed = createSeed();
  host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () =>
      h(NMessageProvider, null, {
        default: () =>
          h(OccurrenceEditor, {
            occurrence: seed.occurrences[0]!,
            experience: seed.experiences[0]!,
            onClose: close,
            onSaved: saved,
          }),
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
async function fill(index: number, value: string) {
  const input = document.querySelectorAll('textarea')[index]!;
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
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '取消')!.click();
  await nextTick();
  await Promise.resolve();
}
describe('逐次问法编辑表单', () => {
  it('仅有两个文本输入，来源只读，清空问法后也可按记录 ID 保存', async () => {
    expect(document.querySelectorAll('textarea')).toHaveLength(2);
    expect(document.querySelectorAll('.source-badge')).toHaveLength(2);
    expect(document.querySelector('select, input, .bubble-choice')).toBeNull();
    expect(isDirty()).toBe(false);
    await fill(0, '');
    await fill(1, '');
    await submit();
    expect(update).toHaveBeenCalledWith({ id: 'o-1', input: { wording: '', followups: '' } });
    expect(saved).toHaveBeenCalledOnce();
    expect(isDirty()).toBe(false);
  });
  it('取消需经过放弃确认，继续编辑时输入保留', async () => {
    await fill(0, '未保存的变形');
    allowLeave.mockResolvedValueOnce(false);
    await cancel();
    expect(allowLeave).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')!.value).toBe('未保存的变形');
    expect(isDirty()).toBe(true);
    await cancel();
    expect(close).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });
  it('提交期间禁止修改与重复保存，失败后保留草稿并可重试', async () => {
    let rejectSave!: (reason: Error) => void;
    update.mockImplementation(() => {
      pending.value = true;
      return new Promise((_resolve, reject) => {
        rejectSave = reject;
      }).finally(() => {
        pending.value = false;
      });
    });
    await fill(0, '变形问法草稿');
    await fill(1, '追问草稿');
    await submit();
    expect([...document.querySelectorAll('textarea')].every((e) => e.disabled)).toBe(true);
    await submit();
    await cancel();
    expect(update).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    rejectSave(new Error('存储失败'));
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(document.querySelector('textarea')!.value).toBe('变形问法草稿');
    expect(document.querySelectorAll('textarea')[1]!.value).toBe('追问草稿');
    expect(saved).not.toHaveBeenCalled();
    expect(isDirty()).toBe(true);
    update.mockResolvedValue({});
    await submit();
    expect(saved).toHaveBeenCalledOnce();
  });
});
