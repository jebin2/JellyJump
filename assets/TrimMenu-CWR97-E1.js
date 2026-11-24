import{t as e}from"./MediaProcessor-ZZ6C2CA1.js";import{c as t,i as n,o as r}from"./Playlist-3CLUFE2H.js";import{$ as i,tt as a}from"./StreamDetector-CLTahiVQ.js";import{t as o}from"./MenuJob-B5vN-9gg.js";import{a as s,t as c}from"./PreviewPlayer-C4lUVsTQ.js";import{t as l}from"./Templates-DuKuTQ0b.js";l(`<!-- trim: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Trim Content Template -->
<template id="trim-content-template">
    <!-- Loading State -->
    <div class="trim-loading flex flex-col items-center justify-center p-xl text-muted" style="grid-column: 1 / -1;">
        <div class="spinner-md border-4 border-current border-t-transparent rounded-full w-8 h-8 animate-spin mb-sm">
        </div>
        <span>Loading video info...</span>
    </div>

    <div class="trim-content hidden" style="display: contents;">
        <!-- Right Panel: Inputs -->
        <div class="modal-controls-panel">
            <div class="tool-card">
                <div class="tool-card-times">
                    <div class="tool-card-input">
                        <label>Start</label>
                        <input type="text" id="trim-start-input" class="mb-input font-mono" placeholder="0:00.000">
                        <button id="trim-set-start-btn" class="jellyjump-btn-small" title="Set the start to the current time">Start here</button>
                    </div>
                    <div class="tool-card-input">
                        <label>End</label>
                        <input type="text" id="trim-end-input" class="mb-input font-mono" placeholder="0:00.000">
                        <button id="trim-set-end-btn" class="jellyjump-btn-small" title="Set the end to the current time">End here</button>
                    </div>
                </div>
                <div class="tool-card-info">Duration: <span class="trim-duration">00:00:00</span></div>
                <label class="checkbox-option mt-sm" title="Skip re-encoding. The cut is exact either way; this just avoids rebuilding the picture.">
                    <input type="checkbox" id="trim-lossless-toggle">
                    <span class="checkbox-label text-sm">⚡ Lossless (fast, keyframe-snapped)</span>
                </label>
            </div>
        </div>
    </div>
</template>
`);var u=class{static async init(l,u){let{modal:d,content:f}=n(`Cut`,`trim-content-template`,r.trim);if(!d)return;let p=f.querySelector(`.trim-loading`),m=f.querySelector(`.trim-content`),h=f.querySelector(`#trim-start-input`),g=f.querySelector(`#trim-end-input`),_=f.querySelector(`#trim-set-start-btn`),v=f.querySelector(`#trim-set-end-btn`),y=f.querySelector(`.trim-duration`),b=f.querySelector(`#trim-lossless-toggle`),x=f.querySelector(`.trim-btn`),S=f.querySelector(`.download-btn`),C=f.querySelector(`.error-message`);x.disabled=!0,await u.ensureMetadata(l);let w=0;l.duration&&typeof l.duration==`string`&&l.duration!==`--:--`&&(w=a(l.duration)),h.value=i(0),g.value=i(w),y.textContent=i(w);let T=0,E=w,D=c(d,u);p.classList.add(`hidden`),m.classList.remove(`hidden`),x.disabled=!1;let O=()=>{document.activeElement!==h&&(h.value=i(T)),document.activeElement!==g&&(g.value=i(E));let e=Math.max(0,E-T);y.textContent=i(e),s(D,T,E);let t=T<E&&E-T>=1;x.disabled=!t,t?C.classList.add(`hidden`):(T>=E?C.textContent=`Start time must be before end time.`:E-T<1&&(C.textContent=`Duration must be at least 1 second.`),C.classList.remove(`hidden`))};O(),h.onchange=e=>{let t=a(e.target.value);t===null?O():(T=Math.max(0,Math.min(t,w)),O(),D&&D.seek(T))},g.onchange=e=>{let t=a(e.target.value);t===null?O():(E=Math.max(0,Math.min(t,w)),O(),D&&D.seek(E))},_.onclick=()=>{D&&(T=D.currentTime,O())},v.onclick=()=>{D&&(E=D.currentTime,O())},x.addEventListener(`click`,async()=>{f.classList.add(`processing`),await o({name:`Cut`,subject:l.title,background:!0,modal:d,work:async({signal:n,onProgress:r})=>{let i=await t.getSourceBlob(l,()=>u.save()),a={start:T,end:E};return b?.checked?e.losslessTrim({source:i,trim:a,onProgress:r,signal:n}):e.process({source:i,format:`mp4`,quality:100,trim:a,onProgress:r,signal:n})},done:e=>{let t=l.title.replace(/\.[^/.]+$/,``)+`-trimmed-${Math.round(T)}-${Math.round(E)}.mp4`,{url:n}=u.insertProcessedItem(l,e,t,{type:`video/mp4`,duration:i(E-T)});S.href=n,S.download=t,S.classList.remove(`hidden`)}})})}};export{u as TrimMenu};
//# sourceMappingURL=TrimMenu-CWR97-E1.js.map