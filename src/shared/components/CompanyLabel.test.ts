import { computed, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import CompanyLabel from './CompanyLabel.vue';
import MasteryBadge from './MasteryBadge.vue';

describe('中性公司标识', () => {
  it('配置换色只更新色点，名称和可访问完整提示同步更新，无额外停靠点', async () => {
    const catalog = ref(getCompanyCatalog());
    const wrapper = mount(CompanyLabel, {
      props: { name: '字节跳动' },
      global: { provide: { [companyCatalogKey as symbol]: computed(() => catalog.value) } },
    });
    expect(wrapper.attributes('style')).toContain('--company-dot: #00B7C3');
    expect(wrapper.find('i').attributes('aria-hidden')).toBe('true');
    expect(wrapper.findAll('button, a, [tabindex]')).toHaveLength(0);
    catalog.value.items[0]!.palette = 'red';
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('style')).toContain('--company-dot: #E1251B');
    const longName = '非常长的公司完整名称';
    await wrapper.setProps({ name: longName });
    expect(wrapper.text()).toBe(longName);
    expect(wrapper.attributes('title')).toBe(longName);
    wrapper.unmount();
  });
  it('草稿配色预览优先，白色与黄色有独立轮廓，读取不改写配置', async () => {
    const catalog = getCompanyCatalog();
    const original = structuredClone(catalog);
    const wrapper = mount(CompanyLabel, { props: { name: '百度', catalog } });
    expect(wrapper.attributes('style')).toContain('--company-dot: #FFFFFF');
    expect(wrapper.attributes('style')).toContain('--company-dot-border: #A1A1AA');
    await wrapper.setProps({ palette: 'yellow' });
    expect(wrapper.attributes('style')).toContain('--company-dot: #FFD100');
    expect(wrapper.attributes('style')).toContain('--company-dot-border: #A88B00');
    expect(catalog).toEqual(original);
    wrapper.unmount();
  });
  it.each(['不会', '模糊', '基本掌握', '熟练'] as const)(
    '掌握状态 %s 保留文字和独立语义色点',
    (mastery) => {
      const wrapper = mount(MasteryBadge, { props: { mastery } });
      expect(wrapper.text()).toBe(mastery);
      expect(wrapper.findAll('i')).toHaveLength(1);
      expect(wrapper.find('i').attributes('aria-hidden')).toBe('true');
      wrapper.unmount();
    },
  );
});
