<script setup lang="ts">
import { computed, ref } from 'vue';
import { NDrawer, NDrawerContent, NButton, NResult } from 'naive-ui';
import { Pencil, Plus, Link2 } from 'lucide-vue-next';
import type { DeskSnapshot, Question } from '@/shared/types/domain';
import { questionOccurrences } from './model';
import MasteryBadge from '@/shared/components/MasteryBadge.vue';
import SourceBadges from '@/shared/components/SourceBadges.vue';
import OccurrenceEditor from './OccurrenceEditor.vue';
import OccurrenceCreate from './OccurrenceCreate.vue';
import { displayDate } from '@/shared/utils/dates';
const props = defineProps<{ id: string; data: DeskSnapshot }>();
defineEmits<{ close: []; edit: [question: Question] }>();
const q = computed(() => props.data.questions.find((q) => q.id === props.id));
const occurrences = computed(() =>
  questionOccurrences(props.data, props.id).map((o) => ({
    ...o,
    experience: props.data.experiences.find((x) => x.id === o.experienceId)!,
  })),
);
const editingId = ref('');
const recording = ref(false);
const editingOccurrence = computed(() => occurrences.value.find((o) => o.id === editingId.value));
</script>
<template>
  <NDrawer
    :show="!!id"
    width="min(720px, 100vw)"
    placement="right"
    @update:show="(show) => !show && $emit('close')"
    ><NDrawerContent title="题目详情" closable :native-scrollbar="false">
      <NResult
        v-if="!q"
        status="404"
        title="题目不存在"
        description="可能已恢复了其他备份，请返回题库重新选择。"
        ><template #footer><NButton @click="$emit('close')">回到题库</NButton></template></NResult
      >
      <div v-else class="question-detail">
        <section class="standard-question">
          <div class="detail-section-top">
            <h3>标准题目</h3>
            <NButton size="small" @click="$emit('edit', q)"
              ><template #icon><Pencil :size="14" /></template>编辑题目</NButton
            >
          </div>
          <div class="detail-chips">
            <span class="category-chip">{{ q.category }}</span
            ><MasteryBadge :mastery="q.mastery" /><span class="muted">{{ q.priority }}优先级</span>
          </div>
          <h2>{{ q.title }}</h2>
          <div class="tag-row">
            <span v-for="tag in q.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </section>
        <section class="detail-section">
          <h3>
            出现记录
            <span class="section-count">{{ q.historicalCount + occurrences.length }} 次</span>
          </h3>
          <div v-if="q.historicalCount" class="historical-note">
            <div class="historical-companies">
              <strong>历史累计 {{ q.historicalCount }} 次</strong>
              <SourceBadges v-for="name in q.historicalCompanies" :key="name" :company="name" />
              <span v-if="!q.historicalCompanies.length">未知</span>
            </div>
            <small>未记录逐次问法</small>
          </div>
          <article v-for="o in occurrences" :key="o.id" class="occurrence-card">
            <div class="occurrence-card-top">
              <SourceBadges
                :company="o.experience.company"
                :recruitment-type="o.experience.recruitmentType"
                :round="o.experience.round"
              /><NButton
                size="small"
                text
                type="primary"
                :aria-label="'编辑' + o.experience.company + '的这次问法'"
                @click="editingId = o.id"
                ><template #icon><Pencil :size="13" /></template>编辑问法</NButton
              >
            </div>
            <small v-if="o.experience.interviewDate"
              >面试 {{ displayDate(o.experience.interviewDate) }}</small
            >
            <div class="occurrence-wording">
              <span>实际问法 / 变形</span>
              <p v-if="o.wording.trim()">{{ o.wording }}</p>
              <p v-else class="muted">未记录实际问法</p>
            </div>
            <div v-if="o.followups.trim()" class="occurrence-wording">
              <span>追问</span>
              <p>{{ o.followups }}</p>
            </div>
            <div v-if="o.experience.source" class="source-note">
              <Link2 :size="12" />{{ o.experience.source }}
            </div>
          </article>
          <p v-if="!occurrences.length" class="muted occurrence-empty">暂无逐次出现记录</p>
          <NButton class="full-width" dashed @click="recording = true"
            ><template #icon><Plus :size="15" /></template>记录一次出现</NButton
          >
        </section>
      </div>
    </NDrawerContent></NDrawer
  >
  <OccurrenceEditor
    v-if="editingOccurrence"
    :key="editingOccurrence.id"
    :occurrence="editingOccurrence"
    :experience="editingOccurrence.experience"
    @close="editingId = ''"
    @saved="editingId = ''"
  />
  <OccurrenceCreate
    v-if="recording && q"
    :key="q.id"
    :question-id="q.id"
    @close="recording = false"
    @saved="recording = false"
  />
</template>
