import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { LocalChecklistRef } from '@/types';

const LS_CHECKLISTS_KEY = 'tenant-buddy-checklists';
const LS_NAME_KEY = 'tenant-buddy-name';

function loadFromStorage(): LocalChecklistRef[] {
  try {
    const raw = localStorage.getItem(LS_CHECKLISTS_KEY);
    return raw ? (JSON.parse(raw) as LocalChecklistRef[]) : [];
  } catch {
    return [];
  }
}

export const useChecklistsStore = defineStore('checklists', () => {
  const checklists = ref<LocalChecklistRef[]>(loadFromStorage());
  const displayName = ref<string | null>(localStorage.getItem(LS_NAME_KEY));

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const sortedChecklists = computed(() =>
    [...checklists.value]
      .filter((c) => !c.pendingDeletionAt || Date.now() - c.pendingDeletionAt < THIRTY_DAYS_MS)
      .sort((a, b) => b.createdAt - a.createdAt),
  );

  function saveToStorage() {
    localStorage.setItem(LS_CHECKLISTS_KEY, JSON.stringify(checklists.value));
  }

  function addChecklist(entry: LocalChecklistRef) {
    if (!checklists.value.find((c) => c.id === entry.id)) {
      checklists.value.push(entry);
      saveToStorage();
    }
  }

  function removeChecklist(id: string) {
    checklists.value = checklists.value.filter((c) => c.id !== id);
    saveToStorage();
  }

  function updateChecklist(id: string, patch: Partial<LocalChecklistRef>) {
    const idx = checklists.value.findIndex((c) => c.id === id);
    if (idx !== -1) {
      checklists.value[idx] = { ...checklists.value[idx], ...patch };
      saveToStorage();
    }
  }

  function hasChecklist(id: string): boolean {
    return checklists.value.some((c) => c.id === id);
  }

  function setDisplayName(name: string) {
    displayName.value = name;
    localStorage.setItem(LS_NAME_KEY, name);
  }

  return {
    checklists,
    sortedChecklists,
    displayName,
    addChecklist,
    removeChecklist,
    updateChecklist,
    hasChecklist,
    setDisplayName,
  };
});
