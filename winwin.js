document.addEventListener("DOMContentLoaded", async () => {
  const splitTabsButton = document.getElementById("split-tabs");
  const mergeWindowsButton = document.getElementById("merge-windows");

  if (!splitTabsButton || !mergeWindowsButton) {
    console.error("Error: Buttons not found in the popup.");
    return;
  }

  // The browser window this popup was opened from.
  let windowId;
  let incognito = false;
  try {
    const current = await chrome.windows.getCurrent();
    windowId = current.id;
    incognito = current.incognito;
  } catch (error) {
    console.error("Could not get the current window:", error);
  }

  splitTabsButton.addEventListener("click", () => run("splitTabs"));
  mergeWindowsButton.addEventListener("click", () => run("mergeWindows"));

  // Query windows directly from the popup instead of waking the background
  // service worker, so the button state appears instantly. Regular and
  // incognito windows can't share tabs, so only count windows of this kind.
  try {
    const windows = (await chrome.windows.getAll({ windowTypes: ["normal"] })).filter(
      (w) => w.incognito === incognito
    );
    updateButtonState(splitTabsButton, windows.length <= 1);
    updateButtonState(mergeWindowsButton, windows.length > 1);
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
