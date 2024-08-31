document.addEventListener("DOMContentLoaded", function () {
  const splitTabsButton = document.getElementById("split-tabs");
  const mergeWindowsButton = document.getElementById("merge-windows");

  if (splitTabsButton && mergeWindowsButton) {
    splitTabsButton.addEventListener("click", function () {
      chrome.runtime.sendMessage({ action: "splitTabs" }, closePopup);
    });

    mergeWindowsButton.addEventListener("click", function () {
      chrome.runtime.sendMessage({ action: "mergeWindows" }, closePopup);
    });
  } else {
    console.error("Error: Buttons not found in the popup.");
  }

  chrome.runtime.sendMessage({ action: "checkWindowState" });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateButtonStates") {
      updateButtonState(splitTabsButton, message.splitTabsEnabled);
      updateButtonState(mergeWindowsButton, message.mergeWindowsEnabled);
    }
  });

  function closePopup() {
    window.close();
  }

  function updateButtonState(button, isEnabled) {
    if (button) {
      button.disabled = !isEnabled;
      button.classList.toggle("disabled", !isEnabled);
    }
  }
});
