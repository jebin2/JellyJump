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
*   **Shared Utilities**: Place common helper functions (e.g., DOM helpers, formatters, validators) in a dedicated `utils/` folder.
*   **Component Isolation**: Each module/class should be self-contained with minimal coupling. Avoid tight dependencies between unrelated modules.
*   **Configuration Over Code**: Extract magic numbers, URLs, and repeated values into a config file or constants.
    *   ✅ `const API_ENDPOINT = '/api/media';`
    *   ❌ Using `'/api/media'` scattered across 10 files
*   **Composition Over Inheritance**: Prefer small, composable functions/modules over deep class hierarchies.
*   **Interface Contracts**: When modules interact, define clear interfaces (method names, expected parameters, return values). Document these contracts.

## 10. Testability
*   **Write Testable Code**: Pure functions, dependency injection, and small modules are easier to test.
*   **Avoid Global State**: Use parameters or class properties instead of globals. Global state makes testing and debugging difficult.
*   **Side Effects Isolation**: Isolate side effects (DOM manipulation, API calls, localStorage) to make core logic testable.
*   **Predictable Behavior**: Functions should behave the same way given the same inputs, regardless of when they're called.

---
**Enforcement**: Code that violates these rules will be rejected during review.