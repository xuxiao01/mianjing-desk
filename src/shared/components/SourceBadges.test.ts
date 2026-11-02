import { computed, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import SourceBadges from './SourceBadges.vue';

describe('来源气泡复用实心配色', () => {
  it('公司别名、招聘类型与轮次共同继承配置，改色立即生效', async () => {
    const catalog = ref(getCompanyCatalog());
    const wrapper = mount(SourceBadges, {
      props: { company: '字节', recruitmentType: '暑期', round: '二面' },
      global: { provide: { [companyCatalogKey as symbol]: computed(() => catalog.value) } },
    });
    expect(wrapper.findAll('.source-badge').map((item) => item.text())).toEqual([
      '字节跳动',
      '暑期',
      '二面',
    ]);
    expect(wrapper.attributes('style')).toContain('--company-background: #00B7C3');
    catalog.value.items[0]!.palette = 'black';
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('style')).toContain('--company-background: #111111');
    expect(wrapper.attributes('style')).toContain('--company-color: #FFFFFF');
    wrapper.unmount();
  });
});
