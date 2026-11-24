import{t as e}from"./Logger-KueTPqug.js";import{t}from"./MediaProcessor-67NYsRPm.js";import{t as n}from"./CustomDropdown-Cs7Q8MM2.js";import{i as r,o as i}from"./Playlist-CPeFzLmy.js";import{l as a,s as o}from"./OverlayCompositor-Ck5xjra0.js";import{t as s}from"./MenuJob-Qz0aGYPZ.js";import{t as c}from"./Templates-DuKuTQ0b.js";c(`<!-- slideshow: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Slideshow Content Template -->
<template id="slideshow-content-template">
    <div class="slideshow-container">

        <!-- Dropzone -->
        <div class="slideshow-dropzone" role="button" tabindex="0" aria-label="Upload images">
            <svg width="32" height="32" fill="currentColor" style="opacity:0.5; margin-bottom:8px;">
                <use href="assets/icons/sprite.svg#icon-image"></use>
            </svg>
            <p class="text-sm text-secondary">Drag &amp; drop images here or <span class="slideshow-browse-link"
                    style="color:var(--accent-primary);cursor:pointer;text-decoration:underline;">browse</span></p>
            <p class="text-xs text-muted mt-xs">PNG, JPG, GIF, WebP, BMP — add multiple at once</p>
            <input type="file" class="slideshow-file-input" accept="image/*" multiple style="display:none;">
        </div>

        <!-- Image List -->
        <div class="slideshow-image-list hidden">
            <div class="slideshow-list-header flex-between mb-xs">
                <span class="text-xs text-secondary font-mono">IMAGES <span
                        class="slideshow-count text-accent font-bold">0</span></span>
                <button class="slideshow-add-more-btn jellyjump-btn-small" title="Add more images">
                    <svg width="14" height="14" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-plus"></use>
                    </svg>
                    <span>Add More</span>
                </button>
            </div>
            <!-- Table header -->
            <div class="slideshow-table-header slideshow-row-grid text-xs text-muted font-mono px-xs py-xs">
                <span></span><!-- drag -->
                <span></span><!-- thumb -->
                <span>FILE</span>
                <span class="text-center">DURATION</span>
                <span></span><!-- remove -->
            </div>
            <div class="slideshow-items-list"></div>
        </div>

        <!-- Settings -->
        <div class="slideshow-settings mt-md">
            <label class="text-xs text-secondary font-mono mb-sm block">TRANSITION</label>

            <div class="slideshow-transition-row flex gap-md items-start mb-sm flex-wrap">
                <!-- Transition type -->
                <div class="setting-group" style="flex:2; min-width:130px;">
                    <label class="text-xs font-bold mb-xs block">Type</label>
                    <div class="jellyjump-menu-btn-container">
                        <div class="mb-select jellyjump-menu-btn w-full slideshow-transition-btn"
                            id="slideshow-transition-btn" aria-haspopup="true" aria-expanded="false">
                            <span>Cut</span>
                        </div>
                        <div class="jellyjump-menu w-full" id="slideshow-transition-menu" role="menu">
                            <div class="jellyjump-menu-item active" data-value="cut" role="menuitem">
                                <span class="menu-label text-sm font-bold">Cut</span>
                                <span class="text-xs text-secondary ml-auto">Instant</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="crossfade" role="menuitem">
                                <span class="menu-label text-sm">Crossfade</span>
                                <span class="text-xs text-secondary ml-auto">Blend</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="slide-left" role="menuitem">
                                <span class="menu-label text-sm">Slide Left</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="slide-right" role="menuitem">
                                <span class="menu-label text-sm">Slide Right</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="slide-up" role="menuitem">
                                <span class="menu-label text-sm">Slide Up</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="slide-down" role="menuitem">
                                <span class="menu-label text-sm">Slide Down</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="fade-to-black" role="menuitem">
                                <span class="menu-label text-sm">Fade to Black</span>
                                <span class="text-xs text-secondary ml-auto">Cinematic</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="wipe-left" role="menuitem">
                                <span class="menu-label text-sm">Wipe Left</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="wipe-right" role="menuitem">
                                <span class="menu-label text-sm">Wipe Right</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="zoom-out" role="menuitem">
                                <span class="menu-label text-sm">Zoom Out</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="flip" role="menuitem">
                                <span class="menu-label text-sm">Flip</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="zoom" role="menuitem">
                                <span class="menu-label text-sm">Zoom</span>
                                <span class="text-xs text-secondary ml-auto">Ken Burns</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Transition duration -->
                <div class="slideshow-transition-duration-wrap setting-group"
                    style="flex:3; min-width:150px; display:none;">
                    <div class="flex-between mb-xs">
                        <label class="text-xs font-bold">Duration</label>
                        <span class="slideshow-trans-dur-val text-xs font-bold text-accent">0.5s</span>
                    </div>
                    <input type="range" class="quality-slider slideshow-trans-dur-slider w-full" min="0.3" max="2.0"
                        step="0.1" value="0.5">
                    <div class="flex-between mt-xs text-xs text-secondary">
                        <span>0.3s</span>
                        <span>1.0s</span>
                        <span>2.0s</span>
                    </div>
                </div>

                <!-- Output FPS -->
                <div class="setting-group" style="flex:2; min-width:120px;">
                    <label class="text-xs font-bold mb-xs block">Output FPS</label>
                    <div class="jellyjump-menu-btn-container">
                        <div class="mb-select jellyjump-menu-btn w-full slideshow-fps-btn" id="slideshow-fps-btn"
                            aria-haspopup="true" aria-expanded="false">
                            <span>30 fps</span>
                        </div>
                        <div class="jellyjump-menu w-full" id="slideshow-fps-menu" role="menu">
                            <div class="jellyjump-menu-item" data-value="24" role="menuitem">
                                <span class="menu-label text-sm">24 fps</span>
                                <span class="text-xs text-secondary ml-auto">Cinematic</span>
                            </div>
                            <div class="jellyjump-menu-item active" data-value="30" role="menuitem">
                                <span class="menu-label text-sm font-bold">30 fps</span>
                                <span class="text-xs text-secondary ml-auto">Standard</span>
                            </div>
                            <div class="jellyjump-menu-item" data-value="60" role="menuitem">
                                <span class="menu-label text-sm">60 fps</span>
                                <span class="text-xs text-secondary ml-auto">Smooth</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Music -->
            <label class="text-xs text-secondary font-mono mb-sm block mt-md">BACKGROUND MUSIC <span
                    class="text-muted font-normal">(optional)</span></label>
            <div class="slideshow-music-row flex gap-sm items-center flex-wrap">
                <label class="jellyjump-btn-small cursor-pointer flex-shrink-0 flex items-center gap-xs">
                    <svg width="14" height="14" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-audio"></use>
                    </svg>
                    <span>Choose File</span>
                    <input type="file" class="slideshow-music-input" accept="audio/*" style="display:none;">
                </label>
                <span class="slideshow-music-name text-sm text-muted flex-1 truncate" style="min-width:0;">No file
                    selected</span>
                <button class="slideshow-music-clear jellyjump-btn-small hidden" title="Remove music">
                    <svg width="14" height="14" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-close"></use>
                    </svg>
                </button>
            </div>
            <!-- Audio trim (shown after file selected) -->
            <div class="slideshow-audio-trim hidden mt-sm">
                <div class="flex-between mb-xs">
                    <label class="text-xs text-secondary font-mono">TRIM</label>
                    <div class="flex items-center gap-sm">
                        <span class="slideshow-trim-times text-xs font-bold text-accent"></span>
                        <button class="slideshow-audio-play jellyjump-btn-small" title="Preview selection">
                            <svg width="14" height="14" fill="currentColor">
                                <use class="slideshow-play-icon" href="assets/icons/sprite.svg#icon-play"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="slideshow-dual-range">
                    <div class="slideshow-range-track">
                        <div class="slideshow-range-fill"></div>
                    </div>
                    <input type="range" class="slideshow-audio-start" min="0" step="0.01" value="0">
                    <input type="range" class="slideshow-audio-end" min="0" step="0.01" value="0">
                </div>
                <div class="flex-between text-xs text-secondary mt-xs">
                    <span class="slideshow-audio-start-label">0:00</span>
                    <span class="slideshow-audio-end-label">0:00</span>
                </div>
            </div>
        </div>
    </div>
</template>

<!-- Slideshow Image Item Template -->
<template id="slideshow-image-item-template">
    <div class="slideshow-item slideshow-row-grid items-center px-xs py-xs rounded border border-transparent"
        draggable="true">
        <!-- Drag handle -->
        <div class="slideshow-item-drag text-muted"
            style="cursor:grab; user-select:none; font-size:16px; text-align:center; line-height:1;">&#8597;</div>
        <!-- Thumbnail -->
        <div style="width:52px;height:48px;background:#000;border-radius:3px;overflow:hidden;">
            <img style="width:100%;height:100%;object-fit:cover;" alt="">
        </div>
        <!-- Filename -->
        <div class="slideshow-item-name text-sm truncate" style="min-width:0;"></div>
        <!-- Duration -->
        <div class="flex items-center justify-center gap-xs">
            <input type="text" class="slideshow-item-duration font-mono" value="3" placeholder="3">
            <span class="text-xs text-secondary flex-shrink-0">s</span>
        </div>
        <!-- Remove -->
        <button class="slideshow-item-remove text-muted" title="Remove"
            style="background:none;border:none;cursor:pointer;padding:2px;display:flex;align-items:center;justify-content:center;border-radius:3px;width:100%;">
            <svg width="14" height="14" fill="currentColor">
                <use href="assets/icons/sprite.svg#icon-close"></use>
            </svg>
        </button>
    </div>
</template>
`);var l=class{static async init(c){let l=document.getElementById(`slideshow-image-item-template`),{modal:u,content:d}=r(`Images to Video`,`slideshow-content-template`,i.slideshow,{maxWidth:`760px`});if(!u)return;if(!l){e.error(`SlideshowMenu: templates not found`),u.close();return}let f=d.querySelector(`.slideshow-dropzone`),p=d.querySelector(`.slideshow-file-input`),ee=d.querySelector(`.slideshow-browse-link`),m=d.querySelector(`.slideshow-image-list`),h=d.querySelector(`.slideshow-items-list`),g=d.querySelector(`.slideshow-count`),_=d.querySelector(`.slideshow-add-more-btn`),v=d.querySelector(`#slideshow-transition-btn`),y=d.querySelector(`#slideshow-transition-menu`),b=d.querySelector(`.slideshow-transition-duration-wrap`),x=d.querySelector(`.slideshow-trans-dur-slider`),S=d.querySelector(`.slideshow-trans-dur-val`),C=d.querySelector(`#slideshow-fps-btn`),w=d.querySelector(`#slideshow-fps-menu`),T=d.querySelector(`.slideshow-music-input`),E=d.querySelector(`.slideshow-music-name`),D=d.querySelector(`.slideshow-music-clear`),O=d.querySelector(`.slideshow-audio-trim`),k=d.querySelector(`.slideshow-audio-start`),A=d.querySelector(`.slideshow-audio-end`),j=d.querySelector(`.slideshow-range-fill`),M=d.querySelector(`.slideshow-trim-times`),N=d.querySelector(`.slideshow-audio-start-label`),P=d.querySelector(`.slideshow-audio-end-label`),F=d.querySelector(`.slideshow-audio-play`),I=d.querySelector(`.slideshow-play-icon`),L=d.querySelector(`.slideshow-btn`),R=d.querySelector(`.error-message`),z=[],B=null,V=0,H=null,U=null,W=null,G=[],K=n.init({button:v,menu:y,initialValue:`cut`,onChange:e=>{e===`cut`?b.style.display=`none`:b.style.display=``}}),q=n.init({button:C,menu:w,initialValue:`30`});x.addEventListener(`input`,()=>{S.textContent=`${parseFloat(x.value).toFixed(1)}s`});let J=()=>{g.textContent=z.length,m.classList.toggle(`hidden`,z.length===0)},Y=()=>{h.innerHTML=``,z.forEach((e,t)=>{let n=l.content.cloneNode(!0),r=n.querySelector(`.slideshow-item`);r.querySelector(`img`).src=e.objectUrl,r.querySelector(`.slideshow-item-name`).textContent=e.name,r.dataset.index=t,r.addEventListener(`dragstart`,()=>{W=t,r.style.opacity=`0.5`}),r.addEventListener(`dragend`,()=>{r.style.opacity=``}),r.addEventListener(`dragover`,e=>{e.preventDefault(),r.style.outline=`2px solid var(--accent-primary)`}),r.addEventListener(`dragleave`,()=>{r.style.outline=``}),r.addEventListener(`drop`,e=>{if(e.preventDefault(),r.style.outline=``,W!==null&&W!==t){let e=z.splice(W,1)[0];z.splice(t,0,e),W=null,Y()}});let i=r.querySelector(`.slideshow-item-duration`);i.addEventListener(`blur`,()=>{let e=parseFloat(i.value);i.value=isNaN(e)?`3`:String(Math.max(.5,Math.min(60,e)))}),r.querySelector(`.slideshow-item-remove`).addEventListener(`click`,()=>{URL.revokeObjectURL(z[t].objectUrl),z.splice(t,1),Y(),J()}),h.appendChild(n)}),J()},X=e=>{for(let t of e){if(!t.type.startsWith(`image/`))continue;let e=URL.createObjectURL(t);G.push(e),z.push({file:t,objectUrl:e,name:t.name})}Y()};f.addEventListener(`click`,()=>p.click()),ee.addEventListener(`click`,e=>{e.stopPropagation(),p.click()}),p.addEventListener(`change`,()=>{p.files.length&&X(p.files),p.value=``}),f.addEventListener(`dragover`,e=>{e.preventDefault(),f.style.borderColor=`var(--accent-primary)`}),f.addEventListener(`dragleave`,()=>{f.style.borderColor=``}),f.addEventListener(`drop`,e=>{e.preventDefault(),f.style.borderColor=``;let t=Array.from(e.dataTransfer.files).filter(e=>e.type.startsWith(`image/`));t.length&&X(t)}),_.addEventListener(`click`,()=>p.click());let Z=e=>`${Math.floor(e/60)}:${String(Math.floor(e%60)).padStart(2,`0`)}`,Q=()=>{let e=parseFloat(k.value),t=parseFloat(A.value),n=V||1;j.style.left=`${e/n*100}%`,j.style.width=`${(t-e)/n*100}%`,N.textContent=Z(e),P.textContent=Z(t),M.textContent=`${Z(e)} – ${Z(t)}`},$=()=>{if(H){try{H.stop()}catch{}H=null}I.setAttribute(`href`,`assets/icons/sprite.svg#icon-play`)};k.addEventListener(`input`,()=>{let e=parseFloat(k.value);e>=parseFloat(A.value)&&(A.value=Math.min(e+.1,V)),Q(),$()}),A.addEventListener(`input`,()=>{let e=parseFloat(k.value),t=parseFloat(A.value);t<=e&&(k.value=Math.max(t-.1,0)),Q(),$()}),F.addEventListener(`click`,async()=>{if(H)$();else if(B)try{U=U||new AudioContext,U.state===`suspended`&&await U.resume();let e=parseFloat(k.value),t=parseFloat(A.value),n=await o(B,e,t);if(!n)return;H=U.createBufferSource(),H.buffer=n,H.connect(U.destination),H.start(0),I.setAttribute(`href`,`assets/icons/sprite.svg#icon-pause`),H.onended=()=>{H=null,I.setAttribute(`href`,`assets/icons/sprite.svg#icon-play`)}}catch(t){e.warn(`[SlideshowMenu] Audio preview failed:`,t)}}),T.addEventListener(`change`,async()=>{if(T.files.length){B=T.files[0],E.textContent=B.name,D.classList.remove(`hidden`),$();try{V=await a(B);let e=V.toFixed(2);k.max=e,A.max=e,k.value=0,A.value=e,Q(),O.classList.remove(`hidden`)}catch(t){e.warn(`[SlideshowMenu] Could not decode audio for trim:`,t),O.classList.add(`hidden`)}}}),D.addEventListener(`click`,()=>{B=null,V=0,T.value=``,E.textContent=`No file selected`,D.classList.add(`hidden`),O.classList.add(`hidden`),$()}),L&&L.addEventListener(`click`,async()=>{if(z.length===0){R&&(R.textContent=`Please add at least one image.`,R.classList.remove(`hidden`));return}let e=z.map(e=>e.file),n=Array.from(h.querySelectorAll(`.slideshow-item-duration`)).map(e=>Math.max(.5,parseFloat(e.value)||3)),r=K.getValue(),i=parseFloat(x.value)||.5,a=parseInt(q.getValue(),10)||30,o=B||null,l=o?parseFloat(k.value):0,d=o?parseFloat(A.value):null;$(),await s({name:`Slideshow`,subject:`${e.length} images`,background:!0,modal:u,work:({signal:s,onProgress:c})=>t.createSlideshowVideo({imageBlobs:e,imageDurations:n,transition:r,transitionDuration:i,audioBlob:o,audioLoop:!0,audioStartTime:l,audioEndTime:d,fps:a,onProgress:e=>c(e,e<.9?`Rendering frames...`:`Finalizing...`),signal:s}),done:async e=>{let t=`slideshow-${r}-${Date.now()}.mp4`,{item:n}=c.insertProcessedItem(null,e,t,{mediaType:`video/mp4`,extra:{path:`Slideshow/${t}`}});await c.ensureMetadata(n)}})}),u.onCleanup(()=>{K.destroy(),q.destroy(),$(),U&&(U.close().catch(()=>{}),U=null);for(let e of G)try{URL.revokeObjectURL(e)}catch{}})}};export{l as SlideshowMenu};
//# sourceMappingURL=SlideshowMenu-DU1bYlEE.js.map