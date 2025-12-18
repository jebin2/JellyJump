/**
 * SpeedDropdown - Reusable speed dropdown menu utility
 * Creates a div-based dropdown matching the control bar style
 */
export class SpeedDropdown {
    /**
     * Initialize a speed dropdown
     * @param {Object} options
     * @param {HTMLElement} options.button - The button element that triggers the dropdown
     * @param {HTMLElement} options.menu - The dropdown menu element
     * @param {Function} options.onChange - Callback when speed changes, receives (speed: number, label: string)
     * @param {number} [options.initialSpeed=1] - Initial speed value
     * @returns {Object} Controller object with getCurrentSpeed() method
     */
    static init({ button, menu, onChange, initialSpeed = 1 }) {
        const menuItems = menu.querySelectorAll('.jellyjump-menu-item');
        let currentSpeed = initialSpeed;

        // Speed button click - toggle menu and position it
        button.addEventListener('click', (e) => {
            e.stopPropagation();

            // Position the fixed menu below the button
            const rect = button.getBoundingClientRect();
            const menuTop = rect.bottom + 4;
            const availableHeight = window.innerHeight - menuTop - 20;

            menu.style.top = `${menuTop}px`;
            menu.style.left = `${rect.left}px`;
            menu.style.maxHeight = `${Math.max(availableHeight, 100)}px`;

            menu.classList.toggle('visible');
        });

        // Speed menu item selection
        menuItems.forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = parseFloat(menuItem.dataset.value);
                currentSpeed = value;

                // Update button text
                button.textContent = menuItem.textContent;

                // Update active state
                menuItems.forEach(item => item.classList.remove('active'));
                menuItem.classList.add('active');

                // Hide menu
                menu.classList.remove('visible');

                // Callback
                if (onChange) {
                    onChange(value, menuItem.textContent);
                }
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            menu.classList.remove('visible');
        });

        // Return controller
        return {
            getCurrentSpeed: () => currentSpeed,
            setDisabled: (disabled) => {
                button.disabled = disabled;
            },
            reset: () => {
                currentSpeed = initialSpeed;
                button.textContent = menuItems[3]?.textContent || '1x'; // Default to 1x (Normal)
                menuItems.forEach(item => {
                    item.classList.toggle('active', parseFloat(item.dataset.value) === initialSpeed);
                });
            }
        };
    }
}
