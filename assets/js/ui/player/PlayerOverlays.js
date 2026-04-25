export function createHelpOverlay(player) {
    const template = document.getElementById('player-help-overlay-template');
    const clone = template.content.cloneNode(true);

    const navSection = clone.getElementById('help-navigation-section');
    const editorSection = clone.getElementById('help-editor-section');

    if (player.config.mode === 'player') {
        if (navSection) navSection.style.display = 'block';
        if (editorSection) editorSection.style.display = 'none';
    } else if (player.config.mode === 'editor') {
        if (navSection) navSection.style.display = 'none';
        if (editorSection) editorSection.style.display = 'block';
    }

    const title = clone.querySelector('.jellyjump-help-title');
    if (title) {
        title.textContent = `Keyboard Shortcuts ${player.config.mode === 'editor' ? '(Editor Mode)' : '(Player Mode)'}`;
    }

    player.container.appendChild(clone);

    player.ui.helpOverlay = player.container.querySelector('.jellyjump-help-overlay');
    player.ui.closeHelpBtn = player.container.querySelector('.jellyjump-close-help');

    player.ui.closeHelpBtn.addEventListener('click', () => player._toggleHelp());
    player.ui.helpOverlay.addEventListener('click', (e) => {
        if (e.target === player.ui.helpOverlay) player._toggleHelp();
    });
}
