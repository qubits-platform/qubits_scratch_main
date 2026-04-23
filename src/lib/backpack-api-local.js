/**
 * Local storage-based backpack API
 * Replaces server-based backpack with browser localStorage
 */

import costumePayload from "./backpack/costume-payload";
import soundPayload from "./backpack/sound-payload";
import spritePayload from "./backpack/sprite-payload";
import codePayload from "./backpack/code-payload";
import { Base64 } from 'js-base64';

const STORAGE_KEY = 'scratch_backpack_items';

// Helper to generate unique IDs
const generateId = () => {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper to get MIME type prefix for data URIs
const getMimePrefix = (type, mime) => {
    if (type === 'script') {
        return 'application/json';
    }
    return mime;
};

// Helper to convert base64 data to data URI
const base64ToDataUri = (base64Data, mime) => {
    return `data:${mime};base64,${base64Data}`;
};

// Add thumbnailUrl and bodyUrl properties using data URIs
const includeDataUrls = (item) => {
    const thumbnailMime = 'image/jpeg';
    const bodyMime = getMimePrefix(item.type, item.mime);
    
    return Object.assign({}, item, {
        thumbnailUrl: base64ToDataUri(item.thumbnail, thumbnailMime),
        bodyUrl: base64ToDataUri(item.body, bodyMime),
    });
};

// Get all items from localStorage
const getStoredItems = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return [];
    }
};

// Save items to localStorage
const setStoredItems = (items) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
    } catch (error) {
        console.error('Error writing to localStorage:', error);
        // Check if it's a quota exceeded error
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            throw new Error('Storage quota exceeded. Try deleting some items from your backpack.');
        }
        throw error;
    }
};

/**
 * Get backpack contents from localStorage
 * @param {object} options - Options object (limit and offset for pagination)
 * @returns {Promise<Array>} Promise that resolves to array of backpack items
 */
const getBackpackContents = ({ limit = 20, offset = 0 }) => {
    return new Promise((resolve) => {
        try {
            const allItems = getStoredItems();
            // Sort by creation time (newest first) - IDs contain timestamps
            const sortedItems = allItems.sort((a, b) => {
                // Extract timestamp from ID if possible
                const timeA = a.id.includes('_') ? parseInt(a.id.split('_')[1]) : 0;
                const timeB = b.id.includes('_') ? parseInt(b.id.split('_')[1]) : 0;
                return timeB - timeA;
            });
            
            // Apply pagination
            const paginatedItems = sortedItems.slice(offset, offset + limit);
            
            // Add data URI URLs
            const itemsWithUrls = paginatedItems.map(includeDataUrls);
            
            resolve(itemsWithUrls);
        } catch (error) {
            console.error('Error getting backpack contents:', error);
            resolve([]);
        }
    });
};

/**
 * Save a backpack object to localStorage
 * @param {object} params - Object containing type, mime, name, body, and thumbnail
 * @returns {Promise<object>} Promise that resolves to the saved item with URLs
 */
const saveBackpackObject = ({
    type,
    mime,
    name,
    body,
    thumbnail,
}) => {
    return new Promise((resolve, reject) => {
        try {
            // Create new item with unique ID
            const newItem = {
                id: generateId(),
                type,
                mime,
                name,
                body,
                thumbnail,
            };
            
            // Get existing items and add new one at the beginning
            const items = getStoredItems();
            items.unshift(newItem);
            
            // Save back to localStorage
            setStoredItems(items);
            
            // Return item with data URLs
            resolve(includeDataUrls(newItem));
        } catch (error) {
            console.error('Error saving backpack object:', error);
            reject(error);
        }
    });
};

/**
 * Delete a backpack object from localStorage
 * @param {object} params - Object containing the item id
 * @returns {Promise<object>} Promise that resolves when deletion is complete
 */
const deleteBackpackObject = ({ id }) => {
    return new Promise((resolve, reject) => {
        try {
            // Get existing items and filter out the one to delete
            const items = getStoredItems();
            const filteredItems = items.filter(item => item.id !== id);
            
            // Save back to localStorage
            setStoredItems(filteredItems);
            
            resolve({ success: true });
        } catch (error) {
            console.error('Error deleting backpack object:', error);
            reject(error);
        }
    });
};

/**
 * Fetch code from a data URI (for code blocks)
 * @param {string} uri - Data URI containing the code JSON
 * @returns {Promise<object>} Promise that resolves to the parsed code object
 */
const fetchCode = (uri) => {
    return new Promise((resolve, reject) => {
        try {
            // Extract base64 data from data URI
            const base64Data = uri.split(',')[1];
            const jsonString = Base64.decode(base64Data);
            const codeObject = JSON.parse(jsonString);
            resolve(codeObject);
        } catch (error) {
            console.error('Error fetching code:', error);
            reject(error);
        }
    });
};

/**
 * Fetch sprite from a data URI (for sprite zip files)
 * @param {string} uri - Data URI containing the sprite zip
 * @returns {Promise<ArrayBuffer>} Promise that resolves to the sprite ArrayBuffer
 */
const fetchSprite = (uri) => {
    return new Promise((resolve, reject) => {
        try {
            // Extract base64 data from data URI
            const base64Data = uri.split(',')[1];
            
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            resolve(bytes.buffer);
        } catch (error) {
            console.error('Error fetching sprite:', error);
            reject(error);
        }
    });
};

export {
    getBackpackContents,
    saveBackpackObject,
    deleteBackpackObject,
    costumePayload,
    soundPayload,
    spritePayload,
    codePayload,
    fetchCode,
    fetchSprite,
};
