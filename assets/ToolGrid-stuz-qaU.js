import{t as e}from"./html-DbBfww-f.js";function t(t,{columns:n=6}={}){let r=document.createElement(`div`);return r.className=`tools-sections`,r.style.setProperty(`--tools-columns`,String(n)),r.innerHTML=t.filter(e=>e.tools.length).map(t=>`
        <section class="tools-section">
            ${t.heading?`<h3 class="tools-section-heading">${e(t.heading)}</h3>`:``}
            <div class="tools-grid tools-grid-compact">
                ${t.tools.map(t=>`
                    <button class="tools-tile tools-tile-sm" data-action="${e(t.action)}"
                            title="${e(t.title??t.label)}">
                        <div class="tools-tile-icon">
                            <svg width="20" height="20" fill="currentColor" aria-hidden="true">
                                <use href="assets/icons/sprite.svg#${e(t.icon)}"></use>
                            </svg>
                        </div>
                        <span class="tools-tile-label">${e(t.label)}</span>
                    </button>
                `).join(``)}
            </div>
        </section>
    `).join(``),r}export{t};
//# sourceMappingURL=ToolGrid-stuz-qaU.js.map