import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import { NMessageProvider } from 'naive-ui';
import QuestionEditor from './QuestionEditor.vue';
import { createSeed } from '@/mocks/seed';
import type { Question, QuestionCreateInput } from '@/shared/types/domain';

const creationPending = ref(false);
const create = vi.fn();
const edit = vi.fn();
const allowLeave = vi.fn(async () => true);
let isDirty: () => boolean;

vi.mock('@/shared/composables/useDesk', () => ({
  useDesk: () => ({ data: ref(createSeed()) }),
  useDeskActions: () => ({
    createQuestion: { isPending: creationPending, mutateAsync: create },
    question: { isPending: ref(false), mutateAsync: edit },
  }),
}));
vi.mock('@/shared/composables/useUnsavedChanges', () => ({
  useUnsavedChanges: (dirty: () => boolean) => {
    isDirty = dirty;
    return { allowLeave };
  },
}));

let app: App;
let host: HTMLDivElement;
function mountEditor(question?: Question) {
  app = createApp({
    render: () =>
      h(NMessageProvider, null, { default: () => h(QuestionEditor, { show: true, question }) }),
  });
  app.mount(host);
}
beforeEach(async () => {
  creationPending.value = false;
  create.mockReset().mockResolvedValue({ id: 'memory-only-question' });
  edit.mockReset();
  allowLeave.mockClear();
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
  vi.unstubAllGlobals();
});

function choice(group: string, label: string): HTMLButtonElement {
  const root = document.querySelector(`[role="group"][aria-label="${group}"]`)!;
  const button = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!button) throw new Error(`缺少选项 ${group}/${label}`);
  return button;
}
async function click(group: string, label: string) {
  choice(group, label).click();
  await nextTick();
}
async function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function title() {
  await fill(document.querySelector('textarea')!, '内存测试题目');
}
async function submit() {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
async function complete() {
  await title();
  await click('来源公司', '字节跳动');
  await click('招聘类型', '暑期');
  await click('面试轮次', '二面');
}

describe('题目来源气泡', () => {
  it('编辑标题与标签时没有答案输入，保存仍原样携带历史 notes', async () => {
    app.unmount();
    const question = createSeed().questions[0]!;
    question.notes = '历史答案，不应显示或被清空';
    edit.mockResolvedValue({ id: question.id });
    mountEditor(question);
    await nextTick();
    expect(document.querySelectorAll('textarea')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('我的答案与笔记');
    expect(document.body.textContent).not.toContain(question.notes);
    await fill(document.querySelector('textarea')!, '修改后的标准标题');
    await fill(
      document.querySelector<HTMLInputElement>('input[placeholder="JavaScript, Promise"]')!,
      '修改后的标签',
    );
    await submit();
    expect(edit).toHaveBeenCalledWith({
      id: question.id,
      input: expect.objectContaining({
        title: '修改后的标准标题',
        tags: ['修改后的标签'],
        notes: question.notes,
      }),
    });
    expect(create).not.toHaveBeenCalled();
  });
  it('默认全空，切换公司保留类型和轮次，再次点击可取消并恢复留空保存', async () => {
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(isDirty()).toBe(false);
    await click('来源公司', '滴滴');
    await click('招聘类型', '暑期');
    await click('面试轮次', '二面');
    await click('来源公司', '美团');
    expect(choice('招聘类型', '暑期').getAttribute('aria-pressed')).toBe('true');
    expect(choice('面试轮次', '二面').getAttribute('aria-pressed')).toBe('true');
    expect(choice('面试轮次', '二面').style.getPropertyValue('--company-color')).toBe('#111827');
    await click('来源公司', '美团');
    expect(choice('面试轮次', '二面').style.getPropertyValue('--company-color')).toBe('#56657F');
    await click('招聘类型', '暑期');
    await click('面试轮次', '二面');
    expect(isDirty()).toBe(false);
    await title();
    await submit();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]![0]).not.toHaveProperty('source');
  });

  it('预设字节保存为字节跳动，来源完整后一次提交', async () => {
    await complete();
    await submit();
    expect(create).toHaveBeenCalledOnce();
    expect((create.mock.calls[0]![0] as QuestionCreateInput).source).toEqual({
      company: '字节跳动',
      recruitmentType: '暑期',
      round: '二面',
    });
    expect(edit).not.toHaveBeenCalled();
  });

  it('仅选择公司时提示补齐来源，不再有其他公司自由输入', async () => {
    await click('来源公司', '腾讯');
    expect(isDirty()).toBe(true);
    expect(document.querySelector('[aria-label="其他公司名称"]')).toBeNull();
    await title();
    await submit();
    expect(document.body.textContent).toContain('请选择招聘类型');
    expect(document.body.textContent).toContain('请选择面试轮次');
    expect(create).not.toHaveBeenCalled();
    await click('招聘类型', '秋招');
    await click('面试轮次', '三面');
    await submit();
    expect((create.mock.calls[0]![0] as QuestionCreateInput).source).toEqual({
      company: '腾讯',
      recruitmentType: '秋招',
      round: '三面',
    });
  });

  it('提交期间禁止来源修改和重复保存，失败保留选择与输入', async () => {
    let rejectSave!: (error: Error) => void;
    create.mockImplementation(() => {
      creationPending.value = true;
      return new Promise((_resolve, reject) => {
        rejectSave = reject;
      }).finally(() => {
        creationPending.value = false;
      });
    });
    await complete();
    await submit();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('.bubble-choice')].every((b) => b.disabled),
    ).toBe(true);
    await click('来源公司', '百度');
    await submit();
    expect(create).toHaveBeenCalledOnce();
    rejectSave(new Error('存储失败，稍后重试'));
    await nextTick();
    await Promise.resolve();
    await nextTick();
    expect(document.querySelector('textarea')!.value).toBe('内存测试题目');
    expect(choice('来源公司', '字节跳动').getAttribute('aria-pressed')).toBe('true');
    expect(choice('面试轮次', '二面').getAttribute('aria-pressed')).toBe('true');
    expect(choice('来源公司', '百度').disabled).toBe(false);
    expect(isDirty()).toBe(true);
  });
});
