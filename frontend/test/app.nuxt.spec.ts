import { describe, it, expect } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import Brand from '../app/components/app/Brand.vue';
describe('application shell', () => {
  it('provides an accessible home link', async () => {
    const component = await mountSuspended(Brand);
    expect(component.get('svg').attributes('aria-hidden')).toBe('true');
    expect(component.findAll('svg path').length).toBeGreaterThan(0);
    expect(component.get('a').attributes('aria-label')).toBe(
      'ThoughtFull home',
    );
  });
});
