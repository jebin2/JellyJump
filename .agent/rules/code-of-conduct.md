---
trigger: always_on
---

# Code of Conduct (COC) & Coding Standards

This document serves as the "Constitution" for code quality in the **MediaBunny Player** project. All code, whether written by humans or LLMs, must strictly adhere to these rules.

## 1. Core Philosophy
*   **Vanilla First**: No frameworks (React, Vue, etc.), no build steps (Webpack, Vite), no NPM dependencies (unless explicitly approved). Use pure ES Modules, HTML, and CSS.
*   **KISS (Keep It Simple, Stupid)**: Prefer simple, readable solutions over "clever" ones. Code should be easy to understand for a junior developer.
*   **Consistency**: Follow the existing patterns in the codebase. If you see a pattern, follow it.

## 2. Naming Conventions
*   **Variables & Functions**: Use `camelCase`. Names must be descriptive and verb-based for functions.
    *   ✅ `fetchUserData()`, `isModalOpen`, `userIndex`
    *   ❌ `getData()`, `flag`, `i` (except in short loops)
*   **Classes**: Use `PascalCase`.
    *   ✅ `VideoPlayer`, `PlaylistManager`
*   **Constants**: Use `UPPER_SNAKE_CASE` for configuration values and magic numbers.
    *   ✅ `MAX_RETRY_ATTEMPTS`, `DEFAULT_VOLUME`
*   **Booleans**: Prefix with `is`, `has`, `should`, or `can` to indicate a question.
    *   ✅ `isVisible`, `hasLoaded`, `shouldRetry`
    *   ❌ `visible`, `loaded`, `retry`
*   **Event Handlers**: Prefix with `on` or `handle`.
    *   ✅ `onPlayClick`, `handleResize`

## 3. Function Design (SRP)
*   **Single Responsibility Principle (SRP)**: One function = One purpose. If a function does "this AND that", split it.
*   **Function Length**: Aim for functions under 30 lines. If it's longer, it's likely doing too much.
*   **Pure Functions**: Prefer pure functions (output depends only on input, no side effects) where possible. This makes testing and debugging easier.
*   **Argument Count**: Limit function arguments to 3. If you need more, pass an options object.
*   **Return Early, Return Often**: Multiple early returns are fine if they simplify logic (see Guard Clauses in Section 4).

## 4. Control Flow & Logic
*   **Guard Clauses**: Use early returns to avoid nested `if/else` blocks (the "Arrow Code" anti-pattern).
    ```javascript
    // ❌ Bad
    function processData(data) {
        if (data) {
            if (data.isValid) {
                save(data);
            }
        }
    }

    // ✅ Good
    function processData(data) {
        if (!data || !data.isValid) return;
        save(data);
    }
    ```
*   **No Unnecessary Checks**: Trust your data types or validate at the boundary (API/User Input). Do not paranoid-check every variable in every function.
*   **Strict Equality**: Always use `===` and `!==`. Never use `==` or `!=`.

## 5. DOM & Performance
*   **Cache Selectors**: Do NOT query the DOM inside loops or frequently called functions (like `requestAnimationFrame`). Cache elements in variables or class properties.
*   **Event Delegation**: Use event delegation for lists or dynamic elements instead of attaching listeners to every child.
*   **No Inline Styles**: Avoid setting `element.style.property` directly. Toggle CSS classes instead. Exception: Dynamic coordinates (e.g., dragging, progress bars).
*   **Debounce/Throttle**: Use debounce or throttle for high-frequency events like `resize`, `scroll`, or `mousemove`.
*   **Batch DOM Updates**: When making multiple DOM changes, use DocumentFragment or update in a single reflow to minimize layout thrashing.

## 6. MediaBunny Specifics
*   **Resource Cleanup**: Always clean up `Conversion`, `Player`, or `Input` instances when they are no longer needed to prevent memory leaks.
*   **Error Handling**: Explicitly handle media errors (loading, decoding, network). Provide user-friendly error messages, not just console logs.
*   **Async/Await**: Use `async/await` for all asynchronous MediaBunny operations. Avoid raw `.then()` chains.
*   **Initialization Patterns**: Use consistent initialization methods (e.g., `init()`, `setup()`) for classes that require async setup or configuration.

## 7. Comments & Documentation
*   **Why, not What**: Comment *why* a complex piece of logic exists, not *what* the code is doing. The code should speak for itself.
    *   ❌ `// Increment i by 1`
    *   ✅ `// Offset by 1 to account for 0-based index`
*   **JSDoc**: Use JSDoc for public functions and classes to describe parameters and return types.

## 8. File Structure
*   **ES Modules**: Use `.js` extension (or `.mjs` if strictly required). Use `import` and `export`.
*   **One Class Per File**: Generally, keep one main class per file, named after the file.

## 9. Modularity & Reusability
*   **DRY (Don't Repeat Yourself)**: If you copy-paste code more than once, extract it into a reusable function or module.
*   **Shared Utilities**: Place common helper functions in a dedicated folder (e.g., `utils/`, `helpers/`).
*   **Component Isolation**: Each module/class should be self-contained with minimal coupling. Avoid tight dependencies between unrelated modules.
*   **Configuration Over Code**: Extract magic numbers, URLs, and repeated values into a config file or constants.
    *   ✅ `const API_ENDPOINT = '/api/media';`
    *   ❌ Using `'/api/media'` scattered across 10 files
*   **Composition Over Inheritance**: Prefer small, composable functions/modules over deep class hierarchies.

## 10. Testability
*   **Write Testable Code**: Pure functions, dependency injection, and small modules are easier to test.
*   **Avoid Global State**: Use parameters or class properties instead of globals. Global state makes testing and debugging difficult.
*   **Side Effects Isolation**: Isolate side effects (DOM manipulation, API calls, localStorage) to make core logic testable.

## 11. CSS Standards

### 11.1 Separation of Concerns
*   **No Inline Styles in HTML**: Never use `style=""` attributes. Exception: Dynamic values (e.g., progress bars, drag positions).
*   **No CSS-in-JS**: Do NOT embed CSS strings in JavaScript files. All styles belong in `.css` files.
    *   ❌ `element.style.cssText = 'color: red; font-size: 14px;'`
    *   ❌ Creating `<style>` tags dynamically in JS
    *   ✅ Toggle classes: `element.classList.add('error-state')`
*   **External Stylesheets Only**: Organize CSS in a logical folder structure (e.g., `styles/`, `css/`).

### 11.2 CSS Architecture
*   **BEM Naming Convention**: Use Block-Element-Modifier pattern.
    ```css
    .video-player { }              /* Block */
    .video-player__controls { }    /* Element */
    .video-player--fullscreen { }  /* Modifier */
    ```
*   **No ID Selectors**: Never use `#id` for styling. IDs are for JS only.
*   **Shallow Specificity**: Keep selectors flat (1-2 levels max).

### 11.3 CSS Custom Properties (Variables)
*   **Centralized Theming**: Define all colors, spacing, and magic numbers as CSS variables.
    ```css
    :root {
        --color-primary: #007bff;
        --space-md: 16px;
    }
    ```
*   **Use Variables Everywhere**: Reference variables instead of hardcoding.
    ```css
    /* ❌ Bad */
    .button { background: #007bff; padding: 8px 16px; }
    
    /* ✅ Good */
    .button { background: var(--color-primary); padding: var(--space-sm) var(--space-md); }
    ```

### 11.4 Responsive & Performance
*   **Mobile-First**: Base styles for mobile, then `min-width` media queries.
*   **Avoid `@import`**: Use `<link>` tags in HTML.
*   **Minimize Repaints**: Animate `transform` and `opacity`, not `width`/`height`/`top`/`left`.

### 11.5 Accessibility
*   **Focus States**: Always style `:focus-visible` for keyboard navigation.
*   **Contrast Ratios**: Meet WCAG AA standards (4.5:1 for text).

## 12. HTML Standards

### 12.1 Semantic Markup
*   **Use Semantic Tags**: `<nav>`, `<main>`, `<article>`, `<section>` over `<div>`.
*   **Buttons vs Links**: `<button>` for actions, `<a>` for navigation.
*   **Heading Hierarchy**: Use `<h1>` to `<h6>` in order. One `<h1>` per page.

### 12.2 Accessibility
*   **Alt Text**: Every `<img>` needs `alt` (or `alt=""` for decorative).
*   **ARIA Labels**: Use for icon-only controls.
    ```html
    <button aria-label="Play video"><svg>...</svg></button>
    ```
*   **Keyboard Navigation**: All interactive elements must be keyboard accessible.

### 12.3 Data Attributes for JS
*   **Use `data-*` for JS Hooks**: Never select by styling class names.
    ```html
    <!-- ✅ Good -->
    <button class="btn" data-action="play">Play</button>
    ```
    ```javascript
    document.querySelector('[data-action="play"]');
    ```

### 12.4 Templates
*   **Use `<template>` Tags**: For repeating elements, clone in JS.
    ```html
    <template id="card-template">
        <div class="card">...</div>
    </template>
    ```

## 13. Theme Management
*   **Use `data-theme` Attribute**: Apply themes via root attribute.
    ```html
    <html data-theme="dark">
    ```
    ```javascript
    document.documentElement.dataset.theme = 'dark';
    ```
*   **Persist Theme**: Save in `localStorage`.
*   **CSS Variable Overrides**: Define theme variants.
    ```css
    :root { --color-bg: #fff; }
    [data-theme="dark"] { --color-bg: #1a1a1a; }
    ```

## 14. JavaScript & CSS Interaction

### 14.1 Class Toggling (The Right Way)
```javascript
// ✅ Toggle classes for state
element.classList.add('is-active');
element.classList.toggle('is-expanded');

// ❌ Direct style manipulation
element.style.display = 'block';
```

### 14.2 When Inline Styles Are Allowed
*   Only for dynamic/computed values:
    ```javascript
    // ✅ Dynamic positioning
    dragElement.style.transform = `translate(${x}px, ${y}px)`;
    
    // ✅ Progress bars
    progressBar.style.width = `${percentage}%`;
    
    // ❌ Static styles
    button.style.backgroundColor = 'blue'; // Use classes!
    ```

## 15. Review Checklist
- [ ] No CSS in JS files
- [ ] No inline HTML styles (except dynamic values)
- [ ] CSS variables used (no hardcoded colors/spacing)
- [ ] BEM naming followed
- [ ] Semantic HTML + ARIA labels
- [ ] Data attributes for JS hooks
- [ ] Theme uses `data-theme`

---
**Enforcement**: Code that violates these rules will be rejected during review.