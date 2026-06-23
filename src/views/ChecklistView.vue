<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useChecklist } from '@/composables/useChecklist';
import TaskItem from '@/components/TaskItem.vue';
import ExportMenu from '@/components/ExportMenu.vue';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog.vue';
import UncheckAllConfirmDialog from '@/components/UncheckAllConfirmDialog.vue';
import DisplayNameModal from '@/components/DisplayNameModal.vue';
import type { LogEvent } from '@/types';

const props = defineProps<{ id: string }>();

const checklist = useChecklist(props.id);

const CUSTOM_SECTION_ID = '__custom__';

const showLog = ref(false);
const showDeleteDialog = ref(false);
const showUncheckAllDialog = ref(false);
const needsName = ref(false);
const copied = ref(false);

const addingSection = ref<{ sectionId: string | null } | null>(null);
const newTaskLabel = ref('');

const LS_SECTIONS_KEY = `tenant-buddy-collapsed-${props.id}`;

function loadSavedSections(): Set<string> | null {
  try {
    const raw = localStorage.getItem(LS_SECTIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveSections(set: Set<string>) {
  localStorage.setItem(LS_SECTIONS_KEY, JSON.stringify([...set]));
}

const savedSections = loadSavedSections();
const collapsedSections = ref<Set<string>>(savedSections ?? new Set());

watch(
  () => checklist.loading.value,
  (loading) => {
    if (loading || savedSections !== null) return;
    const q = checklist.questionnaire.value;
    if (!q) return;
    const toCollapse = new Set<string>();
    for (const section of q.sections) {
      const allTasks = [...section.tasks, ...checklist.customTasks.value.filter((ct) => ct.sectionId === section.id)];
      if (allTasks.length > 0 && allTasks.every((t) => checklist.taskStates.value[t.id]?.checked)) {
        toCollapse.add(section.id);
      }
    }
    const standaloneTasks = checklist.customTasks.value.filter((ct) => ct.sectionId === null);
    if (standaloneTasks.length > 0 && standaloneTasks.every((t) => checklist.taskStates.value[t.id]?.checked)) {
      toCollapse.add(CUSTOM_SECTION_ID);
    }
    collapsedSections.value = toCollapse;
    saveSections(toCollapse);
  },
  { once: true },
);

function toggleSection(id: string) {
  const next = new Set(collapsedSections.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedSections.value = next;
  saveSections(next);
}

function sectionProgress(sectionId: string): { checked: number; total: number } {
  const q = checklist.questionnaire.value;
  if (sectionId === CUSTOM_SECTION_ID) {
    const tasks = checklist.customTasks.value.filter((ct) => ct.sectionId === null);
    return {
      checked: tasks.filter((t) => checklist.taskStates.value[t.id]?.checked).length,
      total: tasks.length,
    };
  }
  const section = q?.sections.find((s) => s.id === sectionId);
  const builtIn = section?.tasks ?? [];
  const custom = checklist.customTasks.value.filter((ct) => ct.sectionId === sectionId);
  const all = [...builtIn, ...custom];
  return {
    checked: all.filter((t) => checklist.taskStates.value[t.id]?.checked).length,
    total: all.length,
  };
}

function customTasksFor(sectionId: string | null) {
  return checklist.customTasks.value.filter((ct) => ct.sectionId === sectionId);
}

let pendingAction: (() => void) | null = null;

const typeLabel = computed(() => (checklist.firestoreDoc.value?.type === 'checkin' ? 'Check-in' : 'Check-out'));
const progressPct = computed(() => {
  const total = checklist.totalCount.value;
  if (!total) return 0;
  return Math.round((checklist.checkedCount.value / total) * 100);
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const isExpiredDeletion = computed(() => {
  const pd = checklist.firestoreDoc.value?.pendingDeletion;
  return pd ? Date.now() - pd.toMillis() >= THIRTY_DAYS_MS : false;
});

function requireName(action: () => void) {
  try {
    action();
  } catch (e) {
    if (e instanceof Error && e.message === 'needs-name') {
      pendingAction = action;
      needsName.value = true;
    }
  }
}

function onNameSet() {
  needsName.value = false;
  if (pendingAction) {
    const action = pendingAction;
    pendingAction = null;
    try {
      action();
    } catch {}
  }
}

function handleToggle(taskId: string) {
  requireName(() => checklist.toggleTask(taskId));
}
function handleUncheckAll() {
  requireName(() => {
    showUncheckAllDialog.value = true;
  });
}
function handleAddNote(taskId: string, text: string) {
  requireName(() => checklist.addNote(taskId, text));
}
function handleEditNote(taskId: string, noteId: string, text: string) {
  requireName(() => checklist.editNote(taskId, noteId, text));
}
function handleDeleteNote(taskId: string, noteId: string) {
  requireName(() => checklist.deleteNote(taskId, noteId));
}

function handleEditCustomTask(id: string, label: string) {
  requireName(() => checklist.editCustomTask(id, label));
}
function handleDeleteCustomTask(id: string) {
  requireName(() => checklist.deleteCustomTask(id));
}

function startAddCustomTask(sectionId: string | null) {
  addingSection.value = { sectionId };
  newTaskLabel.value = '';
}
function cancelCustomTask() {
  addingSection.value = null;
}
function saveCustomTask() {
  if (!newTaskLabel.value.trim() || !addingSection.value) return;
  const sectionId = addingSection.value.sectionId;
  requireName(() => checklist.addCustomTask(newTaskLabel.value.trim(), sectionId));
  addingSection.value = null;
  newTaskLabel.value = '';
}

async function confirmDelete() {
  showDeleteDialog.value = false;
  try {
    await checklist.setDeletion(true);
  } catch (e) {
    if (e instanceof Error && e.message === 'needs-name') {
      needsName.value = true;
      pendingAction = () => checklist.setDeletion(true);
    } else {
      checklist.writeError.value = e instanceof Error ? e.message : 'Failed to mark for deletion';
    }
  }
}

async function undoDeletion() {
  try {
    await checklist.setDeletion(false);
  } catch (e) {
    if (e instanceof Error && e.message === 'needs-name') {
      needsName.value = true;
      pendingAction = () => checklist.setDeletion(false);
    } else {
      checklist.writeError.value = e instanceof Error ? e.message : 'Failed to cancel deletion';
    }
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function customLabelAtIndex(customTaskId: string, upToIndex: number): string {
  const log = checklist.effectiveLog.value;
  let label = '';
  for (let i = 0; i <= Math.min(upToIndex, log.length - 1); i++) {
    const e = log[i];
    if (e.customTaskId !== customTaskId) continue;
    if ((e.type === 'custom_task_added' || e.type === 'custom_task_edited') && e.customTaskLabel !== undefined) {
      label = e.customTaskLabel;
    }
  }
  return label;
}

const reversedLogWithIndices = computed(() =>
  checklist.effectiveLog.value.map((event, originalIndex) => ({ event, originalIndex })).reverse(),
);

function logEntryDescription(event: LogEvent, originalIndex: number): string {
  const q = checklist.questionnaire.value;

  function resolveTaskLabel(): string {
    if (!event.taskId) return '';
    if (q) {
      for (const section of q.sections) {
        const t = section.tasks.find((t) => t.id === event.taskId);
        if (t) return t.label;
      }
    }
    return customLabelAtIndex(event.taskId, originalIndex);
  }

  switch (event.type) {
    case 'created':
      return 'created this checklist';
    case 'all_unchecked':
      return 'unchecked all tasks';
    case 'deletion_requested':
      return 'marked checklist for deletion';
    case 'deletion_cancelled':
      return 'cancelled deletion';
    case 'task_checked':
    case 'task_unchecked': {
      const label = resolveTaskLabel();
      return `${event.type === 'task_checked' ? 'checked' : 'unchecked'}${label ? ` '${label}'` : ''}`;
    }
    case 'note_added':
    case 'note_edited':
    case 'note_deleted': {
      const label = resolveTaskLabel();
      const verb = { note_added: 'added a note', note_edited: 'edited a note', note_deleted: 'deleted a note' }[
        event.type
      ];
      return label ? `${verb} on '${label}'` : verb;
    }
    case 'custom_task_added':
      return `added custom task '${event.customTaskLabel ?? ''}'`;
    case 'custom_task_edited': {
      const newLabel = event.customTaskLabel ?? '';
      const oldLabel = event.customTaskId ? customLabelAtIndex(event.customTaskId, originalIndex - 1) : '';
      return oldLabel && oldLabel !== newLabel
        ? `renamed '${oldLabel}' to '${newLabel}'`
        : `edited custom task '${newLabel}'`;
    }
    case 'custom_task_deleted': {
      const label = event.customTaskId ? customLabelAtIndex(event.customTaskId, originalIndex) : '';
      return `deleted custom task${label ? ` '${label}'` : ''}`;
    }
    default:
      return (event.type as string).replace(/_/g, ' ');
  }
}

function formatTs(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900">
    <div v-if="checklist.loading.value" class="flex items-center justify-center min-h-screen">
      <div class="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
    </div>

    <div
      v-else-if="checklist.notFound.value"
      class="flex flex-col items-center justify-center min-h-screen p-4 text-center"
    >
      <p class="text-slate-600 dark:text-slate-400 font-medium text-lg">Checklist not found</p>
      <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">
        This link may be invalid or the checklist was removed.
      </p>
      <RouterLink to="/" class="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Back to home
      </RouterLink>
    </div>

    <div v-else-if="isExpiredDeletion" class="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <p class="text-slate-600 dark:text-slate-400 font-medium text-lg">This checklist has been deleted</p>
      <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">The 30-day grace period has elapsed.</p>
      <RouterLink to="/" class="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Back to home
      </RouterLink>
    </div>

    <div
      v-else-if="checklist.firestoreDoc.value && !checklist.questionnaire.value && checklist.writeError.value"
      class="flex flex-col items-center justify-center min-h-screen p-4 text-center"
    >
      <p class="text-slate-600 dark:text-slate-400 font-medium text-lg">Failed to load checklist</p>
      <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">{{ checklist.writeError.value }}</p>
      <RouterLink to="/" class="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
        ← Back to home
      </RouterLink>
    </div>

    <template v-else-if="checklist.firestoreDoc.value && checklist.questionnaire.value">
      <header
        class="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
      >
        <div class="max-w-2xl mx-auto px-4 py-3">
          <div class="flex items-center gap-3">
            <RouterLink
              to="/"
              class="flex-shrink-0 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Back"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </RouterLink>
            <div class="flex-1 min-w-0">
              <h1 class="font-semibold text-slate-900 dark:text-slate-100 truncate text-base leading-tight">
                {{ checklist.firestoreDoc.value.name }}
              </h1>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ checklist.countryLabel.value }} · {{ typeLabel }}
              </p>
            </div>
            <ExportMenu
              :doc="checklist.firestoreDoc.value"
              :country-label="checklist.countryLabel.value"
              :questionnaire="checklist.questionnaire.value"
              :custom-tasks="checklist.customTasks.value"
              :task-states="checklist.taskStates.value"
              :log="checklist.effectiveLog.value"
            />
          </div>

          <div class="mt-3 flex items-center gap-2">
            <div class="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                class="h-full rounded-full bg-indigo-600 transition-all duration-300"
                :style="{ width: progressPct + '%' }"
              />
            </div>
            <span class="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex-shrink-0">
              {{ checklist.checkedCount.value }}/{{ checklist.totalCount.value }}
            </span>
          </div>
        </div>
      </header>

      <div v-if="checklist.writeError.value" class="max-w-2xl mx-auto px-4 pt-4">
        <div
          class="flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3"
        >
          <p class="text-sm text-amber-700 dark:text-amber-400">{{ checklist.writeError.value }}</p>
          <button
            class="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline flex-shrink-0"
            @click="checklist.writeError.value = null"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div v-if="checklist.firestoreDoc.value.pendingDeletion" class="max-w-2xl mx-auto px-4 pt-4">
        <div
          class="flex items-center justify-between gap-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3"
        >
          <div class="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
              />
            </svg>
            This checklist will be deleted in 30 days.
          </div>
          <button
            class="text-xs font-medium text-red-700 dark:text-red-400 hover:underline flex-shrink-0"
            @click="undoDeletion"
          >
            Undo
          </button>
        </div>
      </div>

      <div class="max-w-2xl mx-auto px-4 pt-4 flex items-center justify-between gap-2">
        <button
          class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1"
          @click="handleUncheckAll"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Uncheck all
        </button>

        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1"
            :class="{ 'text-green-600! dark:text-green-400!': copied }"
            @click="copyLink"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {{ copied ? 'Copied!' : 'Share link' }}
          </button>
          <button
            v-if="!checklist.firestoreDoc.value.pendingDeletion"
            class="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors py-1"
            @click="showDeleteDialog = true"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <main class="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-12">
        <section
          v-for="section in checklist.questionnaire.value.sections"
          :key="section.id"
          class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
        >
          <button
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            @click="toggleSection(section.id)"
          >
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {{ section.title }}
            </span>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {{ sectionProgress(section.id).checked }}/{{ sectionProgress(section.id).total }}
              </span>
              <svg
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
                :class="{ 'rotate-180': !collapsedSections.has(section.id) }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="!collapsedSections.has(section.id)"
              class="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700"
            >
              <TaskItem
                v-for="task in section.tasks"
                :key="task.id"
                :task="task"
                :state="checklist.taskStates.value[task.id]"
                @toggle="handleToggle(task.id)"
                @add-note="(text) => handleAddNote(task.id, text)"
                @edit-note="(noteId, text) => handleEditNote(task.id, noteId, text)"
                @delete-note="(noteId) => handleDeleteNote(task.id, noteId)"
              />

              <TaskItem
                v-for="ct in customTasksFor(section.id)"
                :key="ct.id"
                :task="ct"
                :state="checklist.taskStates.value[ct.id]"
                :is-custom="true"
                @toggle="handleToggle(ct.id)"
                @add-note="(text) => handleAddNote(ct.id, text)"
                @edit-note="(noteId, text) => handleEditNote(ct.id, noteId, text)"
                @delete-note="(noteId) => handleDeleteNote(ct.id, noteId)"
                @edit-label="(label) => handleEditCustomTask(ct.id, label)"
                @delete-task="handleDeleteCustomTask(ct.id)"
              />

              <div class="px-4 py-2.5">
                <div v-if="addingSection?.sectionId === section.id" class="flex items-center gap-2">
                  <input
                    v-model="newTaskLabel"
                    type="text"
                    placeholder="Task description…"
                    maxlength="200"
                    class="flex-1 rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    @keydown.enter="saveCustomTask"
                    @keydown.escape="cancelCustomTask"
                  />
                  <button
                    :disabled="!newTaskLabel.trim()"
                    class="text-xs font-medium text-indigo-600 dark:text-indigo-400 disabled:opacity-40 hover:underline whitespace-nowrap"
                    @click="saveCustomTask"
                  >
                    Add task
                  </button>
                  <button class="text-xs text-slate-400 hover:text-slate-600" @click="cancelCustomTask">Cancel</button>
                </div>
                <button
                  v-else
                  class="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  @click="startAddCustomTask(section.id)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add task
                </button>
              </div>
            </div>
          </Transition>
        </section>

        <section
          class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
        >
          <button
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            @click="toggleSection(CUSTOM_SECTION_ID)"
          >
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Custom tasks
            </span>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                {{ sectionProgress(CUSTOM_SECTION_ID).checked }}/{{ sectionProgress(CUSTOM_SECTION_ID).total }}
              </span>
              <svg
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200"
                :class="{ 'rotate-180': !collapsedSections.has(CUSTOM_SECTION_ID) }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="!collapsedSections.has(CUSTOM_SECTION_ID)"
              class="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700"
            >
              <TaskItem
                v-for="ct in customTasksFor(null)"
                :key="ct.id"
                :task="ct"
                :state="checklist.taskStates.value[ct.id]"
                :is-custom="true"
                @toggle="handleToggle(ct.id)"
                @add-note="(text) => handleAddNote(ct.id, text)"
                @edit-note="(noteId, text) => handleEditNote(ct.id, noteId, text)"
                @delete-note="(noteId) => handleDeleteNote(ct.id, noteId)"
                @edit-label="(label) => handleEditCustomTask(ct.id, label)"
                @delete-task="handleDeleteCustomTask(ct.id)"
              />

              <div class="px-4 py-2.5">
                <div v-if="addingSection?.sectionId === null" class="flex items-center gap-2">
                  <input
                    v-model="newTaskLabel"
                    type="text"
                    placeholder="Task description…"
                    maxlength="200"
                    class="flex-1 rounded-md border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    @keydown.enter="saveCustomTask"
                    @keydown.escape="cancelCustomTask"
                  />
                  <button
                    :disabled="!newTaskLabel.trim()"
                    class="text-xs font-medium text-indigo-600 dark:text-indigo-400 disabled:opacity-40 hover:underline whitespace-nowrap"
                    @click="saveCustomTask"
                  >
                    Add task
                  </button>
                  <button class="text-xs text-slate-400 hover:text-slate-600" @click="cancelCustomTask">Cancel</button>
                </div>
                <button
                  v-else
                  class="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  @click="startAddCustomTask(null)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add task
                </button>
              </div>
            </div>
          </Transition>
        </section>

        <section>
          <button
            class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mb-2 px-1 w-full"
            @click="showLog = !showLog"
          >
            <span>Activity log ({{ checklist.effectiveLog.value.length }})</span>
            <svg
              class="w-3.5 h-3.5 transition-transform"
              :class="{ 'rotate-180': showLog }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <ol
            v-if="showLog"
            class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden"
          >
            <li
              v-for="{ event, originalIndex } in reversedLogWithIndices"
              :key="originalIndex"
              class="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400"
            >
              <span class="font-medium text-slate-800 dark:text-slate-200">{{ event.actor }}</span>
              {{ ' ' }}{{ logEntryDescription(event, originalIndex) }}
              <span class="ml-2 text-slate-400 tabular-nums">{{ formatTs(event.timestamp) }}</span>
            </li>
          </ol>
        </section>
      </main>
    </template>

    <DisplayNameModal v-if="needsName" @done="onNameSet" />
    <DeleteConfirmDialog v-if="showDeleteDialog" @confirm="confirmDelete" @cancel="showDeleteDialog = false" />
    <UncheckAllConfirmDialog
      v-if="showUncheckAllDialog"
      @confirm="
        checklist.uncheckAll();
        showUncheckAllDialog = false;
      "
      @cancel="showUncheckAllDialog = false"
    />
  </div>
</template>
