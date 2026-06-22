<script setup lang="ts">
import { ref } from 'vue';

const LS_KEY = 'tenant-buddy-privacy-accepted';

const visible = ref(!localStorage.getItem(LS_KEY));

function dismiss() {
  localStorage.setItem(LS_KEY, '1');
  visible.value = false;
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div v-if="visible" class="fixed bottom-0 inset-x-0 z-40 p-4 sm:p-6">
      <div
        class="max-w-2xl mx-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <p class="flex-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          This app uses Google Firebase to store checklist data and an anonymous session for abuse prevention. Your
          display name is stored locally and in activity logs. See
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            class="underline hover:text-slate-800 dark:hover:text-slate-200 whitespace-nowrap"
            >Google's privacy policy</a
          >.
        </p>
        <button
          class="flex-shrink-0 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium px-4 py-2 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
          @click="dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  </Transition>
</template>
