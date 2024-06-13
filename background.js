chrome.runtime.onInstalled.addListener(() => {
    updateTabCount();
    chrome.tabs.onCreated.addListener(updateTabCount);
    chrome.tabs.onRemoved.addListener(updateTabCount);
    chrome.tabs.onUpdated.addListener(updateTabCount);
    chrome.windows.onCreated.addListener(() => {
        updateTabCount();
        checkWindowState();
    });
    chrome.windows.onRemoved.addListener(() => {
        updateTabCount();
        checkWindowState();
    });
    checkWindowState(); // Initial check
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'splitTabs') {
        splitTabs(sendResponse);
        return true; // Keep the message channel open for the sendResponse callback
    } else if (message.action === 'mergeWindows') {
        mergeWindows(sendResponse);
        return true; // Keep the message channel open for the sendResponse callback
    } else if (message.action === 'checkWindowState') {
        checkWindowState();
        sendResponse(); // Respond to close the message channel
    }
    return true; // Keep the message channel open
});

function updateTabCount() {
    chrome.tabs.query({}, (tabs) => {
        const tabCount = tabs.length;
        chrome.action.setBadgeText({ text: tabCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#616161' }); // Set the badge background color to a gray color
    });
}

function checkWindowState() {
    chrome.windows.getAll({ populate: true }, (windows) => {
        const windowCount = windows.length;
        let hasMultipleWindows = windowCount > 1;
        let canMerge = windowCount > 1;

        chrome.runtime.sendMessage({
            action: 'updateButtonStates',
            splitTabsEnabled: !hasMultipleWindows,
            mergeWindowsEnabled: canMerge
        });
    });
}

function splitTabs(callback) {
    console.log("splitTabs function called");
    chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
        if (chrome.runtime.lastError || !currentWindow) {
            console.error("Error getting current window:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
            callback();
            return;
        }

        console.log("Current window:", currentWindow);
        let tabs = currentWindow.tabs;
        let activeTabIndex = tabs.findIndex(tab => tab.active);

        chrome.system.display.getInfo((displays) => {
            console.log("Display info:", displays);
            const screenWidth = displays[0].workArea.width;
            const screenHeight = displays[0].workArea.height;
            const leftWidth = Math.round(screenWidth * 0.4);
            const rightWidth = Math.round(screenWidth * 0.6);

            console.log(`Screen width: ${screenWidth}, screen height: ${screenHeight}`);
            console.log(`Left window width: ${leftWidth}, right window width: ${rightWidth}`);

            let tabIdsToMove = [];

            if (tabs.length === 1) {
                console.log("Only one tab, creating an empty new window");
                chrome.windows.create({}, (newWindow) => {
                    if (chrome.runtime.lastError || !newWindow) {
                        console.error("Error creating new window:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
                        callback();
                        return;
                    }
                    console.log("Created new empty window:", newWindow);
                    resizeWindows(newWindow.id, currentWindow.id, leftWidth, rightWidth, screenHeight);
                    checkWindowState(); // Update button states
                    callback();
                });
            } else {
                if (tabs.length === 2) {
                    // Move the currently active tab to the new window
                    tabIdsToMove.push(tabs[activeTabIndex].id);
                } else {
                    // Move the active tab and all tabs to its right to the new window
                    for (let i = activeTabIndex; i < tabs.length; i++) {
                        tabIdsToMove.push(tabs[i].id);
                    }
                }
                console.log("Tab IDs to move:", tabIdsToMove);
                chrome.windows.create({ tabId: tabIdsToMove[0] }, (newWindow) => {
                    if (chrome.runtime.lastError || !newWindow) {
                        console.error("Error creating new window with tab:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
                        callback();
                        return;
                    }
                    console.log("Created new window with first tab:", newWindow);

                    if (tabIdsToMove.length > 1) {
                        chrome.tabs.move(tabIdsToMove.slice(1), { windowId: newWindow.id, index: -1 }, () => {
                            if (chrome.runtime.lastError) {
                                console.error("Error moving tabs to new window:", chrome.runtime.lastError.message);
                                callback();
                                return;
                            }
                            console.log("Moved tabs to new window");

                            // Check if there are any tabs left in the original window
                            chrome.tabs.query({ windowId: currentWindow.id }, (remainingTabs) => {
                                if (chrome.runtime.lastError) {
                                    console.error("Error querying tabs in the current window:", chrome.runtime.lastError.message);
                                    callback();
                                    return;
                                }

                                if (remainingTabs.length > 0) {
                                    // Tabs remain in the original window, no need to create an empty right window
                                    resizeWindows(newWindow.id, currentWindow.id, leftWidth, rightWidth, screenHeight);
                                } else {
                                    // No tabs left in the original window, create an empty right window
                                    chrome.windows.create({}, (emptyRightWindow) => {
                                        if (chrome.runtime.lastError || !emptyRightWindow) {
                                            console.error("Error creating empty right window:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
                                            callback();
                                            return;
                                        }
                                        console.log("Created empty right window:", emptyRightWindow);
                                        resizeWindows(newWindow.id, emptyRightWindow.id, leftWidth, rightWidth, screenHeight);
                                    });
                                }
                                checkWindowState(); // Update button states
                                callback();
                            });
                        });
                    } else {
                        // Single tab move case
                        chrome.tabs.query({ windowId: currentWindow.id }, (remainingTabs) => {
                            if (chrome.runtime.lastError) {
                                console.error("Error querying tabs in the current window:", chrome.runtime.lastError.message);
                                callback();
                                return;
                            }

                            if (remainingTabs.length > 0) {
                                resizeWindows(newWindow.id, currentWindow.id, leftWidth, rightWidth, screenHeight);
                            } else {
                                chrome.windows.create({}, (emptyRightWindow) => {
                                    if (chrome.runtime.lastError || !emptyRightWindow) {
                                        console.error("Error creating empty right window:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
                                        callback();
                                        return;
                                    }
                                    console.log("Created empty right window:", emptyRightWindow);
                                    resizeWindows(newWindow.id, emptyRightWindow.id, leftWidth, rightWidth, screenHeight);
                                });
                            }
                            checkWindowState(); // Update button states
                            callback();
                        });
                    }
                });
            }
        });
    });
}

function resizeWindows(leftWindowId, rightWindowId, leftWidth, rightWidth, screenHeight) {
    console.log("Resizing windows...");
    chrome.windows.update(leftWindowId, { left: 0, top: 0, width: leftWidth, height: screenHeight }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error resizing left window:", chrome.runtime.lastError.message);
            return;
        }
        console.log("Resized left window to 40%");
    });
    chrome.windows.update(rightWindowId, { left: leftWidth, top: 0, width: rightWidth, height: screenHeight }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error resizing right window:", chrome.runtime.lastError.message);
            return;
        }
        console.log("Resized right window to 60%");
    });
}

function mergeWindows(callback) {
    console.log("mergeWindows function called");
    chrome.windows.getAll({ populate: true }, (windows) => {
        if (windows.length <= 1) {
            console.error("No windows to merge or only one window open.");
            callback();
            return;
        }

        chrome.system.display.getInfo((displays) => {
            const screenWidth = displays[0].workArea.width;
            const screenHeight = displays[0].workArea.height;
            const mainWidth = Math.round(screenWidth * 0.6);

            let mainWindow = null;
            let rightMostPosition = 0;

            // Find the rightmost window
            for (let i = 0; i < windows.length; i++) {
                if (windows[i].left > rightMostPosition) {
                    rightMostPosition = windows[i].left;
                    mainWindow = windows[i];
                }
            }

            if (!mainWindow) {
                console.error("No main window found for merging.");
                callback();
                return;
            }

            console.log("Merging into main window:", mainWindow);

            let remainingWindows = windows.filter(win => win.id !== mainWindow.id);

            let moveTabsPromises = remainingWindows.map(win => {
                let tabIdsToMove = win.tabs.map(tab => tab.id);
                return new Promise((resolve, reject) => {
                    chrome.tabs.move(tabIdsToMove, { windowId: mainWindow.id, index: -1 }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error moving tabs to main window:", chrome.runtime.lastError.message);
                            reject(chrome.runtime.lastError);
                            return;
                        }
                        console.log("Moved tabs to main window:", mainWindow.id);

                        // Check if the window still exists before removing
                        chrome.windows.get(win.id, (existingWindow) => {
                            if (chrome.runtime.lastError || !existingWindow) {
                                console.error("Window already removed or does not exist:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No window found");
                                reject(chrome.runtime.lastError);
                                return;
                            }

                            chrome.windows.remove(win.id, () => {
                                if (chrome.runtime.lastError) {
                                    console.error("Error removing window:", chrome.runtime.lastError.message);
                                    reject(chrome.runtime.lastError);
                                    return;
                                }
                                resolve();
                            });
                        });
                    });
                });
            });

            Promise.all(moveTabsPromises)
                .then(() => {
                    console.log("All tabs moved and windows removed successfully.");
                    chrome.windows.update(mainWindow.id, { left: screenWidth - mainWidth, top: 0, width: mainWidth, height: screenHeight }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error resizing merged window:", chrome.runtime.lastError.message);
                            return;
                        }
                        console.log("Resized merged window to 60%");
                        updateTabCount();
                        checkWindowState(); // Update button states
                        callback();
                    });
                })
                .catch(error => {
                    console.error("Error during merge operation:", error.message);
                    callback();
                });
        });
    });
}
