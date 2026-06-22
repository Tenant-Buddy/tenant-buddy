<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useExport } from '@/composables/useExport';
import type { ExportData } from '@/composables/useExport';

const props = defineProps<ExportData>();

const { exportCSV, exportExcel, exportWord, exportPDF } = useExport();

const open = ref(false);
const exporting = ref<string | null>(null);
const containerRef = ref<HTMLElement | null>(null);

const formats = [
  { id: 'csv', ext: '.csv', label: 'CSV' },
  { id: 'excel', ext: '.xlsx', label: 'Excel' },
  { id: 'word', ext: '.docx', label: 'Word' },
  { id: 'pdf', ext: '.pdf', label: 'PDF' },
];

async function runExport(id: string) {
  exporting.value = id;
  open.value = false;
  try {
    if (id === 'csv') await exportCSV(props);
    else if (id === 'excel') await exportExcel(props);
    else if (id === 'word') await exportWord(props);
    else if (id === 'pdf') await exportPDF(props);
  } finally {
    exporting.value = null;
  }
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<template>
  <div class="relative" ref="containerRef">
    <button
      class="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      @click="open = !open"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Export
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="scale-95 opacity-0"
      enter-to-class="scale-100 opacity-1"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="scale-100 opacity-1"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="open"
        class="absolute right-0 mt-1 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 z-20 origin-top-right"
      >
        <button
          v-for="fmt in formats"
          :key="fmt.id"
          class="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          :disabled="exporting === fmt.id"
          @click="runExport(fmt.id)"
        >
          <span class="text-xs font-mono font-semibold w-10 text-slate-400">{{ fmt.ext }}</span>
          <span>{{ fmt.label }}</span>
          <svg
            v-if="exporting === fmt.id"
            class="w-3 h-3 ml-auto animate-spin text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>
