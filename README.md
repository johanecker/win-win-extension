# Win Win Extension

## Overview

**Win Win** is a Chrome extension designed to enhance multitasking by managing your browser windows. Split your current window into two balanced windows or merge multiple windows into one with a single click. The extension also displays a real-time tab count on the icon.

## Latest Update (v1.0.4)

- **Faster popup:** The Split Tabs and Merge Windows buttons now show the right state instantly when the popup opens.
- **Incognito fix:** Split and Merge now work correctly when regular and incognito windows are open at the same time.

## Previous Update (v1.0.3)

- **Tab count stays accurate:** The badge now keeps updating after Chrome restarts or the background worker goes idle.
- **More reliable merging:** Merge now finishes positioning the merged window, works when windows sit at the screen's left edge or on another monitor, and skips app, popup and incognito windows it can't merge.
- **Better window placement:** Windows now respect the macOS menu bar and Dock and stay on the monitor they're on. Split and merge also work on maximized or fullscreen windows.
- **Tab groups are kept** when splitting and merging.
- **Fewer permissions:** The "Read your browsing history" warning is gone.

## Previous Update (v1.0.2)

- **Minor Bugfixes:** Addressed small issues to improve overall functionality and stability.

## Previous Update (v1.0.1)

- **Minor Fixes and Enhancements**:
  - Resolved various small bugs and issues to improve the overall stability and performance of the extension.
  - Enhanced error handling for better management of edge cases and unexpected scenarios.
  - Made code optimizations for improved maintainability and efficiency.

## Features

- **Window Splitting**: Split your current window into two side-by-side windows with a 40/60 split ratio.
- **Window Merging**: Combine multiple browser windows into one.
- **Real-Time Tab Count**: Displays the number of open tabs on the extension icon.

## Installation

1. Open the [Chrome Web Store](https://chromewebstore.google.com/detail/win-win/cacgeaapncpnnnbigaaiebjkbogejkmm).
2. Click "Add to Chrome".
3. Confirm by clicking "Add extension".

## Usage

### Split Tabs

1. Click the Win Win icon in the Chrome toolbar.
2. Click "Split Tabs". The current window will split into two, moving the active tab and all tabs to its right to the new window.

### Merge Windows

1. Click the Win Win icon in the Chrome toolbar.
2. Click "Merge Windows". All open windows will merge into one.

## Development

### Cloning the Repository

```sh
git clone https://github.com/johanecker/win-win-extension.git
```
