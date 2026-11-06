import { computed, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import CompanyLabel from './CompanyLabel.vue';
import MasteryBadge from './MasteryBadge.vue';

describe('彩色公司胶囊', () => {
  it('配置换色更新胶囊，名称和可访问完整提示同步更新，无额外停靠点', async () => {
    const catalog = ref(getCompanyCatalog());
    const wrapper = mount(CompanyLabel, {
      props: { name: '字节跳动' },
      global: { provide: { [companyCatalogKey as symbol]: computed(() => catalog.value) } },
    });
    expect(wrapper.attributes('style')).toContain('--company-background: #00B7C3');
    expect(wrapper.find('i').exists()).toBe(false);
    expect(wrapper.findAll('button, a, [tabindex]')).toHaveLength(0);
    catalog.value.items[0]!.palette = 'red';
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('style')).toContain('--company-background: #E1251B');
    const longName = '非常长的公司完整名称';
    await wrapper.setProps({ name: longName });
    expect(wrapper.text()).toBe(longName);
    expect(wrapper.attributes('title')).toBe(longName);
    wrapper.unmount();
  });
  it('草稿配色预览优先，白色有灰边，读取不改写配置', async () => {
    const catalog = getCompanyCatalog();
    const original = structuredClone(catalog);
    const wrapper = mount(CompanyLabel, { props: { name: '百度', catalog } });
    expect(wrapper.attributes('style')).toContain('--company-background: #FFFFFF');
    expect(wrapper.attributes('style')).toContain('--company-border: #CBD5E1');
    await wrapper.setProps({ palette: 'yellow' });
    expect(wrapper.attributes('style')).toContain('--company-background: #FFD100');
    expect(wrapper.attributes('style')).toContain('--company-color: #111827');
    expect(catalog).toEqual(original);
    wrapper.unmount();
  });
  it.each(['不会', '模糊', '基本掌握', '熟练'] as const)(
    '掌握状态 %s 使用完整文字且无额外色点',
    (mastery) => {
      const wrapper = mount(MasteryBadge, { props: { mastery } });
      expect(wrapper.text()).toBe(mastery);
      expect(wrapper.findAll('i')).toHaveLength(0);
      expect(wrapper.find('i').exists()).toBe(false);
      wrapper.unmount();
    },
  );
});
