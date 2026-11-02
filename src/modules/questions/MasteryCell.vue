<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { NPopover } from 'naive-ui';
import { masteries } from '@/shared/types/domain';
import type { Mastery, Question, QuestionMetaPatch } from '@/shared/types/domain';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';

const props = defineProps<{
  question: Question;
  busy: boolean;
  save: (patch: QuestionMetaPatch) => Promise<boolean>;
}>();
const open = ref(false);
const trigger = ref<HTMLButtonElement>();
const menu = ref<HTMLDivElement>();
watch(open, async (value) => {
  if (!value) return;
  await nextTick();
  menu.value?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
});
function hide() {
  open.value = false;
  if (trigger.value?.isConnected) trigger.value.focus();
}
async function select(value: Mastery) {
  if (props.busy) return;
  if (value === props.question.mastery || (await props.save({ mastery: value }))) hide();
}
function navigate(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    hide();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = [...menu.value!.querySelectorAll<HTMLButtonElement>('button')];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[index]?.focus();
}
</script>

<template>
  <NPopover
    :show="open"
    trigger="click"
    placement="bottom-start"
    @update:show="
      (value) => {
        if (!busy) open = value;
      }
    "
  >
    <template #trigger>
      <button
        ref="trigger"
        type="button"
        class="cell-edit mastery-edit"
        :disabled="busy"
        :aria-busy="busy"
        :aria-expanded="open"
        aria-haspopup="menu"
        :aria-label="'编辑' + question.title + '的掌握程度'"
        @keydown.down.prevent="open = true"
      >
        <MasteryBadge :mastery="question.mastery" />
      </button>
    </template>
    <div
      ref="menu"
      class="mastery-edit-menu"
      role="menu"
      aria-label="设置掌握程度"
      @keydown="navigate"
    >
      <button
        v-for="value in masteries"
        :key="value"
        type="button"
        role="menuitemradio"
        :aria-checked="value === question.mastery"
        :disabled="busy"
        @click="select(value)"
      >
        <MasteryBadge :mastery="value" /><span v-if="value === question.mastery" aria-hidden="true"
          >✓</span
        >
      </button>
      <small v-if="busy">正在保存…</small>
    </div>
  </NPopover>
</template>

<style scoped>
.mastery-edit-menu {
  display: grid;
  gap: 4px;
  min-width: 156px;
}
.mastery-edit-menu :deep(.mastery-badge) {
  padding: 2px 7px;
  font-size: 14px;
  line-height: 22px;
}
.mastery-edit-menu button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 36px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
}
.mastery-edit-menu button:hover,
.mastery-edit-menu button:focus-visible {
  background: var(--surface-2);
  outline: 2px solid var(--primary-line);
}
.mastery-edit-menu button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.mastery-edit-menu small {
  color: var(--muted);
  font-size: 12px;
  padding: 4px 8px;
}
</style>
