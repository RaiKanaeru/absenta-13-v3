/**
 * PendingChange interface for schedule updates
 */
export interface PendingChange {
  kelas_id: number;
  hari: string;
  jam_ke: number;
  mapel_id?: number | null;
  guru_id?: number | null;
  ruang_id?: number | null;
  rowType?: string;
  action?: 'delete';
  [key: string]: string | number | null | undefined;
}

/** 
 * Returns the canonical string key for a PendingChange: `${kelas_id}-${hari}-${jam_ke}`.
 */
export function pendingChangeKey(change: Pick<PendingChange, 'kelas_id' | 'hari' | 'jam_ke'>): string {
  return `${change.kelas_id}-${change.hari}-${change.jam_ke}`;
}

/** 
 * Merge a new PendingChange into the array, deduplicating by kelas_id+hari+jam_ke (last-write-wins) 
 */
export function mergePendingChange(prev: PendingChange[], change: PendingChange): PendingChange[] {
  const key = pendingChangeKey(change);
  const filtered = prev.filter((p) => pendingChangeKey(p) !== key);
  return [...filtered, change];
}

/** 
 * Merge multiple PendingChanges, deduplicating by kelas_id+hari+jam_ke (last-write-wins for each key) 
 */
export function mergePendingChanges(prev: PendingChange[], changes: PendingChange[]): PendingChange[] {
  let result = [...prev];
  for (const change of changes) {
    result = mergePendingChange(result, change);
  }
  return result;
}

/**
 * Build a Map from PendingChange array for O(1) lookup.
 * Key: `${kelas_id}-${hari}-${jam_ke}`
 */
export function buildPendingMap(changes: PendingChange[]): Map<string, PendingChange> {
  return new Map(changes.map((p) => [pendingChangeKey(p), p]));
}
