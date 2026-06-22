<script setup lang="ts">
import { ref, nextTick } from 'vue';
import type { DerivedNote } from '@/types';

const props = defineProps<{
  notes: DerivedNote[];
}>();

const emit = defineEmits<{
  'add-note': [text: string];
  'edit-note': [noteId: string, text: string];
  'delete-note': [noteId: string];
}>();

const addingNote = ref(false);
const newNoteText = ref('');
const addTextareaRef = ref<HTMLTextAreaElement | null>(null);

const editingNoteId = ref<string | null>(null);
const editText = ref('');

function formatTs(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function startAdd() {
  addingNote.value = true;
  await nextTick();
  addTextareaRef.value?.focus();
}

function cancelAdd() {
  addingNote.value = false;
  newNoteText.value = '';
}

function saveNewNote() {
  if (!newNoteText.value.trim()) return;
  emit('add-note', newNoteText.value.trim());
  newNoteText.value = '';
  addingNote.value = false;
}

function startEdit(note: DerivedNote) {
  editingNoteId.value = note.noteId;
  editText.value = note.text;
}

function cancelEdit() {
  editingNoteId.value = null;
  editText.value = '';
}

function saveEdit(note: DerivedNote) {
  if (!editText.value.trim()) return;
  emit('edit-note', note.noteId, editText.value.trim());
  cancelEdit();
}
</script>

<template>
  <div class="pl-8 pr-4 pb-3 space-y-2">
    <div
      v-for="note in notes"
      :key="note.noteId"
      class="rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
    >
      <template v-if="editingNoteId === note.noteId">
        <textarea
          v-model="editText"
          rows="2"
          class="w-full resize-none rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div class="flex items-center gap-2 mt-1.5">
          <button
            class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            @click="saveEdit(note)"
          >
            Save
          </button>
          <button class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" @click="cancelEdit">
            Cancel
          </button>
        </div>
      </template>
      <template v-else>
        <p class="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{{ note.text }}</p>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-xs text-slate-400 dark:text-slate-500">
            <span class="font-medium text-slate-600 dark:text-slate-400">{{ note.actor }}</span>
            {{ ' · ' }}{{ formatTs(note.editedAt ?? note.addedAt) }}
            <span v-if="note.editedAt" class="italic"> (edited)</span>
          </span>
          <div class="flex items-center gap-2">
            <button
              class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              @click="startEdit(note)"
            >
              Edit
            </button>
            <button
              class="text-xs text-slate-400 hover:text-red-500 transition-colors"
              @click="emit('delete-note', note.noteId)"
            >
              Delete
            </button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="addingNote" class="space-y-1.5">
      <textarea
        ref="addTextareaRef"
        v-model="newNoteText"
        rows="2"
        placeholder="Add a note…"
        class="w-full resize-none rounded-lg border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div class="flex items-center gap-2">
        <button
          :disabled="!newNoteText.trim()"
          class="text-xs font-medium text-indigo-600 dark:text-indigo-400 disabled:opacity-40 hover:underline"
          @click="saveNewNote"
        >
          Save note
        </button>
        <button class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" @click="cancelAdd">
          Cancel
        </button>
      </div>
    </div>

    <button
      v-else
      class="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      @click="startAdd"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      Add note
    </button>
  </div>
</template>
