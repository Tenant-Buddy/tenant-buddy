import { ref, computed, onUnmounted } from 'vue';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useChecklistsStore } from '@/stores/checklists';
import type {
  ChecklistDoc,
  CountryOption,
  LogEvent,
  LogEventType,
  DerivedTaskState,
  DerivedNote,
  DerivedCustomTask,
  Questionnaire,
} from '@/types';

interface DerivedState {
  taskStates: Record<string, DerivedTaskState>;
  customTasks: DerivedCustomTask[];
}

function deriveState(questionnaire: Questionnaire, log: LogEvent[]): DerivedState {
  const taskStates: Record<string, DerivedTaskState> = {};
  for (const section of questionnaire.sections) {
    for (const task of section.tasks) {
      taskStates[task.id] = { checked: false, notes: [] };
    }
  }

  const customTasks: DerivedCustomTask[] = [];

  for (const event of log) {
    switch (event.type) {
      case 'task_checked':
        if (event.taskId && taskStates[event.taskId]) {
          taskStates[event.taskId].checked = true;
        }
        break;
      case 'task_unchecked':
        if (event.taskId && taskStates[event.taskId]) {
          taskStates[event.taskId].checked = false;
        }
        break;
      case 'all_unchecked':
        for (const id in taskStates) taskStates[id].checked = false;
        break;
      case 'note_added':
        if (event.taskId && taskStates[event.taskId] && event.noteId && event.noteText !== undefined) {
          taskStates[event.taskId].notes.push({
            noteId: event.noteId,
            text: event.noteText,
            actor: event.actor,
            addedAt: event.timestamp,
          } as DerivedNote);
        }
        break;
      case 'note_edited':
        if (event.taskId && taskStates[event.taskId] && event.noteId && event.noteText !== undefined) {
          const note = taskStates[event.taskId].notes.find((n) => n.noteId === event.noteId);
          if (note) {
            note.text = event.noteText;
            note.editedAt = event.timestamp;
          }
        }
        break;
      case 'note_deleted':
        if (event.taskId && taskStates[event.taskId] && event.noteId) {
          taskStates[event.taskId].notes = taskStates[event.taskId].notes.filter((n) => n.noteId !== event.noteId);
        }
        break;
      case 'custom_task_added':
        if (event.customTaskId && event.customTaskLabel !== undefined) {
          const ct: DerivedCustomTask = {
            id: event.customTaskId,
            label: event.customTaskLabel,
            sectionId: event.customTaskSectionId ?? null,
            actor: event.actor,
            createdAt: event.timestamp,
          };
          customTasks.push(ct);
          taskStates[event.customTaskId] = { checked: false, notes: [] };
        }
        break;
      case 'custom_task_edited':
        if (event.customTaskId && event.customTaskLabel !== undefined) {
          const ct = customTasks.find((t) => t.id === event.customTaskId);
          if (ct) ct.label = event.customTaskLabel;
        }
        break;
      case 'custom_task_deleted':
        if (event.customTaskId) {
          const idx = customTasks.findIndex((t) => t.id === event.customTaskId);
          if (idx >= 0) {
            delete taskStates[customTasks[idx].id];
            customTasks.splice(idx, 1);
          }
        }
        break;
    }
  }

  return { taskStates, customTasks };
}

type WalEntry = Omit<LogEvent, 'timestamp'> & { timestamp: { seconds: number; nanoseconds: number } };

export function useChecklist(id: string) {
  const store = useChecklistsStore();
  const firestoreDoc = ref<ChecklistDoc | null>(null);
  const questionnaire = ref<Questionnaire | null>(null);
  const countryLabel = ref<string>('');
  const loading = ref(true);
  const notFound = ref(false);
  const writeError = ref<string | null>(null);

  const pendingLog = ref<LogEvent[]>([]);
  const inFlightLog = ref<LogEvent[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let questionnaireLoaded = false;
  let walRecoveryDone = false;
  const docRef = doc(db, 'checklists', id);

  const WAL_KEY = `tenant-buddy-wal-${id}`;

  function walSave(events: LogEvent[]) {
    try {
      if (events.length === 0) {
        localStorage.removeItem(WAL_KEY);
      } else {
        const entries: WalEntry[] = events.map((e) => ({
          ...e,
          timestamp: { seconds: e.timestamp.seconds, nanoseconds: e.timestamp.nanoseconds },
        }));
        localStorage.setItem(WAL_KEY, JSON.stringify(entries));
      }
    } catch {}
  }

  function walLoad(): LogEvent[] {
    try {
      const raw = localStorage.getItem(WAL_KEY);
      if (!raw) return [];
      const entries: WalEntry[] = JSON.parse(raw);
      return entries.map((e) => ({
        ...e,
        timestamp: new Timestamp(e.timestamp.seconds, e.timestamp.nanoseconds),
      }));
    } catch {
      return [];
    }
  }

  const unsubscribe = onSnapshot(
    docRef,
    async (snap) => {
      if (snap.exists()) {
        firestoreDoc.value = snap.data() as ChecklistDoc;
        inFlightLog.value = [];

        if (!questionnaireLoaded) {
          questionnaireLoaded = true;
          const { country, type, questionnaireVersion } = firestoreDoc.value;
          try {
            const [manifest, q] = await Promise.all([
              fetch('/questions/manifest.json').then((r) => r.json()),
              fetch(`/questions/${country}-${type}-${questionnaireVersion}.json`).then((r) => r.json()),
            ]);
            countryLabel.value =
              (manifest.countries as CountryOption[]).find((c) => c.id === country)?.label ?? country;
            questionnaire.value = q;
          } catch {
            writeError.value = 'Failed to load questionnaire';
          }
        }

        if (!walRecoveryDone) {
          walRecoveryDone = true;
          const orphaned = walLoad();
          if (orphaned.length > 0) {
            const confirmedKeys = new Set(
              firestoreDoc.value.log.map((e) => `${e.type}:${e.actor}:${e.timestamp.seconds}`),
            );
            const newOrphaned = orphaned.filter(
              (e) => !confirmedKeys.has(`${e.type}:${e.actor}:${e.timestamp.seconds}`),
            );
            if (newOrphaned.length > 0) {
              pendingLog.value = [...newOrphaned, ...pendingLog.value];
              flushWrite();
            } else {
              walSave([]);
            }
          }
        }

        const pendingDeletionAt = firestoreDoc.value.pendingDeletion?.toMillis();
        if (!store.hasChecklist(id)) {
          store.addChecklist({
            id,
            name: firestoreDoc.value.name,
            country: firestoreDoc.value.country,
            countryLabel: countryLabel.value,
            type: firestoreDoc.value.type,
            createdAt: firestoreDoc.value.createdAt.toMillis(),
            pendingDeletionAt,
          });
        } else {
          store.updateChecklist(id, { pendingDeletionAt });
        }
      } else {
        notFound.value = true;
      }
      loading.value = false;
    },
    (err) => {
      writeError.value = err.message;
      loading.value = false;
    },
  );

  const effectiveLog = computed<LogEvent[]>(() =>
    [...(firestoreDoc.value?.log ?? []), ...inFlightLog.value, ...pendingLog.value].sort(
      (a, b) => a.timestamp.toMillis() - b.timestamp.toMillis(),
    ),
  );

  const derived = computed<DerivedState>(() => {
    if (!questionnaire.value) return { taskStates: {}, customTasks: [] };
    return deriveState(questionnaire.value, effectiveLog.value);
  });

  const taskStates = computed(() => derived.value.taskStates);
  const customTasks = computed(() => derived.value.customTasks);

  const checkedCount = computed(() => Object.values(taskStates.value).filter((s) => s.checked).length);

  const totalCount = computed(() => {
    if (!questionnaire.value) return 0;
    const builtIn = questionnaire.value.sections.reduce((sum, s) => sum + s.tasks.length, 0);
    return builtIn + customTasks.value.length;
  });

  async function flushWrite() {
    if (!pendingLog.value.length) return;
    const toWrite = [...pendingLog.value];
    pendingLog.value = [];
    inFlightLog.value.push(...toWrite);
    try {
      await updateDoc(docRef, { log: arrayUnion(...toWrite) });
      writeError.value = null;
      walSave([]);
    } catch (err) {
      pendingLog.value = [...toWrite, ...pendingLog.value];
      walSave(pendingLog.value);
      inFlightLog.value = inFlightLog.value.filter((e) => !toWrite.includes(e));
      writeError.value = err instanceof Error ? err.message : 'Write failed';
    }
  }

  function scheduleWrite() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushWrite, 2000);
  }

  function requireName(): string {
    if (!store.displayName) throw new Error('needs-name');
    return store.displayName;
  }

  function appendEvent(type: LogEventType, extras: Partial<Omit<LogEvent, 'type' | 'actor' | 'timestamp'>> = {}) {
    const actor = requireName();
    const event: LogEvent = { type, actor, timestamp: Timestamp.now(), ...extras };
    pendingLog.value.push(event);
    walSave(pendingLog.value);
    scheduleWrite();
  }

  function toggleTask(taskId: string) {
    const isChecked = taskStates.value[taskId]?.checked ?? false;
    appendEvent(isChecked ? 'task_unchecked' : 'task_checked', { taskId });
  }

  function uncheckAll() {
    appendEvent('all_unchecked');
  }

  async function setDeletion(requestDeletion: boolean) {
    const actor = requireName();
    const event: LogEvent = {
      type: requestDeletion ? 'deletion_requested' : 'deletion_cancelled',
      actor,
      timestamp: Timestamp.now(),
    };
    await updateDoc(docRef, {
      pendingDeletion: requestDeletion ? serverTimestamp() : null,
      log: arrayUnion(event),
    });
  }

  function addNote(taskId: string, text: string) {
    appendEvent('note_added', { taskId, noteId: crypto.randomUUID(), noteText: text });
  }

  function editNote(taskId: string, noteId: string, text: string) {
    appendEvent('note_edited', { taskId, noteId, noteText: text });
  }

  function deleteNote(taskId: string, noteId: string) {
    appendEvent('note_deleted', { taskId, noteId });
  }

  function addCustomTask(label: string, sectionId: string | null) {
    appendEvent('custom_task_added', {
      customTaskId: crypto.randomUUID(),
      customTaskLabel: label,
      customTaskSectionId: sectionId,
    });
  }

  function editCustomTask(customTaskId: string, label: string) {
    appendEvent('custom_task_edited', { customTaskId, customTaskLabel: label });
  }

  function deleteCustomTask(customTaskId: string) {
    appendEvent('custom_task_deleted', { customTaskId });
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      flushWrite();
    }
  }

  function onBeforeUnload() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    flushWrite();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      flushWrite();
    }
  });

  return {
    firestoreDoc,
    questionnaire,
    countryLabel,
    loading,
    notFound,
    writeError,
    effectiveLog,
    taskStates,
    customTasks,
    checkedCount,
    totalCount,
    toggleTask,
    uncheckAll,
    setDeletion,
    addNote,
    editNote,
    deleteNote,
    addCustomTask,
    editCustomTask,
    deleteCustomTask,
  };
}
