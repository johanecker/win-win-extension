// Win Win – background service worker (Manifest V3).
//
// All event listeners are registered synchronously at the top level so Chrome
// can wake the service worker for them after it has been suspended.

const LEFT_SHARE = 0.4; // Split: left window gets 40%, right window 60%.
const MERGE_SHARE = 0.6; // Merge: merged window takes the right 60%.
const BADGE_COLOR = "#616161";
const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

// ---------------------------------------------------------------------------
// Tab-count badge
// ---------------------------------------------------------------------------

let tabCountTimer = null;

chrome.runtime.onInstalled.addListener(scheduleTabCountUpdate);
chrome.runtime.onStartup.addListener(scheduleTabCountUpdate);
chrome.tabs.onCreated.addListener(scheduleTabCountUpdate);
chrome.tabs.onRemoved.addListener(scheduleTabCountUpdate);

// Also refresh whenever the service worker starts for any other reason.
scheduleTabCountUpdate();

// Debounced: closing a window fires onRemoved once per tab, and tabs.query can
// still include closing tabs for a moment.
function scheduleTabCountUpdate() {
  clearTimeout(tabCountTimer);
  tabCountTimer = setTimeout(updateTabCount, 100);
}

async function updateTabCount() {
  try {
    const tabs = await chrome.tabs.query({});
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    await chrome.action.setBadgeText({ text: String(tabs.length) });
  } catch (error) {
    console.error("Failed to update tab count:", error);
  }
}

// ---------------------------------------------------------------------------
// Popup messaging
// ---------------------------------------------------------------------------

const handlers = {
  getWindowState,
  splitTabs,
  mergeWindows,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message && message.action];
  if (!handler) return false;

  handler(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error(`"${message.action}" failed:`, error);
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    });
  return true; // Response is sent asynchronously.
});

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

// Only normal browser windows can exchange tabs (not app/PWA/popup windows).
function getNormalWindows() {
  return chrome.windows.getAll({ populate: true, windowTypes: ["normal"] });
}

async function getWindowState() {
  const windows = await getNormalWindows();
  return {
    splitTabsEnabled: windows.length <= 1,
    mergeWindowsEnabled: windows.length > 1,
  };
}

// Work area of the display that contains the window's centre (falls back to
// the display with the largest overlap, then the primary display).
async function getWorkArea(win) {
  const displays = await chrome.system.display.getInfo();
  const cx = win.left + win.width / 2;
  const cy = win.top + win.height / 2;

  const containing = displays.find(({ workArea: a }) =>
    cx >= a.left && cx < a.left + a.width && cy >= a.top && cy < a.top + a.height
  );
  if (containing) return containing.workArea;

  const overlap = ({ workArea: a }) =>
    Math.max(0, Math.min(win.left + win.width, a.left + a.width) - Math.max(win.left, a.left)) *
    Math.max(0, Math.min(win.top + win.height, a.top + a.height) - Math.max(win.top, a.top));
  const best = displays.reduce((a, b) => (overlap(b) > overlap(a) ? b : a), displays[0]);
  if (best && overlap(best) > 0) return best.workArea;

  return (displays.find((d) => d.isPrimary) || displays[0]).workArea;
}

// Bounds cannot be changed while a window is maximized, minimized or
// fullscreen, so restore it to "normal" first.
async function placeWindow(windowId, bounds) {
  const win = await chrome.windows.get(windowId);
  if (win.state !== "normal") {
    await chrome.windows.update(windowId, { state: "normal" });
  }
  await chrome.windows.update(windowId, bounds);
}

// Moving tabs to another window drops them from their tab groups. Record the
// groups up front so they can be recreated in the destination window.
async function describeGroups(tabs) {
  const groups = new Map();
  for (const tab of tabs) {
    if (tab.groupId === undefined || tab.groupId === NO_GROUP) continue;
    if (!groups.has(tab.groupId)) {
      let info = null;
      try {
        const g = await chrome.tabGroups.get(tab.groupId);
        info = { title: g.title, color: g.color, collapsed: g.collapsed };
      } catch (error) {
        console.warn("Could not read tab group:", error);
      }
      groups.set(tab.groupId, { info, tabIds: [] });
    }
    groups.get(tab.groupId).tabIds.push(tab.id);
  }
  return [...groups.values()];
}

async function restoreGroups(groups, windowId) {
  for (const { info, tabIds } of groups) {
    try {
      const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
      if (info) await chrome.tabGroups.update(groupId, info);
    } catch (error) {
      console.warn("Could not restore tab group:", error);
    }
  }
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

// Moves the active tab and every tab to its right into a new window on the
// left (40%); the original window goes on the right (60%).
async function splitTabs({ windowId }) {
  const currentWindow =
    typeof windowId === "number"
      ? await chrome.windows.get(windowId, { populate: true })
      : await chrome.windows.getLastFocused({ populate: true, windowTypes: ["normal"] });

  if (currentWindow.type !== "normal") {
    throw new Error("Only normal browser windows can be split.");
  }

  const area = await getWorkArea(currentWindow);
  const leftWidth = Math.round(area.width * LEFT_SHARE);
  const leftBounds = { left: area.left, top: area.top, width: leftWidth, height: area.height };
  const rightBounds = {
    left: area.left + leftWidth,
    top: area.top,
    width: area.width - leftWidth,
    height: area.height,
  };

  const { tabs } = currentWindow;
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.active));
  // With exactly two tabs, always give each tab its own window.
  const tabsToMove = tabs.length === 2 ? [tabs[activeIndex]] : tabs.slice(activeIndex);
  const incognito = currentWindow.incognito;

  // Nothing would stay behind (a single tab, or the first tab is active):
  // keep all tabs together on the left and open a fresh window on the right.
  if (tabsToMove.length === tabs.length) {
    await placeWindow(currentWindow.id, leftBounds);
    await chrome.windows.create({ ...rightBounds, incognito, focused: true });
    return {};
  }

  const groups = await describeGroups(tabsToMove);
  const newWindow = await chrome.windows.create({ tabId: tabsToMove[0].id, ...leftBounds });
  if (tabsToMove.length > 1) {
    await chrome.tabs.move(tabsToMove.slice(1).map((tab) => tab.id), {
      windowId: newWindow.id,
      index: -1,
    });
  }
  await restoreGroups(groups, newWindow.id);

  // Restore the originally active tab (moving tabs can change it).
  await chrome.tabs.update(tabsToMove[0].id, { active: true });

  await placeWindow(currentWindow.id, rightBounds);
  await placeWindow(newWindow.id, leftBounds);
  await chrome.windows.update(newWindow.id, { focused: true });
  return {};
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

// Moves all tabs into the right-most window and gives it the right 60% of
// its display. Incognito and regular windows cannot share tabs, so only
// windows matching the focused window's mode are merged.
async function mergeWindows() {
  const allWindows = await getNormalWindows();
  const focused = allWindows.find((w) => w.focused) || allWindows[0];
  if (!focused) throw new Error("No browser windows found.");

  const windows = allWindows.filter((w) => w.incognito === focused.incognito);
  if (windows.length <= 1) return { merged: 0 };

  // Right-most window wins; ties go to the focused window.
  const target = windows.reduce((best, w) =>
    w.left > best.left || (w.left === best.left && w.focused) ? w : best
  );

  const errors = [];
  for (const source of windows) {
    if (source.id === target.id) continue;
    try {
      const groups = await describeGroups(source.tabs);
      await chrome.tabs.move(source.tabs.map((tab) => tab.id), {
        windowId: target.id,
        index: -1,
      });
      await restoreGroups(groups, target.id);
      // Chrome closes the source window automatically once it is empty.
    } catch (error) {
      console.error(`Could not merge window ${source.id}:`, error);
      errors.push(error);
    }
  }

  const area = await getWorkArea(target);
  const width = Math.round(area.width * MERGE_SHARE);
  await placeWindow(target.id, {
    left: area.left + area.width - width,
    top: area.top,
    width,
    height: area.height,
  });
  await chrome.windows.update(target.id, { focused: true });

  if (errors.length) {
    throw new Error(`${errors.length} window(s) could not be merged: ${errors[0].message}`);
  }
  return { merged: windows.length - 1 };
}
