import{t as e}from"./Logger-CJZeu_FB.js";import{t}from"./MediaProcessor-CnxM-qAK.js";import{c as n,i as r,o as i}from"./Playlist-CjuQKh4e.js";import{$ as a,et as o,tt as s}from"./StreamDetector-Dih9wFo9.js";import{n as c,s as l,t as u}from"./BoxEditorUtils-B_XI4FH-.js";import{r as d}from"./PreviewPlayer-C4lUVsTQ.js";import{t as f}from"./MenuJob-CooJjYoU.js";import{t as p}from"./Templates-DuKuTQ0b.js";p(`<!-- watermark: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Watermark Content Template -->
<template id="watermark-content-template">
    <!-- Right Panel: Watermark Controls -->
    <div class="modal-controls-panel">
        <label class="toggle-switch" style="flex-shrink: 0; padding: 4px 0;">
            <span class="toggle-label label-left">LIVE PREVIEW</span>
            <input type="checkbox" id="wm-live-preview-toggle" checked>
            <span class="toggle-slider"></span>
        </label>

        <label class="text-xs text-secondary font-mono mb-xs block" style="flex-shrink: 0;">WATERMARK AREAS</label>
        <div id="watermark-areas-list" class="tool-cards-list">
            <div class="empty-state text-center py-xl text-muted text-xs italic">No watermarks added. Draw on the video
                to add a watermark.</div>
        </div>
    </div>
</template>

<!-- Watermark Item Template -->
<template id="watermark-item-template">
    <div class="watermark-item tool-card" style="cursor: pointer;">
        <!-- Header: Title + Remove -->
        <div class="tool-card-header">
            <span class="wm-item-title tool-card-title">Watermark</span>
            <button class="remove-wm-btn tool-card-remove">✕</button>
        </div>

        <!-- Time: Start / End -->
        <div class="tool-card-times">
            <div class="tool-card-input">
                <label>Start</label>
                <input type="text" class="mb-input font-mono wm-start-time" placeholder="0:00.000">
                <button class="set-current-start jellyjump-btn-small" title="Set the start to the current time">Start here</button>
            </div>
            <div class="tool-card-input">
                <label>End</label>
                <input type="text" class="mb-input font-mono wm-end-time" placeholder="0:00.000">
                <button class="set-current-end jellyjump-btn-small" title="Set the end to the current time">End here</button>
            </div>
        </div>

        <!-- Type Toggle -->
        <div style="margin-bottom: 8px;">
            <label class="toggle-switch" style="padding: 2px 0;">
                <span class="toggle-label label-left active-text" style="font-size: 11px;">TEXT</span>
                <input type="checkbox" class="wm-item-type-toggle">
                <span class="toggle-slider"></span>
                <span class="toggle-label label-right" style="font-size: 11px;">IMAGE</span>
            </label>
        </div>

        <!-- Text Controls -->
        <div class="wm-item-text-group" style="margin-bottom: 8px;">
            <div class="tool-card-input">
                <input type="text" class="mb-input wm-item-text" placeholder="Watermark text" value="Watermark">
                <input type="color" class="wm-item-color" value="#ffffff">
            </div>
        </div>

        <!-- Image Controls (hidden by default) -->
        <div class="wm-item-image-group hidden" style="margin-bottom: 8px;">
            <input type="file" class="mb-input wm-item-image mb-input-file-choose"
                style="width: 100%; font-size: 0.85em;" accept="image/png,image/jpeg,image/webp">
        </div>

        <!-- Opacity -->
        <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span class="text-xs text-secondary font-mono">Opacity</span>
                <span class="wm-item-opacity-value text-xs font-bold">100%</span>
            </div>
            <input type="range" class="quality-slider wm-item-opacity" style="width: 100%;" min="10" max="100"
                value="100">
        </div>

        <!-- Position & Size: 2x2 grid -->
        <div class="tool-card-grid">
            <div class="tool-card-input">
                <label>X</label>
                <input type="number" class="mb-input font-mono text-center wm-x" min="0" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>Y</label>
                <input type="number" class="mb-input font-mono text-center wm-y" min="0" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>W</label>
                <input type="number" class="mb-input font-mono text-center wm-width" min="1" step="1" value="0">
            </div>
            <div class="tool-card-input">
                <label>H</label>
                <input type="number" class="mb-input font-mono text-center wm-height" min="1" step="1" value="0">
            </div>
        </div>
    </div>
</template>
`);var m=class{static async init(p,m){let _=document.getElementById(`watermark-item-template`),{modal:v,content:y}=r(`Watermark`,`watermark-content-template`,i.watermark);if(!v)return;if(!_){e.error(`Watermark modal templates not found!`),v.close();return}let b=await d(v,m);if(!b)return;let x=b.wrapper,{overlay:S,box:C}=u({overlayClass:`watermark-overlay`,boxDataAttr:`data-watermark-box`});b.adopt(S);let w={containerId:null,playerContainer:b.wrapper,wrapper:b.wrapper,overlay:S,box:C};w.box.setAttribute(`data-crop-box`,``),w.box.style.border=`2px dashed rgba(255, 255, 255, 0.8)`,w.box.style.backgroundColor=`rgba(255, 255, 255, 0.08)`,w.box.style.boxShadow=`none`,w.box.style.display=`none`;let T={wmList:y.querySelector(`#watermark-areas-list`),livePreviewToggle:y.querySelector(`#wm-live-preview-toggle`),processBtn:y.querySelector(`.wm-process-btn`),downloadBtn:y.querySelector(`.download-btn`),progress:{section:y.querySelector(`.progress-section`),bar:y.querySelector(`.progress-bar-fill`),text:y.querySelector(`.progress-percentage`),status:y.querySelector(`.progress-status`)},messages:{error:y.querySelector(`.error-message`),success:y.querySelector(`.success-message`)}},E={video:{width:0,height:0},box:{x:0,y:0,width:0,height:0},preview:{scale:1},watermarkAreas:[],selectedIndex:-1},D=b.player;E.video={...b.video},b.addRenderCallback((t,n)=>{if(!D||!T.livePreviewToggle.checked||E.watermarkAreas.length===0)return;let r=D.currentTime,i=t.width,a=t.height;if(!E.video.width||!E.video.height)return;let o=i/E.video.width,s=a/E.video.height;E.watermarkAreas.forEach(t=>{if(r<t.startTime||r>t.endTime)return;let i=t.x*o,a=t.y*s,c=t.width*o,l=t.height*s;try{if(n.save(),n.globalAlpha=t.opacity||1,t.type===`image`&&t._previewImage&&t._previewImage.complete)n.drawImage(t._previewImage,i,a,c,l);else if(t.type===`text`&&t.text){let e=c/(Math.max(1,t.text.length)*.6),r=l*.8,o=Math.max(8,Math.min(e,r));n.font=`bold ${o}px sans-serif`,n.textAlign=`center`,n.textBaseline=`middle`;let s=g(t.color);n.fillStyle=`rgb(${s.r}, ${s.g}, ${s.b})`,n.strokeStyle=`rgba(0, 0, 0, 0.5)`,n.lineWidth=o*.05;let u=i+c/2,d=a+l/2;n.strokeText(t.text,u,d),n.fillText(t.text,u,d)}n.restore()}catch(t){e.warn(`Render Watermark Failed`,t)}})});let{updateSelection:O,renderOverlayRects:k,dispose:A}=c({editorUI:w,state:E,player:D,videoPanel:x,areas:()=>E.watermarkAreas,rectClass:`wm-area-rect`,boxSelector:`[data-watermark-box]`,minSize:40,createArea:e=>({id:o(),...e,startTime:0,endTime:D.duration||10,type:`text`,text:`Watermark`,color:`#ffffff`,imageFile:null,imageDataUrl:null,opacity:1,_previewImage:null}),onSelectionChange:()=>M(),onAreaMoved:e=>j(e),zIndex:5});T.livePreviewToggle.checked=!0,T.livePreviewToggle.onchange=()=>{D&&D.seek(D.currentTime)};let j=e=>{let t=T.wmList.querySelectorAll(`.watermark-item`)[e];if(!t)return;let n=E.watermarkAreas[e];if(!n)return;let r=t.querySelector(`.wm-x`),i=t.querySelector(`.wm-y`),a=t.querySelector(`.wm-width`),o=t.querySelector(`.wm-height`);r&&(r.value=Math.round(n.x)),i&&(i.value=Math.round(n.y)),a&&(a.value=Math.round(n.width)),o&&(o.value=Math.round(n.height))},M=()=>{let e=T.wmList;e.innerHTML=``,E.watermarkAreas.length===0?e.innerHTML=`<div class="empty-state text-center py-xl text-muted text-xs italic">No watermarks added. Draw on the video to add a watermark.</div>`:E.watermarkAreas.forEach((t,n)=>{let r=_.content.cloneNode(!0);if(n===E.selectedIndex){let e=r.querySelector(`.watermark-item`)||r.firstElementChild;e&&e.classList.add(`active`,`border-primary`,`bg-primary/10`)}r.querySelector(`.wm-item-title`).textContent=`Watermark #${n+1}`;let i=r.querySelector(`.wm-start-time`),o=r.querySelector(`.wm-end-time`);i.value=a(t.startTime),o.value=a(t.endTime);let c=r.querySelector(`.wm-item-type-toggle`),u=r.querySelector(`.wm-item-text-group`),d=r.querySelector(`.wm-item-image-group`);c.checked=t.type===`image`,t.type===`image`&&(u.classList.add(`hidden`),d.classList.remove(`hidden`));let f=r.querySelector(`.wm-item-text`),p=r.querySelector(`.wm-item-color`);f.value=t.text||`Watermark`,p.value=t.color||`#ffffff`;let m=r.querySelector(`.wm-item-opacity`),h=r.querySelector(`.wm-item-opacity-value`);m.value=Math.round((t.opacity||1)*100),h.textContent=`${m.value}%`;let g=r.querySelector(`.wm-x`),v=r.querySelector(`.wm-y`),y=r.querySelector(`.wm-width`),b=r.querySelector(`.wm-height`);g.value=Math.round(t.x),v.value=Math.round(t.y),y.value=Math.round(t.width),b.value=Math.round(t.height);let x=r.querySelector(`.watermark-item`)||r.firstElementChild;x.onclick=e=>{e.target.tagName===`INPUT`||e.target.tagName===`BUTTON`||e.target.closest(`button`)||e.target.closest(`.toggle-switch`)||e.target.tagName===`LABEL`||O(n)},r.querySelector(`.remove-wm-btn`).onclick=e=>{e.stopPropagation(),E.watermarkAreas.splice(n,1),E.selectedIndex===n?O(-1):E.selectedIndex>n?O(E.selectedIndex-1):M()},c.onchange=()=>{t.type=c.checked?`image`:`text`,t.type===`text`?(u.classList.remove(`hidden`),d.classList.add(`hidden`)):(u.classList.add(`hidden`),d.classList.remove(`hidden`)),D&&D.seek(D.currentTime)},f.oninput=()=>{t.text=f.value,D&&D.seek(D.currentTime)},p.oninput=()=>{t.color=p.value,D&&D.seek(D.currentTime)};let S=r.querySelector(`.wm-item-image`);S.onchange=e=>{let r=e.target.files[0];if(!r)return;t.imageFile=r;let i=new FileReader;i.onload=e=>{t.imageDataUrl=e.target.result;let r=new Image;r.onload=()=>{t._previewImage=r;let e=r.width/r.height;t.height=t.width/e,n===E.selectedIndex&&(E.box.height=t.height,l(w.box,E),j(n)),D&&D.seek(D.currentTime),D&&D.seek(D.currentTime)},r.src=e.target.result},i.readAsDataURL(r)},m.oninput=()=>{let e=parseInt(m.value);t.opacity=e/100,h.textContent=`${e}%`,D&&D.seek(D.currentTime)},r.querySelector(`.set-current-start`).onclick=e=>{e.stopPropagation(),t.startTime=D.currentTime,i.value=a(t.startTime)},r.querySelector(`.set-current-end`).onclick=e=>{e.stopPropagation(),t.endTime=D.currentTime,o.value=a(t.endTime)},i.onchange=()=>{let e=s(i.value);e!==null&&(t.startTime=e)},o.onchange=()=>{let e=s(o.value);e!==null&&(t.endTime=e)};let C=()=>{n===E.selectedIndex&&(E.box.x=t.x,E.box.y=t.y,E.box.width=t.width,E.box.height=t.height,l(w.box,E)),k(),D&&D.seek(D.currentTime)};g.onchange=()=>{let e=parseInt(g.value,10);isNaN(e)||(t.x=Math.max(0,Math.min(e,(E.video.width||1920)-t.width)),C())},v.onchange=()=>{let e=parseInt(v.value,10);isNaN(e)||(t.y=Math.max(0,Math.min(e,(E.video.height||1080)-t.height)),C())},y.onchange=()=>{let e=parseInt(y.value,10);!isNaN(e)&&e>=40&&(t.width=Math.min(e,(E.video.width||1920)-t.x),C())},b.onchange=()=>{let e=parseInt(b.value,10);!isNaN(e)&&e>=40&&(t.height=Math.min(e,(E.video.height||1080)-t.y),C())},e.appendChild(r)})};T.processBtn.onclick=async()=>{if(E.watermarkAreas.length===0){T.messages.error.textContent=`No watermark areas defined.`,T.messages.error.classList.remove(`hidden`);return}O(-1);let e=p.title.split(`.`).pop().toLowerCase(),r=[`mp4`,`webm`,`mov`].includes(e)?e:`mp4`;await f({name:`Watermark`,subject:p.title,background:!0,failureText:e=>e.message,modal:v,work:async({signal:e,onProgress:i})=>t.process({source:await n.getSourceBlob(p,()=>m.save()),format:r,quality:100,watermark:{items:E.watermarkAreas.map(h)},onProgress:e=>i(e,e<.9?`Watermarking...`:`Finalizing...`),signal:e}),done:e=>{let t=p.title.replace(/\.[^/.]+$/,``)+`-watermarked.${r}`,{url:n}=m.insertProcessedItem(p,e,t,{type:`video/${r}`});T.downloadBtn.href=n,T.downloadBtn.download=t,T.downloadBtn.classList.remove(`hidden`)}})},v.onCleanup(A)}};function h(e){let t={id:e.id,type:e.type,x:Math.round(e.x),y:Math.round(e.y),width:Math.round(e.width),height:Math.round(e.height),opacity:e.opacity,startTime:e.startTime,endTime:e.endTime};if(e.type===`text`){let n=e.height*.8,r=Math.max(1,e.text.length),i=e.width*.9/(r*.5),a=Math.max(12,Math.min(n,i)),o=document.createElement(`canvas`).getContext(`2d`);o.font=`bold ${a}px sans-serif`;let s=o.measureText(e.text).width;t.text=e.text,t.x=Math.round(e.x+(e.width-s)/2),t.y=Math.round(e.y+(e.height-a)/2),t.fontSize=Math.round(a),t.font=`bold ${Math.round(a)}px sans-serif`,t.fillStyle=(()=>{let t=g(e.color);return`rgb(${t.r}, ${t.g}, ${t.b})`})(),t.strokeStyle=`rgba(0, 0, 0, 0.5)`,t.lineWidth=Math.round(a)*.05,t.textAlign=`left`,t.textBaseline=`top`}else e.type===`image`&&(t.image=e.imageFile);return t}function g(e){let t=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(e);return t?{r:parseInt(t[1],16),g:parseInt(t[2],16),b:parseInt(t[3],16)}:{r:255,g:255,b:255}}export{m as WatermarkMenu};
//# sourceMappingURL=WatermarkMenu-CrzH2k8n.js.map