export function mountPlayerShell(player) {
    player.container.classList.add('jellyjump-container');

    const canvasTemplate = document.getElementById('player-canvas-template');
    const canvasClone = canvasTemplate.content.cloneNode(true);
    player.canvas = canvasClone.querySelector('canvas');
    player.ctx = player.canvas.getContext('2d', { willReadFrequently: true });
    player.container.appendChild(canvasClone);
}
