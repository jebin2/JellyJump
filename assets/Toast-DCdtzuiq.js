import{t as e}from"./Logger-C6IhgouS.js";var t={show(t,n=2e3,r=!1){let i=document.createElement(`div`);i.className=`mb-toast ${r?`mb-toast--error`:``}`,i.textContent=t,i.style.cssText=`
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background: ${r?`var(--color-error, #ff4444)`:`var(--accent-primary, #00d9a5)`};
            color: ${r?`#fff`:`#000`};
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 9999;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            pointer-events: none;
            text-align: center;
            min-width: 200px;
        `,document.body.appendChild(i),requestAnimationFrame(()=>{i.style.opacity=`1`,i.style.transform=`translateX(-50%) translateY(-8px)`}),setTimeout(()=>{i.style.opacity=`0`,i.style.transform=`translateX(-50%) translateY(0)`,setTimeout(()=>{i.parentNode&&document.body.removeChild(i)},300)},n),e.log(`[Toast] ${t}`)}};export{t};
//# sourceMappingURL=Toast-DCdtzuiq.js.map