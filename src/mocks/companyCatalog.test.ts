import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRepository } from './repository';
import { createSeed } from './seed';
import {
  getCompanyCatalog,
  findCompany,
  normalizeCatalogInput,
} from '@/shared/utils/companyCatalog';
import { companyColorStyle } from '@/shared/utils/companyColors';
import { parseSnapshot } from '@/shared/api/validation';
import {
  companyNames,
  occurrenceCount,
  selectQuestions,
  emptyFilters,
} from '@/modules/questions/model';
import type { CompanyCatalog, CompanyTag } from '@/shared/types/domain';

class MemoryStorage implements Storage {
  items = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota');
    this.items.set(key, value);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});
const custom = (): CompanyTag => ({
  id: 'custom',
  name: ' 自定义公司 ',
  aliases: [],
  palette: 'purple',
  enabled: true,
});
function clone(catalog: CompanyCatalog) {
  return structuredClone(catalog.items);
}

describe('统一公司标签库', () => {
  it('旧八种配色和新增黑白色均可读取，黑白配置随 v1 备份恢复，不改业务记录', async () => {
    const repo = createMockRepository(storage);
    const legacy = createSeed();
    const original = getCompanyCatalog(legacy);
    legacy.companyCatalog = {
      revision: 7,
      items: original.items.map((item, index) => ({
        ...item,
        palette: index === 5 ? 'blue' : item.palette,
      })),
    };
    await repo.restore(legacy);
    const before = await repo.getSnapshot();
    expect(getCompanyCatalog(before).items[5]!.palette).toBe('blue');
    const items = clone(before.companyCatalog!);
    items[5]!.palette = 'white';
    items.find((item) => item.name === '智谱')!.palette = 'black';
    await repo.saveCompanyCatalog({ expectedRevision: 7, items });
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    const after = await restored.getSnapshot();
    expect(after.companyCatalog!.items[5]!.palette).toBe('white');
    expect(after.companyCatalog!.items.find((item) => item.name === '智谱')!.palette).toBe('black');
    expect(after).toEqual({ ...before, companyCatalog: after.companyCatalog });
    expect(
      after.companyCatalog!.items.map((item) => [item.id, item.name, item.aliases, item.enabled]),
    ).toEqual(
      before.companyCatalog!.items.map((item) => [item.id, item.name, item.aliases, item.enabled]),
    );
  });
  it('旧数据默认包含预设与全部历史公司，字节别名共用 ID，不改写旧数据', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const raw = await repo.exportRaw();
    const catalog = getCompanyCatalog(before);
    expect(catalog.items.slice(0, 6).map((x) => x.name)).toEqual([
      '字节跳动',
      '滴滴',
      '美团',
      '京东',
      '快手',
      '百度',
    ]);
    expect(findCompany(catalog, '字节')!.id).toBe(findCompany(catalog, '字节跳动')!.id);
    for (const name of [
      ...before.questions.flatMap((q) => q.historicalCompanies),
      ...before.experiences.map((x) => x.company),
    ])
      expect(findCompany(catalog, name)).toBeTruthy();
    expect((await repo.getSnapshot()).companyCatalog).toBeUndefined();
    expect(await repo.exportRaw()).toBe(raw);
  });
  it('新增、配色和排序一次写入，停用与启用保留历史及颜色', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const catalog = getCompanyCatalog(before);
    const items = [custom(), ...clone(catalog)];
    items[1]!.palette = 'red';
    items[1]!.enabled = false;
    const write = vi.spyOn(storage, 'setItem');
    const saved = await repo.saveCompanyCatalog({ expectedRevision: 0, items });
    expect(write).toHaveBeenCalledOnce();
    expect(saved.revision).toBe(1);
    expect(saved.items[0]!.name).toBe('自定义公司');
    const after = await repo.getSnapshot();
    expect(after.questions).toEqual(before.questions);
    expect(after.experiences).toEqual(before.experiences);
    expect(companyColorStyle('字节', saved)['--company-color']).toBe('#FFFFFF');
    expect(companyColorStyle('字节', saved)['--company-background']).toBe('#E1251B');
    saved.items[1]!.enabled = true;
    await repo.saveCompanyCatalog({ expectedRevision: 1, items: saved.items });
    expect((await repo.getSnapshot()).companyCatalog!.items[1]!.enabled).toBe(true);
    expect(items[0]!.name).toBe(' 自定义公司 ');
  });
  it('全局改名同步独立标签、历史公司和面经，来源关系、问法、次数及旧答案不变', async () => {
    const repo = createMockRepository(storage);
    await repo.getSnapshot();
    await repo.updateQuestionMeta('q-1', { companyTags: ['腾讯', '百度'] });
    const before = await repo.getSnapshot();
    const items = clone(getCompanyCatalog(before));
    const target = items.find((x) => x.name === '腾讯')!;
    target.name = '鹅厂';
    target.palette = 'blue';
    const write = vi.spyOn(storage, 'setItem');
    await repo.saveCompanyCatalog({ expectedRevision: 0, items });
    expect(write).toHaveBeenCalledOnce();
    const after = await repo.getSnapshot();
    expect(after.questions[0]!.companyTags).toEqual(['鹅厂', '百度']);
    expect(after.questions[0]!.historicalCompanies).toContain('鹅厂');
    expect(after.experiences[0]!.company).toBe('鹅厂');
    expect(after.occurrences).toEqual(before.occurrences);
    expect(after.reviews).toEqual(before.reviews);
    for (const q of after.questions) {
      const old = before.questions.find((x) => x.id === q.id)!;
      expect(q.notes).toBe(old.notes);
      expect(q.nextReview).toBe(old.nextReview);
      expect(occurrenceCount(after, q)).toBe(occurrenceCount(before, old));
    }
    expect(findCompany(after.companyCatalog!, '腾讯')!.name).toBe('鹅厂');
    expect(selectQuestions(after, { ...emptyFilters, company: '腾讯' }).total).toBe(
      selectQuestions(after, { ...emptyFilters, company: '鹅厂' }).total,
    );
    // Older callers using a former name cannot reintroduce it after a rename.
    await repo.updateQuestionMeta('q-1', { companyTags: ['腾讯'] });
    expect((await repo.getSnapshot()).questions[0]!.companyTags).toEqual(['鹅厂']);
  });
  it('字节改名同步两种历史名称且去重，停用仍能筛选历史', async () => {
    const repo = createMockRepository(storage);
    const seed = createSeed();
    seed.questions[0]!.historicalCompanies = ['字节', '字节跳动'];
    seed.questions[0]!.companyTags = ['字节', '字节跳动'];
    await repo.restore(seed);
    const items = clone(getCompanyCatalog(seed));
    items[0]!.name = 'Byte';
    items[0]!.enabled = false;
    await repo.saveCompanyCatalog({ expectedRevision: 0, items });
    const after = await repo.getSnapshot();
    expect(after.questions[0]!.historicalCompanies).toEqual(['Byte']);
    expect(companyNames(after, after.questions[0]!)).toEqual(['Byte']);
    expect(
      selectQuestions(after, { ...emptyFilters, company: 'Byte' }).items.map((q) => q.id),
    ).toContain('q-1');
  });
  it('保留最新业务变动；冲突不覆盖另一页面的配置，刷新后可重试', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const stale = clone(getCompanyCatalog(before));
    await repo.updateQuestionMeta('q-1', { mastery: '熟练', totalCount: 20 });
    await repo.saveCompanyCatalog({ expectedRevision: 0, items: [...stale, custom()] });
    const raw = await repo.exportRaw();
    await expect(repo.saveCompanyCatalog({ expectedRevision: 0, items: stale })).rejects.toThrow(
      '其他页面',
    );
    expect(await repo.exportRaw()).toBe(raw);
    const fresh = (await repo.getSnapshot()).companyCatalog!;
    fresh.items.reverse();
    await repo.saveCompanyCatalog({ expectedRevision: 1, items: fresh.items });
    const after = await repo.getSnapshot();
    expect(after.questions[0]!.mastery).toBe('熟练');
    expect(occurrenceCount(after, after.questions[0]!)).toBe(20);
  });
  it('重复名称、别名冲突、非法配置及删除已有 ID 均拒绝且不写入', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const catalog = getCompanyCatalog(before);
    const raw = await repo.exportRaw();
    for (const name of ['百度', ' 字节 ', '', '长'.repeat(101)]) {
      await expect(
        repo.saveCompanyCatalog({
          expectedRevision: 0,
          items: [...clone(catalog), { ...custom(), name }],
        }),
      ).rejects.toThrow();
      expect(await repo.exportRaw()).toBe(raw);
    }
    for (const patch of [{ palette: 'bad' }, { enabled: 1 }, { id: '' }, { aliases: [null] }]) {
      expect(() =>
        normalizeCatalogInput({ expectedRevision: 0, items: [{ ...custom(), ...patch }] } as never),
      ).toThrow();
    }
    await expect(repo.saveCompanyCatalog({ expectedRevision: 0, items: [] })).rejects.toThrow(
      '停用',
    );
    expect(await repo.exportRaw()).toBe(raw);
  });
  it('存储失败不留下配置或部分改名，输入可重试', async () => {
    const repo = createMockRepository(storage);
    const before = await repo.getSnapshot();
    const items = clone(getCompanyCatalog(before));
    items.find((x) => x.name === '腾讯')!.name = '新名称';
    const raw = await repo.exportRaw();
    storage.failWrites = true;
    await expect(repo.saveCompanyCatalog({ expectedRevision: 0, items })).rejects.toThrow(
      '存储失败',
    );
    expect(await repo.exportRaw()).toBe(raw);
    storage.failWrites = false;
    await repo.saveCompanyCatalog({ expectedRevision: 0, items });
    expect((await repo.getSnapshot()).experiences[0]!.company).toBe('新名称');
  });
  it('新旧 v1 备份可恢复；空配置与全部停用不补回，损坏配置不覆盖数据', async () => {
    const repo = createMockRepository(storage);
    await repo.restore(createSeed());
    const old = parseSnapshot(JSON.parse(await repo.exportRaw()));
    expect(old.companyCatalog).toBeUndefined();
    const items = clone(getCompanyCatalog(old)).map((x) => ({ ...x, enabled: false }));
    await repo.saveCompanyCatalog({ expectedRevision: 0, items });
    const backup = parseSnapshot(JSON.parse(await repo.exportRaw()));
    const restored = createMockRepository(new MemoryStorage());
    await restored.restore(backup);
    expect(await restored.getSnapshot()).toEqual(await repo.getSnapshot());
    expect(getCompanyCatalog(await restored.getSnapshot()).items.every((x) => !x.enabled)).toBe(
      true,
    );
    backup.companyCatalog = { revision: 3, items: [] };
    await restored.restore(backup);
    expect(getCompanyCatalog(await restored.getSnapshot()).items).toEqual([]);
    const raw = await restored.exportRaw();
    backup.companyCatalog = { revision: -1, items };
    await expect(restored.restore(backup)).rejects.toThrow();
    expect(await restored.exportRaw()).toBe(raw);
  });
});
