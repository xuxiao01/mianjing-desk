import type { CompanyCatalog, CompanyPaletteKey } from '@/shared/types/domain';
import { companyBrandPalette, findCompany } from './companyCatalog';

export interface CompanyTone {
  color: string;
  background: string;
  hoverBackground: string;
  selectedBackground: string;
  border: string;
  selectedBorder: string;
  focus: string;
}
const neutral: CompanyTone = {
  color: '#56657F',
  background: '#F5F8FC',
  hoverBackground: '#E9EEF6',
  selectedBackground: '#E9EEF6',
  border: '#C3CDDC',
  selectedBorder: '#56657F',
  focus: '#56657F',
};
function solid(
  background: string,
  color: string,
  interaction: string,
  focus: string,
  border = background,
): CompanyTone {
  return {
    color,
    background,
    hoverBackground: interaction,
    selectedBackground: interaction,
    border,
    selectedBorder: focus,
    focus,
  };
}
const tones: Record<CompanyPaletteKey, CompanyTone> = {
  teal: solid('#00B7C3', '#111827', '#00ABB6', '#007780'),
  orange: solid('#FF7D00', '#111827', '#F57300', '#9A4500'),
  yellow: solid('#FFD100', '#111827', '#F5C800', '#8A6700'),
  red: solid('#E1251B', '#FFFFFF', '#C82017', '#A31810'),
  coral: solid('#FF5000', '#111827', '#F54800', '#A63000'),
  blue: solid('#0052D9', '#FFFFFF', '#0048C2', '#003EAD'),
  purple: solid('#6F42C1', '#FFFFFF', '#6138AB', '#502B96'),
  gray: solid('#56657F', '#FFFFFF', '#49576F', '#344258'),
  white: solid('#FFFFFF', '#111827', '#F3F4F6', '#111827', '#CBD5E1'),
  black: solid('#111111', '#FFFFFF', '#000000', '#111111'),
};
export const companyPalettes: { key: CompanyPaletteKey; label: string; tone: CompanyTone }[] = [
  { key: 'teal', label: '青', tone: tones.teal },
  { key: 'orange', label: '橙', tone: tones.orange },
  { key: 'yellow', label: '黄', tone: tones.yellow },
  { key: 'red', label: '红', tone: tones.red },
  { key: 'coral', label: '橘红', tone: tones.coral },
  { key: 'blue', label: '蓝', tone: tones.blue },
  { key: 'purple', label: '紫', tone: tones.purple },
  { key: 'gray', label: '灰', tone: tones.gray },
  { key: 'white', label: '白', tone: tones.white },
  { key: 'black', label: '黑', tone: tones.black },
];
export function paletteTone(key: CompanyPaletteKey): CompanyTone {
  return tones[key];
}
export function companyTone(company?: string, catalog?: CompanyCatalog): CompanyTone {
  const name = company?.trim();
  if (!name) return neutral;
  const configured = catalog && findCompany(catalog, name);
  return paletteTone(configured?.palette || companyBrandPalette(name) || 'purple');
}
export function toneStyle(tone: CompanyTone) {
  return {
    '--company-color': tone.color,
    '--company-background': tone.background,
    '--company-hover-background': tone.hoverBackground,
    '--company-selected-background': tone.selectedBackground,
    '--company-border': tone.border,
    '--company-selected-border': tone.selectedBorder,
    '--company-focus-color': tone.focus,
  };
}
export function companyColorStyle(company?: string, catalog?: CompanyCatalog) {
  return toneStyle(companyTone(company, catalog));
}

// Company color is a small identifier; text and interaction surfaces stay neutral.
export function dotStyle(tone: CompanyTone) {
  return {
    '--company-dot': tone.background,
    '--company-dot-border':
      tone.background === '#FFFFFF'
        ? '#A1A1AA'
        : tone.background === '#FFD100'
          ? '#A88B00'
          : tone.background,
  };
}
export function companyDotStyle(company?: string, catalog?: CompanyCatalog) {
  return dotStyle(companyTone(company, catalog));
}
