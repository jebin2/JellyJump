import{t as e}from"./Logger-BtEH8-UK.js";import{c as t,i as n,o as r}from"./Playlist-COkZdtFz.js";import{t as i}from"./MediaProcessor-CSfS6RDL.js";import{n as a,r as o}from"./PreviewPlayer-C4lUVsTQ.js";import{t as s}from"./MenuJob-D8Pp66Fr.js";import{t as c}from"./Templates-DuKuTQ0b.js";c(`<!-- remove-bg: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Remove Background Content Template -->
<template id="remove-bg-content-template">
    <!-- Right Panel: Controls -->
    <div class="modal-controls-panel">
        <!-- Tools Section -->
        <div class="tools-section mb-md p-sm bg-tertiary rounded flex-between items-center">
            <span class="text-xs text-secondary font-bold">TOOLS</span>
            <div class="flex gap-md items-center">
                <label class="checkbox-option flex items-center cursor-pointer select-none">
                    <input type="checkbox" id="live-preview-toggle" checked>

                    <span class="checkbox-label text-xs text-secondary ml-xs">Live Preview</span>
                </label>
            </div>
        </div>

        <!-- Background Options -->
        <div class="bg-options-section">
            <div class="section-title text-sm font-bold text-secondary mb-sm">BACKGROUND</div>
            <div class="flex flex-col gap-sm">
                <label class="radio-option flex items-center gap-sm cursor-pointer p-xs hover:bg-tertiary rounded">
                    <input type="radio" name="bg-type" value="transparent" checked>

                    <span class="text-sm">Transparent</span>
                </label>
                <label class="radio-option flex items-center gap-sm cursor-pointer p-xs hover:bg-tertiary rounded">
                    <input type="radio" name="bg-type" value="custom">

                    <span class="text-sm">Custom Color</span>
                    <div class="flex items-center gap-xs ml-auto">
                        <input type="color" id="custom-bg-color" value="#ffffff"
                            class="w-8 h-8 p-0 border-0 rounded cursor-pointer" disabled>
                    </div>
                </label>
            </div>
        </div>

        <!-- Color Picker Section -->
        <div class="color-picker-section" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
            <div class="section-title text-sm font-bold text-secondary mb-sm">SELECTED COLORS</div>
            <div class="selected-colors-list tool-cards-list mb-sm bg-tertiary p-sm rounded border border-border"
                style="min-height: 0; flex: 1;">
                <div class="empty-state text-xs text-muted text-center py-md">
                    Click on the video to pick colors.
                </div>
            </div>
        </div>
    </div>
</template>

<!-- Color Item Template -->
<template id="color-item-template">
    <div class="tool-card color-item flex gap-md items-center">
        <!-- Left: Color Info -->
        <div class="flex flex-col items-center gap-xs min-w-[60px]">
            <div class="color-swatch border border-border shadow-sm flex-shrink-0 mb-0"
                style="width: 32px; height: 32px;"></div>
            <div class="color-hex font-mono text-xs font-bold">#000000</div>
            <button class="tool-card-remove remove-color-btn p-xs hover:text-danger transition-colors"
                title="Remove color">
                <svg width="14" height="14" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-trash"></use>
                </svg>
            </button>
        </div>

        <!-- Right: Sliders -->
        <div class="flex-1 grid gap-sm w-full">
            <div class="flex items-center gap-sm text-xs text-secondary">
                <span class="font-mono shrink-0 text-right" style="width: 80px;">Sim</span>
                <input type="range" class="quality-slider similarity-slider flex-1" min="0" max="100" value="40">
                <span class="similarity-value font-mono w-8 text-right text-primary">0.40</span>
            </div>
            <div class="flex items-center gap-sm text-xs text-secondary">
                <span class="font-mono shrink-0 text-right" style="width: 80px;">Smooth</span>
                <input type="range" class="quality-slider smoothness-slider flex-1" min="0" max="100" value="8">
                <span class="smoothness-value font-mono w-8 text-right text-primary">0.08</span>
            </div>
            <div class="flex items-center gap-sm text-xs text-secondary">
                <span class="font-mono shrink-0 text-right" style="width: 80px;">Spill</span>
                <input type="range" class="quality-slider spill-slider flex-1" min="0" max="100" value="10">
                <span class="spill-value font-mono w-8 text-right text-primary">0.10</span>
            </div>
        </div>
    </div>
</template>
`);var l=class{static async init(c,l){let{modal:u,content:d}=n(`Remove Background`,`remove-bg-content-template`,r.removeBg);if(!u)return;let f=d.querySelector(`.selected-colors-list`),p=d.querySelector(`#live-preview-toggle`),m=d.querySelectorAll(`input[name="bg-type"]`),h=d.querySelector(`#custom-bg-color`),g=d.querySelector(`.removebg-btn`),_=d.querySelector(`.download-btn`),v=d.querySelector(`.error-message`),y=[],b=await o(u,l);if(!b)return;let x=b.player,S=document.createElement(`div`);S.className=`jj-pick-layer`,S.title=`Click a colour to remove it`,b.adopt(S),b.addRenderCallback((e,t)=>{if(!p.checked||y.length===0)return;let n=e.width,r=e.height,a=t.getImageData(0,0,n,r),o=Array.from(m).find(e=>e.checked).value,s=h.value;i.applyChromaKey(a,y,o,s),t.putImageData(a,0,0)});try{x&&x.canvas&&setTimeout(()=>{try{let t=x.canvas.getContext(`2d`,{willReadFrequently:!0}),n=x.canvas.width,r=x.canvas.height,i=((e,t,n)=>{let r=[0,(t-1)*4,t*(n-1)*4,(t*n-1)*4],i=0,a=0,o=0,s=0;return r.forEach(t=>{t<e.length&&(i+=e[t],a+=e[t+1],o+=e[t+2],s++)}),s===0?null:{r:Math.round(i/s),g:Math.round(a/s),b:Math.round(o/s)}})(t.getImageData(0,0,n,r).data,n,r);i&&(e.log(`[RemoveBackground] Auto-detected color:`,i),C(i))}catch(t){e.warn(`[RemoveBackground] Auto-detection failed:`,t)}},100)}catch(t){e.error(`Failed to load video:`,t),v.textContent=`Failed to load video: `+t.message,v.classList.remove(`hidden`);return}S.style.cursor=`crosshair`,S.addEventListener(`click`,e=>{if(!x||!x.canvas)return;let t=a(x.canvas,e);if(!t)return;let n=x.canvas.getContext(`2d`,{willReadFrequently:!0}).getImageData(t.x,t.y,1,1).data;n[3]>0&&C({r:n[0],g:n[1],b:n[2]})}),p.onchange=()=>{x.isPlaying||x.seek(x.currentTime)};function C(e){y.some(t=>Math.abs(t.r-e.r)<5&&Math.abs(t.g-e.g)<5&&Math.abs(t.b-e.b)<5)||(y.push({...e,similarity:0,smoothness:.08,spill:.1}),T(),x.isPlaying||x.seek(x.currentTime))}function w(e){y.splice(e,1),T(),x.isPlaying||x.seek(x.currentTime)}function T(){if(f.innerHTML=``,y.length===0){f.innerHTML=`
                    <div class="empty-state text-xs text-muted text-center py-md">
                        Click on the video to pick colors.
                    </div>
                `;return}let e=document.getElementById(`color-item-template`);y.forEach((t,n)=>{let r=e.content.cloneNode(!0),i=r.querySelector(`.color-swatch`),a=r.querySelector(`.color-hex`),o=r.querySelector(`.remove-color-btn`),s=r.querySelector(`.similarity-slider`),c=r.querySelector(`.similarity-value`),l=r.querySelector(`.smoothness-slider`),u=r.querySelector(`.smoothness-value`),d=r.querySelector(`.spill-slider`),p=r.querySelector(`.spill-value`);[s,l,d].forEach(e=>e.addEventListener(`click`,e=>e.stopPropagation()));let m=`rgb(${t.r}, ${t.g}, ${t.b})`;i.style.backgroundColor=m,a.textContent=E(t.r,t.g,t.b),s.value=t.similarity*100,c.textContent=t.similarity.toFixed(2),l.value=t.smoothness*100,u.textContent=t.smoothness.toFixed(2),d.value=t.spill*100,p.textContent=t.spill.toFixed(2);let h=()=>{x.isPlaying||x.seek(x.currentTime)};s.oninput=()=>{t.similarity=parseInt(s.value)/100,c.textContent=t.similarity.toFixed(2),h()},l.oninput=()=>{t.smoothness=parseInt(l.value)/100,u.textContent=t.smoothness.toFixed(2),h()},d.oninput=()=>{t.spill=parseInt(d.value)/100,p.textContent=t.spill.toFixed(2),h()},o.onclick=()=>w(n),f.appendChild(r)})}m.forEach(e=>{e.onchange=()=>{let t=e.value===`custom`;h.disabled=!t,x.isPlaying||x.seek(x.currentTime)},e.onclick=()=>{e.value===`custom`&&(h.disabled=!1,setTimeout(()=>h.click(),10))}}),h.onchange=()=>{x.isPlaying||x.seek(x.currentTime)};function E(e,t,n){return`#`+((1<<24)+(e<<16)+(t<<8)+n).toString(16).slice(1).toUpperCase()}g.onclick=async()=>{if(y.length===0){v.textContent=`Please select at least one color to remove.`,v.classList.remove(`hidden`);return}_.classList.add(`hidden`),h.disabled=!0,x&&x.pause();let e=Array.from(m).find(e=>e.checked).value,n=h.value;await s({name:`Remove BG`,subject:c.title,background:!0,modal:u,work:async({signal:r,onProgress:a})=>i.process({source:await t.getProcessedSourceURL(c),removeBackgroundOptions:{colors:y,bgType:e,bgColor:n},onProgress:e=>a(e,e<.1?`Initializing...`:e<.9?`Removing background...`:`Finalizing...`),signal:r}),done:async t=>{let n=e===`transparent`?`webm`:`mp4`,r=`${c.title.replace(/\.[^.]+$/,``)}-nobg.${n}`,{item:i,url:a}=l.insertProcessedItem(c,t,r,{type:`video/${n}`,mediaType:`video/${n}`,duration:null,extra:{thumbnail:c.thumbnail}});_.href=a,_.download=r,_.classList.remove(`hidden`),_.onclick=e=>{e.stopPropagation()},await l.ensureMetadata(i)}}),m[1].checked&&(h.disabled=!1)}}};export{l as RemoveBackgroundMenu};
//# sourceMappingURL=RemoveBackgroundMenu-BUzFSDMx.js.map