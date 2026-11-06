// One palette feeds CSS custom properties and the Naive UI theme.
export const palette = {
  primary: '#202124',
  'primary-hover': '#111113',
  'primary-pressed': '#09090B',
  'primary-soft': '#EFEFF1',
  'primary-line': '#A1A1AA',
  heading: '#202124',
  text: '#303136',
  muted: '#6B6B73',
  disabled: '#92929B',
  line: '#ECECEE',
  'line-strong': '#D7D7DC',
  surface: '#FFFFFF',
  'surface-2': '#F5F5F6',
  'surface-3': '#EFEFF1',
  bg: '#FAFAFA',
  success: '#287D46',
  'success-soft': '#EFF6F0',
  warning: '#A66513',
  'warning-soft': '#FFF7E8',
  danger: '#B42318',
  'danger-soft': '#FDECEB',
  'focus-ring': 'rgb(32 33 36 / 16%)',
  overlay: 'rgb(32 33 36 / 28%)',
  'shadow-modal': '0 25px 90px rgb(32 33 36 / 12%)',
} as const;

export function installPalette() {
  for (const [name, value] of Object.entries(palette))
    document.documentElement.style.setProperty(`--${name}`, value);
}
