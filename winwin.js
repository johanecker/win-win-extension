document.addEventListener("DOMContentLoaded", async () => {
  const splitTabsButton = document.getElementById("split-tabs");
  const mergeWindowsButton = document.getElementById("merge-windows");

  if (!splitTabsButton || !mergeWindowsButton) {
    console.error("Error: Buttons not found in the popup.");
    return;
  }

  // The browser window this popup was opened from.
  let windowId;
  try {
    windowId = (await chrome.windows.getCurrent()).id;
  } catch (error) {
    console.error("Could not get the current window:", error);
  }

  splitTabsButton.addEventListener("click", () => run("splitTabs"));
  mergeWindowsButton.addEventListener("click", () => run("mergeWindows"));

  try {
    const state = await chrome.runtime.sendMessage({ action: "getWindowState" });
    if (state && state.ok) {
      updateButtonState(splitTabsButton, state.splitTabsEnabled);
      updateButtonState(mergeWindowsButton, state.mergeWindowsEnabled);
    }
  } catch (error) {
    console.error("Could not get window state:", error);
  }

  async function run(action) {
    updateButtonState(splitTabsButton, false);
    updateButtonState(mergeWindowsButton, false);
    try {
      const response = await chrome.runtime.sendMessage({ action, windowId });
      if (response && !response.ok) console.error(`${action} failed:`, response.error);
    } catch (error) {
      // The popup can close while the background is still working. That's fine.
      console.warn(`${action}:`, error);
    }
    window.close();
  }

  function updateButtonState(button, isEnabled) {
    button.disabled = !isEnabled;
    button.classList.toggle("disabled", !isEnabled);
  }
});
