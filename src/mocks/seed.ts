import type { Category, DeskSnapshot, Mastery, Priority } from '@/shared/types/domain';

export function createSeed(): DeskSnapshot {
  const createdAt = '2026-10-01T08:00:00.000Z';
  const topics: [string, Category, string[], Priority, Mastery, number][] = [
    ['宏任务与微任务的执行顺序', '八股', ['JavaScript', '事件循环'], '高', '模糊', 7],
    ['Vue 3 响应式原理与 Vue 2 的区别', '八股', ['Vue', '响应式'], '高', '基本掌握', 4],
    ['手写防抖与节流', '手撕', ['JavaScript', '闭包'], '高', '基本掌握', 3],
    ['实现一个有并发限制的请求调度器', '手撕', ['Promise', '并发控制'], '高', '不会', 1],
    ['浏览器强缓存与协商缓存', '八股', ['HTTP', '浏览器'], '高', '模糊', 3],
    ['反转链表：迭代与递归', '算法', ['链表', '递归'], '中', '基本掌握', 3],
    ['如何排查页面白屏', '场景题', ['性能优化', '浏览器'], '中', '模糊', 1],
    ['flex: 1 究竟代表什么', '八股', ['CSS', 'Flexbox'], '高', '模糊', 2],
    ['实现支持循环引用的深拷贝', '手撕', ['JavaScript', 'WeakMap'], '高', '不会', 1],
    ['无重复字符的最长子串', '算法', ['滑动窗口', '字符串'], '中', '模糊', 1],
    ['前端如何处理跨域请求', '八股', ['HTTP', '跨域'], '中', '熟练', 2],
    ['设计一个倒计时组件', '场景题', ['Vue', '定时器'], '中', '基本掌握', 2],
    ['解释 JavaScript 原型与原型链', '八股', ['JavaScript', '原型链'], '高', '基本掌握', 6],
    ['实现一个发布订阅器', '手撕', ['JavaScript', '设计模式'], '中', '模糊', 2],
    ['输入 URL 到页面显示发生了什么', '八股', ['浏览器', '网络'], '中', '模糊', 1],
    ['合并重叠区间', '算法', ['排序', '数组'], '低', '基本掌握', 1],
  ];
  const notes = [
    '## 先记住一个原则\n\n同步任务执行完成后，清空微任务队列，再进入下一轮任务。\n\n```javascript\nconsole.log(1);\nsetTimeout(() => console.log(2));\nPromise.resolve().then(() => console.log(3));\n// 1 → 3 → 2\n```\n\n### 容易遗漏的追问\n- 渲染与事件循环有什么关系？\n- 微任务中继续添加微任务会怎样？',
    '## 核心区别\n\nVue 2 使用 Object.defineProperty；Vue 3 的 reactive 基于 Proxy。\n\n- 依赖收集：track\n- 更新触发：trigger\n- ref 包装单个值，reactive 代理对象。\n\n> 理解原理后，再尝试写一个最小实现。',
    '## 防抖\n连续触发时，只执行最后一次。\n\n```javascript\nfunction debounce(fn, delay) {\n  let timer;\n  return function (...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n```',
  ];
  return {
    version: 1,
    questions: topics.map(([title, category, tags, priority, mastery, historicalCount], i) => ({
      id: 'q-' + (i + 1),
      title,
      category,
      tags,
      priority,
      mastery,
      organized: i < 3 || mastery === '基本掌握' || mastery === '熟练',
      notes: notes[i] || '',
      historicalCount,
      historicalCompanies: [
        ['腾讯', '百度'],
        ['字节', '智谱'],
        ['滴滴', '百度'],
      ][i % 3]!,
      createdAt,
      updatedAt: createdAt,
      nextReview: null,
    })),
    experiences: [
      {
        id: 'e-1',
        company: '腾讯',
        role: '前端开发实习生',
        round: '一面',
        interviewDate: null,
        source: '演示面经 · 非真实面试记录',
        original: '围绕事件循环、Vue 响应式和性能排查展开。这条示例用于体验题目关联。',
        createdAt,
      },
      {
        id: 'e-2',
        company: '字节跳动',
        role: '前端开发实习生',
        round: '二面',
        interviewDate: null,
        source: '演示面经 · 非真实面试记录',
        original: '手写并发调度器，讨论异常处理、结果顺序与任务取消。',
        createdAt,
      },
    ],
    occurrences: [
      {
        id: 'o-1',
        questionId: 'q-1',
        experienceId: 'e-1',
        wording: 'Promise 和 setTimeout 的打印顺序是什么？',
        followups: '微任务里产生新微任务时怎么执行？',
      },
      {
        id: 'o-2',
        questionId: 'q-2',
        experienceId: 'e-1',
        wording: 'Proxy 与 defineProperty 的差别是什么？',
        followups: '',
      },
      {
        id: 'o-3',
        questionId: 'q-4',
        experienceId: 'e-2',
        wording: '给一组 URLs，最多并发 3 个请求，如何实现？',
        followups: '如何保持结果顺序？某个任务失败怎么办？',
      },
    ],
    reviews: [],
  };
}
