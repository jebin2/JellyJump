import{t as e}from"./MediaProcessor-VrfbyMF4.js";import{c as t,i as n,o as r}from"./Playlist-BFks0Th_.js";import{$ as i,tt as a}from"./StreamDetector-BX2eEpeJ.js";import{a as o,r as s,t as c}from"./DecorationLayer-BPRzyDw-.js";import{t as l}from"./MenuJob-DZJJ6bE3.js";import{n as u}from"./html-BLzzGjX8.js";import{t as d}from"./Templates-DuKuTQ0b.js";d(`<!-- export-fx: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Export with the on-screen effects baked into the file -->
<template id="export-fx-content-template">
    <div class="modal-controls-panel">
        <div class="flex flex-col gap-md p-md">
            <div class="control-group">
                <label class="text-xs text-secondary font-mono mb-sm block">BAKED INTO THE FILE</label>
                <ul class="export-fx-summary flex flex-col gap-xs text-sm"></ul>
                <p class="export-fx-empty hidden text-xs text-muted">
                    Nothing is applied yet. Open the filter panel on the player and add a
                    colour effect, a sticker, a border or some rain, then come back.
                </p>
            </div>

            <div class="export-fx-subtitles hidden control-group">
                <label class="text-xs text-secondary font-mono mb-sm block">SUBTITLES</label>
                <label class="checkbox-option" title="Written as tracks viewers can turn on and off, not burned into the picture.">
                    <input type="checkbox" id="export-fx-subtitles-toggle" checked>
                    <span class="checkbox-label text-sm export-fx-subtitles-label"></span>
                </label>
            </div>

            <div class="w-full h-px bg-border my-sm"></div>

            <div class="control-group">
                <label class="text-xs text-secondary font-mono mb-sm block">RANGE</label>
                <div class="tool-card-times">
                    <div class="tool-card-input">
                        <label>Start</label>
                        <input type="text" id="export-fx-start" class="mb-input font-mono" placeholder="0:00.000">
                    </div>
                    <div class="tool-card-input">
                        <label>End</label>
                        <input type="text" id="export-fx-end" class="mb-input font-mono" placeholder="0:00.000">
                    </div>
                </div>
                <p class="text-xs text-muted mt-sm">Leave these alone to export the whole video.</p>
            </div>

            <p class="export-fx-note text-xs text-muted">
                Re-encodes the video, so it takes a while and the picture is rebuilt rather
                than copied. The audio is carried over untouched.
            </p>
        </div>
    </div>
</template>
`);var f=class d{static async init(o,s){let c=s.player,f=s.items[s.activeIndex],p=!!c&&!!f&&f.id===o.id,{modal:m,content:h}=n(`Export with effects`,`export-fx-content-template`,r.exportFx);if(!m)return;let g=h.querySelector(`.export-fx-summary`),_=h.querySelector(`.export-fx-empty`),v=h.querySelector(`#export-fx-start`),y=h.querySelector(`#export-fx-end`),b=h.querySelector(`.export-fx-btn`),x=h.querySelector(`.download-btn`),S=p?(c.subtitles?.tracks??[]).filter(e=>e.cues?.length):[],C=h.querySelector(`#export-fx-subtitles-toggle`);if(S.length){let e=S.map(e=>e.name).join(`, `);h.querySelector(`.export-fx-subtitles-label`).textContent=`Include ${S.length===1?`the subtitle track`:`${S.length} subtitle tracks`} (${e})`,h.querySelector(`.export-fx-subtitles`).classList.remove(`hidden`)}p?m.isPanel&&(_.textContent=`Nothing is applied yet. Add a colour effect, a sticker, a border or some rain with the player's Filters button.`):_.textContent=`Play this video first. The effects live on the player, so they can only be baked into the video that is on screen.`;let w=()=>{let e=p?d._describe(c):[];g.innerHTML=u`${e.map(e=>u`<li>${e}</li>`)}`;let t=!p||e.length===0&&!S.length;_.classList.toggle(`hidden`,!t),b.disabled=t};if(w(),m.isPanel&&p&&c.container){let e=0,t=()=>{cancelAnimationFrame(e),e=requestAnimationFrame(w)};for(let e of[`input`,`change`,`click`])c.container.addEventListener(e,t);m.onCleanup(()=>{cancelAnimationFrame(e);for(let e of[`input`,`change`,`click`])c.container.removeEventListener(e,t)})}await s.ensureMetadata(o);let T=0;typeof o.duration==`string`&&o.duration!==`--:--`&&(T=a(o.duration)),v.value=i(0),y.value=i(T),b.addEventListener(`click`,async()=>{let n=c.videoFilters,r=n?Object.assign(Object.create(Object.getPrototypeOf(n)),n):null;await l({name:`Export FX`,subject:o.title,background:!0,modal:m,failureText:e=>e.message||`Export failed.`,work:async({signal:n,onProgress:i})=>{let l=a(v.value)||0,u=a(y.value)||T;if(!(u>l))throw Error(`The end has to come after the start.`);let d=await t.getSourceBlob(o,()=>s.save());return{blob:await e.process({source:d,format:`mp4`,quality:100,...l>0||u<T?{trim:{start:l,end:u}}:{},overlays:{filters:r,stickers:c.stickers,decorations:c.decorations},subtitles:S.length&&C?.checked?S.map(e=>({name:e.name,cues:e.cues})):null,onProgress:i,signal:n}),start:l,end:u}},done:({blob:e,start:t,end:n})=>{let r=`${o.title.replace(/\.[^/.]+$/,``)} - effects.mp4`,{url:a}=s.insertProcessedItem(o,e,r,{type:`video/mp4`,duration:i(n-t)});x.href=a,x.download=r,x.classList.remove(`hidden`)}})})}static _describe(e){let t=[],n=e.videoFilters;if(n?.isActive?.()){let e=n.effect?n.effects[n.effect]?.label:null,r=n.brightness!==100||n.contrast!==100||n.saturation!==100||n.sepia>0||n.grayscale>0||n.hueRotate!==0||n.blur>0||n.invert>0;e&&t.push(`Effect: ${e}`),r&&t.push(`Colour adjustments`)}let r=e.stickers?.stickers??[];if(r.length){let e=r.filter(e=>o[e.motion]).length;t.push(`${r.length} sticker${r.length===1?``:`s`}`+(e?`, ${e} moving`:``))}let i=e.decorations;return i?.border&&t.push(`Border: ${c[i.border]?.label??i.border}`),i?.rain&&t.push(`${s[i.rain]?.label??i.rain} (${i.density} at a time)`),t}};export{f as ExportMenu};
//# sourceMappingURL=ExportMenu-lr2qd-Be.js.map