import{t as e}from"./Logger-DOeRJXJb.js";import{c as t,i as n,o as r}from"./Playlist-ClgPGWxo.js";import{t as i}from"./MediaProcessor-CMewCk14.js";import{dt as a,lt as o,ut as s}from"./StreamDetector-lxrk5bbH.js";import{n as c,s as l,t as u}from"./BoxEditorUtils-B_XI4FH-.js";import{r as d}from"./PreviewPlayer-C4lUVsTQ.js";import{t as f}from"./MenuJob-DzUWx0pR.js";import{t as p}from"./Templates-DuKuTQ0b.js";p(`<!-- blur: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Blur Content Template (Split Layout) -->
<template id="blur-content-template">
    <!-- Right Panel: Blur Controls -->
    <div class="modal-controls-panel">
        <div style="flex-shrink: 0;">
            <div class="flex-between mb-xs">
                <label class="text-xs text-secondary font-mono" for="blur-intensity">BLUR INTENSITY</label>
                <span id="blur-intensity-value" class="text-xs font-bold">15px</span>
            </div>
            <input type="range" id="blur-intensity" class="quality-slider w-full" min="1" max="40" value="15">
        </div>

        <label class="toggle-switch" style="flex-shrink: 0; padding: 4px 0;">
            <span class="toggle-label label-left">LIVE PREVIEW</span>
            <input type="checkbox" id="live-preview-toggle" checked>
            <span class="toggle-slider"></span>
        </label>

        <label class="text-xs text-secondary font-mono mb-xs block" style="flex-shrink: 0;">BLUR AREAS</label>
        <div id="blur-areas-list" class="tool-cards-list">
            <div class="empty-state text-center py-xl text-muted text-xs italic">No blur areas added. Draw on the video
                to add a blur area.</div>
        </div>
    </div>
</template>

<!-- Blur Item Template -->
<template id="blur-item-template">
    <div class="blur-item tool-card" style="cursor: pointer;">
        <!-- Header: Title + Remove -->
        <div class="tool-card-header">
            <span class="blur-item-title tool-card-title">Blur Area</span>
            <button class="remove-blur-btn tool-card-remove">✕</button>
        </div>

        <!-- Time: Start / End -->
        <div class="tool-card-times">
            <div class="tool-card-input">
                <label>Start</label>
                <input type="text" class="mb-input font-mono blur-start-time" placeholder="0:00.000">
                <button class="set-current-start jellyjump-btn-small" title="Set the start to the current time">Start here</button>
            </div>
            <div class="tool-card-input">
                <label>End</label>
                <input type="text" class="mb-input font-mono blur-end-time" placeholder="0:00.000">
                <button class="set-current-end jellyjump-btn-small" title="Set the end to the current time">End here</button>
            </div>
        </div>

        <!-- Position & Size: 2x2 grid -->
        <div class="tool-card-grid">
            <div class="tool-card-input">
                <label>X</label>
                <input type="number" class="mb-input font-mono text-center blur-x" min="0" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>Y</label>
                <input type="number" class="mb-input font-mono text-center blur-y" min="0" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>W</label>
                <input type="number" class="mb-input font-mono text-center blur-width" min="1" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>H</label>
                <input type="number" class="mb-input font-mono text-center blur-height" min="1" step="1" value="0">
            </div>
        </div>
    </div>
</template>
`);var m=class{static async init(p,m){let h=document.getElementById(`blur-item-template`),{modal:g,content:_}=n(`Blur`,`blur-content-template`,r.blur);if(!g)return;if(!h){e.error(`Blur modal templates not found!`),g.close();return}let v=await d(g,m);if(!v)return;let y=v.wrapper,{overlay:b,box:x}=u({overlayClass:`blur-overlay`,boxDataAttr:`data-blur-box`});v.adopt(b);let S={containerId:null,playerContainer:v.wrapper,wrapper:v.wrapper,overlay:b,box:x};S.box.setAttribute(`data-crop-box`,``),S.box.style.border=`2px dashed rgba(255, 255, 255, 0.8)`,S.box.style.backgroundColor=`rgba(255, 255, 255, 0.08)`,S.box.style.boxShadow=`none`,S.box.style.display=`none`;let C={blurList:_.querySelector(`#blur-areas-list`),blurIntensity:_.querySelector(`#blur-intensity`),blurIntensityValue:_.querySelector(`#blur-intensity-value`),processBtn:_.querySelector(`.process-btn`),downloadBtn:_.querySelector(`.download-btn`),livePreviewToggle:_.querySelector(`#live-preview-toggle`),progress:{section:_.querySelector(`.progress-section`),bar:_.querySelector(`.progress-bar-fill`),text:_.querySelector(`.progress-percentage`),status:_.querySelector(`.progress-status`)},messages:{error:_.querySelector(`.error-message`),success:_.querySelector(`.success-message`)}},w={video:{width:0,height:0},box:{x:0,y:0,width:0,height:0},preview:{scale:1},blurAreas:[],selectedIndex:-1},T=v.player;w.video={...v.video};let E=()=>parseInt(C.blurIntensity.value,10)||15;v.addRenderCallback((t,n)=>{if(!T||!C.livePreviewToggle.checked||w.blurAreas.length===0)return;let r=T.currentTime,i=E();w.blurAreas.forEach(a=>{if(r<a.startTime||r>a.endTime)return;let o=t.width,s=t.height;if(!w.video.width||!w.video.height)return;let c=o/w.video.width,l=s/w.video.height,u=a.x*c,d=a.y*l,f=a.width*c,p=a.height*l;try{n.save(),n.beginPath(),n.rect(u,d,f,p),n.clip(),n.filter=`blur(${i}px)`,n.drawImage(t,0,0,o,s),n.restore()}catch(t){e.warn(`Render Blur Failed`,t)}})}),C.blurIntensity.oninput=()=>{C.blurIntensityValue.textContent=`${C.blurIntensity.value}px`,T&&T.seek(T.currentTime)};let{updateSelection:D,renderOverlayRects:O,dispose:k}=c({editorUI:S,state:w,player:T,videoPanel:y,areas:()=>w.blurAreas,rectClass:`blur-area-rect`,boxSelector:`[data-blur-box]`,minSize:20,createArea:e=>({id:s(),...e,startTime:0,endTime:T.duration||10}),onSelectionChange:()=>j(),onAreaMoved:e=>A(e),zIndex:5});C.livePreviewToggle.checked=!0,C.livePreviewToggle.onchange=()=>{T&&T.seek(T.currentTime)};let A=e=>{let t=C.blurList.querySelectorAll(`.blur-item`)[e];if(!t)return;let n=w.blurAreas[e];if(!n)return;let r=t.querySelector(`.blur-x`),i=t.querySelector(`.blur-y`),a=t.querySelector(`.blur-width`),o=t.querySelector(`.blur-height`);r&&(r.value=Math.round(n.x)),i&&(i.value=Math.round(n.y)),a&&(a.value=Math.round(n.width)),o&&(o.value=Math.round(n.height))},j=()=>{let e=C.blurList;e.innerHTML=``,w.blurAreas.length===0?e.innerHTML=`<div class="empty-state text-center py-xl text-muted text-xs italic">No blur areas added. Draw on the video to add a blur area.</div>`:w.blurAreas.forEach((t,n)=>{let r=h.content.cloneNode(!0);if(n===w.selectedIndex){let e=r.querySelector(`.blur-item`)||r.firstElementChild;e&&e.classList.add(`active`,`border-primary`,`bg-primary/10`)}r.querySelector(`.blur-item-title`).textContent=`Blur Area #${n+1}`;let i=r.querySelector(`.blur-start-time`),s=r.querySelector(`.blur-end-time`);i.value=o(t.startTime),s.value=o(t.endTime);let c=r.querySelector(`.blur-x`),u=r.querySelector(`.blur-y`),d=r.querySelector(`.blur-width`),f=r.querySelector(`.blur-height`);c.value=Math.round(t.x),u.value=Math.round(t.y),d.value=Math.round(t.width),f.value=Math.round(t.height);let p=r.querySelector(`.blur-item`)||r.firstElementChild;p.onclick=e=>{e.target.tagName===`INPUT`||e.target.tagName===`BUTTON`||e.target.closest(`button`)||D(n)},r.querySelector(`.remove-blur-btn`).onclick=e=>{e.stopPropagation(),w.blurAreas.splice(n,1),w.selectedIndex===n?D(-1):w.selectedIndex>n?D(w.selectedIndex-1):j()},r.querySelector(`.set-current-start`).onclick=e=>{e.stopPropagation(),t.startTime=T.currentTime,i.value=o(t.startTime)},r.querySelector(`.set-current-end`).onclick=e=>{e.stopPropagation(),t.endTime=T.currentTime,s.value=o(t.endTime)},i.onchange=e=>{let n=a(e.target.value);n!==null&&(t.startTime=n)},s.onchange=e=>{let n=a(e.target.value);n!==null&&(t.endTime=n)};let m=()=>{n===w.selectedIndex&&(w.box.x=t.x,w.box.y=t.y,w.box.width=t.width,w.box.height=t.height,l(S.box,w)),O(),T&&T.seek(T.currentTime)};c.onchange=e=>{let n=parseInt(e.target.value,10);isNaN(n)||(t.x=Math.max(0,Math.min(n,(w.video.width||1920)-t.width)),m())},u.onchange=e=>{let n=parseInt(e.target.value,10);isNaN(n)||(t.y=Math.max(0,Math.min(n,(w.video.height||1080)-t.height)),m())},d.onchange=e=>{let n=parseInt(e.target.value,10);!isNaN(n)&&n>=20&&(t.width=Math.min(n,(w.video.width||1920)-t.x),m())},f.onchange=e=>{let n=parseInt(e.target.value,10);!isNaN(n)&&n>=20&&(t.height=Math.min(n,(w.video.height||1080)-t.y),m())},e.appendChild(r)})};C.processBtn.onclick=async()=>{w.blurAreas.length===0?(C.messages.error.textContent=`No blur areas defined.`,C.messages.error.classList.remove(`hidden`)):(D(-1),await f({name:`Blur`,subject:p.title,background:!0,failureText:e=>e.message,modal:g,work:async({signal:e,onProgress:n})=>i.process({source:await t.getSourceBlob(p,()=>m.save()),format:`mp4`,blur:{areas:w.blurAreas,intensity:E()},onProgress:e=>n(e,e<.9?`Blurring...`:`Finalizing...`),signal:e}),done:e=>{let t=p.title.replace(/\.[^/.]+$/,``)+`-blurred.mp4`,{url:n}=m.insertProcessedItem(p,e,t);C.downloadBtn.href=n,C.downloadBtn.download=t,C.downloadBtn.classList.remove(`hidden`)}}))},g.onCleanup(k)}};export{m as BlurMenu};
//# sourceMappingURL=BlurMenu-CIbgvNC_.js.map