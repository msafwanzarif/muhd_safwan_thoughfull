export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo-brand',
      secondary: 'teal-brand',
      neutral: 'slate',
    },
    button: {
      slots: { base: 'min-h-11 rounded-full font-heading font-semibold' },
    },
    input: { slots: { base: 'min-h-11' } },
    select: { slots: { base: 'min-h-11', item: 'min-h-11' } },
    selectMenu: { slots: { base: 'min-h-11', item: 'min-h-11' } },
    tabs: { slots: { trigger: 'min-h-11' } },
    alert: { defaultVariants: { variant: 'soft' } },
  },
});
