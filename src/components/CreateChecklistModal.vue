<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCreateChecklist } from '@/composables/useCreateChecklist';
import { useChecklistsStore } from '@/stores/checklists';
import DisplayNameModal from '@/components/DisplayNameModal.vue';
import type { CountryOption, ChecklistType } from '@/types';

const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const store = useChecklistsStore();
const checklistCreator = useCreateChecklist();

const name = ref('');
const country = ref('');
const checklistType = ref<ChecklistType>('checkin');
const creating = ref(false);
const showNamePrompt = ref(false);
const countries = ref<CountryOption[]>([]);

const types = [
  { value: 'checkin' as ChecklistType, label: 'Check-in' },
  { value: 'checkout' as ChecklistType, label: 'Check-out' },
];

onMounted(async () => {
  const manifest = await fetch('/questions/manifest.json').then((r) => r.json());
  countries.value = manifest.countries as CountryOption[];
  if (countries.value.length > 0) country.value = countries.value[0].id;
});

const selectedCountryLabel = computed(() => countries.value.find((c) => c.id === country.value)?.label ?? '');

const defaultName = computed(
  () => `${selectedCountryLabel.value} ${checklistType.value === 'checkin' ? 'Check-in' : 'Check-out'}`,
);

async function create() {
  if (!store.displayName) {
    showNamePrompt.value = true;
    return;
  }
  creating.value = true;
  try {
    const id = await checklistCreator.create(country.value, checklistType.value, name.value);
    emit('close');
    router.push(`/checklist/${id}`);
  } finally {
    creating.value = false;
  }
}

function onNameSet() {
  showNamePrompt.value = false;
  create();
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-checklist-title"
        class="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6"
      >
        <h2 id="create-checklist-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          New checklist
        </h2>

        <label class="block mb-4">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Property address <span class="text-slate-400 font-normal">(optional)</span>
          </span>
          <input
            v-model="name"
            type="text"
            :placeholder="defaultName"
            maxlength="120"
            class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label class="block mb-4">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Country</span>
          <select
            v-model="country"
            class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option v-for="c in countries" :key="c.id" :value="c.id">{{ c.label }}</option>
          </select>
        </label>

        <fieldset class="mb-6">
          <legend class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type</legend>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="t in types"
              :key="t.value"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors"
              :class="
                checklistType === t.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              "
            >
              <input v-model="checklistType" type="radio" :value="t.value" class="accent-indigo-600" />
              <span class="text-sm font-medium">{{ t.label }}</span>
            </label>
          </div>
        </fieldset>

        <div class="flex gap-3">
          <button
            class="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            :disabled="creating || !country"
            class="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition-colors"
            @click="create"
          >
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <DisplayNameModal v-if="showNamePrompt" @done="onNameSet" />
  </Teleport>
</template>
