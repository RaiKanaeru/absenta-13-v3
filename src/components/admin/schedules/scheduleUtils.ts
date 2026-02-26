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
 * Merge a new PendingChange into the array, deduplicating by kelas_id+hari+jam_ke (last-write-wins) 
 */
export function mergePendingChange(prev: PendingChange[], change: PendingChange): PendingChange[] {
  const filtered = prev.filter(
    (p) => !(p.kelas_id === change.kelas_id && p.hari === change.hari && p.jam_ke === change.jam_ke)
  );
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
