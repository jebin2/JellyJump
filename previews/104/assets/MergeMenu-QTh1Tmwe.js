import{t as e}from"./Logger-yrsaUjje.js";import{t}from"./Modal-d2Ji3_kb.js";import{t as n}from"./MediaProcessor-DI7LJByV.js";import{c as r}from"./Playlist-b11JlByi.js";import{t as i}from"./MenuJob-Km6xsayt.js";import{r as a}from"./ErrorReporter-D4PpDUmT.js";import{t as o}from"./Templates-DuKuTQ0b.js";o(`<!-- merge: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Merge Modal Content Template -->
<template id="merge-modal-content-template">
    <div class="merge-container">
        <!-- Two-Column Grid for Video Selection -->
        <div class="merge-grid-container">
            <!-- Left Column: Available Videos -->
            <div class="available-videos-section available-section">
                <h4 class="text-sm font-bold mb-sm flex-between section-header">
                    <span>Available Videos</span>
                    <span class="text-xs text-muted selection-count">0 selected</span>
                </h4>
                <div
                    class="available-list overflow-y-auto flex-1 border border-border rounded bg-secondary p-xs scroll-list">
                    <!-- Items injected here -->
                    <div class="empty-state text-center p-md text-muted text-sm italic">No videos available</div>
                </div>
            </div>

            <!-- Right Column: Selected Videos (Order) -->
            <div class="selected-videos-section selected-section">
                <h4 class="text-sm font-bold mb-sm section-header">
                    Merge Order
                    (Drag to Reorder)</h4>
                <div
                    class="selected-list overflow-y-auto flex-1 border border-border rounded bg-secondary p-xs scroll-list">
                    <!-- Selected items injected here -->
                    <div
                        class="empty-selection-state text-center p-md text-muted text-sm italic h-full flex items-center justify-center">
                        Select videos from the left to merge
                    </div>
                </div>
            </div>
        </div>

        <!-- Merge Options (Outside Grid) -->
        <div class="merge-options">
            <!-- Merge Options (Flex Single Line) -->
            <!-- Merge Options (Flex Single Line) -->
            <div class="merge-options flex gap-lg items-end mb-md w-full">
                <!-- Target Resolution -->
                <div class="resolution-options flex flex-col gap-xs" style="flex: 3;">
                    <div class="text-xs text-secondary font-mono uppercase text-nowrap">Target Resolution</div>
                    <div class="flex items-center gap-xs">
                        <input type="number" id="merge-width"
                            class="mb-input font-mono text-center w-full p-1 box-border" placeholder="W" min="128"
                            max="7680" step="2" style="height: 36px;">
                        <span class="text-secondary font-bold select-none">&times;</span>
                        <input type="number" id="merge-height"
                            class="mb-input font-mono text-center w-full p-1 box-border" placeholder="H" min="128"
                            max="7680" step="2" style="height: 36px;">
                    </div>
                    <div class="text-[10px] text-muted truncate max-w-[200px] min-h-[15px]">
                        <span class="max-resolution-hint">Detecting...</span>
                    </div>
                </div>

                <!-- Scale Mode -->
                <div class="scale-options flex flex-col gap-xs" style="flex: 3;">
                    <div class="text-xs text-secondary font-mono uppercase text-nowrap">Scale Mode</div>
                    <select class="mb-select w-full py-0 px-2 text-sm scale-select box-border" style="height: 36px;">
                        <option value="proportional">Scale Proportionally</option>
                        <option value="center">Keep Original Size</option>
                        <option value="fill">Scale to Fill</option>
                    </select>
                </div>

                <!-- Background Color -->
                <div class="bg-color-options flex flex-col gap-xs" style="flex: 1;">
                    <div class="text-xs text-secondary font-mono uppercase text-nowrap">Bg Color</div>
                    <div class="flex items-center">
                        <input type="color" id="merge-bg-color"
                            class="w-full rounded border border-border cursor-pointer p-0 box-border" value="#000000"
                            title="Background Color" style="height: 36px;">
                    </div>
                </div>
            </div>

            <!-- Options -->

        </div>
    </div>

    <!-- Progress Section (Hidden by default) -->

</template>

<!-- Merge Modal Footer Template -->
<template id="merge-modal-footer-template">
    <div class="flex-between w-full h-full gap-md items-center">
        <!-- Progress & Messages (Left) -->
        <div class="flex-1 flex items-center">
            <div class="progress-section hidden flex items-center gap-sm w-full">
                <div
                    class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin text-primary">
                </div>
                <span class="progress-status text-sm font-mono text-secondary">Merging...</span>
                <span class="progress-percentage text-sm font-bold text-accent">0%</span>
            </div>
            <div class="error-message hidden text-danger text-sm font-bold"></div>
            <div class="success-message hidden text-success text-sm font-bold flex items-center gap-xs">
                <svg width="14" height="14" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-check"></use>
                </svg>
                <span>Added to playlist</span>
            </div>
        </div>

        <!-- Action Buttons (Right) -->
        <div class="action-buttons flex gap-sm flex-shrink-0">
            <a href="#" class="btn jellyjump-btn-small hidden download-btn" title="Download" aria-label="Download"
                download>
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-download"></use>
                </svg>
            </a>
            <button class="btn jellyjump-btn-small merge-btn" title="Merge" aria-label="Merge" disabled>
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-copy"></use>
                </svg>
            </button>
        </div>
    </div>
</template>

<!-- Merge Item Template -->
<template id="merge-item-template">
    <div class="merge-item flex items-center gap-sm p-xs rounded hover:bg-tertiary cursor-pointer border border-transparent mb-xs"
        draggable="true">
        <div class="item-thumb w-8 h-8 bg-black rounded overflow-hidden flex-shrink-0">
            <!-- Thumb or placeholder -->
        </div>
        <div class="item-info flex-1 merge-item__info">
            <div class="item-title text-sm font-bold merge-item__title"></div>
            <div class="item-meta text-xs text-muted">
                <span class="item-dur"></span>
            </div>
        </div>
        <button class="remove-item-btn text-muted hover:text-danger merge-item__remove" title="Remove">
            &times;
        </button>
    </div>
</template>
`);var s=class{static async init(o,s){let c=document.getElementById(`merge-modal-content-template`),l=document.getElementById(`merge-modal-footer-template`),u=document.getElementById(`merge-item-template`);if(!c||!l||!u)return;let d=new t({maxWidth:`900px`});d.setTitle(`Merge Videos`),d.setBody(c.content.cloneNode(!0)),d.setFooter(l.content.cloneNode(!0));let f=d.modal,p=f.querySelector(`.available-list`),m=f.querySelector(`.selected-list`),h=f.querySelector(`.merge-btn`),g=f.querySelector(`.selection-count`),_=f.querySelector(`.empty-selection-state`),v=f.querySelector(`#merge-width`),y=f.querySelector(`#merge-height`),b=f.querySelector(`.max-resolution-hint`),x=f.querySelector(`.scale-select`),S=f.querySelector(`#merge-bg-color`),C=[],w=async()=>{if(C.length===0){v.value=``,y.value=``,b.textContent=`Select videos to detect resolution`;return}b.textContent=`Detecting resolution...`;let e=0,t=0;for(let n of C)n.videoInfo?await s.ensureMetadata(n):(n.duration=`Loading...`,O(),await s.ensureMetadata(n),O()),n.videoInfo&&(e=Math.max(e,n.videoInfo.width),t=Math.max(t,n.videoInfo.height));e>0&&t>0?(v.value=e,y.value=t,b.textContent=`Max detected: ${e}×${t}`):b.textContent=`Could not detect resolution`},T=async()=>{g.textContent=`${C.length} selected`,C.length>=2?h.removeAttribute(`disabled`):h.setAttribute(`disabled`,`true`),C.length>0?_.classList.add(`hidden`):_.classList.remove(`hidden`),await w()},E=e=>{if(e.isStream||e.isLive||e.url&&(e.url.includes(`.m3u8`)||e.url.includes(`/hls/`))||e.isAudio)return!1;let t=e.type||e.mimeType||e.fileType||``;if(t.startsWith(`video`))return!0;if(t.startsWith(`audio`))return!1;let n=e.title||e.path||e.url||``,r=/\.(mp4|webm|mov|avi|mkv|m4v|flv|wmv|ogv)$/i,i=/\.(mp3|wav|flac|aac|ogg|m4a|opus|wma)$/i;if(r.test(n))return!0;if(i.test(n))return!1;if(e.file&&e.file.type){if(e.file.type.startsWith(`video`))return!0;if(e.file.type.startsWith(`audio`))return!1}return!0},D=()=>{p.innerHTML=``;let e=s.items.filter(E);e.length===0?p.innerHTML=`<div class="empty-state text-center p-md text-muted text-sm italic">No videos available</div>`:e.forEach((e,t)=>{let n=u.content.cloneNode(!0).querySelector(`.merge-item`);n.querySelector(`.remove-item-btn`).remove();let r=n.querySelector(`.item-title`),i=e.path||e.title;r.textContent=i&&i.includes(`/`)?i:e.title,r.title=i||e.title,n.querySelector(`.item-dur`).textContent=e.duration||`--:--`,C.includes(e)&&(n.classList.add(`bg-primary`,`text-white`),n.classList.remove(`hover:bg-tertiary`)),n.addEventListener(`click`,()=>{C.push(e),D(),O(),T()}),p.appendChild(n)})},O=()=>{m.innerHTML=``,C.length===0?m.appendChild(_):C.forEach((t,n)=>{if(!t){e.warn(`Undefined item in selectedVideos at index`,n);return}let r=u.content.cloneNode(!0).querySelector(`.merge-item`),i=r.querySelector(`.item-title`);i.textContent=t.title,i.title=t.title,r.querySelector(`.item-dur`).textContent=t.duration||`--:--`,r.querySelector(`.remove-item-btn`).addEventListener(`click`,e=>{e.stopPropagation(),C.splice(n,1),D(),O(),T()}),r.addEventListener(`dragstart`,e=>{e.dataTransfer.effectAllowed=`move`,e.dataTransfer.setData(`text/plain`,n),r.classList.add(`opacity-50`)}),r.addEventListener(`dragend`,()=>{r.classList.remove(`opacity-50`),m.querySelectorAll(`.merge-item`).forEach(e=>e.classList.remove(`border-primary`))}),r.addEventListener(`dragover`,e=>{e.preventDefault(),e.dataTransfer.dropEffect=`move`,r.classList.add(`border-primary`)}),r.addEventListener(`dragleave`,()=>{r.classList.remove(`border-primary`)}),r.addEventListener(`drop`,e=>{e.preventDefault();let t=parseInt(e.dataTransfer.getData(`text/plain`)),r=n;if(t!==r){let e=C[t];C.splice(t,1),C.splice(r,0,e),O()}}),m.appendChild(r)})};d.open(),D(),O(),T(),h.addEventListener(`click`,async()=>{if(C.length<2)return;let e=parseInt(v.value),t=parseInt(y.value),o=x.value,c=S.value;!e||!t||e<128||t<128?a.show(`Enter a resolution of at least 128×128.`,4e3,!0):(h.disabled=!0,h.innerHTML=`<span class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin mr-xs"></span> Merging...`,(await i({name:`Merge`,subject:`${C.length} videos`,background:!0,modal:d,work:async({signal:i,onProgress:a})=>{let l=[];for(let e of C)l.push(await r.getSourceBlob(e,()=>s.save()));return n.merge({inputs:l,format:`mp4`,resolution:{width:e,height:t},scaleMode:o,backgroundColor:c,onProgress:a,signal:i})},done:async e=>{let t=C[C.length-1],n=`merged-${new Date().toISOString().replace(/[:.]/g,`-`)}.mp4`,r=t?.path||t?.title||``,i=r.includes(`/`)?r.substring(0,r.lastIndexOf(`/`)):``,{item:a}=s.insertProcessedItem(t,e,n,{type:`video/mp4`,duration:null,extra:{path:i?`${i}/${n}`:n}});await s.ensureMetadata(a)}})).ok||(h.disabled=!1,h.innerHTML=`<span class="mr-xs">Merge</span><svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-copy"></use></svg>`))})}};export{s as MergeMenu};
//# sourceMappingURL=MergeMenu-QTh1Tmwe.js.map