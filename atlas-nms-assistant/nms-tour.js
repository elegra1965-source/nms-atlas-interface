/* ============================================================
   nms-tour.js (2026-10-24) -- the same file on every nomansskyhub.app site.

   A short spotlight tour of the real page: dims everything, rings one real
   button at a time with a small card (Back / Next / Skip), scrolls it into
   view if needed. Plus a one-time "New here?" prompt for first visits, so
   newcomers don't have to hunt for the Tour button.

   USE (after this file is loaded):
     NMSTour.init({
       id: 'weather',                       // per-site key for "seen" storage
       steps: [{sel:'#loc', title:'Search a city', body:'...'}, ...],
       button: {after:'#installBtn', className:'tool-btn', style:'', label:'▷ TOUR'},  // optional, injected next to an existing button (waits for it to exist)
       launchers: ['#tour-btn'],           // optional, existing buttons that start the tour
       waitFor: function(){ return true; }, // optional, first-visit prompt waits until this is true (e.g. a welcome box closed)
       start: function(){ ... }            // optional, replaces the spotlight tour (Hub uses its video pop-up)
     });
   Steps whose element is missing or hidden are skipped. The phone's Back
   button and Esc close the tour. English text is translated by lang.js as
   it appears (add the strings to each site's lang/*.json).
   ============================================================ */
(function(){
  if(window.NMSTour) return;
  var css=''+
  '#nmsTourOv{position:fixed;inset:0;z-index:2147482000;display:none;pointer-events:none}'+
  '#nmsTourOv.show{display:block}'+
  '#nmsTourHole{position:fixed;border-radius:8px;border:2px solid #00e5ff;box-shadow:0 0 0 9999px rgba(2,6,12,.78),0 0 16px rgba(0,229,255,.5);pointer-events:none;transition:top .3s ease,left .3s ease,width .3s ease,height .3s ease}'+
  '#nmsTourCard{position:fixed;width:min(300px,calc(100vw - 24px));box-sizing:border-box;padding:14px;background:#06121c;border:1px solid rgba(0,229,255,.45);border-radius:10px;color:#cfe0f0;pointer-events:auto;font:14px/1.5 system-ui,sans-serif;transition:top .3s ease,left .3s ease;box-shadow:0 10px 30px rgba(0,0,0,.6)}'+
  '#nmsTourCard .nt-k{font:600 11px/1 monospace;letter-spacing:3px;color:#f0a500}'+
  '#nmsTourCard .nt-t{font-weight:700;font-size:16px;letter-spacing:.04em;color:#eaf6ff;margin:6px 0 4px}'+
  '#nmsTourCard .nt-b{font-size:13px;color:rgba(207,224,240,.8)}'+
  '.nt-row{display:flex;gap:8px;margin-top:12px}'+
  '.nt-row button,#nmsTourPill button{flex:1;min-height:40px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.4);border-radius:6px;color:#7fe3ff;font:600 11px/1 monospace;letter-spacing:2px;cursor:pointer;padding:0 10px}'+
  '.nt-row button.nt-go,#nmsTourPill button.nt-go{border-color:#f0a500;color:#f0c14e;background:rgba(240,165,0,.08)}'+
  '.nt-row button:focus-visible,#nmsTourPill button:focus-visible{outline:2px solid #00e5ff;outline-offset:2px}'+
  '#nmsTourPill{position:fixed;left:50%;bottom:78px;transform:translate(-50%,20px);opacity:0;z-index:2147481000;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;width:min(340px,calc(100vw - 24px));box-sizing:border-box;padding:10px 12px;background:#06121c;border:1px solid rgba(240,165,0,.6);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.6);transition:opacity .35s ease,transform .35s ease}'+
  '#nmsTourPill.show{opacity:1;transform:translate(-50%,0)}'+
  '#nmsTourPill .nt-q{flex:0 0 100%;text-align:center;font:600 11px/1.3 monospace;letter-spacing:2px;color:#f0a500}'+
  '#nmsTourPill button{flex:1 1 0;padding:6px 8px;line-height:1.3}'+
  '@media (prefers-reduced-motion:reduce){#nmsTourHole,#nmsTourCard,#nmsTourPill{transition:none}}';

  var cfg=null, list=[], idx=0, active=false, pushed=false, ov, hole, card, followUntil=0, dir=1;
  function $(s){ try{ return document.querySelector(s); }catch(e){ return null; } }
  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
  function seenKey(){ return 'nmsTourSeen:'+cfg.id; }

  function build(){
    if(ov) return;
    var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    ov=document.createElement('div'); ov.id='nmsTourOv';
    ov.innerHTML='<div id="nmsTourHole"></div><div id="nmsTourCard" role="dialog" aria-modal="false" aria-live="polite">'+
      '<div class="nt-k" id="nmsTourStep"></div><div class="nt-t" id="nmsTourTitle"></div><div class="nt-b" id="nmsTourBody"></div>'+
      '<div class="nt-row"><button type="button" id="nmsTourSkip">SKIP</button><button type="button" id="nmsTourBack">BACK</button><button type="button" class="nt-go" id="nmsTourNext">NEXT</button></div></div>';
    document.body.appendChild(ov);
    hole=ov.querySelector('#nmsTourHole'); card=ov.querySelector('#nmsTourCard');
    ov.querySelector('#nmsTourSkip').addEventListener('click',function(){ close(false); });
    ov.querySelector('#nmsTourBack').addEventListener('click',function(){ if(idx>0){ dir=-1; go(idx-1); } });
    ov.querySelector('#nmsTourNext').addEventListener('click',function(){ dir=1; if(idx>=list.length-1) close(false); else go(idx+1); });
    window.addEventListener('scroll',function(){ if(active) place(); },{passive:true});
    window.addEventListener('resize',function(){ if(active) place(); });
    document.addEventListener('keydown',function(e){ if(active&&e.key==='Escape') close(false); });
    window.addEventListener('popstate',function(){ if(active){ pushed=false; close(true); } });
  }
  function shown(st){ var el=$(st.sel); if(!el) return false; var r=el.getBoundingClientRect(); return !!(r.width||r.height); }
  function target(i){
    var el=list[i]&&$(list[i].sel); if(!el) return null;
    var r=el.getBoundingClientRect();
    return (r.width||r.height)?el:null;
  }
  function go(i){
    var n=list.length;
    while(i>=0&&i<n&&!target(i)) i+=dir;     /* skip anything not on screen in this layout */
    if(i>=n){ close(false); return; }
    if(i<0){ i=idx; if(!target(i)){ close(false); return; } }
    idx=i;
    var s=list[i], el=target(i);
    ov.querySelector('#nmsTourStep').textContent='STEP '+(i+1)+' OF '+n;
    ov.querySelector('#nmsTourTitle').textContent=s.title;
    ov.querySelector('#nmsTourBody').textContent=s.body;
    ov.querySelector('#nmsTourBack').style.visibility=i===0?'hidden':'visible';
    ov.querySelector('#nmsTourNext').textContent=i===n-1?'DONE':'NEXT';
    var r=el.getBoundingClientRect(), vh=window.innerHeight;
    if(r.top<70||r.bottom>vh-190){
      var smooth=!window.matchMedia||!matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({block:'center',behavior:smooth?'smooth':'auto'});
    }
    follow();
  }
  function follow(){                          /* keep re-measuring while the page scrolls/animates */
    followUntil=Date.now()+900;
    (function tick(){ if(!active) return; place(); if(Date.now()<followUntil) requestAnimationFrame(tick); })();
  }
  function place(){
    var el=target(idx); if(!el) return;
    var r=el.getBoundingClientRect(), pad=6, vw=window.innerWidth, vh=window.innerHeight;
    var top=Math.max(4,r.top-pad), left=Math.max(4,r.left-pad);
    var w=Math.min(vw-8,r.right+pad)-left, h=Math.min(r.height+pad*2, vh-8-top);
    hole.style.top=top+'px'; hole.style.left=left+'px'; hole.style.width=Math.max(w,10)+'px'; hole.style.height=Math.max(h,10)+'px';
    var cw=card.offsetWidth||300, ch=card.offsetHeight||160, ct=r.bottom+pad+10;
    if(ct+ch>vh-8) ct=r.top-pad-10-ch;          /* not enough room below: go above */
    if(ct<8) ct=Math.max(8,vh-ch-12);           /* tall target: pin to the bottom */
    var cl=Math.min(vw-cw-12,Math.max(12,r.left));
    card.style.top=ct+'px'; card.style.left=cl+'px';
  }
  function open(){
    hidePill(); store(seenKey(),'1');
    if(cfg.start){ cfg.start(); return; }
    build(); list=cfg.steps.filter(shown); if(!list.length) return;
    active=true; idx=0; dir=1;
    ov.classList.add('show');
    if(!pushed){ try{ history.pushState({nmsTour:1},''); pushed=true; }catch(e){} }
    go(0);
    try{ ov.querySelector('#nmsTourNext').focus({preventScroll:true}); }catch(e){}
  }
  function close(fromPop){
    if(!active) return;
    active=false; ov.classList.remove('show');
    if(pushed&&!fromPop){ pushed=false; try{ history.back(); }catch(e){} }
  }

  /* ---- one-time "New here?" prompt ---- */
  var pill=null, pillTimer=null;
  function hidePill(){
    if(!pill) return; var p=pill; pill=null; clearTimeout(pillTimer);
    p.classList.remove('show'); setTimeout(function(){ if(p.parentNode) p.parentNode.removeChild(p); },400);
  }
  function showPill(){
    if(pill||store(seenKey())) return;
    store(seenKey(),'1');                       /* only ever offered once per site */
    pill=document.createElement('div'); pill.id='nmsTourPill'; pill.setAttribute('role','dialog'); pill.setAttribute('aria-label','New here?');
    pill.innerHTML='<span class="nt-q">NEW HERE?</span><button type="button" class="nt-go" id="nmsTourPillGo">▶ TAKE THE TOUR</button><button type="button" id="nmsTourPillNo">DIVE IN</button>';
    document.body.appendChild(pill);
    pill.querySelector('#nmsTourPillGo').addEventListener('click',open);
    pill.querySelector('#nmsTourPillNo').addEventListener('click',hidePill);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(pill) pill.classList.add('show'); }); });
    pillTimer=setTimeout(hidePill,20000);       /* drifts away on its own if ignored */
  }
  function firstVisit(){
    if(store(seenKey())) return;
    var t0=Date.now();
    (function wait(){
      if(store(seenKey())) return;
      var ok=true; try{ ok=!cfg.waitFor||cfg.waitFor(); }catch(e){}
      if(ok){ setTimeout(function(){
        var still=true; try{ still=!cfg.waitFor||cfg.waitFor(); }catch(e){}
        if(still){ if(!active) showPill(); } else if(Date.now()-t0<120000) setTimeout(wait,500);   /* a welcome box opened meanwhile: wait for it again */
      },cfg.delay==null?1800:cfg.delay); return; }
      if(Date.now()-t0<120000) setTimeout(wait,500);
    })();
  }

  function injectButton(b){
    var t0=Date.now();
    (function tryIt(){
      if(document.getElementById('nmsTourBtn')) return;
      var ref=$(b.after);
      if(!ref){ if(Date.now()-t0<20000) setTimeout(tryIt,400); return; }
      var btn=document.createElement('button'); btn.type='button'; btn.id='nmsTourBtn';
      if(b.className) btn.className=b.className;
      if(b.style) btn.setAttribute('style',b.style);
      btn.textContent=b.label||'▷ TOUR'; btn.title='Take a quick tour of this page'; btn.setAttribute('aria-label','Take a quick tour of this page');
      btn.addEventListener('click',open);
      ref.parentNode.insertBefore(btn,ref.nextSibling);
    })();
  }

  window.NMSTour={
    init:function(c){
      cfg=c; build();
      if(c.button) injectButton(c.button);
      (c.launchers||[]).forEach(function(s){ var el=$(s); if(el) el.addEventListener('click',open); });
      if(c.firstVisit!==false) firstVisit();
    },
    start:open, close:function(){ close(false); }
  };
})();
