import{t as e}from"./Logger-BU32RJJF.js";import{t}from"./MediaProcessor-bwCQZjHK.js";import{c as n,i as r,o as i}from"./Playlist-Ci_5mjle.js";import{t as a}from"./MenuJob-FUJ3ojPQ.js";import{t as o}from"./Templates-DuKuTQ0b.js";o(`<!-- resize: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Resize Content Template -->
<template id="resize-content-template">
    <div class="source-info mb-lg p-sm bg-tertiary rounded flex-between items-center">
        <div class="flex flex-col">
            <span class="text-xs text-secondary font-mono">CURRENT RESOLUTION</span>
            <span class="current-resolution text-sm font-bold text-primary">Checking...</span>
        </div>
        <div class="flex flex-col items-end">
            <span class="text-xs text-secondary font-mono">ASPECT RATIO</span>
            <span class="current-aspect-ratio text-sm font-bold text-accent">--:--</span>
        </div>
    </div>

    <!-- Dimension Inputs -->
    <div class="tool-card mb-lg">
        <div class="tool-card-header">
            <span class="tool-card-title">Dimensions</span>
        </div>
        <div class="dimension-inputs-container">
            <div class="tool-card-input">
                <label for="resize-width">WIDTH (px)</label>
                <input type="number" id="resize-width" class="mb-input font-mono text-center" placeholder="1920"
                    min="128" max="7680" step="2">
            </div>
            <div class="aspect-lock-container flex flex-col items-center justify-end">
                <button class="aspect-lock-btn btn jellyjump-btn-primary p-xs rounded aspect-lock-btn-container"
                    title="Lock Aspect Ratio" aria-pressed="true">
                    <svg width="20" height="20" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-link"></use>
                    </svg>
                </button>
            </div>
            <div class="tool-card-input">
                <label for="resize-height">HEIGHT (px)</label>
                <input type="number" id="resize-height" class="mb-input font-mono text-center" placeholder="1080"
                    min="128" max="7680" step="2">
            </div>
        </div>
    </div>

    <!-- Presets -->
    <div class="presets-container mb-lg">
        <label class="text-xs text-secondary font-mono mb-xs block">PRESETS</label>
        <div class="presets-grid">
            <button class="btn jellyjump-btn-secondary preset-btn" data-preset="1080p">1080p (FHD)</button>
            <button class="btn jellyjump-btn-secondary preset-btn" data-preset="720p">720p (HD)</button>
            <button class="btn jellyjump-btn-secondary preset-btn" data-preset="480p">480p (SD)</button>
            <button class="btn jellyjump-btn-secondary preset-btn" data-preset="360p">360p</button>
        </div>
</template>
`);var s=class{static async init(o,s){let{modal:c,content:l}=r(`Resize Video`,`resize-content-template`,i.resize,{maxWidth:`550px`});if(!c)return;let u=l.querySelector(`.current-resolution`),d=l.querySelector(`.current-aspect-ratio`),f=l.querySelector(`#resize-width`),p=l.querySelector(`#resize-height`),m=l.querySelector(`.aspect-lock-btn`),h=l.querySelectorAll(`.preset-btn`),g=l.querySelector(`.resize-btn`),_=l.querySelector(`.download-btn`),v=l.querySelector(`.progress-status`),y=l.querySelector(`.progress-percentage`),b=l.querySelector(`.error-message`),x=0,S=0,C=0,w=!0,T=(e,t)=>{let n=(e,t)=>t?n(t,e%t):e,r=n(e,t);return`${e/r}:${t/r}`},E=(e,t,n)=>{n!==`width`&&(f.value=Math.round(e)),n!==`height`&&(p.value=Math.round(t))};try{if(await s.ensureMetadata(o),o.videoInfo&&o.videoInfo.width&&o.videoInfo.height)x=o.videoInfo.width,S=o.videoInfo.height,C=x/S,u.textContent=`${x}x${S}`,d.textContent=T(x,S),E(x,S);else throw Error(`No video metadata available`)}catch(t){e.error(`Failed to load video info:`,t),u.textContent=`Unknown`,b.textContent=`Failed to load video info. Resizing may not work.`,b.classList.remove(`hidden`)}m.addEventListener(`click`,()=>{if(w=!w,m.setAttribute(`aria-pressed`,w),m.classList.toggle(`jellyjump-btn-primary`,w),m.classList.toggle(`jellyjump-btn-secondary`,!w),w){let e=parseInt(f.value)||x;E(e,e/C,`width`)}}),f.addEventListener(`input`,()=>{let e=parseInt(f.value);w&&e&&C&&E(e,e/C,`width`)}),p.addEventListener(`input`,()=>{let e=parseInt(p.value);w&&e&&C&&E(e*C,e,`height`)}),h.forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.preset,n;switch(t){case`1080p`:n=1080;break;case`720p`:n=720;break;case`480p`:n=480;break;case`360p`:n=360}n&&(E(n*C,n),h.forEach(e=>e.classList.remove(`jellyjump-btn-primary`)),h.forEach(e=>e.classList.add(`jellyjump-btn-secondary`)),e.classList.remove(`jellyjump-btn-secondary`),e.classList.add(`jellyjump-btn-primary`))})}),g.addEventListener(`click`,async()=>{let e=parseInt(f.value),r=parseInt(p.value);!e||!r||e<128||r<128?(b.textContent=`Dimensions must be at least 128px.`,b.classList.remove(`hidden`)):e%2!=0||r%2!=0?(b.textContent=`Dimensions must be even numbers.`,b.classList.remove(`hidden`)):(v.textContent=`Resizing to ${e}x${r}...`,await a({name:`Resize`,subject:o.title,background:!0,modal:c,work:async({signal:i,onProgress:a})=>{let c=await n.getSourceBlob(o,()=>s.save());return t.process({source:c,format:`mp4`,quality:100,resolution:{width:e,height:r},onProgress:a,signal:i})},done:t=>{let n=o.title.replace(/\.[^/.]+$/,``)+`-${e}x${r}.mp4`,{url:i}=s.insertProcessedItem(o,t,n,{type:`video/mp4`});_.href=i,_.download=n,_.classList.remove(`hidden`),g.classList.remove(`hidden`),v.textContent=`Processing...`,y.textContent=`0%`}}))})}};export{s as ResizeMenu};
//# sourceMappingURL=ResizeMenu-DFJ5tdSl.js.map