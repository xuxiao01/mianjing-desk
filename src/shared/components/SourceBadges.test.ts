import { computed, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { companyCatalogKey } from '@/shared/composables/useCompanyCatalog';
import { getCompanyCatalog } from '@/shared/utils/companyCatalog';
import SourceBadges from './SourceBadges.vue';

describe('来源公司胶囊与中性轮次', () => {
  it('公司别名与胶囊读取配置，轮次和招聘类型不染色', async () => {
    const catalog = ref(getCompanyCatalog());
    const wrapper = mount(SourceBadges, {
      props: { company: '字节', recruitmentType: '暑期', round: '二面' },
      global: { provide: { [companyCatalogKey as symbol]: computed(() => catalog.value) } },
    });
    expect(wrapper.findAll('.company-label, .source-badge').map((item) => item.text())).toEqual([
      '字节跳动',
      '暑期',
      '二面',
    ]);
    expect(wrapper.find('.company-label').attributes('style')).toContain(
      '--company-background: #00B7C3',
    );
    catalog.value.items[0]!.palette = 'black';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.company-label').attributes('style')).toContain(
      '--company-background: #111111',
    );
    expect(wrapper.findAll('.source-badge').every((badge) => !badge.attributes('style'))).toBe(
      true,
    );
    wrapper.unmount();
  });
});
