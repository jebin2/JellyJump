import{t as e}from"./MediaProcessor-DvwkOm6_.js";import{c as t,i as n,o as r}from"./Playlist-DdxE2Wj9.js";import{a as i,c as a,i as o,o as s,r as c,s as l}from"./BoxEditorUtils-B_XI4FH-.js";import{t as u}from"./MenuJob-Coh6PKS_.js";import{r as d}from"./PreviewPlayer-C4lUVsTQ.js";import{t as f}from"./Templates-DuKuTQ0b.js";f(`<!-- crop: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Crop Content Template -->
<template id="crop-content-template">
    <!-- Left Panel: Video Preview with Crop Box -->
    <div class="modal-video-panel">
        <!-- The overlay moves over the main player's picture when Crop opens -->
        <div class="crop-preview-wrapper" style="position: relative;">
            <!-- Crop Overlay (sibling to player, positioned over it via CSS) -->
            <div class="crop-overlay" data-crop-overlay>
                <div class="crop-box" data-crop-box>
                    <div class="crop-handle crop-handle-nw" data-handle="nw"></div>
                    <div class="crop-handle crop-handle-n" data-handle="n"></div>
                    <div class="crop-handle crop-handle-ne" data-handle="ne"></div>
                    <div class="crop-handle crop-handle-e" data-handle="e"></div>
                    <div class="crop-handle crop-handle-se" data-handle="se"></div>
                    <div class="crop-handle crop-handle-s" data-handle="s"></div>
                    <div class="crop-handle crop-handle-sw" data-handle="sw"></div>
                    <div class="crop-handle crop-handle-w" data-handle="w"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Right Panel: Crop Coordinates -->
    <div class="modal-controls-panel">
        <div class="tool-card">
            <div class="tool-card-header">
                <span class="tool-card-title">Crop Position</span>
            </div>
            <div class="crop-coords-grid tool-card-grid">
                <div class="tool-card-input">
                    <label for="crop-left">LEFT (px)</label>
                    <input type="number" id="crop-left" class="mb-input font-mono text-center" min="0" step="1"
                        value="0">
                </div>
                <div class="tool-card-input">
                    <label for="crop-top">TOP (px)</label>
                    <input type="number" id="crop-top" class="mb-input font-mono text-center" min="0" step="1"
                        value="0">
                </div>
            </div>
        </div>

        <div class="tool-card">
            <div class="tool-card-header">
                <span class="tool-card-title">Crop Size</span>
            </div>
            <div class="crop-coords-grid tool-card-grid">
                <div class="tool-card-input">
                    <label for="crop-width">WIDTH (px)</label>
                    <input type="number" id="crop-width" class="mb-input font-mono text-center" min="64" step="2"
                        value="0">
                </div>
                <div class="tool-card-input">
                    <label for="crop-height">HEIGHT (px)</label>
                    <input type="number" id="crop-height" class="mb-input font-mono text-center" min="64" step="2"
                        value="0">
                </div>
            </div>
            <div class="tool-card-info">Drag the corners to adjust the crop area</div>
        </div>
    </div>
</template>
`);var p=class{static async init(e,t){let{modal:i,content:a}=n(`Crop`,`crop-content-template`,r.crop);if(!i)return;let s=a.querySelector(`.crop-preview-wrapper`),c={playerContainer:null,cropWrapper:s,cropOverlay:s.querySelector(`[data-crop-overlay]`),cropBox:s.querySelector(`[data-crop-box]`),inputs:{left:a.querySelector(`#crop-left`),top:a.querySelector(`#crop-top`),width:a.querySelector(`#crop-width`),height:a.querySelector(`#crop-height`)},buttons:{crop:a.querySelector(`.crop-btn`),download:a.querySelector(`.download-btn`)},progress:{section:a.querySelector(`.progress-section`),text:a.querySelector(`.progress-percentage`),status:a.querySelector(`.progress-status`)},messages:{error:a.querySelector(`.error-message`),success:a.querySelector(`.success-message`)}},u={video:{width:0,height:0},box:{x:0,y:0,width:0,height:0},preview:{scale:1,offsetX:0,offsetY:0,displayWidth:0,displayHeight:0}},f=await d(i,t);if(!f)return;f.adopt(c.cropOverlay),c.playerContainer=f.wrapper,u.video={...f.video};let p=m(c,u),v=o(c.cropOverlay,c.cropBox,u,40,()=>{l(c.cropBox,u),h(c,u)});g(c,u),_(c,u,e,t,i),i.onCleanup(()=>{v.dispose(),clearTimeout(p.timer),p.current?.disconnect()})}};function m(e,t){let n={timer:null,current:null};return t.box={x:0,y:0,width:t.video.width,height:t.video.height},n.timer=setTimeout(()=>{a(e.cropOverlay,t),l(e.cropBox,t),h(e,t),e.playerContainer&&(n.current=c(e.playerContainer,e.cropOverlay,t,()=>l(e.cropBox,t)))},200),n}function h(e,t){e.inputs.left.value=Math.round(t.box.x),e.inputs.top.value=Math.round(t.box.y),e.inputs.width.value=Math.round(t.box.width),e.inputs.height.value=Math.round(t.box.height)}function g(e,t){let n=()=>{t.box.x=Math.max(0,parseInt(e.inputs.left.value)||0),t.box.y=Math.max(0,parseInt(e.inputs.top.value)||0),t.box.width=Math.max(100,parseInt(e.inputs.width.value)||100),t.box.height=Math.max(100,parseInt(e.inputs.height.value)||100),t.box.x=Math.min(t.box.x,t.video.width-100),t.box.y=Math.min(t.box.y,t.video.height-100),t.box.width=Math.min(t.box.width,t.video.width-t.box.x),t.box.height=Math.min(t.box.height,t.video.height-t.box.y),a(e.cropOverlay,t),l(e.cropBox,t),h(e,t)};Object.values(e.inputs).forEach(e=>{e.addEventListener(`input`,n)})}function _(n,r,a,o,c){n.buttons.crop.addEventListener(`click`,async()=>{let l=Math.floor(r.box.width/2)*2,d=Math.floor(r.box.height/2)*2;l<64||d<64?i(n.messages.error,`Crop must be at least 64px`):(s(n.progress,`Cropping to ${l}x${d}...`),await u({name:`Crop`,subject:a.title,background:!0,modal:c,work:async({signal:n,onProgress:i})=>{let s=await t.getSourceBlob(a,()=>o.save());return e.process({source:s,format:`mp4`,quality:100,crop:{left:Math.round(r.box.x),top:Math.round(r.box.y),width:l,height:d},onProgress:i,signal:n})},done:e=>{let t=a.title.replace(/\.[^/.]+$/,``)+`-crop-${l}x${d}.mp4`,{url:r}=o.insertProcessedItem(a,e,t);n.buttons.download.href=r,n.buttons.download.download=t,n.buttons.download.classList.remove(`hidden`),n.messages.success.textContent=`✓ Added to playlist`}}))})}export{p as CropMenu};
//# sourceMappingURL=CropMenu-B9TM1C_H.js.map