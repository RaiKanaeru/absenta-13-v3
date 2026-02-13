/**
 * PDF Helper Utilities
 * Streaming response, image conversion, and shared utilities for PDF exports
 */

/**
 * Stream PDF buffer as download response
 * @param {Object} res - Express response object
 * @param {Buffer} buffer - PDF buffer from buildPdf()
 * @param {string} filename - Download filename (e.g., 'laporan-kehadiran.pdf')
 */
export function streamPdfResponse(res, buffer, filename) {
    const sanitizedFilename = filename.replaceAll(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
}

/**
 * Send PDF as inline preview (opens in browser PDF viewer)
 * @param {Object} res - Express response object
 * @param {Buffer} buffer - PDF buffer from buildPdf()
 * @param {string} filename - Filename for the PDF
 */
export function inlinePdfResponse(res, buffer, filename) {
    const sanitizedFilename = filename.replaceAll(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
}

/**
 * Generate a timestamped filename for PDF exports
 * @param {string} baseName - Base name (e.g., 'rekap-ketidakhadiran-siswa')
 * @param {string} [startDate] - Start date for period
 * @param {string} [endDate] - End date for period
 * @returns {string} Formatted filename with .pdf extension
 */
export function generatePdfFilename(baseName, startDate, endDate) {
    const parts = [baseName];

    if (startDate && endDate) {
        parts.push(`${startDate}_${endDate}`);
    } else if (startDate) {
        parts.push(startDate);
    }

    return `${parts.join('-')}.pdf`;
}

/**
 * Wrap a PDF export handler with standard error handling
 * @param {Function} handler - Async function(req, res) that generates PDF
 * @param {string} operationName - Name for logging
 * @returns {Function} Express route handler
 */
export function wrapPdfExport(handler, operationName) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            console.error(`[PDF Export] ${operationName} failed:`, error.message);

            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: `Gagal membuat PDF: ${operationName}`,
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
        }
    };
}

export default {
    streamPdfResponse,
    inlinePdfResponse,
    generatePdfFilename,
    wrapPdfExport
};
