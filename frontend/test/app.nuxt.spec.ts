import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import Brand from '../app/components/app/Brand.vue';
describe('application shell', () => {
  it('provides an accessible home link', async () => {
    const component = await mountSuspended(Brand);
    expect(component.text()).toBe('ThoughtFull');
    expect(component.get('a').attributes('aria-label')).toBe(
      'ThoughtFull home',
    );
  });
});
