<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { useChecklistsStore } from '@/stores/checklists';

const emit = defineEmits<{ done: [] }>();

const store = useChecklistsStore();
const name = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => nextTick(() => inputRef.value?.focus()));

function submit() {
  if (!name.value.trim()) return;
  store.setDisplayName(name.value.trim());
  emit('done');
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-title"
        class="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6"
      >
        <h2 id="display-name-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          What's your name?
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Your name appears next to any changes you make to this checklist.
        </p>
        <input
          ref="inputRef"
          v-model="name"
          type="text"
          placeholder="e.g. Alex"
          maxlength="40"
          class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keydown.enter="submit"
        />
        <button
          :disabled="!name.trim()"
          class="mt-3 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium text-sm py-2 transition-colors"
          @click="submit"
        >
          Continue
        </button>
      </div>
    </div>
  </Teleport>
</template>
