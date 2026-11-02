import { companyPaletteKeys } from '@/shared/types/domain';
import type {
  CompanyCatalog,
  CompanyCatalogInput,
  CompanyTag,
  CompanyPaletteKey,
  DeskSnapshot,
} from '@/shared/types/domain';

const defaults: CompanyTag[] = [
  { id: 'company-byte', name: '字节跳动', aliases: ['字节'], palette: 'teal', enabled: true },
  { id: 'company-didi', name: '滴滴', aliases: [], palette: 'orange', enabled: true },
  { id: 'company-meituan', name: '美团', aliases: [], palette: 'yellow', enabled: true },
  { id: 'company-jd', name: '京东', aliases: [], palette: 'red', enabled: true },
  { id: 'company-kuaishou', name: '快手', aliases: [], palette: 'coral', enabled: true },
  { id: 'company-baidu', name: '百度', aliases: [], palette: 'white', enabled: true },
];
const brandPalettes: Record<string, CompanyPaletteKey> = {
  字节: 'teal',
  字节跳动: 'teal',
  滴滴: 'orange',
  美团: 'yellow',
  京东: 'red',
  快手: 'coral',
  百度: 'white',
  腾讯: 'blue',
  智谱: 'black',
};
export function companyBrandPalette(name: string): CompanyPaletteKey | undefined {
  const key = name.trim();
  return Object.hasOwn(brandPalettes, key) ? brandPalettes[key] : undefined;
}
export function findCompany(catalog: CompanyCatalog, name: string) {
  const value = name.trim();
  return catalog.items.find((item) => item.name === value || item.aliases.includes(value));
}
export function getCompanyCatalog(data?: DeskSnapshot): CompanyCatalog {
  if (data?.companyCatalog !== undefined) return data.companyCatalog;
  const catalog: CompanyCatalog = { revision: 0, items: structuredClone(defaults) };
  const names = [
    ...(data?.questions.flatMap((q) => [...q.historicalCompanies, ...(q.companyTags || [])]) || []),
    ...(data?.experiences.map((x) => x.company) || []),
  ];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || findCompany(catalog, name)) continue;
    catalog.items.push({
      id: 'legacy-company-' + encodeURIComponent(name),
      name,
      aliases: [],
      palette: companyBrandPalette(name) || 'purple',
      enabled: true,
    });
  }
  return catalog;
}
export function companyKey(catalog: CompanyCatalog, name: string): string {
  return findCompany(catalog, name)?.id || 'unconfigured:' + encodeURIComponent(name.trim());
}
export function companyName(catalog: CompanyCatalog, key: string): string {
  return (
    catalog.items.find((item) => item.id === key)?.name ||
    (key.startsWith('unconfigured:') ? decodeURIComponent(key.slice(13)) : '')
  );
}
export function canonicalCompany(catalog: CompanyCatalog, name: string): string {
  return findCompany(catalog, name)?.name || name.trim();
}
export function normalizeCatalogItems(value: unknown): CompanyTag[] {
  if (!Array.isArray(value)) throw new Error('公司标签配置格式无效');
  const ids = new Set<string>(),
    names = new Set<string>();
  return Array.from(value).map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('公司标签配置格式无效');
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id))
      throw new Error('公司标签 ID 无效或重复');
    ids.add(item.id);
    const validName = (name: unknown): name is string =>
      typeof name === 'string' && !!name.trim() && name.trim().length <= 100;
    if (
      !validName(item.name) ||
      !Array.isArray(item.aliases) ||
      !Array.from(item.aliases).every(validName)
    )
      throw new Error('公司名称不能为空，且不能超过 100 字');
    if (!companyPaletteKeys.includes(item.palette as never) || typeof item.enabled !== 'boolean')
      throw new Error('公司配色或启用状态无效');
    const name = item.name.trim();
    const aliases = [...new Set((item.aliases as string[]).map((x) => x.trim()))].filter(
      (x) => x !== name,
    );
    for (const text of [name, ...aliases]) {
      if (names.has(text)) throw new Error('公司名称或别名已存在：' + text);
      names.add(text);
    }
    return {
      id: item.id,
      name,
      aliases,
      palette: item.palette as CompanyTag['palette'],
      enabled: item.enabled,
    };
  });
}
export function validateCatalogRevision(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error('公司标签配置版本无效');
}
export function normalizeCatalogInput(input: CompanyCatalogInput): CompanyCatalogInput {
  if (!input || typeof input !== 'object') throw new Error('公司标签配置格式无效');
  validateCatalogRevision(input.expectedRevision);
  if (input.expectedRevision === Number.MAX_SAFE_INTEGER)
    throw new Error('公司标签配置版本已超出可更新范围');
  return { expectedRevision: input.expectedRevision, items: normalizeCatalogItems(input.items) };
}
