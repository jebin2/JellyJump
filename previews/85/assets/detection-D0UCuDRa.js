import{R as e}from"./Progress-CeZKW439.js";import{t}from"./MediaProcessor-D6CgZDN_.js";import{t as n}from"./MenuJob-DDDmwyJd.js";import{c as r}from"./Playlist-CrbskHrF.js";function i({item:i,playlist:a,surface:o,start:s,end:c,index:l,kind:u,folder:d,button:f}){let p=`${i.title.replace(/\.[^/.]+$/,``)} - ${u} ${l}.mp4`;f.disabled=!0,f.title=`Added to Jobs`;let m=n({name:`${u} ${l}`,subject:i.title,background:!0,keepOpen:!0,modal:o,work:async({signal:e,onProgress:n})=>{let o=await r.getSourceBlob(i,()=>a.save());return t.process({source:o,format:`mp4`,quality:100,trim:{start:s,end:c},onProgress:n,signal:e})},done:t=>{a.insertProcessedItem(i,t,p,{type:`video/mp4`,duration:e(c-s),extra:{path:`${d}/${p}`}})}});return m.then(e=>{f.isConnected&&(e.ok?(f.querySelector(`use`)?.setAttribute(`href`,`assets/icons/sprite.svg#icon-check`),f.classList.add(`text-success`),f.title=`Added`):(f.disabled=!1,f.title=`Add Clip`))}),m}var a=`<!-- detection: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Detection Content Template (Motion/Cuts) -->
<template id="detection-content-template">
    <div class="detection-content flex flex-col h-[50vh] max-h-[500px]">
        <div class="flex-none pb-sm border-b border-white/10">
            <p class="mb-sm truncate text-secondary text-sm">Target: <strong
                    class="target-filename text-primary">--</strong></p>

            <!-- Sensitivity Slider (for CutDetection - hidden by MotionDetection) -->
            <div class="quality-section sensitivity-section hidden">
                <div class="flex-between mb-sm">
                    <span class="text-secondary text-sm font-mono">SENSITIVITY:</span>
                    <span class="sensitivity-value text-sm font-bold">Medium</span>
                </div>
                <input type="range" class="quality-slider sensitivity-slider" min="1" max="3" step="1" value="2">
                <div class="flex-between mt-xs text-xs text-secondary">
                    <span>High</span>
                    <span>Medium</span>
                    <span>Low</span>
                </div>
            </div>

            <!-- Status Area (for progress display) -->
            <div class="detection-status-area bg-tertiary/50 p-sm rounded mt-sm">
                <div class="flex-between mb-xs">
                    <span class="status-text text-sm font-mono text-secondary">Initializing...</span>
                    <span class="status-percent text-sm font-bold text-accent">0%</span>
                </div>
                <div class="progress-bar-container h-1.5 bg-black rounded overflow-hidden">
                    <div
                        class="progress-bar-fill bg-primary h-full w-0 transition-all duration-300 shadow-[0_0_8px_var(--color-primary)]">
                    </div>
                </div>
            </div>
        </div>

        <div
            class="detected-items-list flex-auto overflow-y-auto p-sm space-y-xs min-h-0 bg-secondary/30 mt-sm rounded border border-white/5 custom-scrollbar">
            <div class="flex-center flex-col gap-sm h-full text-muted italic status-placeholder py-xl">
                <span class="text-sm">Adjust sensitivity and click Detect</span>
            </div>
        </div>
    </div>
</template>

<!-- Detection Footer Template -->
<template id="detection-footer-template">
    <div class="detection-footer-container flex-between items-center w-full gap-md">
        <!-- Status Area (Left) -->
        <div class="detection-footer-status flex-1">
            <div class="progress-section hidden flex items-center gap-sm">
                <div
                    class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin text-primary">
                </div>
                <span class="progress-status text-sm font-mono text-secondary">Processing...</span>
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
            <button class="detect-btn btn jellyjump-btn-small" title="Detect" aria-label="Detect">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-search"></use>
                </svg>
            </button>
        </div>
    </div>
</template>
`;export{i as n,a as t};
//# sourceMappingURL=detection-D0UCuDRa.js.map