import { createSeed } from '@/mocks/seed';
import { getCompanyCatalog } from './companyCatalog';
import { describe, expect, it } from 'vitest';
import { companyColorStyle, companyPalettes, companyTone } from './companyColors';

function luminance(hex: string) {
  const values = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
}
function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + 0.05) / (low! + 0.05);
}

describe('实心公司配色', () => {
  it.each([
    ['字节跳动', '#00B7C3', '#111827'],
    ['滴滴', '#FF7D00', '#111827'],
    ['美团', '#FFD100', '#111827'],
    ['京东', '#E1251B', '#FFFFFF'],
    ['快手', '#FF5000', '#111827'],
    ['百度', '#FFFFFF', '#111827'],
    ['腾讯', '#0052D9', '#FFFFFF'],
    ['智谱', '#111111', '#FFFFFF'],
  ])('%s 使用约定品牌近似色', (name, background, color) => {
    expect(companyTone(name)).toMatchObject({ background, color });
    expect(companyTone(name, getCompanyCatalog(createSeed()))).toMatchObject({ background, color });
  });
  it('字节别名一致；白色有灰边，所有配色状态均清晰且焦点在白底上可辨认', () => {
    expect(companyTone(' 字节 ')).toEqual(companyTone('字节跳动'));
    expect(companyTone('百度').border).toBe('#CBD5E1');
    expect(companyPalettes).toHaveLength(10);
    for (const { tone } of companyPalettes) {
      for (const background of [tone.background, tone.hoverBackground, tone.selectedBackground])
        expect(contrast(tone.color, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tone.focus, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    }
  });
  it('未选公司仍为中性色；自定义公司回退实心紫色，原八个键继续有效', () => {
    expect(companyTone('').color).toBe('#56657F');
    expect(companyTone().background).toBe('#F5F8FC');
    for (const name of ['其他', '新公司', 'constructor', 'toString'])
      expect(companyTone(name)).toMatchObject({ color: '#FFFFFF', background: '#6F42C1' });
    expect(companyPalettes.slice(0, 8).map((item) => item.key)).toEqual([
      'teal',
      'orange',
      'yellow',
      'red',
      'coral',
      'blue',
      'purple',
      'gray',
    ]);
    expect(companyColorStyle('腾讯')['--company-focus-color']).not.toBe('#FFFFFF');
  });
  it('已保存配置始终优先，读取不会重设用户自行修改的公司颜色', () => {
    const data = createSeed();
    const catalog = getCompanyCatalog(data);
    catalog.items.find((item) => item.name === '百度')!.palette = 'black';
    data.companyCatalog = catalog;
    expect(companyTone('百度', getCompanyCatalog(data))).toMatchObject({
      background: '#111111',
      color: '#FFFFFF',
    });
    expect(getCompanyCatalog(data).items.find((item) => item.name === '百度')!.palette).toBe(
      'black',
    );
  });
});
