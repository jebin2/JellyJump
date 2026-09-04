import"./Logger-C6IhgouS.js";var e=class{static async show({items:e,processor:t,onComplete:n,onToast:r}){if(e.length===0){r&&r(`No streams found to validate`);return}let i=this._createUI(e.length);document.body.appendChild(i.overlay);let a=0,o=0,s=!1;i.okBtn.onclick=()=>{s=!0,this._close(i)},await t.validateStreams(e,(t,n,r)=>{s||(r?o++:a++,i.progressFill.style.width=`${t*100}%`,i.status.textContent=`Checking ${Math.round(t*e.length)} of ${e.length}...`,i.currentItem.textContent=n.title,i.brokenCountEl.textContent=o,i.workingCountEl.textContent=a)}),!s&&(i.status.textContent=`Validation complete!`,i.okBtn.textContent=`OK`,i.okBtn.onclick=()=>{this._close(i),n&&n(o,a)},r&&r(`Validation complete: ${o} broken, ${a} working`))}static _createUI(e){let t=document.createElement(`div`);return t.className=`mb-modal-overlay`,t.innerHTML=`
            <div class="mb-modal" style="max-width: 400px;">
                <div class="mb-modal-header">
                    <h3>Validating Streams</h3>
                </div>
                <div class="validation-modal-content">
                    <div class="validation-progress-container">
                        <div class="validation-progress-bar">
                            <div class="validation-progress-fill"></div>
                        </div>
                        <div class="validation-status">Preparing...</div>
                    </div>
                    <div class="validation-current-item">Starting...</div>
                    <div class="validation-stats">
                        <div class="validation-stat">
                            <span class="label">Working:</span>
                            <span class="value working-count">0</span>
                        </div>
                        <div class="validation-stat">
                            <span class="label">Broken:</span>
                            <span class="value broken-count">0</span>
                        </div>
                    </div>
                </div>
                <div class="mb-modal-footer">
                    <button class="mb-btn mb-btn-secondary ok-btn">Cancel</button>
                </div>
            </div>
        `,{overlay:t,progressFill:t.querySelector(`.validation-progress-fill`),status:t.querySelector(`.validation-status`),currentItem:t.querySelector(`.validation-current-item`),workingCountEl:t.querySelector(`.working-count`),brokenCountEl:t.querySelector(`.broken-count`),okBtn:t.querySelector(`.ok-btn`)}}static _close(e){e.overlay.remove()}};export{e as ValidationModal};
//# sourceMappingURL=ValidationModal-CGzzU6Tt.js.map