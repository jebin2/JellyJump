import{t as e}from"./Modal-D05RPi_Y.js";import{r as t}from"./ErrorReporter-CpDRxmBx.js";import{t as n}from"./Logger-DxomOsVN.js";var r=class{static isSupported(){return typeof RTCPeerConnection==`function`&&typeof HTMLCanvasElement<`u`&&typeof HTMLCanvasElement.prototype.captureStream==`function`}static show(r){if(!this.isSupported()){t.show(`This browser cannot share a watch party.`,4e3,!0);return}if(!r?.duration&&!r?.isLive){t.show(`Open something to watch first.`,3500,!0);return}if(r.capabilities&&!r.capabilities.canvasFrames){t.show(`A YouTube video cannot be shared this way — its picture and sound belong to YouTube. Send your friend the YouTube link instead.`,5e3,!0);return}let i=new e({maxWidth:`560px`});i.setTitle(`Watch Together`);let a=document.createElement(`div`);a.className=`watch-party`,a.innerHTML=`
            <p class="wp-lead">
                Send a friend the link. They send a code back. Then they are watching
                what you are watching — they cannot pause or seek it.
                <strong>Each link works for one person.</strong>
            </p>
            <div class="wp-step">
                <div class="wp-step-head">
                    <span class="wp-num">1</span>
                    <span>Send this link to <span class="wp-whose">one friend</span></span>
                </div>
                <div class="wp-row">
                    <input class="wp-link" readonly spellcheck="false" placeholder="Creating…">
                    <button class="wp-copy jellyjump-btn-secondary" type="button" disabled>Copy</button>
                </div>
                <p class="wp-hint">
                    Paste it in a message to that one person — not a group. It is long;
                    that is normal.
                </p>
            </div>
            <div class="wp-step">
                <div class="wp-step-head"><span class="wp-num">2</span> Paste their reply</div>
                <div class="wp-row">
                    <input class="wp-answer" spellcheck="false" placeholder="Paste the code they send back">
                    <button class="wp-accept jellyjump-btn-secondary" type="button">Connect</button>
                </div>
                <p class="wp-hint wp-status"></p>
            </div>
            <div class="wp-viewers"></div>
            <div class="wp-footer">
                <p class="wp-hint wp-running">
                    One link and one code per friend — send them all, then paste the
                    replies back in any order.
                    <strong>Closing this panel does not stop sharing.</strong>
                </p>
                <button class="wp-stop jellyjump-btn-secondary" type="button">Stop sharing</button>
            </div>
        `,i.setBody(a),i.open();let o=a.querySelector(`.wp-link`),s=a.querySelector(`.wp-copy`),c=a.querySelector(`.wp-answer`),l=a.querySelector(`.wp-accept`),u=a.querySelector(`.wp-status`),d=a.querySelector(`.wp-viewers`),f=a.querySelector(`.wp-stop`),p=a.querySelector(`.wp-whose`),m=r.watchParty,h=null,g=(e,t)=>e===`connected`?`watching`:t?e===`connecting`||e===`new`?`connecting…`:e:`waiting for their reply`,_=!1,v=async()=>{if(!_){_=!0;try{let e=await m.invitesWithRoutes();d.textContent=``,f.disabled=!m.isActive;for(let t of e){let e=document.createElement(`div`);e.className=`wp-viewer-row`;let n=document.createElement(`span`);n.className=`wp-dot`,t.state===`connected`&&n.classList.add(`on`);let r=document.createElement(`span`),i=t.route?` (${t.route})`:``;if(r.textContent=`Friend ${t.id} — ${g(t.state,t.accepted)}${i}`,e.append(n,r),d.append(e),t.accepted&&t.detail){let e=document.createElement(`p`);e.className=`wp-viewer-why`,e.textContent=t.detail,d.append(e)}}}finally{_=!1}}},y=e=>{o.value=e.link,s.disabled=!1,s.textContent=`Copy`,p.textContent=`Friend ${e.id}`},b=async()=>{o.value=``,o.placeholder=`Creating…`,s.disabled=!0;try{y(await m.invite())}catch(e){n.warn(`[WatchParty] Invite failed:`,e),o.placeholder=e.message||`Could not create an invitation.`,u.textContent=e.message||``}await v()};s.addEventListener(`click`,async()=>{try{await navigator.clipboard.writeText(o.value),s.textContent=`Copied`,setTimeout(()=>{s.textContent=`Copy`},1800)}catch{o.select(),s.textContent=`Press Ctrl+C`}}),l.addEventListener(`click`,async()=>{let e=c.value.trim();if(!e)u.textContent=`Paste the code they sent you.`;else{l.disabled=!0,u.textContent=`Connecting…`;try{let t=await m.accept(e);c.value=``,u.textContent=`Friend ${t} is connected. The next link is ready below.`,await v(),await b()}catch(e){n.warn(`[WatchParty] Accept failed:`,e),u.textContent=e.message||`That code could not be used.`}finally{l.disabled=!1}}}),f.addEventListener(`click`,async()=>{m.stop(),c.value=``,u.textContent=`Sharing stopped. Nobody is watching.`,t.show(`Watch party ended.`,2500),f.disabled=!0,await b()}),h=setInterval(v,1500),i.onCleanup(()=>{clearInterval(h)});let x=m.pendingInvite;x?(y(x),v()):b()}};export{r as WatchPartyMenu};
//# sourceMappingURL=WatchPartyMenu-PM947rgk.js.map