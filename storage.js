// Storage utility helpers for YouTube Vanced Plugin
// This module centralizes access to chrome.storage so that future
// migrations and versioning logic can be added in a single place.
// NOTE: Currently used only by upcoming feature branches.

export function getSettings(keys = null, callback = () => {}) {
  try {
    if (Array.isArray(keys)) {
      chrome.storage.sync.get(keys, callback);
    } else {
      chrome.storage.sync.get(null, callback);
    }
  } catch (e) {
    console.error('getSettings error', e);
    callback({});
  }
}

export function setSettings(partial = {}, callback = () => {}) {
  try {
    chrome.storage.sync.set(partial, callback);
  } catch (e) {
    console.error('setSettings error', e);
    callback();
  }
} 