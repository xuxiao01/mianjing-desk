<script setup lang="ts">
import { NResult, NButton } from 'naive-ui';
</script>
<template>
  <NResult status="404" title="这里还没有内容" description="这个地址不存在，回到题库继续学习吧。"
    ><template #footer
      ><RouterLink to="/questions"
        ><NButton type="primary">回到我的题库</NButton></RouterLink
      ></template
    ></NResult
  >
</template>
