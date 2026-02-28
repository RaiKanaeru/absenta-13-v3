import { describe, it, expect } from 'vitest';
import { mergePendingChange, mergePendingChanges } from '../scheduleUtils';
import type { PendingChange } from '../scheduleUtils';

describe('scheduleUtils', () => {
  describe('mergePendingChange', () => {
    it('should add a new change to an empty list', () => {
      const prev: PendingChange[] = [];
      const change: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, mapel_id: 10 };
      const result = mergePendingChange(prev, change);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(change);
    });

    it('should merge fields when dragging guru then mapel to same cell', () => {
      const guruChange: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, guru_id: 10 };
      const mapelChange: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, mapel_id: 20 };
      let result = mergePendingChange([], guruChange);
      result = mergePendingChange(result, mapelChange);
      expect(result).toHaveLength(1);
      expect(result[0].guru_id).toBe(10);   // preserved from first drag
      expect(result[0].mapel_id).toBe(20);  // from second drag
    });

    it('should override the same field on re-drag', () => {
      const guru1: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, guru_id: 10 };
      const guru2: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, guru_id: 20 };
      let result = mergePendingChange([], guru1);
      result = mergePendingChange(result, guru2);
      expect(result).toHaveLength(1);
      expect(result[0].guru_id).toBe(20);   // overridden
    });

    it('should not merge changes for different cells', () => {
      const change1: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, guru_id: 10 };
      const change2: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 2, mapel_id: 20 };
      let result = mergePendingChange([], change1);
      result = mergePendingChange(result, change2);
      expect(result).toHaveLength(2);
    });

    it('should preserve fields when action is added', () => {
      const prev: PendingChange[] = [
        { kelas_id: 1, hari: 'Senin', jam_ke: 1, mapel_id: 10 }
      ];
      const change: PendingChange = { kelas_id: 1, hari: 'Senin', jam_ke: 1, action: 'delete' };
      const result = mergePendingChange(prev, change);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('delete');
      expect(result[0].mapel_id).toBe(10); // Now preserved!
    });
  });

  describe('mergePendingChanges', () => {
    it('should apply multiple changes and deduplicate with field merge', () => {
      const prev: PendingChange[] = [
        { kelas_id: 1, hari: 'Senin', jam_ke: 1, mapel_id: 10 }
      ];
      const changes: PendingChange[] = [
        { kelas_id: 1, hari: 'Senin', jam_ke: 1, action: 'delete' },
        { kelas_id: 1, hari: 'Senin', jam_ke: 2, mapel_id: 30 }
      ];
      const result = mergePendingChanges(prev, changes);
      expect(result).toHaveLength(2);
      const jam1 = result.find(c => c.jam_ke === 1);
      expect(jam1?.action).toBe('delete');
      expect(jam1?.mapel_id).toBe(10); // Preserved
      expect(result.find(c => c.jam_ke === 2)?.mapel_id).toBe(30);
    });
  });
});
