const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./DiagnosticsView-D6AEpZU_.js","./Modal-9DB1OaOs.js","./Logger-OMeZj2kG.js","./JobQueue-u3WJsTyI.js","./ErrorReporter-qdKIFi39.js","./ErrorReporter-D47Dymdg.css","./Metrics-BvVG6ZZO.js","./rolldown-runtime-CEoa-xHZ.js"])))=>i.map(i=>d[i]);
import{t as e}from"./Logger-OMeZj2kG.js";import{t}from"./Modal-9DB1OaOs.js";import{$t as n,Yt as r,cn as i,fn as a,gt as o}from"./StreamDetector-lj1Jp1Se.js";import{c as s}from"./Playlist-BTd3Gedo.js";import{t as c}from"./Templates-DuKuTQ0b.js";import{t as l}from"./preload-helper-CCJYESOX.js";c(`<!-- info: loaded with its tool (ui/menus/core/Templates.js) -->
<template id="info-content-template">
    <div class="info-loading flex flex-col items-center justify-center py-xl">
        <div class="loading-spinner mb-md"></div>
        <div class="text-secondary">Loading video information...</div>
    </div>
    <div class="info-modal-content hidden">
        <!-- File Properties -->
        <div class="info-section">
            <div class="info-section-header">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-file"></use>
                </svg>
                <h3 class="info-section-title">File Properties</h3>
            </div>
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">Source</span>
                    <div class="info-value-group">
                        <span class="info-value truncate" data-key="source" title="" style="max-width: 220px;">Local
                            File</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="source">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Filename</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="filename">video.mp4</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="filename">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Format</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="format">MP4</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="format">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">MIME Type</span>
                    <div class="info-value-group">
                        <span class="info-value font-mono text-xs" data-key="mimeType">video/mp4</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="mimeType">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Size</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="size">12.5 MB</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="size">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Duration</span>
                    <div class="info-value-group">
                        <span class="info-value font-mono" data-key="duration">--:--:--</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="duration">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Metadata Tags (hidden if no metadata) -->
        <div class="info-section info-section-metadata hidden" data-section="metadata">
            <div class="info-section-header">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-tag"></use>
                </svg>
                <h3 class="info-section-title">Metadata Tags</h3>
            </div>
            <div class="info-grid">
                <div class="info-row" data-row="metaTitle">
                    <span class="info-label">Title</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaTitle">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaTitle">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaArtist">
                    <span class="info-label">Artist</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaArtist">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaArtist">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaAlbum">
                    <span class="info-label">Album</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaAlbum">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaAlbum">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaDate">
                    <span class="info-label">Date</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaDate">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaDate">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaComment">
                    <span class="info-label">Comment</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaComment">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaComment">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaGenre">
                    <span class="info-label">Genre</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaGenre">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaGenre">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaTrack">
                    <span class="info-label">Track #</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaTrack">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaTrack">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row" data-row="metaEncoder">
                    <span class="info-label">Encoder</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="metaEncoder">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="metaEncoder">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- Cover Art -->
                <div class="info-row info-row-cover hidden" data-row="coverArt">
                    <span class="info-label">Cover Art</span>
                    <div class="info-value-group">
                        <img class="info-cover-art" data-key="coverArt" src="" alt="Cover Art"
                            style="max-width: 80px; max-height: 80px; border-radius: 4px; display: none;" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Video Stream -->
        <div class="info-section">
            <div class="info-section-header">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-video"></use>
                </svg>
                <h3 class="info-section-title">Video Stream</h3>
                <span class="info-track-count text-muted text-xs" data-key="videoTrackCount"></span>
            </div>
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">Codec</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="videoCodec">H.264</span>
                        <span class="info-value-sub font-mono text-xs text-muted"
                            data-key="videoCodecString">avc1.4d401f</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="videoCodec">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Codec Params</span>
                    <div class="info-value-group">
                        <span class="info-value font-mono text-xs text-muted" data-key="videoCodecParam">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="videoCodecParam">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Decode Support</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="videoCanDecode">—</span>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Resolution</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="resolution">1920x1080</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="resolution">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Aspect Ratio</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="aspectRatio">16:9</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="aspectRatio">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Pixel Aspect Ratio</span>
                    <div class="info-value-group">
                        <span class="info-value text-muted" data-key="pixelAspectRatio">1:1</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="pixelAspectRatio">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Coded Resolution</span>
                    <div class="info-value-group">
                        <span class="info-value text-muted" data-key="codedResolution">1920x1088</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="codedResolution">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Frame Rate</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="fps">30 fps</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="fps">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Frame Count</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="frameCount">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="frameCount">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Bitrate</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="videoBitrate">5.2 Mbps</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="videoBitrate">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Rotation</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="rotation">0°</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="rotation">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">HDR</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="hdr">No</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="hdr">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Color Space</span>
                    <div class="info-value-group">
                        <span class="info-value text-muted" data-key="colorSpace">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="colorSpace">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Audio Stream -->
        <div class="info-section">
            <div class="info-section-header">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-headphones"></use>
                </svg>
                <h3 class="info-section-title">Audio Stream</h3>
                <span class="info-track-count text-muted text-xs" data-key="audioTrackCount"></span>
            </div>
            <div class="info-grid">
                <div class="info-row">
                    <span class="info-label">Codec</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="audioCodec">AAC</span>
                        <span class="info-value-sub font-mono text-xs text-muted"
                            data-key="audioCodecString">mp4a.40.2</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="audioCodec">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Codec Params</span>
                    <div class="info-value-group">
                        <span class="info-value font-mono text-xs text-muted" data-key="audioCodecParam">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="audioCodecParam">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Decode Support</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="audioCanDecode">—</span>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Channels</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="channels">Stereo (2)</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="channels">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Sample Rate</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="sampleRate">48 kHz</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="sampleRate">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Bitrate</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="audioBitrate">—</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="audioBitrate">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="info-row">
                    <span class="info-label">Language</span>
                    <div class="info-value-group">
                        <span class="info-value" data-key="language">English (eng)</span>
                        <button class="info-copy-btn copy-btn" title="Copy" data-copy="language">
                            <svg width="12" height="12" fill="currentColor">
                                <use href="assets/icons/sprite.svg#icon-copy"></use>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<!-- Info Footer Template -->
<template id="info-footer-template">
    <div class="info-footer-container flex-between items-center w-full gap-md">
        <!-- Status Area (Left) -->
        <div class="info-footer-status flex-1">
            <div class="success-message hidden text-success text-sm font-bold flex items-center gap-xs">
                <svg width="14" height="14" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-check"></use>
                </svg>
                <span>Copied to clipboard</span>
            </div>
        </div>
        <!-- Action Buttons (Right) -->
        <div class="action-buttons flex gap-sm flex-shrink-0">
            <button class="btn jellyjump-btn-small diagnostics-btn" title="About this device and build, for a bug report">Diagnostics</button>
            <button class="btn jellyjump-btn-small copy-all-btn" title="Copy All Info" aria-label="Copy All Info">
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-copy"></use>
                </svg>
            </button>
        </div>
    </div>
</template>
`);function u(e){let t=Math.floor(e||0),n=Math.floor(t/3600),r=Math.floor(t%3600/60),i=t%60,a=e=>String(e).padStart(2,`0`);return n?`${n}:${a(r)}:${a(i)}`:`${r}:${a(i)}`}var d=class{static async init(c,d){let f=document.getElementById(`info-content-template`),p=document.getElementById(`info-footer-template`);if(!f)return;let m=new t({maxWidth:`600px`});m.setTitle(`Video Information`),m.setBody(f.content.cloneNode(!0)),p&&m.setFooter(p.content.cloneNode(!0));let h=m.modal,g=h.querySelector(`.info-loading`),_=h.querySelector(`.info-modal-content`),v=h.querySelectorAll(`.copy-btn`),y=h.querySelector(`.copy-all-btn`);h.querySelector(`.diagnostics-btn`)?.addEventListener(`click`,async()=>{let{DiagnosticsView:e}=await l(async()=>{let{DiagnosticsView:e}=await import(`./DiagnosticsView-D6AEpZU_.js`);return{DiagnosticsView:e}},__vite__mapDeps([0,1,2,3,4,5,6,7]),import.meta.url);e.open()}),m.open();try{if(c.isYouTube){let e=d.player,t=e?.engine===`youtube`&&e?.duration>0,n={source:c.url||`Unknown`,filename:c.title,format:`YouTube`,mimeType:`text/html`,size:`N/A`,duration:t?u(e.duration):`N/A`,metaTitle:c.title||`N/A`,metaArtist:`N/A`,metaAlbum:`N/A`,metaDate:`N/A`,metaComment:`Video ID ${c.youtubeId}`+(c.youtubeStart?`, starts at ${c.youtubeStart}s`:``),videoCodec:`N/A`,videoCodecString:`N/A`,resolution:`N/A`,aspectRatio:`N/A`,codedResolution:`N/A`,fps:`N/A`,frameCount:`N/A`,videoBitrate:`N/A`,rotation:`N/A`,hdr:`N/A`,colorSpace:`N/A`,videoTrackCount:``,audioCodec:`N/A`,audioCodecString:`N/A`,channels:`N/A`,sampleRate:`N/A`,audioBitrate:`N/A`,language:`N/A`,audioTrackCount:``};g&&g.classList.add(`hidden`),_&&_.classList.remove(`hidden`),Object.keys(n).forEach(e=>{let t=h.querySelector(`[data-key="${e}"]`);if(!t)return;t.textContent=n[e];let r=t.parentElement.querySelector(`.copy-btn`);r&&(r.dataset.value=n[e]),e===`source`&&(t.title=n[e])}),m.body&&(m.body.dataset.rawInfo=JSON.stringify(n));return}if(c.isStream||c.isLive){let e=d.player&&d.player.src===c.url,t=`N/A`;if(e&&d.player.videoElement){let e=d.player.videoElement;e.videoWidth&&(t=`${e.videoWidth}x${e.videoHeight}`)}let n={source:c.url||`Unknown`,filename:c.title,format:`Stream (HLS/M3U8)`,mimeType:c.mimeType||`application/vnd.apple.mpegurl`,size:`N/A`,duration:`LIVE`,metaTitle:`N/A`,metaArtist:`N/A`,metaAlbum:`N/A`,metaDate:`N/A`,metaComment:`N/A`,videoCodec:`N/A`,videoCodecString:`N/A`,resolution:t,aspectRatio:`N/A`,codedResolution:`N/A`,fps:`N/A`,frameCount:`N/A`,videoBitrate:`N/A`,rotation:`N/A`,hdr:`N/A`,colorSpace:`N/A`,videoTrackCount:``,audioCodec:`N/A`,audioCodecString:`N/A`,channels:`N/A`,sampleRate:`N/A`,audioBitrate:`N/A`,language:`N/A`,audioTrackCount:``};g&&g.classList.add(`hidden`),_&&_.classList.remove(`hidden`),Object.keys(n).forEach(e=>{let t=h.querySelector(`[data-key="${e}"]`);if(t){t.textContent=n[e];let r=t.parentElement.querySelector(`.copy-btn`);r&&(r.dataset.value=n[e]),e===`source`&&(t.title=n[e])}}),m.body&&(m.body.dataset.rawInfo=JSON.stringify(n));return}if(await d.ensureMetadata(c),!m.overlay)return;let t=(e,t=1)=>{if(e===0)return`0 Bytes`;let n=1024,r=t<0?0:t,i=[`Bytes`,`KB`,`MB`,`GB`,`TB`],a=Math.floor(Math.log(e)/Math.log(n));return parseFloat((e/n**a).toFixed(r))+` `+i[a]},l=`Unknown`;if(c.fileSize)l=t(c.fileSize);else if(c.file)l=t(c.file.size);else if(c.url)try{let e=(await fetch(c.url,{method:`HEAD`})).headers.get(`content-length`);e&&(l=t(parseInt(e)))}catch{l=`Unknown`}let f=`Unknown`,p=`Unknown`;c.videoInfo&&(c.videoInfo.fps&&(f=`${c.videoInfo.fps} fps`),c.videoInfo.bitrate&&(p=`${(c.videoInfo.bitrate/1e6).toFixed(1)} Mbps`));let v=c.fileType||(c.file?c.file.type:`Unknown`),y=v===`Unknown`?`Unknown`:v.split(`/`)[0],b=c.isLocal?`Local File`:c.url||`Unknown`,x=c.videoInfo?((e,t)=>{if(!e||!t)return`N/A`;let n=(e,t)=>t?n(t,e%t):e,r=n(e,t),i=e/r,a=t/r,o=e/t;return Math.abs(o-16/9)<.01?`16:9`:Math.abs(o-4/3)<.01?`4:3`:Math.abs(o-21/9)<.01?`21:9`:Math.abs(o-9/16)<.01?`9:16`:Math.abs(o-1)<.01?`1:1`:`${i}:${a}`})(c.videoInfo.width,c.videoInfo.height):`N/A`,S=c.videoTracks?`(${c.videoTracks.length} track${c.videoTracks.length===1?``:`s`})`:``,C=c.audioTracks?`(${c.audioTracks.length} track${c.audioTracks.length===1?``:`s`})`:``,w={title:null,artist:null,album:null,date:null,comment:null,genre:null,track:null,encoder:null},T=null,E=`N/A`,D=`N/A`,O=`N/A`,k=c.videoInfo?c.videoInfo.hasHDR:!1,A=`N/A`,j=`N/A`,M=`N/A`,N=`N/A`,P=`N/A`;try{let t=await s.sourceForReading(c),l;l=typeof t==`string`?new r(t):new a(t);let u=new n({source:l,formats:i});try{let t=await u.getMetadataTags();if(t&&(w.title=t.title||null,w.artist=t.artist||null,w.album=t.album||null,w.date=t.date||null,w.comment=t.comment||null,w.genre=t.genre||null,w.track=t.track||null,w.encoder=t.encoder||t.raw?.ENCODER||t.raw?.encoder||null,t.images&&t.images.length>0))try{let e=t.images[0];if(e.data){let t=new Blob([e.data],{type:e.mimeType||`image/jpeg`});T=URL.createObjectURL(t)}}catch(t){e.warn(`Failed to extract cover art:`,t)}let n=await u.getPrimaryVideoTrack();if(n){try{let e=await n.computePacketStats();e&&e.packetCount&&(E=e.packetCount.toLocaleString())}catch(t){e.warn(`Failed to compute video packet stats:`,t)}try{let e=await n.getColorSpace();if(e){let t=[];e.primaries&&t.push(e.primaries),e.matrix&&t.push(e.matrix),e.transfer&&t.push(e.transfer),t.length>0&&(O=t.join(` / `))}}catch(t){e.warn(`Failed to get color space:`,t)}try{k=await n.hasHighDynamicRange()}catch{}try{A=await n.getCodecParameterString()||`N/A`}catch(t){e.warn(`Failed to get video codec param:`,t)}try{M=await n.canDecode()?`✅ Supported`:`❌ Not Supported`}catch{M=`❓ Unknown`}try{let e=n.pixelAspectRatio;e&&(P=e.num===1&&e.den===1?`1:1 (Square Pixels)`:`${e.num}:${e.den}`)}catch(t){e.warn(`Failed to get pixel aspect ratio:`,t)}}let r=await u.getPrimaryAudioTrack();if(r){try{let e=await r.getAverageBitrate()||(await r.computePacketStats(50)).averageBitrate;e&&(D=`${Math.round(e/1e3)} kbps`)}catch(t){e.warn(`Failed to determine audio bitrate:`,t)}try{j=await r.getCodecParameterString()||`N/A`}catch(t){e.warn(`Failed to get audio codec param:`,t)}try{await o([r]),N=await r.canDecode()?`✅ Supported`:`❌ Not Supported`}catch{N=`❓ Unknown`}}}finally{if(u&&typeof u.dispose==`function`)try{u.dispose()}catch{}}}catch(t){e.warn(`Failed to fetch extended metadata:`,t)}let F={source:b,filename:c.title,format:y,mimeType:v,size:l,duration:c.duration||`Unknown`,metaTitle:w.title||`—`,metaArtist:w.artist||`—`,metaAlbum:w.album||`—`,metaDate:w.date||`—`,metaComment:w.comment||`—`,metaGenre:w.genre||`—`,metaTrack:w.track||`—`,metaEncoder:w.encoder||`—`,coverArt:T,videoCodec:c.videoInfo?c.videoInfo.codec.toUpperCase():`N/A`,videoCodecString:c.videoInfo?c.videoInfo.codec:`N/A`,resolution:c.videoInfo?`${c.videoInfo.width}x${c.videoInfo.height}`:`N/A`,aspectRatio:x,pixelAspectRatio:P,codedResolution:c.videoInfo?`${c.videoInfo.codedWidth}x${c.videoInfo.codedHeight}`:`N/A`,fps:f,frameCount:E,videoBitrate:p,rotation:c.videoInfo?`${c.videoInfo.rotation}°`:`N/A`,hdr:k?`Yes`:`No`,colorSpace:O,videoCodecParam:A,videoCanDecode:M,videoTrackCount:S,audioCodec:c.audioInfo?c.audioInfo.codec.toUpperCase():`N/A`,audioCodecString:c.audioInfo?c.audioInfo.codec:`N/A`,channels:c.audioInfo?c.audioInfo.channels===2?`Stereo (2)`:`${c.audioInfo.channels} Channels`:`N/A`,sampleRate:c.audioInfo?`${(c.audioInfo.sampleRate/1e3).toFixed(1)} kHz`:`N/A`,audioBitrate:D,language:c.audioInfo?c.audioInfo.languageCode===`und`?`Undetermined`:c.audioInfo.languageCode:`N/A`,audioCodecParam:j,audioCanDecode:N,audioTrackCount:C};g&&g.classList.add(`hidden`),_&&_.classList.remove(`hidden`),Object.keys(F).forEach(e=>{let t=h.querySelector(`[data-key="${e}"]`);if(t){t.textContent=F[e];let n=t.parentElement.querySelector(`.copy-btn`);n&&(n.dataset.value=F[e]),e===`source`&&(t.title=F[e])}}),m.body&&(m.body.dataset.rawInfo=JSON.stringify(F));let I=w.title||w.artist||w.album||w.date||w.comment||w.genre||w.track||w.encoder||T,L=h.querySelector(`[data-section="metadata"]`);if(L&&I&&(L.classList.remove(`hidden`),[`metaTitle`,`metaArtist`,`metaAlbum`,`metaDate`,`metaComment`,`metaGenre`,`metaTrack`,`metaEncoder`].forEach(e=>{let t=L.querySelector(`[data-row="${e}"]`);if(t){let n=F[e];n&&n!==`—`||t.classList.add(`hidden`)}}),T)){let e=L.querySelector(`[data-row="coverArt"]`),t=L.querySelector(`[data-key="coverArt"]`);e&&t&&(e.classList.remove(`hidden`),t.src=T,t.style.display=`block`)}}catch(t){e.error(`Failed to load video info:`,t),g&&g.classList.add(`hidden`),_&&_.classList.remove(`hidden`)}let b=(e=`Copied to clipboard`)=>{let t=h.querySelector(`.success-message`);t&&(t.querySelector(`span`).textContent=e,t.classList.remove(`hidden`),setTimeout(()=>{t.classList.add(`hidden`)},2e3))};v.forEach(t=>{t.addEventListener(`click`,async()=>{let n=t.dataset.value;if(n)try{await navigator.clipboard.writeText(n),b(`Copied to clipboard`)}catch(t){e.error(`Failed to copy:`,t)}})}),y&&y.addEventListener(`click`,async()=>{try{let e=JSON.parse(m.body.dataset.rawInfo||`{}`),t=`Video Information
-----------------
Filename: ${e.filename}
Format: ${e.format}
MIME Type: ${e.mimeType}
Size: ${e.size}
Duration: ${e.duration}

Video Stream
------------
Codec: ${e.videoCodec} (${e.videoCodecString})
Resolution: ${e.resolution} (Coded: ${e.codedResolution})
Pixel Aspect Ratio: ${e.pixelAspectRatio}
Frame Rate: ${e.fps}
Bitrate: ${e.videoBitrate}
Rotation: ${e.rotation}
HDR: ${e.hdr}
Color Space: ${e.colorSpace}
Frame Count: ${e.frameCount}
${e.videoTrackCount?`Tracks: ${e.videoTrackCount}`:``}
${e.metaTitle&&e.metaTitle!==`—`?`
Metadata Tags
-------------
Title: ${e.metaTitle}
Artist: ${e.metaArtist}
Album: ${e.metaAlbum}
Date: ${e.metaDate}
Comment: ${e.metaComment}`:``}

Audio Stream
------------
Codec: ${e.audioCodec} (${e.audioCodecString})
Channels: ${e.channels}
Sample Rate: ${e.sampleRate}
Bitrate: ${e.audioBitrate}
Language: ${e.language}
${e.audioTrackCount?`Tracks: ${e.audioTrackCount}`:``}
`;await navigator.clipboard.writeText(t),b(`All info copied`)}catch(t){e.error(`Failed to copy all:`,t)}})}};export{d as InfoMenu};
//# sourceMappingURL=InfoMenu-U5CjzFGl.js.map