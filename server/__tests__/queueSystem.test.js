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
});
