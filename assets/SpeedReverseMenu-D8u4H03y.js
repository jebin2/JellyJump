import{t as e}from"./Logger-CPpFMQAE.js";import{t}from"./MediaProcessor-3CfBj7Zj.js";import{c as n,i as r,o as i,s as a}from"./Playlist-C10WrL3i.js";import{at as o,st as s}from"./StreamDetector-D63s1Dff.js";import{t as c}from"./MenuJob-Dnm1zKLR.js";import{t as l}from"./Templates-DuKuTQ0b.js";l(`<!-- speed-reverse: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Reverse Content Template -->
<template id="reverse-content-template">
    <div class="source-info mb-md">
        <span class="text-secondary text-sm font-mono">SOURCE:</span>
        <div class="source-filename text-base font-bold truncate" title=""></div>
        <div class="source-details text-xs text-muted mt-xs">
            <span class="source-duration"></span> • <span class="source-resolution"></span>
        </div>
    </div>

    <!-- Loading State -->
    <div class="reverse-loading flex flex-col items-center justify-center p-xl text-muted">
        <div class="spinner-md border-4 border-current border-t-transparent rounded-full w-8 h-8 animate-spin mb-sm">
        </div>
        <span>Loading video info...</span>
    </div>

    <div class="reverse-content hidden">
        <div class="info-text mb-lg p-sm bg-tertiary rounded text-sm text-secondary">
            Adjust playback speed or reverse the video.
        </div>

        <!-- Direction Options -->
        <div class="direction-selection mb-lg">
            <div class="text-xs font-bold uppercase text-secondary tracking-wider mb-sm">Playback Direction</div>
            <div class="radio-group flex gap-md">
                <label class="radio-option">
                    <input type="radio" name="direction" value="forward" checked class="hidden">
                    <div class="radio-label">
                        <span class="format-name">Forward</span>
                        <span class="format-desc">Normal Playback</span>
                    </div>
                </label>
                <label class="radio-option">
                    <input type="radio" name="direction" value="reverse" class="hidden">

                    <div class="radio-label">
                        <span class="format-name">Reverse</span>
                        <span class="format-desc">Backwards Playback</span>
                    </div>
                </label>
            </div>
        </div>

        <!-- Audio Options -->
        <div class="options-group mb-lg">
            <div class="text-xs text-secondary font-mono mb-sm">AUDIO OPTIONS</div>
            <label class="checkbox-option mb-sm">
                <input type="checkbox" name="includeAudio" id="reverse-include-audio" checked>

                <span class="checkbox-label text-sm">Include Audio</span>
            </label>
        </div>

        <!-- Speed Options -->
        <!-- Playback Speed -->
        <div class="setting-group mb-lg">
            <div class="flex justify-between items-center mb-sm">
                <span class="text-xs font-bold uppercase text-secondary tracking-wider">Playback Speed</span>
                <span class="speed-display text-xs font-bold text-primary">1.0x</span>
            </div>
            <input type="range" class="quality-slider speed-slider w-full" min="0.25" max="4" step="0.25" value="1">
            <div class="flex-between mt-xs text-xs text-secondary">
                <span>0.25x</span>
                <span>4x</span>
            </div>
        </div>

        <!-- Processing Info -->
        <div class="processing-info mb-lg hidden">
            <div class="warning-message p-sm border-warning text-warning text-sm mb-sm hidden" id="long-video-warning">
                ⚠️ Long video detected. Processing may take several minutes.
            </div>
        </div>

    </div>
</template>
`);var u=class{static async init(l,u){let{modal:d,content:f}=r(`Playback Speed & Direction`,`reverse-content-template`,i.reverse,{maxWidth:`500px`});if(!d)return;let p=f.querySelector(`.source-filename`),m=f.querySelector(`.source-duration`),h=f.querySelector(`.source-resolution`),g=f.querySelector(`.quality-slider`),_=f.querySelector(`.speed-display`),v=f.querySelector(`#reverse-include-audio`),y=f.querySelectorAll(`input[name="direction"]`),b=f.querySelector(`.reverse-btn`),x=f.querySelector(`.reverse-loading`),S=f.querySelector(`.reverse-content`),C=f.querySelector(`#long-video-warning`),w=f.querySelector(`.processing-info`);p.textContent=l.title,p.title=l.title,await u.ensureMetadata(l),x&&x.classList.add(`hidden`),S&&S.classList.remove(`hidden`),b&&(b.disabled=!1);let T=0;l.duration&&typeof l.duration==`string`&&l.duration!==`--:--`&&(T=s(l.duration)),m.textContent=o(T),h.textContent=l.videoInfo?`${l.videoInfo.width}×${l.videoInfo.height}`:`Unknown`;let E=T>60,D=()=>{let e=parseFloat(g.value),t=f.querySelector(`input[name="direction"]:checked`).value===`reverse`,n=T/e;_.textContent=`${e}x (${o(n)})`,t&&E?(C&&C.classList.remove(`hidden`),w&&w.classList.remove(`hidden`)):(C&&C.classList.add(`hidden`),!C||C.classList.contains(`hidden`));let r=v.closest(`label`);if(r){let e=r.querySelector(`.checkbox-label`);e&&(e.textContent=t?`Include reversed audio`:`Include audio`)}if(b){a(b,t?`Reverse Video`:`Change Speed`);let n=!t&&e===1&&v?.checked!==!1;b.disabled=n,n&&(b.title=`Pick another speed, reverse it, or leave out the audio`)}};g&&g.addEventListener(`input`,D),y.forEach(e=>{e.addEventListener(`change`,D)}),v?.addEventListener(`change`,D),D(),b&&b.addEventListener(`click`,async()=>{let r=g?parseFloat(g.value):1,i=!v||v.checked,a=f.querySelector(`input[name="direction"]:checked`).value===`reverse`;await c({name:a?`Reverse`:`Speed`,subject:l.title,background:!0,modal:d,work:async({signal:o,onProgress:s})=>{let c;try{c=await n.getSourceBlob(l,()=>u.save())}catch(t){throw e.error(`Failed to get source blob:`,t),Error(`Cannot access video file`)}let d={source:c,speed:r,includeAudio:i,onProgress:e=>s(e,e<.9?a?`Reversing & Encoding...`:`Processing frames...`:`Finalizing...`),signal:o};return a?t.reverseVideo(d):t.changeVideoSpeed(d)},done:async e=>{let t=a?`reversed-${r}x`:r<1?`slow-${r}x`:`fast-${r}x`,n=`${l.title.replace(/\.[^.]+$/,``)}-${t}.mp4`,{item:i}=u.insertProcessedItem(l,e,n,{duration:null,mediaType:`video/mp4`,extra:{thumbnail:l.thumbnail}});await u.ensureMetadata(i)}})})}};export{u as SpeedReverseMenu};
//# sourceMappingURL=SpeedReverseMenu-D8u4H03y.js.map