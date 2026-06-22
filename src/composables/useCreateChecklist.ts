import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { useChecklistsStore } from '@/stores/checklists';
import type { ChecklistDoc, ChecklistType, CountryOption } from '@/types';

interface QuestionnaireManifest {
  countries: CountryOption[];
  versions: Record<string, string>;
}

export function useCreateChecklist() {
  async function create(country: string, type: ChecklistType, name?: string): Promise<string> {
    const store = useChecklistsStore();

    const manifest: QuestionnaireManifest = await fetch('/questions/manifest.json').then((r) => r.json());
    const version = manifest.versions[`${country}-${type}`];
    const countryLabel = manifest.countries.find((c) => c.id === country)?.label ?? country;

    const defaultName = `${countryLabel} ${type === 'checkin' ? 'Check-in' : 'Check-out'}`;
    const docName = name?.trim() || defaultName;

    const actor = store.displayName!;
    const now = Timestamp.now();

    const data: ChecklistDoc = {
      name: docName,
      country,
      type,
      questionnaireVersion: version,
      createdAt: now,
      pendingDeletion: null,
      log: [{ type: 'created', actor, timestamp: now }],
    };

    const ref = await addDoc(collection(db, 'checklists'), data);
    store.addChecklist({
      id: ref.id,
      name: docName,
      country,
      countryLabel,
      type,
      createdAt: now.toMillis(),
    });

    return ref.id;
  }

  return { create };
}
