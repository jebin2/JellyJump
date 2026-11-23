import{i as e,r as t}from"./ErrorReporter-BingNHlu.js";import{t as n}from"./Logger-DTrpYznI.js";import{a as r,c as i}from"./Playlist-Hbdb7wPr.js";import{t as a}from"./MediaProcessor-YnonMtyi.js";import{t as o}from"./CustomDropdown-Cs7Q8MM2.js";import{t as s}from"./MenuJob-BkPs8T6g.js";import{n as c}from"./html-BLzzGjX8.js";import{t as l}from"./Templates-DuKuTQ0b.js";l(`<!-- tracks: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Track Management Content Template -->
<template id="track-management-content-template">
    <div class="source-filename text-sm text-muted mb-md font-mono break-all"></div>

    <!-- Loading State -->
    <div class="tracks-loading flex flex-col items-center justify-center p-xl text-muted">
        <div class="spinner-md border-4 border-current border-t-transparent rounded-full w-8 h-8 animate-spin mb-sm">
        </div>
        <span>Scanning media tracks...</span>
    </div>

    <div class="tracks-content hidden">
        <div class="track-section video-tracks-section">
            <h4 class="track-section-title flex items-center gap-sm mb-sm font-bold">
                <span>📹 Video Tracks</span>
                <span class="track-count badge bg-primary text-white text-xs px-xs rounded-full">0</span>
            </h4>
            <div class="track-list video-track-list grid gap-sm">
                <!-- Video tracks injected here -->
                <div class="no-tracks-message text-muted text-sm italic hidden">No video tracks available
                </div>
            </div>
        </div>

        <div class="track-section audio-tracks-section mt-lg">
            <h4 class="track-section-title flex items-center gap-sm mb-sm font-bold">
                <span>🎵 Audio Tracks</span>
                <span class="track-count badge bg-primary text-white text-xs px-xs rounded-full">0</span>
            </h4>
            <div class="track-list audio-track-list grid gap-sm">
                <!-- Audio tracks injected here -->
                <div class="no-tracks-message text-muted text-sm italic hidden">No audio tracks available
                </div>
            </div>
        </div>
    </div>
</template>

<!-- Track Management Footer Template -->
<template id="track-management-footer-template">
    <div class="track-footer-container flex-between items-center w-full gap-md">
        <!-- Status Area (Left) -->
        <div class="track-footer-status flex-1">
            <div class="progress-section hidden flex items-center gap-sm">
                <div class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin">
                </div>
                <span class="progress-status text-sm font-mono text-primary">Processing...</span>
                <span class="progress-percentage text-sm font-bold text-accent">0%</span>
            </div>
            <div class="error-message hidden text-danger text-sm"></div>
            <div class="success-message hidden text-success text-sm font-bold">✓ Added to playlist</div>
        </div>
        <!-- Action Buttons (Right) -->
        <div class="action-buttons flex gap-sm flex-shrink-0">
            <!-- No redundant close button here -->
        </div>
    </div>
</template>

<template id="track-card-template">
    <div class="track-card tool-card">
        <div class="tool-card-header">
            <span class="track-title tool-card-title">Track #<span class="track-index">1</span></span>
            <div class="track-actions flex gap-xs items-center">
                <!-- Speed Menu -->
                <div class="jellyjump-menu-btn mb-speed-dropdown-container">
                    <button class="btn jellyjump-btn-small mb-speed-dropdown-btn" data-speed-btn aria-label="Speed"
                        aria-haspopup="true" aria-expanded="false" title="Playback Speed">
                        1x
                    </button>
                    <div class="jellyjump-menu mb-speed-dropdown" data-speed-menu role="menu">
                        <div class="jellyjump-menu-item" data-value="0.25" role="menuitem" tabindex="0">0.25x</div>
                        <div class="jellyjump-menu-item" data-value="0.5" role="menuitem" tabindex="0">0.5x</div>
                        <div class="jellyjump-menu-item" data-value="0.75" role="menuitem" tabindex="0">0.75x</div>
                        <div class="jellyjump-menu-item active" data-value="1" role="menuitem" tabindex="0">1x</div>
                        <div class="jellyjump-menu-item" data-value="1.25" role="menuitem" tabindex="0">1.25x</div>
                        <div class="jellyjump-menu-item" data-value="1.5" role="menuitem" tabindex="0">1.5x</div>
                        <div class="jellyjump-menu-item" data-value="1.75" role="menuitem" tabindex="0">1.75x</div>
                        <div class="jellyjump-menu-item" data-value="2" role="menuitem" tabindex="0">2x</div>
                    </div>
                </div>
                <button class="btn jellyjump-btn-small download-track-btn" title="Download Track">
                    <svg width="16" height="16" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-download"></use>
                    </svg>
                </button>
                <button class="btn jellyjump-btn-small add-to-playlist-btn" title="Add to Playlist">
                    <svg width="16" height="16" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-plus"></use>
                    </svg>
                </button>
            </div>
        </div>
        <div class="tool-card-grid" style="grid-template-columns: 1fr 1fr 1fr;">
            <div class="tool-card-input">
                <label>Codec</label>
                <span class="meta-codec text-sm">—</span>
            </div>
            <div class="tool-card-input">
                <label>Details</label>
                <span class="meta-details text-sm">—</span>
            </div>
            <div class="tool-card-input">
                <label>Language</label>
                <span class="meta-language text-sm">—</span>
            </div>
        </div>
        <div class="progress-container hidden flex items-center gap-xs text-primary mt-xs">
            <div class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin">
            </div>
            <span class="text-xs font-bold">Extracting...</span>
        </div>
    </div>
</template>
`);var u=class{static async init(i,a){let o=document.getElementById(`track-management-content-template`),s=document.getElementById(`track-management-footer-template`);if(!o||!s)return;let l=r({maxWidth:`700px`});l.setTitle(`Video & Audio Tracks`),l.setBody(o.content.cloneNode(!0)),l.setFooter(s.content.cloneNode(!0));let u=l.modal,d=u.querySelector(`.source-filename`);d.textContent=`Source: ${i.title}`;let f=l.querySelector(`.mb-modal-close-btn`);f&&l.isPanel?f.remove():f&&f.addEventListener(`click`,()=>l.close()),l.open();try{await a.ensureMetadata(i),u.querySelector(`.tracks-loading`).classList.add(`hidden`),u.querySelector(`.tracks-content`).classList.remove(`hidden`);let e={video:i.videoTracks||[],audio:i.audioTracks||[]};this.renderTracks(e,i,u,a,l)}catch(r){if(n.error(`Failed to load tracks:`,r),e.from(r).code===`FILE_MISSING`){l.close(),t.show(`"${i.title}" is no longer available (the browser's storage may have been cleared), so it was removed from the playlist.`,6e3,!0);let e=a.items.indexOf(i);e!==-1&&(a.removeItem(e),n.log(`[TrackManagerMenu] Removed unavailable item: ${i.title}`));return}u.querySelector(`.tracks-loading`).classList.add(`hidden`),u.querySelector(`.mb-modal-body`).insertAdjacentHTML(`beforeend`,String(c`<div class="p-md text-danger">Failed to load tracks: ${r.message}</div>`))}}static renderTracks(e,n,r,i,a){let s=r.querySelector(`.video-track-list`),c=r.querySelector(`.audio-track-list`),l=r.querySelector(`.video-tracks-section .track-count`),u=r.querySelector(`.audio-tracks-section .track-count`),d=r.querySelector(`.video-tracks-section .no-tracks-message`),f=r.querySelector(`.audio-tracks-section .no-tracks-message`);l.textContent=e.video.length,u.textContent=e.audio.length,e.video.length===0&&d.classList.remove(`hidden`),e.audio.length===0&&f.classList.remove(`hidden`);let p=document.getElementById(`track-card-template`),m=[],h=(e,r,s)=>{e.forEach((e,c)=>{let l=p.content.cloneNode(!0).querySelector(`.track-card`);l.querySelector(`.track-index`).textContent=c+1,l.querySelector(`.meta-codec`).textContent=e.codecString||e.codec||`Unknown`,l.querySelector(`.meta-language`).textContent=e.language||`und`;let u=``;u=s===`video`?`${e.width}x${e.height}`:`${e.channels}ch, ${e.sampleRate}Hz`,l.querySelector(`.meta-details`).textContent=u;let d=l.querySelector(`.download-track-btn`),f=l.querySelector(`.add-to-playlist-btn`),h=l.querySelector(`[data-speed-btn]`),g=l.querySelector(`[data-speed-menu]`),_=o.init({button:h,menu:g,initialValue:`1`});m.push(_);let v=`mp4`;if(s===`audio`){let t=(e.codec||``).toLowerCase();v=t.includes(`mp3`)?`mp3`:t.includes(`aac`)||t.includes(`mp4a`)?`m4a`:t.includes(`flac`)?`flac`:t.includes(`pcm`)||t===``?`wav`:`m4a`}d.addEventListener(`click`,()=>{this.extractTrack({index:i.items.indexOf(n),trackIndex:c,trackType:s,format:v,addToPlaylist:!1,speed:parseFloat(_.getValue()),modalInstance:a,playlist:i})}),f.addEventListener(`click`,()=>{let e=parseFloat(_.getValue()),r=v,o=e===1?``:`-${e}x`,l=`${n.title.replace(/\.[^/.]+$/,``)}-${s}-track${c+1}${o}.${r}`;i.items.some(e=>e.title===l)?t.show(`"${l}" is already in the playlist.`,4e3,!0):this.extractTrack({index:i.items.indexOf(n),trackIndex:c,trackType:s,format:v,addToPlaylist:!0,speed:parseFloat(_.getValue()),modalInstance:a,playlist:i})}),r.appendChild(l)})};h(e.video,s,`video`),h(e.audio,c,`audio`),a.onCleanup(()=>{m.forEach(e=>e.destroy())})}static async extractTrack({index:e,trackIndex:t,trackType:n,format:r,addToPlaylist:o,speed:c,modalInstance:l,playlist:u}){let d=u.items[e],f=l.modal;await s({name:`Extract ${n} track ${t+1}`,subject:d.title,background:!0,keepOpen:!0,modal:l,work:async({signal:e,onProgress:o})=>{let s=await i.getSourceBlob(d,()=>u.save());return a.extractTrack({source:s,trackIndex:t,trackType:n,format:r,speed:c,onProgress:o,signal:e})},done:e=>this.handleExtractionSuccess({blob:e,originalItem:d,trackType:n,trackIndex:t,format:r,addToPlaylist:o,speed:c,playlist:u,modal:f})})}static handleExtractionSuccess({blob:e,originalItem:t,trackType:n,trackIndex:r,format:i,addToPlaylist:a,speed:o,playlist:s,modal:c}){let l=i,u=o===1?``:`-${o}x`,d=`${t.title.replace(/\.[^/.]+$/,``)}-${n}-track${r+1}${u}.${l}`,f=c.querySelector(`.progress-section`),p=c.querySelector(`.success-message`);if(a){let r=(t.path||t.title).includes(`/`)?t.path.split(`/`).slice(0,-1).join(`/`)+`/`+d:t.title+`/`+d,i=s.items.indexOf(t);s.insertProcessedItem(t,e,d,{mediaType:n===`video`?`video`:`audio`,extra:{path:r,isAudioOnly:n===`audio`}}),p.classList.remove(`hidden`),f.classList.add(`hidden`),setTimeout(()=>{let e=s.container.querySelector(`[data-index="${i+1}"]`);e&&e.scrollIntoView({behavior:`smooth`,block:`nearest`})},100)}else{let t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=d,document.body.appendChild(n),n.click(),document.body.removeChild(n),f.classList.add(`hidden`)}}};export{u as TrackManagerMenu};
//# sourceMappingURL=TrackManagerMenu-CIi_hrd9.js.map