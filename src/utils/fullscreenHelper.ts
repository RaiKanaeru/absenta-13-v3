/**
 * Fullscreen API Helper
 * Provides cross-browser support for entering and exiting fullscreen mode.
 * Handles vendor prefixes: standard, webkit, ms.
 */

// Define interface for vendor-prefixed properties
interface FSElement extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

// Define interface for vendor-prefixed document
interface FSDocument extends Document {
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element;
    msFullscreenElement?: Element;
}

/**
 * Request fullscreen for a specific element
 * @param elem - The HTML element to make fullscreen
 */
export const enterFullscreen = async (elem: HTMLElement): Promise<void> => {
    try {
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        } else if ((elem as FSElement).webkitRequestFullscreen) {
            await (elem as FSElement).webkitRequestFullscreen?.();
        } else if ((elem as FSElement).msRequestFullscreen) {
            await (elem as FSElement).msRequestFullscreen?.();
        }
    } catch (error) {
        console.error('Failed to enter fullscreen:', error);
    }
};

/**
 * Exit fullscreen mode
 */
export const exitFullscreen = async (): Promise<void> => {
    const doc = document as FSDocument;
    try {
        if (doc.exitFullscreen) {
            await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen?.();
        } else if (doc.msExitFullscreen) {
            await doc.msExitFullscreen?.();
        }
    } catch (error) {
        console.error('Failed to exit fullscreen:', error);
    }
};

/**
 * Check if currently in fullscreen mode
 * @returns boolean
 */
export const isFullscreen = (): boolean => {
    const doc = document as FSDocument;
    return !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.msFullscreenElement
    );
};
