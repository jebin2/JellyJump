/**
 * CustomDropdown - Reusable themed dropdown menu utility
 * Creates a div-based dropdown matching the application's design system
 */
export class CustomDropdown {
    /**
     * Initialize a custom dropdown
     * @param {Object} options
     * @param {HTMLElement} options.button - The button element that triggers the dropdown
     * @param {HTMLElement} options.menu - The dropdown menu element
     * @param {Function} options.onChange - Callback when selection changes, receives (value: string, label: string)
     * @param {string} [options.initialValue] - Initial selected value
     * @returns {Object} Controller object
     */
    static init({ button, menu, onChange, initialValue }) {
        const menuItems = menu.querySelectorAll('.jellyjump-menu-item');
        let currentValue = initialValue;

        const updateActiveState = (value) => {
            menuItems.forEach(item => {
                const isActive = item.dataset.value === value;
                item.classList.toggle('active', isActive);
                if (isActive) {
                    // Update button content to match active item's label (excluding extra descriptions)
                    const labelSpan = item.querySelector('.menu-label') || item;
                    const text = labelSpan.textContent.split('\n')[0].trim();

                    // Preserve icon if exists
                    const buttonTextSpan = button.querySelector('span:not(.mb-select-arrow)');
                    if (buttonTextSpan) {
                        buttonTextSpan.textContent = text;
                    } else {
                        // Check if it's a simple button where children might be just text node + arrow
                        // We want to replace only the text part
                        const textNode = Array.from(button.childNodes).find(node => node.nodeType === 3); // Text node
                        if (textNode) {
                            textNode.textContent = text;
                        } else {
                            button.textContent = text;
                        }
                    }
                }
            });
        };

        // Initialize state
        if (initialValue) {
            updateActiveState(initialValue);
        } else {
            // Default to first item if no initial value
            const firstItem = menuItems[0];
            if (firstItem) {
                currentValue = firstItem.dataset.value;
                updateActiveState(currentValue);
            }
        }

        // Toggle menu
        button.addEventListener('click', (e) => {
            e.stopPropagation();

            const isVisible = menu.classList.contains('visible');

            // Close other open menus
            document.dispatchEvent(new CustomEvent('closeAllMenus'));

            if (!isVisible) {
                const rect = button.getBoundingClientRect();

                const menuWidth = Math.max(200, rect.width);
                let left = rect.left;

                // Viewport edge detection (prevent right overflow)
                if (left + menuWidth > window.innerWidth) {
                    left = window.innerWidth - menuWidth - 10;
                }

                // Temporarily show menu to measure its height
                menu.style.visibility = 'hidden';
                menu.style.display = 'flex';
                const menuHeight = menu.offsetHeight;
                menu.style.display = '';
                menu.style.visibility = '';

                // Calculate available space above and below
                const spaceBelow = window.innerHeight - rect.bottom - 20;
                const spaceAbove = rect.top - 20;

                // Decide direction: open upward if more space above OR not enough space below
                const openUpward = spaceAbove > spaceBelow || (menuHeight > spaceBelow && menuHeight <= spaceAbove);

                menu.style.position = 'fixed';
                menu.style.left = `${left}px`;
                menu.style.width = `${menuWidth}px`;
                menu.style.zIndex = '21000'; // Above modal (20000)

                if (openUpward) {
                    // Position above the button
                    menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
                    menu.style.top = 'auto';
                    menu.style.maxHeight = `${Math.max(150, spaceAbove)}px`;
                } else {
                    // Position below the button
                    menu.style.top = `${rect.bottom + 4}px`;
                    menu.style.bottom = 'auto';
                    menu.style.maxHeight = `${Math.max(150, spaceBelow)}px`;
                }

                menu.style.right = 'auto';
                menu.style.overflowY = 'auto';

                menu.classList.add('visible');
                button.classList.add('is-open');
                button.setAttribute('aria-expanded', 'true');
            }
        });

        // Item selection
        menuItems.forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();

                if (menuItem.classList.contains('disabled')) return;

                const value = menuItem.dataset.value;
                currentValue = value;

                updateActiveState(value);
                menu.classList.remove('visible');
                button.classList.remove('is-open');
                button.setAttribute('aria-expanded', 'false');

                if (onChange) {
                    onChange(value, menuItem.textContent.trim());
                }
            });

            // Accessibility: handle Enter/Space
            menuItem.setAttribute('tabindex', '0');
            menuItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    menuItem.click();
                }
            });
        });

        // Close on outside click
        const closeHandler = () => {
            menu.classList.remove('visible');
            button.classList.remove('is-open');
            button.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('click', closeHandler);
        document.addEventListener('closeAllMenus', closeHandler);

        return {
            getValue: () => currentValue,
            setValue: (value) => {
                currentValue = value;
                updateActiveState(value);
            },
            setDisabled: (disabled) => {
                button.disabled = disabled;
                button.classList.toggle('disabled', disabled);
            },
            destroy: () => {
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('closeAllMenus', closeHandler);
            }
        };
    }
}
