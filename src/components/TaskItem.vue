<script setup lang="ts">
import { ref, nextTick } from 'vue';
import NoteThread from './NoteThread.vue';
import type { Task, DerivedTaskState } from '@/types';

const props = defineProps<{
  task: Task;
  state: DerivedTaskState | undefined;
  isCustom?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  'add-note': [text: string];
  'edit-note': [noteId: string, text: string];
  'delete-note': [noteId: string];
  'edit-label': [newLabel: string];
  'delete-task': [];
}>();

const editingLabel = ref(false);
const editLabelText = ref('');
const labelInputRef = ref<HTMLInputElement | null>(null);

async function startEditLabel() {
  editLabelText.value = props.task.label;
  editingLabel.value = true;
  await nextTick();
  labelInputRef.value?.focus();
  labelInputRef.value?.select();
}

function saveLabel() {
  if (editLabelText.value.trim()) {
    emit('edit-label', editLabelText.value.trim());
  }
  editingLabel.value = false;
}

function cancelLabel() {
  editingLabel.value = false;
}
</script>

<template>
  <div class="px-4 py-3">
    <div class="flex items-start gap-3">
      <button
        class="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        :class="
          state?.checked
            ? 'bg-indigo-600 border-indigo-600'
            : 'border-slate-300 dark:border-slate-500 hover:border-indigo-400'
        "
        :aria-checked="state?.checked ? 'true' : 'false'"
        role="checkbox"
        @click="emit('toggle')"
        @keydown.space.prevent="emit('toggle')"
      >
        <svg
          v-if="state?.checked"
          class="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </button>

      <div class="flex-1 min-w-0">
        <div v-if="isCustom && editingLabel" class="flex items-center gap-2">
          <input
            ref="labelInputRef"
            v-model="editLabelText"
            type="text"
            maxlength="200"
            class="flex-1 rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @keydown.enter="saveLabel"
            @keydown.escape="cancelLabel"
          />
          <button class="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline" @click="saveLabel">
            Save
          </button>
          <button class="text-xs text-slate-400 hover:text-slate-600" @click="cancelLabel">Cancel</button>
        </div>

        <div v-else class="flex items-start gap-1.5 flex-wrap">
          <span
            class="text-sm leading-snug transition-colors"
            :class="[
              state?.checked ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200',
              isCustom ? 'cursor-text' : '',
            ]"
            @click="isCustom ? startEditLabel() : undefined"
            >{{ task.label }}</span
          >

          <a
            v-if="task.url"
            :href="task.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-shrink-0 mt-0.5 text-slate-400 hover:text-indigo-500 transition-colors"
            :aria-label="`Open ${task.label} link`"
            @click.stop
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>

          <template v-if="isCustom">
            <button
              class="flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
              aria-label="Edit task"
              @click.stop="startEditLabel"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
            </button>
            <button
              class="flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
              aria-label="Delete task"
              @click.stop="emit('delete-task')"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </template>
        </div>

        <p v-if="task.dueText" class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {{ task.dueText }}
        </p>
      </div>
    </div>

    <NoteThread
      :notes="state?.notes ?? []"
      @add-note="(text) => emit('add-note', text)"
      @edit-note="(noteId, text) => emit('edit-note', noteId, text)"
      @delete-note="(noteId) => emit('delete-note', noteId)"
    />
  </div>
</template>
