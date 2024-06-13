document.addEventListener('DOMContentLoaded', function() {
    const splitTabsButton = document.getElementById('split-tabs');
    const mergeWindowsButton = document.getElementById('merge-windows');

    splitTabsButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'splitTabs' }, closePopup);
    });

    mergeWindowsButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'mergeWindows' }, closePopup);
    });

    // Request to check the window state on popup load
    chrome.runtime.sendMessage({ action: 'checkWindowState' });

    // Listen for updates to button states from the background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateButtonStates') {
            splitTabsButton.disabled = !message.splitTabsEnabled;
            splitTabsButton.classList.toggle('disabled', !message.splitTabsEnabled);

            mergeWindowsButton.disabled = !message.mergeWindowsEnabled;
            mergeWindowsButton.classList.toggle('disabled', !message.mergeWindowsEnabled);
        }
    });

    function closePopup() {
        window.close();
    }
});
