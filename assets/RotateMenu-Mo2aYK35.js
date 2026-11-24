import{c as e,i as t,o as n}from"./Playlist-CzpW45-z.js";import{t as r}from"./MediaProcessor-BYCerOHH.js";import{t as i}from"./MenuJob-Jq-VoxwJ.js";import{r as a}from"./PreviewPlayer-C4lUVsTQ.js";import{t as o}from"./Templates-DuKuTQ0b.js";o(`<!-- rotate: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Rotate Content Template -->
<template id="rotate-content-template">
    <!-- Right Panel: Rotate Controls -->
    <div class="modal-controls-panel">
        <div class="rotate-controls flex flex-col gap-md p-md">
            <!-- Rotation -->
            <div class="control-group">
                <label class="text-xs text-secondary font-mono mb-sm block">ROTATION</label>
                <div class="flex gap-sm">
                    <button class="jellyjump-btn-secondary flex-1 py-sm flex-center flex-col gap-xs"
                        data-action="rotate-left" title="Rotate Left (-90°)">
                        <svg width="24" height="24" fill="currentColor" style="transform: scaleX(-1);">
                            <use href="assets/icons/sprite.svg#icon-rotate-cw"></use>
                        </svg>
                        <span class="text-xs">-90°</span>
                    </button>
                    <button class="jellyjump-btn-secondary flex-1 py-sm flex-center flex-col gap-xs"
                        data-action="rotate-right" title="Rotate Right (+90°)">
                        <svg width="24" height="24" fill="currentColor">
                            <use href="assets/icons/sprite.svg#icon-rotate-cw"></use>
                        </svg>
                        <span class="text-xs">+90°</span>
                    </button>
                </div>
                <div class="text-center mt-sm">
                    <span class="text-xs text-secondary">Current: </span>
                    <span class="rotation-value text-sm font-bold text-primary">0°</span>
                </div>
            </div>

            <div class="w-full h-px bg-border my-sm"></div>

            <!-- Flip -->
            <div class="control-group">
                <label class="text-xs text-secondary font-mono mb-sm block">FLIP</label>
                <div class="flex gap-sm">
                    <button class="jellyjump-btn-secondary flex-1 py-sm flex-center flex-col gap-xs"
                        data-action="flip-h" title="Flip Horizontal">
                        <svg width="24" height="24" fill="currentColor">
                            <use href="assets/icons/sprite.svg#icon-flip-h"></use>
                        </svg>
                        <span class="text-xs">Horizontal</span>
                    </button>
                    <button class="jellyjump-btn-secondary flex-1 py-sm flex-center flex-col gap-xs"
                        data-action="flip-v" title="Flip Vertical">
                        <svg width="24" height="24" fill="currentColor">
                            <use href="assets/icons/sprite.svg#icon-flip-v"></use>
                        </svg>
                        <span class="text-xs">Vertical</span>
                    </button>
                </div>
                <div class="text-center mt-sm">
                    <span class="text-xs text-secondary">State: </span>
                    <span class="flip-value text-sm font-bold text-primary">None</span>
                </div>
            </div>

            <div class="w-full h-px bg-border my-sm"></div>

            <!-- Reset -->
            <button class="jellyjump-btn-secondary w-full py-sm" data-action="reset">
                Reset All
            </button>
        </div>
    </div>
</template>
`);var s=class{static async init(e,r){let{modal:i}=t(`Rotate & Flip`,`rotate-content-template`,n.rotate);if(!i)return;let o=await a(i,r);if(!o)return;let s=o.canvas;i.onCleanup(()=>{s.style.transform=``,s.style.transition=``}),this._setup(i,e,r,{previewEl:s})}static _setup(t,n,a,o){let s=t.modal.querySelector(`.mb-modal-body`),c=0,l=!1,u=!1,d=()=>o.previewEl,f=()=>{let e=l?-1:1,t=u?-1:1,r=d();if(r){let i=r.offsetWidth,a=r.offsetHeight,o=n.videoInfo?.width||r.videoWidth||r.width||i,s=n.videoInfo?.height||r.videoHeight||r.height||a,l=c%180!=0&&i&&a&&o&&s?Math.min(i/s,a/o)/Math.min(i/o,a/s):1;r.style.transition=`transform 0.3s ease`,r.style.transform=`rotate(${c}deg) scale(${e*l}, ${t*l})`}s.querySelector(`.rotation-value`).textContent=`${c}°`,s.querySelector(`.flip-value`).textContent=l&&u?`Horizontal & Vertical`:l?`Horizontal`:u?`Vertical`:`None`};s.querySelectorAll(`[data-action]`).forEach(e=>{e.addEventListener(`click`,e=>{let t=e.target.closest(`button`).dataset.action;t===`rotate-left`&&(c-=90),t===`rotate-right`&&(c+=90),c=(c%360+360)%360,t===`flip-h`&&(l=!l),t===`flip-v`&&(u=!u),t===`reset`&&(c=0,l=!1,u=!1),f()})});let p=t.modal.querySelector(`.rotate-process-btn`),m=t.modal.querySelector(`.mb-modal-footer`),h=m.querySelector(`.success-message`),g=m.querySelector(`.action-buttons`);p.addEventListener(`click`,()=>{let o=c%360,s=(n.file?n.file.name:n.title||`video.mp4`).split(`.`),d=s.pop(),f=`${s.join(`.`)}_rotated.${d}`;i({name:`Rotate`,subject:n.title,background:!0,modal:t,work:async({signal:t,onProgress:i})=>{let s=await e.getSourceBlob(n,()=>a.save());return r.process({source:s,format:`mp4`,quality:`high`,rotate:o,flip:l||u?{horizontal:l,vertical:u}:null,onProgress:i,signal:t})},done:e=>a.insertProcessedItem(n,e,f)})});let _=()=>{h.classList.contains(`hidden`)||(h.classList.add(`hidden`),g.classList.remove(`hidden`))};s.querySelectorAll(`[data-action]`).forEach(e=>{e.addEventListener(`click`,_)})}};export{s as RotateMenu};
//# sourceMappingURL=RotateMenu-Mo2aYK35.js.map