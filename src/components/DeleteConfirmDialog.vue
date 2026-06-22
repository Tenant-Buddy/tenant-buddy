<script setup lang="ts">
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        class="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6"
      >
        <h2 id="delete-confirm-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Delete checklist?
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
          This checklist will be marked for deletion and removed in 30 days. You can undo this before then.
        </p>
        <div class="flex gap-3">
          <button
            class="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 transition-colors"
            @click="emit('confirm')"
          >
            Mark for deletion
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
