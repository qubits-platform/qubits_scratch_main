/**
 * Utility functions for managing project history and undo/redo operations
 */

/**
 * Restore a project state from history to the VM
 * @param {VM} vm - The Scratch VM instance
 * @param {Object} historyItem - The history item containing project data
 * @param {Function} updateHistoryNavigation - Redux action to update navigation state
 * @param {Function} addNotification - Redux action to add notifications
 * @returns {Promise} Promise that resolves when project is loaded
 */
export const restoreProjectFromHistory = async (
    vm,
    historyItem,
    updateHistoryNavigation,
    addNotification
) => {
    try {
        if (!historyItem || !historyItem.content) {
            throw new Error("Invalid history item");
        }

        // Convert base64 to binary data
        const binaryString = atob(historyItem.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Load the project into the VM
        await vm.loadProject(bytes.buffer);

        // Reset restoring flag
        updateHistoryNavigation(undefined, undefined, false);

        // Show success notification
        addNotification({
            type: "success",
            icon: "success",
            message: `Restored to: ${historyItem.name || "Previous version"}`,
            duration: 2000,
        });

        return true;
    } catch (error) {
        console.error("Error restoring project from history:", error);

        // Reset restoring flag on error
        updateHistoryNavigation(undefined, undefined, false);

        // Show error notification
        addNotification({
            type: "error",
            icon: "error",
            message: "Failed to restore project from history",
            duration: 5000,
        });

        return false;
    }
};

/**
 * Create a history item from current project state
 * @param {string} base64Content - Base64 encoded project content
 * @param {string} projectName - Current project name
 * @returns {Object} History item object
 */
export const createHistoryItem = (base64Content, projectName) => {
    return {
        content: base64Content,
        name: projectName || "Untitled",
        timestamp: Date.now(),
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
};

/**
 * Get the current history item based on history index
 * @param {Array} projectHistory - Array of history items
 * @param {number} historyIndex - Current history index
 * @returns {Object|null} Current history item or null if invalid
 */
export const getCurrentHistoryItem = (projectHistory, historyIndex) => {
    if (
        !projectHistory ||
        historyIndex < 0 ||
        historyIndex >= projectHistory.length
    ) {
        return null;
    }
    return projectHistory[historyIndex];
};

/**
 * Get the previous history item for undo operation
 * @param {Array} projectHistory - Array of history items
 * @param {number} historyIndex - Current history index
 * @returns {Object|null} Previous history item or null if not available
 */
export const getPreviousHistoryItem = (projectHistory, historyIndex) => {
    const previousIndex = historyIndex - 1;
    return getCurrentHistoryItem(projectHistory, previousIndex);
};

/**
 * Get the next history item for redo operation
 * @param {Array} projectHistory - Array of history items
 * @param {number} historyIndex - Current history index
 * @returns {Object|null} Next history item or null if not available
 */
export const getNextHistoryItem = (projectHistory, historyIndex) => {
    const nextIndex = historyIndex + 1;
    return getCurrentHistoryItem(projectHistory, nextIndex);
};

/**
 * Validate if a base64 string represents a valid project for history storage
 * @param {string} base64Content - Base64 encoded project content
 * @param {number} minSize - Minimum size threshold (default: 1000 characters)
 * @returns {boolean} True if valid for history storage
 */
export const isValidForHistory = (base64Content, minSize = 1000) => {
    if (!base64Content || typeof base64Content !== "string") {
        return false;
    }

    // Check minimum size to avoid storing empty or corrupt projects
    return base64Content.length >= minSize;
};

/**
 * Format timestamp for display in history items
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
export const formatHistoryTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffMinutes < 1) {
        return "Just now";
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
    } else {
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else {
            return (
                date.toLocaleDateString() +
                " " +
                date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                })
            );
        }
    }
};

/**
 * Calculate the size of base64 content in bytes
 * @param {string} base64Content - Base64 encoded content
 * @returns {number} Size in bytes
 */
export const getHistoryItemSize = (base64Content) => {
    if (!base64Content || typeof base64Content !== "string") {
        return 0;
    }

    // Calculate actual byte size of base64 content
    const padding = (base64Content.match(/=/g) || []).length;
    return Math.floor((base64Content.length * 3) / 4) - padding;
};

/**
 * Get memory usage information for the history stack
 * @param {Array} projectHistory - Array of history items
 * @returns {Object} Memory usage statistics
 */
export const getHistoryMemoryUsage = (projectHistory) => {
    if (!projectHistory || !Array.isArray(projectHistory)) {
        return { totalSize: 0, itemCount: 0, averageSize: 0 };
    }

    const totalSize = projectHistory.reduce((sum, item) => {
        return sum + getHistoryItemSize(item.content || "");
    }, 0);

    return {
        totalSize,
        itemCount: projectHistory.length,
        averageSize:
            projectHistory.length > 0
                ? Math.floor(totalSize / projectHistory.length)
                : 0,
        formattedSize: formatBytes(totalSize),
    };
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 MB")
 */
const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
