import assert from 'node:assert';
import { describe, it } from 'node:test';
import DownloadQueue from '../services/system/queue-system.js';

describe('DownloadQueue file access', () => {
    it('purges expired file access entries', () => {
        const queue = new DownloadQueue();
        queue.fileAccessTtlMs = 1000;

        queue.fileAccessMap.set('report_u1_test.xlsx', { userId: 1, createdAt: Date.now() - 5000 });
        queue.fileAccessMap.set('report_u2_test.xlsx', { userId: 2, createdAt: Date.now() });

        queue.purgeExpiredFileAccess();

        assert.strictEqual(queue.fileAccessMap.has('report_u1_test.xlsx'), false);
        assert.strictEqual(queue.fileAccessMap.has('report_u2_test.xlsx'), true);
    });

    it('falls back to filename ownership when map entry expired', () => {
        const queue = new DownloadQueue();
        queue.fileAccessTtlMs = 1;
        const filename = 'report_u3_test.xlsx';

        queue.fileAccessMap.set(filename, { userId: 999, createdAt: Date.now() - 5000 });

        assert.strictEqual(queue.verifyFileAccess(filename, 3), true);
    });

    it('removes filepath from job status result', async () => {
        const queue = new DownloadQueue();
        queue.queues.excelDownload = {
            getJob: async () => ({
                id: 1,
                data: { userId: 1 },
                returnvalue: { filename: 'report_u1_test.xlsx', filepath: '/tmp/secret.xlsx' },
                getState: async () => 'completed',
                progress: () => 100,
                timestamp: Date.now(),
                processedOn: Date.now(),
                finishedOn: Date.now(),
                failedReason: null
            })
        };

        const status = await queue.getJobStatus(1, 1);

        assert.ok(status);
        assert.ok(status.result);
        assert.strictEqual(status.result.filename, 'report_u1_test.xlsx');
        assert.strictEqual(status.result.filepath, undefined);
    });

    it('builds stable deduplication keys for equivalent filters', () => {
        const queue = new DownloadQueue();
        queue.dedupTtlMs = 300000;

        const keyA = queue.buildJobDedupKey('student-attendance', 7, {
            tanggal_mulai: '2026-01-01',
            tanggal_selesai: '2026-01-31',
            kelas_id: 3,
            nested: { b: 2, a: 1 }
        });

        const keyB = queue.buildJobDedupKey('student-attendance', 7, {
            kelas_id: 3,
            tanggal_selesai: '2026-01-31',
            nested: { a: 1, b: 2 },
            tanggal_mulai: '2026-01-01'
        });

        assert.strictEqual(keyA, keyB);
    });

    it('returns existing active job when deduplication key already exists', async () => {
        const queue = new DownloadQueue();
        queue.adaptiveThrottleEnabled = false;

        const existingJob = {
            id: 'existing-job-1',
            getState: async () => 'active'
        };

        queue.queues.excelDownload = {
            getJobCounts: async () => ({ waiting: 0, active: 0, delayed: 0 }),
            getJob: async () => existingJob,
            getWaiting: async () => [{ id: 'existing-job-1' }],
            add: async () => {
                throw new Error('should not add duplicate job');
            }
        };

        const result = await queue.addExcelDownloadJob({
            type: 'student-attendance',
            userRole: 'guru',
            userId: 21,
            filters: {
                tanggal_mulai: '2026-01-01',
                tanggal_selesai: '2026-01-31'
            }
        });

        assert.strictEqual(result.jobId, 'existing-job-1');
        assert.strictEqual(result.deduplicated, true);
        assert.strictEqual(result.status, 'active');
    });

    it('rejects new jobs when queue depth exceeds max depth', async () => {
        const queue = new DownloadQueue();
        queue.adaptiveThrottleEnabled = false;
        queue.queueMaxDepth = 1;

        queue.queues.excelDownload = {
            getJobCounts: async () => ({ waiting: 1, active: 0, delayed: 0 }),
            getJob: async () => null,
            add: async () => ({ id: 'new-job-1' }),
            getWaiting: async () => []
        };

        await assert.rejects(
            () => queue.addExcelDownloadJob({
                type: 'student-attendance',
                userRole: 'guru',
                userId: 22,
                filters: {
                    tanggal_mulai: '2026-01-01',
                    tanggal_selesai: '2026-01-31'
                }
            }),
            (error) => {
                assert.strictEqual(error.name, 'QueueBackpressureError');
                assert.match(error.message, /Queue sedang penuh/);
                return true;
            }
        );
    });
});
