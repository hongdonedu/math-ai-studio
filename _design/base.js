/* ==========================================================
   수학 AI 스튜디오 — 공통 대화 셸 도우미 (ChatGPT 느낌)
   사용법:
     Shell.init({ storageKey:'ng', onSubmit:(text)=>{...} });
     await Shell.ai('안녕! <b>굵게</b>도 돼요.', { widget: el });  // 글자가 흘러나오듯 표시
     Shell.user('내 답');
     await Shell.think(700);          // "생각하는 중…" 반짝 글씨
     Shell.chips([{label:'💡 힌트', onClick:fn}]);
     Shell.placeholder('답을 입력하세요');  Shell.lock(true/false);
     Sound.good(); Sound.bad(); Sound.tick(); Sound.win();
     Store.get(key, fallback); Store.set(key, value);
     confetti(); toast('메시지');
   ========================================================== */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 저장 (브라우저 안에서만) ---------- */
  const Store = {
    get(k, fb){ try{ const v = localStorage.getItem(k); return v==null ? fb : JSON.parse(v); }catch(e){ return fb; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };

  /* ---------- 효과음 (직접 합성, 첫 클릭 뒤에만 소리) ---------- */
  const Sound = (function(){
    let ctx = null, on = Store.get('mas-sound', true);
    function ac(){ if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(ctx.state==='suspended') ctx.resume(); return ctx; }
    function tone(freq, dur=0.12, type='sine', vol=0.08, when=0){
      if(!on) return; const a = ac(); if(!a) return;
      const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+0.01); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+dur+0.02);
    }
    return {
      get on(){ return on; },
      toggle(){ on = !on; Store.set('mas-sound', on); return on; },
      tick(){ tone(880, .05, 'triangle', .04); },
      pop(){ tone(520, .08, 'sine', .06); tone(780, .08, 'sine', .05, .05); },
      good(){ tone(660, .12, 'sine', .08); tone(990, .18, 'sine', .07, .09); },
      bad(){ tone(220, .18, 'triangle', .07); tone(180, .2, 'triangle', .06, .1); },
      win(){ [523,659,784,1047].forEach((f,i)=>tone(f, .22, 'sine', .07, i*.11)); },
      type(){ tone(1200+Math.random()*200, .015, 'square', .006); }
    };
  })();

  /* ---------- 토스트 ---------- */
  let toastTimer = null;
  function toast(msg, ms=2200){
    let t = $('.toast'); if(t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); t.textContent = msg;
    document.body.appendChild(t); clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.remove(), ms);
  }

  /* ---------- 색종이 ---------- */
  function confetti(n=140){
    if(reduce) return;
    const c = document.createElement('canvas'); c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:90';
    document.body.appendChild(c); const x = c.getContext('2d');
    const W = c.width = innerWidth*devicePixelRatio, H = c.height = innerHeight*devicePixelRatio;
    c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px';
    const cs = getComputedStyle(document.documentElement);
    const cols = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2'), cs.getPropertyValue('--star'), '#ff5c8a', '#3b82f6'].map(s=>s.trim()||'#888');
    const P = Array.from({length:n},()=>({x:W/2+(Math.random()-.5)*W*.3, y:H*.55, vx:(Math.random()-.5)*28*devicePixelRatio, vy:(-Math.random()*26-8)*devicePixelRatio, r:Math.random()*6+4, a:Math.random()*6, va:(Math.random()-.5)*.3, c:cols[Math.random()*cols.length|0]}));
    let f=0; (function loop(){ x.clearRect(0,0,W,H); P.forEach(p=>{ p.vy+=0.9*devicePixelRatio; p.x+=p.vx; p.y+=p.vy; p.vx*=.985; p.a+=p.va; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.fillStyle=p.c; x.fillRect(-p.r,-p.r/2,p.r*2,p.r); x.restore(); }); if(++f<140) requestAnimationFrame(loop); else c.remove(); })();
  }

  /* ---------- 글자 흘려 쓰기 ---------- */
  function streamInto(el, html, speed){
    return new Promise(resolve=>{
      el.innerHTML = html;
      if(reduce || speed===0){ resolve(); return; }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = []; let n; while((n = walker.nextNode())){ nodes.push([n, n.nodeValue]); n.nodeValue=''; }
      const dot = document.createElement('span'); dot.className='cursor-dot'; el.appendChild(dot);
      let i = 0, j = 0, skip = false, count = 0;
      const stop = ()=>{ skip = true; };
      el.addEventListener('click', stop, {once:true});
      function step(){
        if(skip){ nodes.forEach(([node,txt])=>node.nodeValue=txt); dot.remove(); resolve(); return; }
        let budget = 3;
        while(budget-- > 0 && i < nodes.length){
          const [node, txt] = nodes[i];
          node.nodeValue = txt.slice(0, ++j);
          if(j >= txt.length){ i++; j = 0; }
        }
        if(++count % 4 === 0) Sound.type();
        Shell.scroll();
        if(i >= nodes.length){ dot.remove(); resolve(); return; }
        setTimeout(step, speed);
      }
      step();
    });
  }

  const ICON = {
    copy:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    thumb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4V10h3zm0 0 4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18.2 21H7"/></svg>',
    speaker:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m16 9 5 5m0-5-5 5"/></svg>',
    menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>'
  };

  /* ---------- 셸 ---------- */
  const Shell = {
    ICON,
    opts:{},
    init(opts={}){
      this.opts = opts;
      this.thread = $('#thread'); this.inner = $('#threadInner'); this.input = $('#composerInput');
      this.sendBtn = $('#sendBtn'); this.chipBox = $('#composerChips');
      // 테마
      const saved = Store.get('mas-theme', null); if(saved) document.documentElement.setAttribute('data-theme', saved);
      const themeBtn = $('#themeBtn'); if(themeBtn){ const paint=()=>{ const dark = this.isDark(); themeBtn.innerHTML = dark?ICON.sun:ICON.moon; themeBtn.title = dark?'밝은 화면':'어두운 화면'; }; paint(); themeBtn.onclick=()=>{ const next = this.isDark()?'light':'dark'; document.documentElement.setAttribute('data-theme', next); Store.set('mas-theme', next); paint(); }; }
      // 소리
      const sb = $('#soundBtn'); if(sb){ const paint=()=>{ sb.innerHTML = Sound.on?ICON.speaker:ICON.mute; sb.title = Sound.on?'소리 끄기':'소리 켜기'; }; paint(); sb.onclick=()=>{ Sound.toggle(); paint(); toast(Sound.on?'소리를 켰어요':'소리를 껐어요'); }; }
      // 서랍(모바일 사이드바)
      const app = $('.app'); const mb = $('#menuBtn'); if(mb) mb.onclick=()=>app.classList.add('drawer-open');
      const ds = $('.drawer-scrim'); if(ds) ds.onclick=()=>app.classList.remove('drawer-open');
      const cb = $('#closeSide'); if(cb) cb.onclick=()=>app.classList.remove('drawer-open');
      // 입력창
      if(this.input){
        const sync=()=>{ this.sendBtn.disabled = !this.input.value.trim() || this.locked; };
        this.input.addEventListener('input', sync);
        this.input.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); this.submit(); } });
        this.sendBtn.addEventListener('click', ()=>this.submit());
        sync(); this._sync = sync;
      }
      document.querySelectorAll('[data-icon]').forEach(el=>{ el.innerHTML = ICON[el.dataset.icon]||''; });
    },
    isDark(){ const a = document.documentElement.getAttribute('data-theme'); if(a) return a==='dark'; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; },
    closeDrawer(){ const app=$('.app'); app && app.classList.remove('drawer-open'); },
    submit(){
      if(this.locked) return; const v = this.input.value.trim(); if(!v) return;
      this.input.value=''; this._sync && this._sync();
      if(this.opts.onSubmit) this.opts.onSubmit(v);
    },
    placeholder(t){ if(this.input) this.input.placeholder = t; },
    lock(b){ this.locked = !!b; if(this.input){ this.input.disabled = !!b; this._sync && this._sync(); } },
    focus(){ if(this.input && !('ontouchstart' in window)) this.input.focus(); },
    chips(list=[]){
      if(!this.chipBox) return; this.chipBox.innerHTML='';
      list.forEach(c=>{ const b=document.createElement('button'); b.className='chip'; b.type='button'; b.innerHTML=c.label; b.onclick=()=>{ Sound.tick(); c.onClick(); }; this.chipBox.appendChild(b); });
    },
    clear(){ this.inner.innerHTML=''; },
    scroll(force){ const t=this.thread; if(!t) return; const near = t.scrollHeight - t.scrollTop - t.clientHeight < 260; if(force||near) t.scrollTop = t.scrollHeight; },
    user(text){
      const m=document.createElement('div'); m.className='msg msg-user';
      const b=document.createElement('div'); b.className='bubble'; b.textContent=text; m.appendChild(b);
      this.inner.appendChild(m); this.scroll(true); return m;
    },
    async think(ms=650, label='생각하는 중'){
      const m=document.createElement('div'); m.className='msg msg-ai';
      m.innerHTML='<div class="orb" aria-hidden="true"></div><div class="body"><div class="thinking">'+label+'…</div></div>';
      this.inner.appendChild(m); this.scroll(true);
      await new Promise(r=>setTimeout(r, reduce?0:ms)); m.remove();
    },
    async ai(html, o={}){
      if(o.think!==false) await this.think(o.thinkMs||520, o.thinkLabel);
      const m=document.createElement('div'); m.className='msg msg-ai';
      m.innerHTML='<div class="orb" aria-hidden="true"></div><div class="body"><div class="text"></div></div>';
      this.inner.appendChild(m); this.scroll(true);
      const body=m.querySelector('.body'), text=m.querySelector('.text');
      if(html) await streamInto(text, html, o.speed==null?14:o.speed); else text.remove();
      if(o.widget){ const w = typeof o.widget==='function'?o.widget():o.widget; if(w){ body.appendChild(w); } }
      if(o.actions!==false && html){
        const acts=document.createElement('div'); acts.className='msg-actions';
        acts.innerHTML='<button class="icon-btn" title="복사" aria-label="복사">'+ICON.copy+'</button><button class="icon-btn" title="좋아요" aria-label="좋아요">'+ICON.thumb+'</button>';
        acts.children[0].onclick=()=>{ const s=text.innerText; (navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(()=>toast('복사했어요')).catch(()=>toast('복사할 수 없는 화면이에요')); };
        acts.children[1].onclick=(e)=>{ e.currentTarget.style.color='var(--accent)'; Sound.pop(); toast('좋아요! 피드백 고마워요'); };
        body.appendChild(acts);
      }
      this.scroll(true); return m;
    },
    modal(html, {onClose}={}){
      const s=document.createElement('div'); s.className='scrim';
      s.innerHTML='<div class="modal" role="dialog" aria-modal="true"><div style="display:flex;justify-content:flex-end;margin:-8px -8px 0 0"><button class="icon-btn" aria-label="닫기">'+ICON.close+'</button></div><div class="modal-body"></div></div>';
      s.querySelector('.modal-body').innerHTML = html;
      const close=()=>{ s.remove(); onClose&&onClose(); };
      s.querySelector('.icon-btn').onclick=close; s.addEventListener('click', e=>{ if(e.target===s) close(); });
      document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', esc);} });
      document.body.appendChild(s); return {el:s, close};
    },
    starsHTML(n, max=3){ let h='<span class="stars" aria-label="별 '+n+'개">'; for(let i=0;i<max;i++) h+= i<n?'★':'<span class="off">★</span>'; return h+'</span>'; },
    esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  };

  window.Shell = Shell; window.Sound = Sound; window.Store = Store; window.toast = toast; window.confetti = confetti;
})();
