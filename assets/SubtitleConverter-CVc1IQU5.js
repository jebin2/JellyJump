function e(e){let t=Math.floor(e/3600),n=Math.floor(e%3600/60),r=(e%60).toFixed(3);return`${t.toString().padStart(2,`0`)}:${n.toString().padStart(2,`0`)}:${r.padStart(6,`0`)}`}function t(t,n={}){let{wordsPerCue:r=8,maxCueDuration:i=5}=n;if(!Array.isArray(t)||t.length===0)return`WEBVTT

`;let a=`WEBVTT

`,o=0;for(;o<t.length;){let n=[],s=t[o],c=s;for(;o<t.length&&n.length<r&&t[o].end-s.start<=i;)n.push(t[o]),c=t[o],o++;if(n.length===0&&o<t.length&&(n.push(t[o]),c=t[o],o++),n.length>0){let t=e(n[0].start),r=e(c.end),i=n.map(e=>e.word).join(` `);a+=`${t} --> ${r}\n`,a+=`${i}\n\n`}}return a}function n(t,n={}){let{measure:r=null,maxWidth:i=0,maxWords:a=16,wordsPerCue:o=4,maxCueDuration:s=6,maxGap:c=1.5}=n,l=typeof r==`function`&&i>0,u=[];for(let e of Array.isArray(t)?t:[]){let t=(e?.text||``).trim();if(!t)continue;let n=Number(e?.timestamp?.[0]),r=Number(e?.timestamp?.[1]);Number.isFinite(n)||(n=u.length?u[u.length-1].end:0),Number.isFinite(r)||(r=n+.3),r<n&&(r=n+.1),u.push({text:t,start:n,end:r})}if(u.length===0)return`WEBVTT

`;let d=`WEBVTT

`,f=[],p=()=>{if(f.length===0)return;let t=f[0].start,n=Math.max(f[f.length-1].end,t+.1),r=f.map(e=>e.text).join(` `);d+=`${e(t)} --> ${e(n)}\n${r}\n\n`,f=[]};for(let e of u){if(f.length>0){let t=e.start-f[f.length-1].end,n=e.end-f[0].start>s||t>c;if(!n)if(l){let t=f.map(e=>e.text).join(` `)+` `+e.text;n=f.length>=a||r(t)>i}else n=f.length>=o;n&&p()}f.push(e)}return p(),d}function r(e){let t=JSON.parse(e);if(Array.isArray(t))return t;if(t.words)return t.words;if(t.segments)return t.segments.flatMap(e=>e.words||[]);throw Error(`Invalid transcript format: expected array or object with words/segments property`)}export{t as jsonToVTT,r as parseTranscriptJSON,n as wordChunksToVTT};
//# sourceMappingURL=SubtitleConverter-CVc1IQU5.js.map