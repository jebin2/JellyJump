const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./ShareMenu-DHsAUTm6.js","./ShareState-DBLdaA_B.js","./Logger-C6IhgouS.js","./Toast-DCdtzuiq.js","./Modal-BE06rcvs.js","./ScreenRecorderMenu-ChF7L8aX.js","./defineProperty-BDeJkQjj.js","./MergeMenu-Da2Vxrvk.js","./mediabunny-C0EeaCOn.js","./MediaBunny-BTN-c6AO.js","./preload-helper-DDNUbuXK.js","./MediaProcessor-CsfgJNgq.js","./MediaMetadata-CLhLTj8I.js","./mediaUtils-Inj5iaJP.js","./SlideshowMenu-Csj7X2wY.js","./CustomDropdown-DKyNYDN9.js","./MenuFactory-p3xY8Nvh.js","./CombineAVMenu-f2LlQxkV.js"])))=>i.map(i=>d[i]);
import{t as e}from"./preload-helper-DDNUbuXK.js";import{t}from"./Logger-C6IhgouS.js";import{t as n}from"./Modal-BE06rcvs.js";var r=class{static async show(r){let i=new n({maxWidth:`320px`});i.setTitle(`Tools`);let a=document.createElement(`div`);a.className=`tools-grid`,a.innerHTML=`
            <button class="tools-tile" data-action="screen-record" title="Record Screen">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-record"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Record Screen</span>
            </button>
            <button class="tools-tile" data-action="camera-record" title="Camera Recording">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-camera"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Camera</span>
            </button>
            <button class="tools-tile" data-action="merge" title="Merge Videos">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-copy"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Merge Videos</span>
            </button>
            <button class="tools-tile" data-action="slideshow" title="Images to Video">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-image"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Slideshow</span>
            </button>
            <button class="tools-tile" data-action="combine-av" title="Combine Audio/Video">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-audio"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Combine A/V</span>
            </button>
            <button class="tools-tile" data-action="share" title="Share Library">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-link"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Share Library</span>
            </button>
            <button class="tools-tile tools-tile-danger" data-action="reset" title="Reset App">
                <div class="tools-tile-icon">
                    <svg width="24" height="24" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-trash"></use>
                    </svg>
                </div>
                <span class="tools-tile-label">Reset App</span>
            </button>
        `,i.setBody(a);let{ShareMenu:o}=await e(async()=>{let{ShareMenu:e}=await import(`./ShareMenu-DHsAUTm6.js`);return{ShareMenu:e}},__vite__mapDeps([0,1,2,3,4]),import.meta.url),s=a.querySelector(`[data-action="share"]`);if(!o.isSupported())s?.remove();else if(s){let{ShareState:t}=await e(async()=>{let{ShareState:e}=await import(`./ShareState-DBLdaA_B.js`);return{ShareState:e}},__vite__mapDeps([1,2]),import.meta.url),n=e=>{s.classList.toggle(`sharing-active`,e);let t=s.querySelector(`.tools-tile-label`);t&&(t.textContent=e?`Sharing`:`Share Library`)};n(t.isSharing),t.refresh().then(n)}a.querySelectorAll(`.tools-tile`).forEach(n=>{n.addEventListener(`click`,async a=>{let s=n.dataset.action;if(i.close(),s===`screen-record`){let{ScreenRecorderMenu:t}=await e(async()=>{let{ScreenRecorderMenu:e}=await import(`./ScreenRecorderMenu-ChF7L8aX.js`);return{ScreenRecorderMenu:e}},__vite__mapDeps([5,6,2,3]),import.meta.url);t.showOptions(r)}else if(s===`camera-record`){let{ScreenRecorderMenu:t}=await e(async()=>{let{ScreenRecorderMenu:e}=await import(`./ScreenRecorderMenu-ChF7L8aX.js`);return{ScreenRecorderMenu:e}},__vite__mapDeps([5,6,2,3]),import.meta.url);t.showCameraOptions(r)}else if(s===`merge`){let{MergeMenu:t}=await e(async()=>{let{MergeMenu:e}=await import(`./MergeMenu-Da2Vxrvk.js`);return{MergeMenu:e}},__vite__mapDeps([7,8,9,10,2,11,12,13,4]),import.meta.url);t.init(null,r)}else if(s===`slideshow`){let{SlideshowMenu:t}=await e(async()=>{let{SlideshowMenu:e}=await import(`./SlideshowMenu-Csj7X2wY.js`);return{SlideshowMenu:e}},__vite__mapDeps([14,8,9,10,2,11,15,16,4]),import.meta.url);t.init(r)}else if(s===`combine-av`){let{CombineAVMenu:t}=await e(async()=>{let{CombineAVMenu:e}=await import(`./CombineAVMenu-f2LlQxkV.js`);return{CombineAVMenu:e}},__vite__mapDeps([17,8,9,10,2,11,12,13,4]),import.meta.url);t.init(r)}else if(s===`share`)o.show();else if(s===`reset`&&confirm(`Reset the app? This will clear all data and reload.`))try{await new Promise((e,t)=>{let n=indexedDB.deleteDatabase(`JellyJumpDB`);n.onsuccess=()=>e(),n.onerror=()=>t(n.error),n.onblocked=()=>e()}),localStorage.clear(),window.location.reload()}catch(e){t.error(`Reset failed:`,e),window.location.reload()}})}),i.open()}};export{r as ToolsMenu};
//# sourceMappingURL=ToolsMenu-Czr2TX8V.js.map