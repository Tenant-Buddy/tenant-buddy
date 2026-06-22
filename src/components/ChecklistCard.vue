<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { LocalChecklistRef } from '@/types';

const props = defineProps<{
  checklist: LocalChecklistRef;
}>();

const router = useRouter();

const typeLabel = computed(() => (props.checklist.type === 'checkin' ? 'Check-in' : 'Check-out'));
const dateLabel = computed(() =>
  new Date(props.checklist.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
);
const daysUntilDeletion = computed(() => {
  if (!props.checklist.pendingDeletionAt) return null;
  const remaining = 30 - Math.floor((Date.now() - props.checklist.pendingDeletionAt) / (24 * 60 * 60 * 1000));
  return Math.max(remaining, 0);
});

function navigate() {
  router.push(`/checklist/${props.checklist.id}`);
}
</script>

<template>
  <div
    class="group relative rounded-xl border bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    :class="checklist.pendingDeletionAt ? 'border-red-200 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'"
    @click="navigate"
  >
    <div
      v-if="checklist.pendingDeletionAt"
      class="mb-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
        />
      </svg>
      {{ daysUntilDeletion === 0 ? 'Deleting today' : `Will be deleted in ${daysUntilDeletion} day${daysUntilDeletion === 1 ? '' : 's'}` }}
    </div>

    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-medium text-slate-900 dark:text-slate-100 truncate">{{ checklist.name }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ checklist.countryLabel }} · {{ typeLabel }} · {{ dateLabel }}</p>
      </div>
      <svg
        class="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
</template>
