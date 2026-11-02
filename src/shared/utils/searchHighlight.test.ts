import { describe, expect, it } from 'vitest';
import { highlightTerms, splitHighlightText } from './searchHighlight';

describe('搜索高亮纯文本分段', () => {
  it.each([
    ['实现并发请求，并发控制', '并发', ['并发', '并发']],
    ['Promise 与并发控制，promise', '  并发\tPROMISE  ', ['Promise', '并发', 'promise']],
    ['并发控制与并发', '并发 并发控制 并发', ['并发控制', '并发']],
    ['ababa', 'aba bab', ['ababa']],
    ['并发控制', '并发 控制', ['并发控制']],
    ['Promise.all · a+b · [0] · ?', 'Promise.all a+b [0] ?', ['Promise.all', 'a+b', '[0]', '?']],
    [
      '\\.*+?[](){}^$| 与 \\.*+?[](){}^$|',
      '\\.*+?[](){}^$|',
      ['\\.*+?[](){}^$|', '\\.*+?[](){}^$|'],
    ],
    ['İ Promise 🚀 并发', 'İ promise 并发', ['İ', 'Promise', '并发']],
    ['ΟΣ 并发', 'ΟΣ 并发', ['ΟΣ', '并发']],
    ['<img src=x>  并发\nPromise & 笔记', '<img 并发 promise', ['<img', '并发', 'Promise']],
    ['完整原文  标点，换行\n', '不存在', []],
    ['完整原文  标点，换行\n', ' \t\n ', []],
    ['', '并发', []],
  ])('保持原文并正确标记 %j / %j', (text, query, expected) => {
    const parts = splitHighlightText(text, query);
    expect(parts.map((part) => part.text).join('')).toBe(text);
    expect(parts.filter((part) => part.highlighted).map((part) => part.text)).toEqual(expected);
    expect(parts.every((part) => !!part.text)).toBe(true);
  });

  it('按现有空白拆词规则去重，预处理后的查询可在多个字段复用且不被修改', () => {
    const terms = highlightTerms('  并发\tPROMISE promise\n并发  ');
    expect(terms).toEqual(['并发', 'promise']);
    Object.freeze(terms);
    expect(splitHighlightText('Promise.all', terms)).toEqual([
      { text: 'Promise', highlighted: true },
      { text: '.all', highlighted: false },
    ]);
    expect(splitHighlightText('并发控制', terms)).toEqual([
      { text: '并发', highlighted: true },
      { text: '控制', highlighted: false },
    ]);
    expect(terms).toEqual(['并发', 'promise']);
  });
});
