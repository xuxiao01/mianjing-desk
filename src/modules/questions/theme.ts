import type { GlobalThemeOverrides } from 'naive-ui';

export const compactTableTheme: NonNullable<GlobalThemeOverrides['DataTable']> = {
  thPaddingMedium: '10px 18px',
  tdPaddingMedium: '10px 18px',
};

// Inherit the app palette; typography and control sizes apply only to the question workspace.
export const questionTheme: GlobalThemeOverrides = {
  common: {
    fontSize: '14px',
    fontSizeMini: '12px',
    fontSizeTiny: '12px',
    fontSizeSmall: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    heightSmall: '34px',
    heightMedium: '38px',
    heightLarge: '44px',
  },
  DataTable: {
    fontSizeMedium: '14px',
    thFontWeight: '500',
    thPaddingMedium: '14px 18px',
    tdPaddingMedium: '18px',
    lineHeight: '22px',
  },
  Pagination: { itemSizeMedium: '36px', itemFontSizeMedium: '14px' },
  Drawer: { titleFontSize: '18px' },
  Dialog: { fontSize: '14px', titleFontSize: '18px', lineHeight: '1.7' },
};
