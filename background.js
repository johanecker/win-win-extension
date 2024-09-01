chrome.runtime.onInstalled.addListener(() => {
  initializeEventListeners();
  updateTabCount();
  checkWindowState(); // Initial check
});

// Fallback mechanism: Update tab count every 5 seconds
setInterval(updateTabCount, 5000);

// Listen for Chrome startup
chrome.runtime.onStartup.addListener(() => {
  updateTabCount();
});

// Existing event listeners for other actions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "splitTabs") {
    splitTabs(sendResponse);
  } else if (message.action === "mergeWindows") {
    mergeWindows(sendResponse);
  } else if (message.action === "checkWindowState") {
    checkWindowState();
    sendResponse(); // Respond to close the message channel
  }
  return true; // Keep the message channel open
});

function initializeEventListeners() {
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
}

function updateTabCount() {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error("Error querying tabs:", chrome.runtime.lastError.message);
      return;
    }

    const tabCount = tabs.length;

    // Ensure the tab count is always a valid number
    if (typeof tabCount !== "number" || isNaN(tabCount)) {
      console.error("Invalid tab count:", tabCount);
      chrome.action.setBadgeText({ text: "" }); // Clear badge on error
      return;
    }

    console.log(`Tab count updated to: ${tabCount}`); // Debugging output

    // Update the badge text only if there's a valid tab count
    chrome.action.setBadgeText({ text: tabCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#616161" });
  });
}

function splitTabs(callback) {
  chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
    if (chrome.runtime.lastError || !currentWindow) {
      console.error(
        "Error getting current window:",
        chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : "No window found"
      );
      callback();
      return;
    }

    chrome.storage.local.get(["lastSplitRatio"], (result) => {
      let leftRatio = result.lastSplitRatio ? result.lastSplitRatio.left : 0.4; // Default to 40%
      let rightRatio = result.lastSplitRatio
        ? result.lastSplitRatio.right
        : 0.6; // Default to 60%

      let tabs = currentWindow.tabs;
      let activeTabIndex = tabs.findIndex((tab) => tab.active);

      chrome.system.display.getInfo((displays) => {
        const screenWidth = displays[0].workArea.width;
        const screenHeight = displays[0].workArea.height;
        const leftWidth = Math.round(screenWidth * leftRatio);
        const rightWidth = Math.round(screenWidth * rightRatio);

        let tabIdsToMove = [];

        if (tabs.length === 1) {
          chrome.windows.create({}, (newWindow) => {
            if (chrome.runtime.lastError || !newWindow) {
              console.error(
                "Error creating new window:",
                chrome.runtime.lastError
                  ? chrome.runtime.lastError.message
                  : "No window found"
              );
              callback();
              return;
            }
            resizeWindows(
              newWindow.id,
              currentWindow.id,
              leftWidth,
              rightWidth,
              screenHeight
            );
            checkWindowState();
            callback();
          });
        } else {
          if (tabs.length === 2) {
            tabIdsToMove.push(tabs[activeTabIndex].id);
          } else {
            for (let i = activeTabIndex; i < tabs.length; i++) {
              tabIdsToMove.push(tabs[i].id);
            }
          }

          chrome.windows.create({ tabId: tabIdsToMove[0] }, (newWindow) => {
            if (chrome.runtime.lastError || !newWindow) {
              console.error(
                "Error creating new window with tab:",
                chrome.runtime.lastError
                  ? chrome.runtime.lastError.message
                  : "No window found"
              );
              callback();
              return;
            }

            if (tabIdsToMove.length > 1) {
              chrome.tabs.move(
                tabIdsToMove.slice(1),
                { windowId: newWindow.id, index: -1 },
                () => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error moving tabs to new window:",
                      chrome.runtime.lastError.message
                    );
                    callback();
                    return;
                  }

                  chrome.tabs.query(
                    { windowId: currentWindow.id },
                    (remainingTabs) => {
                      if (chrome.runtime.lastError) {
                        console.error(
                          "Error querying tabs in the current window:",
                          chrome.runtime.lastError.message
                        );
                        callback();
                        return;
                      }

                      if (remainingTabs.length > 0) {
                        resizeWindows(
                          newWindow.id,
                          currentWindow.id,
                          leftWidth,
                          rightWidth,
                          screenHeight
                        );
                      } else {
                        chrome.windows.create({}, (emptyRightWindow) => {
                          if (chrome.runtime.lastError || !emptyRightWindow) {
                            console.error(
                              "Error creating empty right window:",
                              chrome.runtime.lastError
                                ? chrome.runtime.lastError.message
                                : "No window found"
                            );
                            callback();
                            return;
                          }
                          resizeWindows(
                            newWindow.id,
                            emptyRightWindow.id,
                            leftWidth,
                            rightWidth,
                            screenHeight
                          );
                        });
                      }
                      checkWindowState();
                      callback();
                    }
                  );
                }
              );
            } else {
              chrome.tabs.query(
                { windowId: currentWindow.id },
                (remainingTabs) => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error querying tabs in the current window:",
                      chrome.runtime.lastError.message
                    );
                    callback();
                    return;
                  }

                  if (remainingTabs.length > 0) {
                    resizeWindows(
                      newWindow.id,
                      currentWindow.id,
                      leftWidth,
                      rightWidth,
                      screenHeight
                    );
                  } else {
                    chrome.windows.create({}, (emptyRightWindow) => {
                      if (chrome.runtime.lastError || !emptyRightWindow) {
                        console.error(
                          "Error creating empty right window:",
                          chrome.runtime.lastError
                            ? chrome.runtime.lastError.message
                            : "No window found"
                        );
                        callback();
                        return;
                      }
                      resizeWindows(
                        newWindow.id,
                        emptyRightWindow.id,
                        leftWidth,
                        rightWidth,
                        screenHeight
                      );
                    });
                  }
                  checkWindowState();
                  callback();
                }
              );
            }
          });
        }
      });
    });
  });
}

function resizeWindows(
  leftWindowId,
  rightWindowId,
  leftWidth,
  rightWidth,
  screenHeight
) {
  chrome.windows.update(
    leftWindowId,
    { left: 0, top: 0, width: leftWidth, height: screenHeight },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error resizing left window:",
          chrome.runtime.lastError.message
        );
        return;
      }
    }
  );
  chrome.windows.update(
    rightWindowId,
    { left: leftWidth, top: 0, width: rightWidth, height: screenHeight },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error resizing right window:",
          chrome.runtime.lastError.message
        );
        return;
      }
    }
  );

  // Store the user's preference for future splits
  chrome.storage.local.set({
    lastSplitRatio: {
      left: leftWidth / (leftWidth + rightWidth),
      right: rightWidth / (leftWidth + rightWidth),
    },
  });
}

function mergeWindows(callback) {
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

      let remainingWindows = windows.filter((win) => win.id !== mainWindow.id);

      let moveTabsPromises = remainingWindows.map((win) => {
        let tabIdsToMove = win.tabs.map((tab) => tab.id);
        return new Promise((resolve, reject) => {
          chrome.tabs.move(
            tabIdsToMove,
            { windowId: mainWindow.id, index: -1 },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error moving tabs to main window:",
                  chrome.runtime.lastError.message
                );
                reject(chrome.runtime.lastError);
                return;
              }

              chrome.windows.get(win.id, (existingWindow) => {
                if (chrome.runtime.lastError || !existingWindow) {
                  console.error(
                    "Window already removed or does not exist:",
                    chrome.runtime.lastError
                      ? chrome.runtime.lastError.message
                      : "No window found"
                  );
                  reject(chrome.runtime.lastError);
                  return;
                }

                chrome.windows.remove(win.id, () => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error removing window:",
                      chrome.runtime.lastError.message
                    );
                    reject(chrome.runtime.lastError);
                    return;
                  }
                  resolve();
                });
              });
            }
          );
        });
      });

      Promise.all(moveTabsPromises)
        .then(() => {
          chrome.windows.update(
            mainWindow.id,
            {
              left: screenWidth - mainWidth,
              top: 0,
              width: mainWidth,
              height: screenHeight,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error resizing merged window:",
                  chrome.runtime.lastError.message
                );
                return;
              }
              updateTabCount();
              checkWindowState();
              callback();
            }
          );
        })
        .catch((error) => {
          console.error("Error during merge operation:", error.message);
          callback();
        });
    });
  });
}

function checkWindowState() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const windowCount = windows.length;
    let hasMultipleWindows = windowCount > 1;
    let canMerge = windowCount > 1;

    chrome.runtime.sendMessage({
      action: "updateButtonStates",
      splitTabsEnabled: !hasMultipleWindows,
      mergeWindowsEnabled: canMerge,
    });
  });
}
