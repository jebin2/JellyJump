import{t as e}from"./Logger-D8RQpEDv.js";import{t}from"./MediaProcessor-CZ33ClQu.js";import{c as n,i as r,o as i}from"./Playlist-Ccvt4Z6z.js";import{$ as a,Q as o,tt as s}from"./StreamDetector-BTl3w4BN.js";import{t as c}from"./CustomDropdown-Cs7Q8MM2.js";import{t as l}from"./MenuJob-sPrw_F6M.js";import{a as u,t as d}from"./PreviewPlayer-C4lUVsTQ.js";import{t as f}from"./Templates-DuKuTQ0b.js";f(`<!-- gif: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- GIF Creation Content Template -->
<template id="gif-content-template">
    <!-- Loading State -->
    <div class="gif-loading flex flex-col items-center justify-center p-xl text-muted" style="grid-column: 1 / -1;">
        <div class="spinner-md border-4 border-current border-t-transparent rounded-full w-8 h-8 animate-spin mb-sm">
        </div>
        <span>Loading video info...</span>
    </div>

    <div class="gif-content hidden" style="display: contents;">
        <!-- Right Panel: Controls -->
        <div class="modal-controls-panel">
            <div class="tool-card mb-md">
                <div class="tool-card-times">
                    <div class="tool-card-input">
                        <label>Start</label>
                        <input type="text" id="gif-start-input" class="mb-input font-mono" placeholder="0:00.000">
                        <button id="gif-set-start-btn" class="jellyjump-btn-small" title="Set the start to the current time">Start here</button>
                    </div>
                    <div class="tool-card-input">
                        <label>End</label>
                        <input type="text" id="gif-end-input" class="mb-input font-mono" placeholder="0:00.000">
                        <button id="gif-set-end-btn" class="jellyjump-btn-small" title="Set the end to the current time">End here</button>
                    </div>
                </div>
                <div class="tool-card-info">Duration: <span class="gif-duration">00:00:00</span></div>
            </div>

            <!-- Validation Error -->
            <div class="time-validation-error hidden text-danger text-sm"></div>

            <!-- GIF Settings -->
            <div class="gif-settings">
                <label class="text-xs text-secondary font-mono mb-xs block">GIF SETTINGS</label>

                <!-- Frame Rate -->
                <div class="setting-group mb-sm">
                    <label class="text-xs font-bold mb-xs block">Frame Rate</label>
                    <div class="jellyjump-menu-btn-container">
                        <div class="mb-select jellyjump-menu-btn w-full" id="gif-fps-btn" aria-haspopup="true"
                            aria-expanded="false">
                            <span>15 FPS (Recommended)</span>
                        </div>
                        <div class="jellyjump-menu w-full" id="gif-fps-menu" role="menu">
                            <div class="jellyjump-menu-item" data-value="5" role="menuitem">
                                <span class="menu-label text-sm">5 FPS (Smallest)</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="10" role="menuitem">
                                <span class="menu-label text-sm">10 FPS (Smooth)</span>
                            </div>
                            <div class="jellyjump-menu-item active" data-value="15" role="menuitem">
                                <span class="menu-label text-sm font-bold">15 FPS (Recommended)</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="20" role="menuitem">
                                <span class="menu-label text-sm">20 FPS (Very smooth)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Size -->
                <div class="setting-group mb-sm">
                    <label class="text-xs font-bold mb-xs block">Size</label>
                    <div class="jellyjump-menu-btn-container">
                        <div class="mb-select jellyjump-menu-btn w-full" id="gif-size-btn" aria-haspopup="true"
                            aria-expanded="false">
                            <span>480p</span>
                        </div>
                        <div class="jellyjump-menu w-full" id="gif-size-menu" role="menu">
                            <div class="jellyjump-menu-item" data-value="original" role="menuitem">
                                <span class="menu-label text-sm">Original Size</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="720" role="menuitem">
                                <span class="menu-label text-sm">720p</span>
                            </div>
                            <div class="jellyjump-menu-item active" data-value="480" role="menuitem">
                                <span class="menu-label text-sm font-bold">480p</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="360" role="menuitem">
                                <span class="menu-label text-sm">360p</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quality -->
                <div class="setting-group">
                    <div class="flex-between mb-xs">
                        <span class="text-xs font-bold">Quality</span>
                        <span id="gif-quality-value" class="text-xs font-bold">High</span>
                    </div>
                    <input type="range" class="quality-slider" id="gif-quality" min="40" max="100" step="20" value="80">
                    <div class="flex-between mt-xs text-[10px] text-secondary">
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                        <span>Original</span>
                    </div>
                </div>
            </div>
            <!-- The GIF made, shown here once its job is done -->
            <div class="gif-preview-section hidden mt-sm">
                <div class="gif-preview-container border border-border rounded p-sm bg-tertiary flex justify-center">
                    <img class="gif-preview-image" src="" alt="GIF preview"
                        style="max-width: 100%; height: auto; max-height: 200px;">
                </div>
                <div class="text-xs text-muted mt-xs">
                    GIF size: <span class="gif-file-size">-</span>
                </div>
            </div>
        </div>
    </div>
</template>
`);var p=class{static async init(f,p){let{modal:m,content:h}=r(`GIF`,`gif-content-template`,i.gif);if(!m)return;let g=h.querySelector(`.gif-loading`),_=h.querySelector(`.gif-content`),v=h.querySelector(`#gif-start-input`),y=h.querySelector(`#gif-end-input`),b=h.querySelector(`#gif-set-start-btn`),x=h.querySelector(`#gif-set-end-btn`),S=h.querySelector(`.gif-duration`),C=h.querySelector(`.time-validation-error`),w=h.querySelector(`#gif-fps-btn`),T=h.querySelector(`#gif-fps-menu`),E=c.init({button:w,menu:T,initialValue:`15`}),D=h.querySelector(`#gif-size-btn`),O=h.querySelector(`#gif-size-menu`),k=c.init({button:D,menu:O,initialValue:`480`}),A=h.querySelector(`#gif-quality`),j=h.querySelector(`#gif-quality-value`),M=h.querySelector(`.create-gif-btn`),N=h.querySelector(`.download-btn`),P=h.querySelector(`.gif-preview-section`),F=h.querySelector(`.gif-preview-image`),I=h.querySelector(`.gif-file-size`);await p.ensureMetadata(f);let L=0;f.duration&&typeof f.duration==`string`&&f.duration!==`--:--`&&(L=s(f.duration)),g.classList.add(`hidden`),_.classList.remove(`hidden`);let R=0,z=Math.min(L,10);v.value=a(R),y.value=a(z),S.textContent=a(z-R);let B=d(m,p),V=()=>{v.value=a(R),y.value=a(z);let e=Math.max(0,z-R);S.textContent=a(e),u(B,R,z),C.classList.add(`hidden`),M.disabled=!1,R>=z?(C.textContent=`Start time must be before end time`,C.classList.remove(`hidden`),M.disabled=!0):e<1?(C.textContent=`GIF duration must be at least 1 second`,C.classList.remove(`hidden`),M.disabled=!0):e>60&&(C.textContent=`GIF duration must not exceed 60 seconds`,C.classList.remove(`hidden`),M.disabled=!0)};V(),v.addEventListener(`change`,()=>{let e=s(v.value);isNaN(e)?V():(R=Math.min(Math.max(0,e),L),R>=z&&(R=Math.max(0,z-1)),V(),B&&B.seek(R))}),y.addEventListener(`change`,()=>{let e=s(y.value);isNaN(e)?V():(z=Math.min(Math.max(0,e),L),z<=R&&(z=Math.min(L,R+1)),V(),B&&B.seek(z))}),b.addEventListener(`click`,()=>{if(B){let e=B.currentTime;R=Math.min(Math.max(0,e),L),R>=z&&(z=Math.min(L,R+10)),V()}}),x.addEventListener(`click`,()=>{if(B){let e=B.currentTime;e>R&&(z=Math.min(Math.max(0,e),L),V())}}),A.addEventListener(`input`,()=>{let e=parseInt(A.value);j.textContent={40:`Low`,60:`Medium`,80:`High`,100:`Original`}[e]||`Medium`}),M.addEventListener(`click`,async()=>{let r=R,i=z,s=parseInt(E.getValue()),c=k.getValue(),u=parseInt(A.value);P.classList.add(`hidden`),N.classList.add(`hidden`),await l({name:`GIF`,subject:f.title,background:!0,modal:m,work:async({signal:a,onProgress:o})=>{let l,d;c===`original`?(l=f.videoInfo.width,d=f.videoInfo.height):(d={720:720,480:480,360:360}[c],l=Math.round(f.videoInfo.width/f.videoInfo.height*d));let m;try{m=await n.getSourceBlob(f,()=>p.save())}catch(t){throw e.error(`Failed to get source blob:`,t),Error(`Cannot access video file`)}return t.createGif({input:m,startTime:r,duration:i-r,fps:s,width:l,height:d,quality:u,onProgress:o,signal:a})},done:e=>{let t=URL.createObjectURL(e);F.src=t,I.textContent=o(e.size),P.classList.remove(`hidden`),m.body&&setTimeout(()=>{m.body.scrollTo({top:m.body.scrollHeight,behavior:`smooth`})},50);let n=Math.round(r).toString().padStart(2,`0`)+`-`+Math.round(i).toString().padStart(2,`0`),s=`${f.title.replace(/\.[^.]+$/,``)}-${n}.gif`;N.href=t,N.download=s,N.classList.remove(`hidden`),p.insertProcessedItem(f,e,s,{type:`image/gif`,mediaType:`image/gif`,duration:a(i-r),extra:{url:t,thumbnail:t}})}})}),m.onCleanup(()=>{E.destroy(),k.destroy()})}};export{p as GifMenu};
//# sourceMappingURL=GifMenu-B-mea8UM.js.map