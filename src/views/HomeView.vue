<script setup lang="ts">
import { ref } from 'vue';
import { useChecklistsStore } from '@/stores/checklists';
import ChecklistCard from '@/components/ChecklistCard.vue';
import CreateChecklistModal from '@/components/CreateChecklistModal.vue';

const store = useChecklistsStore();
const showCreate = ref(false);
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <header
      class="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
    >
      <div class="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="font-semibold text-slate-900 dark:text-slate-100 text-base">Tenant Buddy</h1>
        <button
          class="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 transition-colors"
          @click="showCreate = true"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New
        </button>
      </div>
    </header>

    <main class="max-w-xl mx-auto px-4 py-6">
      <div
        v-if="store.sortedChecklists.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
            />
          </svg>
        </div>
        <p class="text-slate-600 dark:text-slate-400 font-medium">No checklists yet</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">Create one to start tracking your move.</p>
        <button
          class="mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
          @click="showCreate = true"
        >
          Create checklist
        </button>
      </div>

      <div v-else class="space-y-3">
        <ChecklistCard v-for="item in store.sortedChecklists" :key="item.id" :checklist="item" />
      </div>
    </main>

    <CreateChecklistModal v-if="showCreate" @close="showCreate = false" />
  </div>
</template>
