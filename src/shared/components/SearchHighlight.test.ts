import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchHighlight from './SearchHighlight.vue';

describe('搜索高亮组件', () => {
  it('精确保留空格标点和原始大小写，更新或清空查询时同步高亮', async () => {
    const text = '  实现并发控制 · Promise.all\n并发  ';
    const wrapper = mount(SearchHighlight, { props: { text, query: '并发' } });
    expect(wrapper.element.textContent).toBe(text);
    expect(wrapper.findAll('mark').map((item) => item.text())).toEqual(['并发', '并发']);
    expect(wrapper.findAll('[tabindex], button, a')).toHaveLength(0);
    await wrapper.setProps({ query: 'promise' });
    expect(wrapper.find('mark').text()).toBe('Promise');
    expect(wrapper.element.textContent).toBe(text);
    await wrapper.setProps({ query: '' });
    expect(wrapper.findAll('mark')).toHaveLength(0);
    expect(wrapper.element.textContent).toBe(text);
    wrapper.unmount();
  });

  it('HTML和特殊字符始终作为文本显示，不创建可执行节点', () => {
    const text = '<img src=x onerror=alert(1)> <script>alert(1)</script> & a+b';
    const wrapper = mount(SearchHighlight, { props: { text, query: '<img <script> a+b' } });
    expect(wrapper.findAll('img, script')).toHaveLength(0);
    expect(wrapper.element.textContent).toBe(text);
    expect(wrapper.findAll('mark').map((item) => item.text())).toEqual(['<img', '<script>', 'a+b']);
    wrapper.unmount();
  });
});
