import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import CompanyPicker from './CompanyPicker.vue';
import { companyKey, getCompanyCatalog } from '@/shared/utils/companyCatalog';

let wrapper: VueWrapper;
afterEach(() => wrapper.unmount());
describe('共享公司选择', () => {
  it('按配置顺序展示，搜索别名，单选可取消，无自由新增和其他选项', async () => {
    const catalog = getCompanyCatalog();
    wrapper = mount(CompanyPicker, { props: { catalog, modelValue: [] } });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).toEqual(
      catalog.items.map((x) => x.name),
    );
    expect(wrapper.text()).not.toContain('其他');
    await wrapper.find('input').setValue('字节');
    expect(wrapper.findAll('.bubble-choice')).toHaveLength(1);
    await wrapper.find('.bubble-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['company-byte']]);
    await wrapper.setProps({ modelValue: ['company-byte'] });
    await wrapper.find('.bubble-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[]]);
    await wrapper.find('.company-picker-top button').trigger('click');
    expect(wrapper.emitted('manage')).toHaveLength(1);
  });
  it('多选保持 ID，目录改名换色不丢选择；停用可移除不能重新加入', async () => {
    const catalog = getCompanyCatalog();
    catalog.items[0]!.enabled = false;
    wrapper = mount(CompanyPicker, {
      props: { catalog, modelValue: ['company-byte'], multiple: true },
    });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).not.toContain('字节跳动');
    const renamed = structuredClone(catalog);
    renamed.items[0]!.name = 'Byte';
    renamed.items[0]!.palette = 'red';
    await wrapper.setProps({ catalog: renamed });
    expect(wrapper.find('.company-tag-draft').text()).toBe('Byte');
    expect(wrapper.find('.company-tag-draft').attributes('style')).toContain('#E1251B');
    await wrapper.find('[aria-label="删除公司标签Byte"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[]]);
    await wrapper.setProps({ modelValue: [] });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).not.toContain('Byte');
  });
  it('明确空目录不恢复预设；禁用时不能触发选择与管理', async () => {
    wrapper = mount(CompanyPicker, {
      props: { catalog: { revision: 1, items: [] }, modelValue: [], disabled: true },
    });
    expect(wrapper.findAll('.bubble-choice')).toHaveLength(0);
    expect(wrapper.text()).toContain('没有可选公司');
    expect(wrapper.find('.company-picker-top button').attributes('disabled')).toBeDefined();
  });
  it('紧凑模式标签只出现一次，按目录顺序点选和取消，不显示重复区域', async () => {
    const catalog = getCompanyCatalog();
    const original = structuredClone(catalog);
    wrapper = mount(CompanyPicker, {
      props: { catalog, modelValue: ['company-byte'], multiple: true, compact: true },
    });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).toEqual(
      catalog.items.map((x) => x.name),
    );
    expect(wrapper.find('.company-picker-selected').exists()).toBe(false);
    expect(wrapper.find('.company-picker-top').exists()).toBe(false);
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.find('[aria-pressed="true"]').text()).toBe('字节跳动');
    await wrapper.find('.bubble-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[]]);
    await wrapper.setProps({ modelValue: [] });
    expect(wrapper.find('[aria-pressed="true"]').exists()).toBe(false);
    await wrapper.find('.bubble-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['company-byte']]);
    expect(catalog).toEqual(original);
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).toEqual(
      catalog.items.map((x) => x.name),
    );
  });

  it('紧凑模式显示已选停用及未配置标签，移除后不重新提供候选', async () => {
    const catalog = getCompanyCatalog();
    catalog.items[0]!.enabled = false;
    const unknown = companyKey(catalog, '未配置的公司');
    wrapper = mount(CompanyPicker, {
      props: { catalog, modelValue: ['company-byte', unknown], multiple: true, compact: true },
    });
    const selected = wrapper.findAll('[aria-pressed="true"]');
    expect(selected.map((x) => x.text())).toEqual(['字节跳动', '未配置的公司']);
    await selected[0]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[unknown]]);
    await wrapper.setProps({ modelValue: [unknown] });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).not.toContain('字节跳动');
    await wrapper.find('[aria-pressed="true"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([[]]);
    await wrapper.setProps({ modelValue: [] });
    expect(wrapper.findAll('.bubble-choice').map((x) => x.text())).not.toContain('未配置的公司');
  });

  it('紧凑搜索按过滤前数量在12个边界显示，支持别名且不随搜索结果隐藏', async () => {
    const catalog = getCompanyCatalog();
    for (let i = 6; i < 12; i++)
      catalog.items.push({
        id: 'extra-' + i,
        name: '公司' + i,
        aliases: [],
        palette: 'purple',
        enabled: true,
      });
    wrapper = mount(CompanyPicker, {
      props: { catalog, modelValue: [], multiple: true, compact: true },
    });
    expect(wrapper.find('input').exists()).toBe(false);
    const expanded = structuredClone(catalog);
    expanded.items.push({
      id: 'extra-12',
      name: '公司12',
      aliases: [],
      palette: 'purple',
      enabled: true,
    });
    await wrapper.setProps({ catalog: expanded });
    expect(wrapper.find('input').exists()).toBe(true);
    await wrapper.find('input').setValue('字节');
    expect(wrapper.findAll('.bubble-choice')).toHaveLength(1);
    expect(wrapper.find('input').exists()).toBe(true);
    await wrapper.find('input').setValue('不存在');
    expect(wrapper.text()).toContain('没有匹配标签');
    await wrapper.setProps({ catalog });
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.findAll('.bubble-choice')).toHaveLength(12);
  });

  it('紧凑空库不补回默认项；禁用时无法切换', async () => {
    wrapper = mount(CompanyPicker, {
      props: { catalog: { revision: 1, items: [] }, modelValue: [], multiple: true, compact: true },
    });
    expect(wrapper.text()).toBe('暂无标签');
    const catalog = getCompanyCatalog();
    await wrapper.setProps({ catalog, disabled: true });
    expect(
      wrapper.findAll('.bubble-choice').every((x) => x.attributes('disabled') !== undefined),
    ).toBe(true);
    await wrapper.find('.bubble-choice').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
