import{t as e}from"./Modal-d2Ji3_kb.js";import{t}from"./MediaProcessor-DI7LJByV.js";import{c as n}from"./Playlist-b11JlByi.js";import{t as r}from"./MenuJob-Km6xsayt.js";import{t as i}from"./Templates-DuKuTQ0b.js";i(`<!-- combine-av: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Combine Audio/Video Modal Content Template -->
<template id="combine-av-modal-content-template">
    <div class="combine-av-container">
        <div class="combine-empty-state hidden text-center p-md text-muted text-sm italic mb-md">
            Need at least one video file and a second file to pull audio from.
        </div>

        <div class="flex flex-col gap-md">
            <div class="flex flex-col gap-xs">
                <div class="text-xs text-secondary font-mono uppercase">Video From</div>
                <select class="mb-select w-full combine-video-select"></select>
            </div>

            <div class="flex flex-col gap-xs">
                <div class="text-xs text-secondary font-mono uppercase">Audio From</div>
                <select class="mb-select w-full combine-audio-select"></select>
            </div>

            <div class="flex flex-col gap-xs">
                <div class="text-xs text-secondary font-mono uppercase">Output Format</div>
                <select class="mb-select w-full combine-format-select">
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                    <option value="mov">MOV</option>
                </select>
            </div>
        </div>
    </div>
</template>

<!-- Combine Audio/Video Modal Footer Template -->
<template id="combine-av-modal-footer-template">
    <div class="flex-between w-full h-full gap-md items-center">
        <div class="flex-1 flex items-center">
            <div class="progress-section hidden flex items-center gap-sm w-full">
                <div
                    class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin text-primary">
                </div>
                <span class="progress-status text-sm font-mono text-secondary">Combining...</span>
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

        <div class="action-buttons flex gap-sm flex-shrink-0">
            <a href="#" class="btn jellyjump-btn-small hidden download-btn" title="Download" aria-label="Download"
                download>
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-download"></use>
                </svg>
            </a>
            <button class="btn jellyjump-btn-small combine-btn" title="Combine" aria-label="Combine" disabled>
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-audio"></use>
                </svg>
            </button>
        </div>
    </div>
</template>
`);var a=class{static async init(i){let a=document.getElementById(`combine-av-modal-content-template`),o=document.getElementById(`combine-av-modal-footer-template`);if(!a||!o)return;let s=new e({maxWidth:`520px`});s.setTitle(`Combine Audio/Video`),s.setBody(a.content.cloneNode(!0)),s.setFooter(o.content.cloneNode(!0));let c=s.modal,l=c.querySelector(`.combine-video-select`),u=c.querySelector(`.combine-audio-select`),d=c.querySelector(`.combine-format-select`),f=c.querySelector(`.combine-btn`),p=c.querySelector(`.combine-empty-state`),m=e=>!(e.isStream||e.isLive||e.url&&(e.url.includes(`.m3u8`)||e.url.includes(`/hls/`))),h=e=>{if(!m(e)||e.isAudio||(e.type||e.mimeType||e.fileType||``).startsWith(`audio`))return!1;let t=e.title||e.path||e.url||``;return!/\.(mp3|wav|flac|aac|ogg|m4a|opus|wma)$/i.test(t)},g=i.items.filter(m),_=i.items.filter(h);g.length<2||_.length===0?(p.classList.remove(`hidden`),f.setAttribute(`disabled`,`true`)):p.classList.add(`hidden`);let v=(e,t)=>{e.innerHTML=``,t.forEach((t,n)=>{let r=document.createElement(`option`);r.value=String(n),r.textContent=t.path||t.title,e.appendChild(r)})};v(l,_),v(u,g),l._items=_,u._items=g,(()=>{let e=_.length>0&&g.length>0;f.disabled=!e})(),s.open(),f.addEventListener(`click`,async()=>{let e=_[parseInt(l.value,10)],a=g[parseInt(u.value,10)];if(!e||!a)return;let o=d.value;f.disabled=!0,f.innerHTML=`<span class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin mr-xs"></span> Combining...`,(await r({name:`Combine A/V`,subject:e.title,background:!0,modal:s,work:async({signal:r,onProgress:s})=>{let c=await n.getSourceBlob(e,()=>i.save()),l=await n.getSourceBlob(a,()=>i.save());return t.combineAudioVideo({videoSource:c,audioSource:l,format:o,onProgress:s,signal:r})},done:async t=>{let n=e,r=`combined-${new Date().toISOString().replace(/[:.]/g,`-`)}.${o}`,a=n?.path||n?.title||``,s=a.includes(`/`)?a.substring(0,a.lastIndexOf(`/`)):``,{item:c}=i.insertProcessedItem(n,t,r,{type:`video/${o}`,duration:null,extra:{path:s?`${s}/${r}`:r}});await i.ensureMetadata(c)}})).ok||(f.disabled=!1,f.innerHTML=`<span class="mr-xs">Combine</span><svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-audio"></use></svg>`)})}};export{a as CombineAVMenu};
//# sourceMappingURL=CombineAVMenu-CxoKRWm0.js.map