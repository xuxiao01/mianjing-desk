<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { NButton, NForm, NFormItem, NInput, NModal, useMessage } from 'naive-ui';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from 'lucide-vue-next';
import type { CompanyTag } from '@/shared/types/domain';
import { cloud } from './api';
import { useRefresh, useCatalog } from './queries';
import { useUnsavedChanges } from '@/shared/composables/useUnsavedChanges';
import { normalizeCatalogItems } from '@/shared/utils/companyCatalog';
import CompanyLabel from '@/shared/components/CompanyLabel.vue';
import { companyPalettes, toneStyle } from '@/shared/utils/companyColors';

const props = defineProps<{ contextDirty?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const surface = ref<HTMLDivElement>();
const nameInput = ref<InstanceType<typeof NInput>>();
const { data, refetch } = useCatalog();
const refresh = useRefresh();
const starting = { items: (data.value?.items || []).map((c) => ({ ...c, aliases: [] })) };
const items = ref<CompanyTag[]>(JSON.parse(JSON.stringify(starting.items)));
const baseline = ref(JSON.stringify(items.value));
const editing = ref<string | null>(null);
const form = reactive({ name: '', palette: 'purple' as CompanyTag['palette'] });
const formBaseline = ref('');
const formError = ref(''),
  saveError = ref('');
const pending = ref(false);
const dirty = computed(
  () =>
    JSON.stringify(items.value) !== baseline.value ||
    (!!editing.value && JSON.stringify(form) !== formBaseline.value),
);
const { allowLeave } = useUnsavedChanges(() => dirty.value, {
  isPending: () => pending.value,
  routeDirty: () => dirty.value || !!props.contextDirty,
});
const message = useMessage();
function edit(item?: CompanyTag) {
  editing.value = item?.id || 'new';
  form.name = item?.name || '';
  form.palette = item?.palette || 'purple';
  formBaseline.value = JSON.stringify(form);
  formError.value = '';
  void nextTick(() => nameInput.value?.focus());
}
function applyEdit() {
  const old = items.value.find((item) => item.id === editing.value);
  const next: CompanyTag = {
    id: old?.id || crypto.randomUUID(),
    name: form.name,
    aliases: old?.aliases || [],
    palette: form.palette,
    enabled: old?.enabled ?? true,
  };
  try {
    const draft = old
      ? items.value.map((item) => (item.id === old.id ? next : item))
      : [...items.value, next];
    items.value = normalizeCatalogItems(draft);
    editing.value = null;
    formError.value = '';
    void nextTick(() => {
      [...(surface.value?.querySelectorAll<HTMLButtonElement>('[data-company-id]') || [])]
        .find((button) => button.dataset.companyId === next.id)
        ?.focus();
    });
    return true;
  } catch (error) {
    formError.value = (error as Error).message;
    return false;
  }
}
async function cancelEdit() {
  if (JSON.stringify(form) === formBaseline.value || (await allowLeave())) editing.value = null;
}
function move(index: number, delta: number) {
  const other = index + delta;
  if (other < 0 || other >= items.value.length) return;
  const focused = document.activeElement as HTMLElement | null;
  [items.value[index], items.value[other]] = [items.value[other]!, items.value[index]!];
  void nextTick(() => {
    if (focused?.isConnected) focused.focus();
  });
}
async function close() {
  if (!pending.value && (await allowLeave())) emit('close');
}
async function reload() {
  if (!(await allowLeave())) return;
  const result = await refetch();
  if (result.error) {
    saveError.value = result.error.message;
    return;
  }
  const fresh = { items: (result.data?.items || []).map((c) => ({ ...c, aliases: [] })) };
  items.value = JSON.parse(JSON.stringify(fresh.items));
  baseline.value = JSON.stringify(items.value);
  editing.value = null;
  saveError.value = '';
}
async function save() {
  if (pending.value) return;
  if (editing.value && !applyEdit()) return;
  // An explicit first save also persists the derived defaults; subsequent clean saves do nothing.
  if (!dirty.value) {
    emit('close');
    return;
  }
  try {
    pending.value = true;
    await cloud.saveCatalog({ items: items.value.map((c, index) => ({ ...c, sortOrder: index })) });
    await refresh();
    baseline.value = JSON.stringify(items.value);
    message.success('公司标签配置已保存');
    emit('close');
  } catch (error) {
    saveError.value = (error as Error).message;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <NModal :show="true" :mask-closable="false" :close-on-esc="false" @update:show="close">
    <div
      ref="surface"
      class="modal-surface company-catalog-manager"
      role="dialog"
      aria-modal="true"
      aria-label="管理公司标签"
    >
      <div class="modal-top">
        <h2>管理公司标签</h2>
        <button
          class="icon-button"
          aria-label="关闭公司标签管理"
          :disabled="pending"
          @click="close"
        >
          <X :size="20" />
        </button>
      </div>
      <p class="catalog-note">全站共用。改名会同步已有公司名称；停用只移出新增候选项。</p>
      <div class="catalog-heading">
        <strong
          >公司标签 <small>{{ items.length }}</small></strong
        ><NButton :disabled="pending || !!editing" @click="edit()"
          ><template #icon><Plus :size="15" /></template>新增公司</NButton
        >
      </div>
      <NForm
        v-if="editing"
        class="catalog-edit-form"
        :disabled="pending"
        @submit.prevent="applyEdit"
      >
        <NFormItem
          label="公司名称"
          :validation-status="formError ? 'error' : undefined"
          :feedback="formError || undefined"
          ><NInput
            ref="nameInput"
            v-model:value="form.name"
            :maxlength="100"
            placeholder="输入公司名称"
            :input-props="{ 'aria-label': '配置公司名称' }"
        /></NFormItem>
        <NFormItem label="气泡颜色"
          ><div class="catalog-palette" role="group" aria-label="气泡颜色">
            <button
              v-for="option in companyPalettes"
              :key="option.key"
              type="button"
              :style="toneStyle(option.tone)"
              :aria-pressed="form.palette === option.key"
              :disabled="pending"
              @click="form.palette = option.key"
            >
              <span class="palette-check" aria-hidden="true"
                ><Check v-if="form.palette === option.key" :size="12"
              /></span>
              <span>{{ option.label }}</span>
            </button>
          </div></NFormItem
        >
        <div class="catalog-form-actions">
          <NButton :disabled="pending" @click="cancelEdit">取消编辑</NButton
          ><NButton attr-type="submit" :disabled="pending"
            >确认{{ editing === 'new' ? '添加' : '修改' }}</NButton
          >
        </div>
      </NForm>
      <div class="catalog-list">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="catalog-row"
          :class="{ inactive: !item.enabled }"
        >
          <CompanyLabel class="catalog-chip" :name="item.name" :palette="item.palette" />
          <span class="catalog-row-color"
            >{{ companyPalettes.find((p) => p.key === item.palette)?.label }}色<span
              v-if="!item.enabled"
            >
              · 已停用</span
            ></span
          >
          <div class="catalog-row-actions">
            <button
              class="icon-button"
              :aria-label="'编辑公司' + item.name"
              :data-company-id="item.id"
              :disabled="pending || !!editing"
              @click="edit(item)"
            >
              <Pencil :size="15" /></button
            ><button
              class="icon-button"
              :aria-label="'上移' + item.name"
              :disabled="pending || !!editing || index === 0"
              @click="move(index, -1)"
            >
              <ArrowUp :size="15" /></button
            ><button
              class="icon-button"
              :aria-label="'下移' + item.name"
              :disabled="pending || !!editing || index === items.length - 1"
              @click="move(index, 1)"
            >
              <ArrowDown :size="15" /></button
            ><NButton text :disabled="pending || !!editing" @click="item.enabled = !item.enabled">{{
              item.enabled ? '停用' : '启用'
            }}</NButton>
          </div>
        </div>
        <p v-if="!items.length" class="catalog-note">暂无公司标签，点击「新增公司」开始配置。</p>
      </div>
      <div v-if="saveError" role="alert" class="catalog-error">
        {{ saveError }}<NButton text :disabled="pending" @click="reload">重新加载配置</NButton>
      </div>
      <footer class="modal-footer">
        <span v-if="dirty">有未保存的配置</span
        ><NButton :disabled="pending" @click="close">取消</NButton
        ><NButton type="primary" :loading="pending" @click="save">保存配置</NButton>
      </footer>
    </div>
  </NModal>
</template>

<style scoped>
.company-catalog-manager.modal-surface {
  width: min(720px, calc(100vw - 32px));
  font-size: 14px;
  display: flex;
  flex-direction: column;
}
.company-catalog-manager > :not(.catalog-list) {
  flex-shrink: 0;
}
.modal-top h2 {
  font-size: 22px;
}
.catalog-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 20px;
}
.catalog-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 20px 0 12px;
}
.catalog-heading small {
  color: var(--muted);
  font-weight: 400;
  margin-left: 6px;
}
.catalog-list {
  display: grid;
  flex: 1 1 auto;
  min-height: 120px;
  max-height: 480px;
  overflow: auto;
}
.catalog-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.catalog-chip {
  font-size: 14px;
  max-width: 100%;
}
.catalog-palette button {
  border: 1px solid var(--company-border);
  color: var(--company-color);
  background: var(--company-background);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 14px;
  overflow-wrap: anywhere;
  max-width: 100%;
}
.catalog-row-color {
  color: var(--muted);
  font-size: 12px;
}
.catalog-row-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.catalog-row.inactive .catalog-chip {
  border-style: dashed;
}
.catalog-edit-form {
  padding: 16px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.catalog-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.catalog-palette button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 18px;
  min-height: 36px;
  cursor: pointer;
}
.palette-check {
  position: absolute;
  left: 3px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  width: 12px;
}
.catalog-palette button:hover:not(:disabled) {
  background: var(--company-hover-background);
}
.catalog-palette button[aria-pressed='true'] {
  background: var(--company-selected-background);
}
.catalog-palette button:focus-visible {
  outline: 2px solid var(--company-focus-color);
  outline-offset: 3px;
}
.catalog-palette button:disabled {
  opacity: 1;
  border-style: dashed;
  cursor: wait;
}
.catalog-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.catalog-error {
  color: var(--danger);
  font-size: 12px;
  margin-top: 12px;
}
.catalog-error .n-button {
  margin-left: 8px;
}
.modal-footer > span {
  font-size: 12px;
}
@media (max-width: 600px) {
  .catalog-row-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .catalog-edit-form {
    padding: 12px;
  }
}
</style>
