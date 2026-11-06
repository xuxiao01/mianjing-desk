import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { frequencyBand } from './frequency';
import FrequencyBadge from './FrequencyBadge.vue';
import OrganizedBadge from './OrganizedBadge.vue';

describe('次数和整理标签', () => {
  it.each([
    [0, 'none'],
    [1, 'low'],
    [2, 'low'],
    [3, 'medium'],
    [4, 'medium'],
    [5, 'high'],
    [7, 'high'],
    [10, 'high'],
    [Number.MAX_SAFE_INTEGER, 'high'],
  ] as const)('次数 %s 使用固定频率档位 %s', (count, band) => {
    expect(frequencyBand(count)).toBe(band);
    const wrapper = mount(FrequencyBadge, { props: { count } });
    expect(wrapper.text()).toBe(String(count));
    expect(wrapper.classes()).toContain(band);
    expect(wrapper.attributes('aria-label')).toBe(`出现 ${count} 次`);
    expect(wrapper.findAll('button, a, [tabindex]')).toHaveLength(0);
    wrapper.unmount();
  });
  it('次数修改后刷新档位，不增加说明小字', async () => {
    const wrapper = mount(FrequencyBadge, { props: { count: 2 } });
    await wrapper.setProps({ count: 5 });
    expect(wrapper.classes()).toContain('high');
    expect(wrapper.text()).toBe('5');
    expect(wrapper.find('small').exists()).toBe(false);
    wrapper.unmount();
  });
  it('整理状态显示是/否，无障碍名称保留完整含义，组件不触发保存', async () => {
    const wrapper = mount(OrganizedBadge, { props: { organized: false } });
    expect(wrapper.text()).toBe('否');
    expect(wrapper.attributes('aria-label')).toBe('待整理');
    await wrapper.setProps({ organized: true });
    expect(wrapper.text()).toBe('是');
    expect(wrapper.attributes('aria-label')).toBe('已整理');
    expect(wrapper.classes()).toContain('done');
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });
});
