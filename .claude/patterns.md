# JellyJump — Common Patterns & Recipes

Quick reference for adding features without re-reading the full codebase.

## Adding a New Tool/Menu (Step-by-Step)

### 1. Create Menu Class: `assets/js/player/menu/<Name>Menu.js`
Follow this structure (based on ConvertMenu/EncryptMenu):
```js
import { Logger } from '../../utils/Logger.js';
import { Modal } from '../Modal.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../utils/FooterHelper.js';

export class MyMenu {
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('my-content-template');
        if (!contentTemplate) { Logger.error('Template not found!'); return; }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('My Tool');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(createProcessFooter(FOOTER_CONFIGS.myTool));

        const modalContent = modal.modal;
        // Query elements from modalContent...
        // Setup event listeners...
        modal.open();
    }
}
```

### 2. Add HTML Template: `public/assets/templates/playlist-templates.html`
Append a `<template id="my-content-template">` at the end of the file.
- Use existing CSS utility classes: `mb-lg`, `mb-md`, `mb-sm`, `flex`, `gap-sm`, `text-secondary`, `text-sm`, `font-mono`, `hidden`, etc.
- Input class: `jellyjump-input w-full`
- Button classes: `jellyjump-btn-secondary`, `jellyjump-btn-small`
- Label pattern: `<div class="text-secondary text-sm font-mono mb-sm">LABEL:</div>`

### 3. Add Footer Config: `assets/js/utils/FooterHelper.js`
Add entry to `FOOTER_CONFIGS` object:
```js
myTool: { actionClass: 'my-btn', icon: 'icon-my', title: 'My Tool' }
```

### 4. Add Route: `assets/js/player/menu/MenuRouter.js`
Add case before `default` in the switch:
```js
case 'my-tool': {
    const { MyMenu } = await import('./MyMenu.js');
    await MyMenu.init(item, playlist);
    break;
}
```

### 5. Add Tool Entry: `assets/js/player/Playlist.js`
In `_showToolsMenu()` around line ~2730, add to `videoTools` array:
```js
{ action: 'my-tool', icon: 'icon-my', label: 'My Tool' },
```
- `info` is always last in the list
- `streamTools` is a separate array for HLS stream-specific tools

### 6. Add SVG Icon: `public/assets/icons/sprite.svg`
Add `<symbol>` before closing `</svg>`:
```xml
<symbol id="icon-my" viewBox="0 0 24 24">
    <path d="..."/>
</symbol>
```
Use Material Design icons (24x24 viewBox, single path preferred).

## Common Footer Template Structure
The shared footer (`common-process-footer-template`) provides:
- `.progress-section` (with `.spinner-sm`, `.progress-status`, `.progress-percentage`)
- `.error-message` (hidden by default)
- `.success-message` (hidden by default)
- `.download-btn` (hidden `<a>` tag — set `.href` and `.download`)
- `.primary-action-btn` (configured via FooterHelper)
- `.action-icon-use` (`<use>` element — can change `href` dynamically to swap icons)

## Getting Source Blob
```js
const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
```
Returns the raw file blob with caching. Used by ConvertMenu, BlurMenu, EncryptMenu, TrackManagerMenu, etc.

## Adding Result to Playlist
```js
const url = URL.createObjectURL(resultBlob);
const newItem = {
    title: newFilename,
    url: url,
    file: new File([resultBlob], newFilename, { type: resultBlob.type }),
    duration: item.duration,
    type: 'video',
    path: (item.path || item.title) + '/' + newFilename,
    id: generateId()   // from '../../utils/mediaUtils.js'
};
const index = playlist.items.indexOf(item);
playlist.items.splice(index + 1, 0, newItem);
playlist.render();
playlist._saveState();
```

## Modal API (`assets/js/player/Modal.js`)
- `new Modal({ maxWidth: '500px' })` — create modal
- `modal.setTitle(string)` — set header title
- `modal.setBody(DocumentFragment)` — set content from cloned template
- `modal.setFooter(DocumentFragment)` — set footer (use `createProcessFooter()`)
- `modal.open()` / `modal.close()`
- `modal.modal` — the root modal DOM element (query children from this)
- `modal.closeBtn` — the X button (disable during processing)
- `modal.onCleanup(cb)` — register cleanup callback (e.g., dropdown.destroy())

## UI Disable/Enable Pattern During Processing
```js
// Disable
actionBtn.disabled = true;
modal.closeBtn.disabled = true;
inputs.forEach(i => i.disabled = true);
errorMessage.classList.add('hidden');
successMessage.classList.add('hidden');
downloadBtn.classList.add('hidden');
progressSection.classList.remove('hidden');

// On success
successMessage.classList.remove('hidden');
progressSection.classList.add('hidden');
downloadBtn.classList.remove('hidden');

// On error
errorMessage.textContent = `Operation failed: ${error.message}`;
errorMessage.classList.remove('hidden');
progressSection.classList.add('hidden');

// Re-enable (in finally or after try/catch)
actionBtn.disabled = false;
modal.closeBtn.disabled = false;
inputs.forEach(i => i.disabled = false);
```

## Custom Dropdown (`assets/js/utils/CustomDropdown.js`)
```js
const dropdown = CustomDropdown.init({ button: btnEl, menu: menuEl, initialValue: 'default' });
dropdown.getValue();
dropdown.setDisabled(true/false);
modal.onCleanup(() => dropdown.destroy()); // Always register cleanup!
```

## Existing Icons in sprite.svg
icon-play, icon-pause, icon-download, icon-trash, icon-sliders, icon-convert,
icon-scissors, icon-maximize, icon-crop, icon-gif, icon-rewind, icon-record,
icon-bg, icon-watermark, icon-droplet, icon-scenes, icon-motion, icon-info,
icon-check, icon-blur, icon-rotate-cw, icon-flip-h, icon-flip-v,
icon-lock, icon-lock-open

## Key Directories
- `assets/js/player/menu/` — all tool menus (17+ files)
- `assets/js/utils/` — helpers (Logger, MediaMetadata, FooterHelper, CryptoHelper, CustomDropdown, mediaUtils)
- `assets/js/core/` — MediaProcessor.js, CorePlayer
- `public/assets/templates/` — HTML templates (playlist-templates.html)
- `public/assets/icons/` — sprite.svg
- `lib/` — third-party (mediabunny.js, hls.js)
