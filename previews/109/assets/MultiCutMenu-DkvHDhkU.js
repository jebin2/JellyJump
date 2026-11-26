import{t as e}from"./MediaProcessor-D5hiAXh_.js";import{c as t,i as n,o as r}from"./Playlist-CIZc97jx.js";import{ct as i,ut as a}from"./StreamDetector-Hh5mQB2k.js";import{t as o}from"./MenuJob-7mzT9oz_.js";import{o as s,t as c}from"./PreviewPlayer-C4lUVsTQ.js";import{t as l}from"./Templates-DuKuTQ0b.js";l(`<!-- multicut: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- MultiCut Content Template -->
<template id="multicut-content-template">
    <div class="multicut-loading flex flex-col items-center justify-center p-xl text-muted"
        style="grid-column: 1 / -1;">
        <div class="spinner-md border-4 border-current border-t-transparent rounded-full w-8 h-8 animate-spin mb-sm">
        </div>
        <span>Loading video info...</span>
    </div>

    <div class="multicut-content hidden" style="display: contents;">
        <div class="modal-controls-panel">
            <button id="multicut-add-clip-btn" class="jellyjump-btn-large w-full mb-md">+ Add Segments</button>

            <div class="duration-display bg-tertiary p-sm rounded border border-border mb-md">
                <span class="text-xs text-secondary font-mono block mb-xs">REMAINING DURATION</span>
                <span class="multicut-total-duration text-accent font-bold text-lg">00:00:00</span>
            </div>

            <div id="multicut-clips-list" class="tool-cards-list">
            </div>
        </div>
    </div>
</template>
`);var u=class{static async init(l,u){let{modal:d,content:f}=n(`Multi-Cut`,`multicut-content-template`,r.multicut);if(!d)return;let p=f.querySelector(`.multicut-loading`),m=f.querySelector(`.multicut-content`),h=f.querySelector(`#multicut-clips-list`),g=f.querySelector(`#multicut-add-clip-btn`),_=f.querySelector(`.multicut-total-duration`),v=f.querySelector(`.multicut-btn`),y=f.querySelector(`.download-btn`);v.disabled=!0,await u.ensureMetadata(l);let b=0;l.duration&&typeof l.duration==`string`&&l.duration!==`--:--`&&(b=a(l.duration));let x=[],S=null,C=-1,w=()=>{},T=()=>{w(x,b);let e=x.reduce((e,t)=>e+(t.end-t.start),0),t=b-e;_.textContent=i(t),v.disabled=x.length===0},E=()=>{h.innerHTML=x.map((e,t)=>`
                <div class="tool-card ${t===C?`active`:``}" data-index="${t}">
                    <div class="tool-card-header">
                        <span class="tool-card-title">Segment ${t+1}</span>
                        <button class="tool-card-remove" data-index="${t}">&times;</button>
                    </div>
                    <div class="tool-card-times">
                        <div class="tool-card-input">
                            <label>Start</label>
                            <input type="text" class="clip-start-input font-mono" data-index="${t}" value="${i(e.start)}">
                            <button class="clip-set-start-btn jellyjump-btn-small" data-index="${t}" title="Set the start to the current time">Start here</button>
                        </div>
                        <div class="tool-card-input">
                            <label>End</label>
                            <input type="text" class="clip-end-input font-mono" data-index="${t}" value="${i(e.end)}">
                            <button class="clip-set-end-btn jellyjump-btn-small" data-index="${t}" title="Set the end to the current time">End here</button>
                        </div>
                    </div>
                    <div class="tool-card-info">Duration: ${i(e.end-e.start)}</div>
                </div>
            `).join(``),h.querySelectorAll(`.tool-card-remove`).forEach(e=>{e.addEventListener(`click`,e=>{let t=parseInt(e.target.dataset.index);x.splice(t,1),C>=x.length&&(C=x.length-1),E(),T()})}),h.querySelectorAll(`.clip-start-input`).forEach(e=>{e.addEventListener(`change`,e=>{let t=parseInt(e.target.dataset.index),n=a(e.target.value);n!==null&&(x[t].start=Math.max(0,Math.min(n,x[t].end-1)),E(),T(),S&&t===C&&S.seek(x[t].start))})}),h.querySelectorAll(`.clip-end-input`).forEach(e=>{e.addEventListener(`change`,e=>{let t=parseInt(e.target.dataset.index),n=a(e.target.value);n!==null&&(x[t].end=Math.max(x[t].start+1,Math.min(n,b)),E(),T(),S&&t===C&&S.seek(x[t].end))})}),h.querySelectorAll(`.clip-set-start-btn`).forEach(e=>{e.addEventListener(`click`,e=>{let t=parseInt(e.target.dataset.index);S&&(x[t].start=Math.max(0,Math.min(S.currentTime,x[t].end-1)),E(),T())})}),h.querySelectorAll(`.clip-set-end-btn`).forEach(e=>{e.addEventListener(`click`,e=>{let t=parseInt(e.target.dataset.index);S&&(x[t].end=Math.max(x[t].start+1,Math.min(S.currentTime,b)),E(),T())})}),h.querySelectorAll(`.tool-card`).forEach(e=>{e.addEventListener(`click`,t=>{if(t.target.tagName===`INPUT`||t.target.tagName===`BUTTON`)return;let n=parseInt(e.dataset.index);C=n,E(),S&&S.seek(Math.max(0,x[n].start-2))})})};if(S=c(d,u),w=s(S,d),S){let e=e=>{if(x.length===0)return;let t=S.currentTime,n=[...x].sort((e,t)=>e.start-t.start),r=!1,i=b;for(let e of n){if(t>=e.start&&t<e.end){r=!0,i=e.end;break}if(e.start>t){i=e.start;break}}r&&i-t>.05&&S.seek(i)};S.on&&S.on(`timeupdate`,e),d.onCleanup(()=>{S.off&&S.off(`timeupdate`,e)})}p.classList.add(`hidden`),m.classList.remove(`hidden`),T(),g.addEventListener(`click`,()=>{let e=x.length>0?x[x.length-1].end:0,t={start:e,end:Math.min(e+10,b)};x.push(t),C=x.length-1,E(),T(),S&&S.seek(t.start)}),v.addEventListener(`click`,async()=>{x.length!==0&&(f.classList.add(`processing`),await o({name:`Multi-Cut`,subject:l.title,background:!0,modal:d,work:async({signal:n,onProgress:r})=>{let i=await t.getSourceBlob(l,()=>u.save()),a=[...x].sort((e,t)=>e.start-t.start),o=[],s=0;for(let e of a)e.start>s&&o.push({start:s,end:e.start}),s=e.end;if(s<b&&o.push({start:s,end:b}),o.length===0)throw Error(`No video remaining after removing all clips`);let c=(t,r)=>e.process({source:i,format:`mp4`,quality:100,trim:{start:t.start,end:t.end},onProgress:r,signal:n}),d;if(o.length===1)d=await c(o[0],r);else{let t=.8/o.length,i=[];for(let e=0;e<o.length;e++)i.push(await c(o[e],n=>r(e*t+n*t)));d=await e.merge({inputs:i,format:`mp4`,onProgress:e=>r(.8+e*.2),signal:n})}let f=o.reduce((e,t)=>e+(t.end-t.start),0);return{blob:d,remaining:f}},done:({blob:e,remaining:t})=>{let n=l.title.replace(/\.[^/.]+$/,``)+`-${x.length}-removed.mp4`,{url:r}=u.insertProcessedItem(l,e,n,{type:`video/mp4`,duration:i(t)});y.href=r,y.download=n,y.classList.remove(`hidden`)}}))})}};export{u as MultiCutMenu};
//# sourceMappingURL=MultiCutMenu-DkvHDhkU.js.map