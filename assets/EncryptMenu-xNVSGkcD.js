const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./MediaProcessor-BvRVLaZH.js","./rolldown-runtime-CEoa-xHZ.js","./Logger-BjianYtO.js","./StreamDetector-DEyq6il_.js","./ErrorReporter-BlPtvWc8.js","./ErrorReporter-CkkKVcRy.css","./preload-helper-qai7ov5E.js","./preload-helper-B8YEJJ5A.css","./html-BLzzGjX8.js","./Modal-CSq-tpOG.js","./MetadataService-CmN_1Bp7.js","./OverlayCompositor-Dg1xyrRe.js","./SubtitleConverter-DGtgNNM5.js"])))=>i.map(i=>d[i]);
import{t as e}from"./Logger-BjianYtO.js";import{c as t,i as n,l as r,o as i,s as a}from"./Playlist-CG29r0ce.js";import{t as o}from"./MenuJob-CIk_0K1S.js";import{r as s}from"./ErrorReporter-BlPtvWc8.js";import{t as c}from"./Templates-DuKuTQ0b.js";import{t as l}from"./preload-helper-qai7ov5E.js";c(`<!-- encrypt: loaded with its tool (ui/menus/core/Templates.js) -->
<!-- Encrypt/Decrypt Content Template -->
<template id="encrypt-content-template">
    <!-- Mode Toggle -->
    <div class="encrypt-mode-section mb-lg">
        <label class="toggle-switch encrypt-mode-toggle">
            <span class="toggle-label label-left">Encrypt</span>
            <input type="checkbox" class="encrypt-mode-checkbox">
            <span class="toggle-slider"></span>
            <span class="toggle-label label-right">Decrypt</span>
        </label>
    </div>

    <!-- Password Input -->
    <div class="encrypt-password-section mb-md">
        <label class="text-secondary text-sm font-mono mb-sm block">PASSWORD:</label>
        <input type="password" class="encrypt-password jellyjump-input w-full" placeholder="Enter password"
            autocomplete="off">
    </div>

    <!-- Confirm Password (encrypt only) -->
    <div class="encrypt-confirm-section mb-md">
        <label class="text-secondary text-sm font-mono mb-sm block">CONFIRM PASSWORD:</label>
        <input type="password" class="encrypt-confirm jellyjump-input w-full" placeholder="Confirm password"
            autocomplete="off">
    </div>

    <!-- Password Hint (encrypt only) -->
    <div class="encrypt-hint-section mb-md">
        <label class="text-secondary text-sm font-mono mb-sm block">HINT (optional):</label>
        <input type="text" class="encrypt-hint jellyjump-input w-full" placeholder="Password hint" autocomplete="off"
            maxlength="200">
    </div>

    <!-- Hint Display (decrypt only, shown if hint exists) -->
    <div class="encrypt-hint-display hidden mb-md">
        <span class="text-secondary text-sm font-mono">HINT:</span>
        <span class="encrypt-hint-value text-sm" style="color: var(--accent-primary); margin-left: 6px;"></span>
    </div>

    <!-- Protection mode (auto-selected by file size, encrypt only) -->
    <div class="encrypt-platform-section mb-md">
        <div class="flex items-center gap-sm mb-xs">
            <span class="encrypt-platform-label text-xs font-mono" style="color:var(--accent-primary);letter-spacing:0.05em;">RE-ENCODING RESISTANT</span>
        </div>
        <p class="encrypt-platform-info text-xs text-secondary">
            Encrypted data is embedded in the carrier video's pixel strip and audio track —
            survives platform re-encoding (Twitter, YouTube, Telegram, etc).<br>
            Estimated output length:
            <span class="encrypt-platform-duration font-mono" style="color:var(--accent-primary);">—</span>.
            Larger files produce longer videos.
        </p>
    </div>

    <!-- Info -->
    <div class="encrypt-info text-xs text-secondary">
        <p class="encrypt-info-text"></p>
        <p class="mt-xs" style="opacity:0.7;">No password recovery — remember your password.</p>
    </div>
</template>
`);var u=class{static async init(c,u){e.log(`Opening Encrypt Modal`);let{modal:d,content:f}=n(`Encrypt / Decrypt`,`encrypt-content-template`,i.encrypt,{maxWidth:`500px`});if(!d)return;let p=f.querySelector(`.encrypt-btn`),m=f.querySelector(`.error-message`);p&&(p.disabled=!0);let h=f.querySelector(`.encrypt-mode-checkbox`),g=f.querySelector(`.encrypt-password`),_=f.querySelector(`.encrypt-confirm`),v=f.querySelector(`.encrypt-confirm-section`),y=f.querySelector(`.encrypt-hint`),b=f.querySelector(`.encrypt-hint-section`),x=f.querySelector(`.encrypt-hint-display`),S=f.querySelector(`.encrypt-hint-value`),C=f.querySelector(`.encrypt-info-text`),w=f.querySelector(`.action-icon-use`),T=f.querySelector(`.encrypt-platform-section`),E=f.querySelector(`.encrypt-platform-label`),D=f.querySelector(`.encrypt-platform-info`),O=`encrypt`,k=null,A=null,j=()=>A?.size??c.fileSize??0,M=()=>j()>r.IN_RAM_PAYLOAD_LIMIT,N=typeof window<`u`&&`showSaveFilePicker`in window,P=()=>{if(T&&(T.style.display=O===`encrypt`?``:`none`,O===`encrypt`&&j())){if(M()&&!N){let e=Math.floor(r.IN_RAM_PAYLOAD_LIMIT/1048576);E&&(E.textContent=`FILE TOO LARGE`),D&&(D.textContent=`Files over ~${e} MB need to stream to disk, which this browser doesn't support. Use the desktop app or a Chromium-based browser.`),p&&(p.disabled=!0)}else if(M())p&&(p.disabled=!1),E&&(E.textContent=`RE-ENCODING RESISTANT (STREAMED)`),D&&(D.textContent=`This file is large — you'll pick a save location and the encrypted carrier video is written straight to disk. Note the carrier is much longer/larger than the original.`);else{p&&(p.disabled=!1),E&&(E.textContent=`RE-ENCODING RESISTANT`),D&&(D.innerHTML=`Encrypted data is embedded in the carrier video's pixel strip and audio track — survives platform re-encoding (Twitter, YouTube, Telegram, etc).<br>Estimated output length: <span class="encrypt-platform-duration font-mono" style="color:var(--accent-primary);">—</span>.`);let e=T.querySelector(`.encrypt-platform-duration`);if(e){let t=r.estimatedDuration(j()),n=Math.floor(t/60),i=Math.round(t%60);e.textContent=n>0?`~${n}m ${i}s`:`~${i}s`}}}},F=()=>{O===`encrypt`?(v.classList.remove(`hidden`),b.classList.remove(`hidden`),x.classList.add(`hidden`),T&&(T.style.display=``),a(p,`Encrypt`),w&&w.setAttribute(`href`,`assets/icons/sprite.svg#icon-lock`),C.textContent=`Encrypts the file into a carrier MP4. External players (VLC, YouTube, etc) show an encrypted banner — only the correct password restores the original.`):(v.classList.add(`hidden`),b.classList.add(`hidden`),T&&(T.style.display=`none`),a(p,`Decrypt`),w&&w.setAttribute(`href`,`assets/icons/sprite.svg#icon-lock-open`),C.textContent=`Decrypts a previously encrypted file. Enter the same password used to encrypt it.`,k&&k.hint?(S.textContent=k.hint,x.classList.remove(`hidden`)):x.classList.add(`hidden`))};h.addEventListener(`change`,()=>{O=h.checked?`decrypt`:`encrypt`,F(),m.classList.add(`hidden`)});try{let n=await t.sourceForReading(c,()=>u.save());typeof n==`string`&&n.startsWith(`blob:`)&&(A=await(await fetch(n)).blob()),k=await r.readMetadata(n),k&&(e.log(`[EncryptMenu] Detected JJC4 file — ${JSON.stringify(k)}`),h.checked=!0,O=`decrypt`)}catch(t){e.log(`[EncryptMenu] Could not read metadata: ${t.message}`)}p&&(p.disabled=!1),F(),P(),p.addEventListener(`click`,async()=>{let n=g.value;if(!n){m.textContent=`Please enter a password.`,m.classList.remove(`hidden`);return}if(O===`encrypt`&&n!==_.value){m.textContent=`Passwords do not match.`,m.classList.remove(`hidden`);return}m.classList.add(`hidden`);let r=O,i=r===`encrypt`?`Encrypt`:`Decrypt`,a=c.title.replace(/\.[^/.]+$/,``)+`-encrypted.mp4`,f=null;if(r===`encrypt`&&M())try{f=await window.showSaveFilePicker({suggestedName:a,types:[{description:`MP4 video`,accept:{"video/mp4":[`.mp4`]}}]})}catch(t){t?.name!==`AbortError`&&e.error(`Save picker failed:`,t);return}let p=y.value.trim()||void 0,h=e=>!Number.isFinite(e)||e<0?``:e>=3600?`${Math.floor(e/3600)}h ${Math.round(e%3600/60)}m`:e>=60?`${Math.floor(e/60)}m ${Math.round(e%60)}s`:`${Math.max(1,Math.round(e))}s`;o({name:i,subject:c.title,background:!0,modal:d,work:async({signal:e,onProgress:o})=>{let s=A||await t.getSourceBlob(c,()=>u.save()),d=(e,t)=>{let n=t?.etaSec===void 0?``:h(t.etaSec);o(e,n?`${n} left · ${Math.round(t.fps)} fps`:`${i}ing…`)},{MediaProcessor:m}=await l(async()=>{let{MediaProcessor:e}=await import(`./MediaProcessor-BvRVLaZH.js`).then(e=>e.n);return{MediaProcessor:e}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12]),import.meta.url);if(r===`encrypt`){let t=await m.encryptPlatform(s,n,{filename:c.title,mimeType:s.type||c.type||`video/mp4`,hint:p,onProgress:d,signal:e,...f?{fileHandle:f}:{}});return{blob:f?null:t,filename:a}}let g=await m.decryptPlatform(s,n,d,e);return{blob:g.blob,filename:g.metadata.name||c.title.replace(/\.[^/.]+$/,``)+`-decrypted`}},done:({blob:e,filename:t})=>{e?u.insertProcessedItem(c,e,t):s.show(`Encrypted and saved to “${t}”.`,5e3)}})})}};export{u as EncryptMenu};
//# sourceMappingURL=EncryptMenu-xNVSGkcD.js.map