/* =============================================================
   수학 AI 스튜디오 — 게임 엔진 (세 앱 공용)
   Game.init({ key, name, gpt, kicker, sub, units, bg, hero, faces, badge, badgeTitle,
               missions:[{id,name,short,icon,pos:[x,y],count,boss,intro,gen(i,ctx),stars(m)}],
               blueprint:[[항목, html]], praise:[...], onReady })
   문제(p): { kicker, title, render(box, api), check(v) → true | false | '힌트 문장',
             hint, solution, say, after(box) }
   ============================================================= */
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rand = (a,b) => a + Math.floor(Math.random()*(b-a+1));
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const shuffle = arr => { const a = arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

  /* ---------- 저장 ---------- */
  const Store = {
    get(k, fb){ try{ const v = localStorage.getItem(k); return v==null ? fb : JSON.parse(v); }catch(e){ return fb; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };

  /* ---------- 효과음 (직접 합성) ---------- */
  const Sound = (function(){
    let ctx=null, on = Store.get('mas-sound', true);
    function ac(){ if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(ctx.state==='suspended') ctx.resume(); return ctx; }
    function tone(f, d=.12, type='sine', v=.08, w=0){ if(!on) return; const a=ac(); if(!a) return; const t=a.currentTime+w, o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+d+.02); }
    return {
      get on(){ return on; }, toggle(){ on=!on; Store.set('mas-sound', on); return on; },
      tick(){ tone(900,.05,'triangle',.04); }, pop(){ tone(520,.08); tone(780,.08,'sine',.05,.05); },
      good(){ tone(660,.12); tone(990,.2,'sine',.07,.09); }, bad(){ tone(220,.18,'triangle',.07); tone(170,.22,'triangle',.06,.1); },
      win(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.25,'sine',.07,i*.1)); },
      whoosh(){ if(!on) return; const a=ac(); if(!a) return; const t=a.currentTime,o=a.createOscillator(),g=a.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(1400,t+.35); g.gain.setValueAtTime(.04,t); g.gain.exponentialRampToValueAtTime(.0001,t+.4); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+.42); },
      type(){ tone(1300+Math.random()*300,.012,'square',.005); }
    };
  })();

  function toast(msg, ms=2000){ $$('.toast').forEach(t=>t.remove()); const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(), ms); }
  function confetti(n=160){
    if(reduce) return; const c=document.createElement('canvas'); c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:80'; document.body.appendChild(c);
    const x=c.getContext('2d'), d=devicePixelRatio||1, W=c.width=innerWidth*d, H=c.height=innerHeight*d; c.style.width=innerWidth+'px'; c.style.height=innerHeight+'px';
    const cs=getComputedStyle(document.body); const cols=[cs.getPropertyValue('--accent'),cs.getPropertyValue('--accent-2'),'#ffc23d','#ff6b9a','#4cc9f0','#ffffff'].map(s=>s.trim()||'#fc0');
    const P=Array.from({length:n},()=>({x:W/2+(Math.random()-.5)*W*.5,y:H*.6,vx:(Math.random()-.5)*30*d,vy:(-Math.random()*28-10)*d,r:(Math.random()*6+4)*d,a:Math.random()*6,va:(Math.random()-.5)*.3,c:pick(cols)}));
    let f=0; (function loop(){ x.clearRect(0,0,W,H); P.forEach(p=>{ p.vy+=.9*d; p.x+=p.vx; p.y+=p.vy; p.vx*=.985; p.a+=p.va; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.fillStyle=p.c; x.fillRect(-p.r,-p.r/2,p.r*2,p.r); x.restore(); }); if(++f<150) requestAnimationFrame(loop); else c.remove(); })();
  }

  const PRAISE = ['정확해요!','완벽해요!','대단해요, 디자이너님!','바로 그거예요!','멋진 생각이에요!','훌륭해요!','척척박사네요!','와, 한 번에 맞혔어요!'];

  /* ---------- 엔진 ---------- */
  const G = {
    $, $$, esc, rand, pick, shuffle, Store, Sound, toast, confetti,
    cfg:null, save:null, cur:null,
    init(cfg){
      this.cfg = cfg;
      this.save = Store.get('mas-game-'+cfg.key, {stars:{}, name:'', badge:false});
      document.title = cfg.name;
      document.body.insertAdjacentHTML('afterbegin', `
        <div class="world" id="world" style="background-image:url('${cfg.bg}')"></div>
        <section class="screen" id="title">
          <div class="title-wrap">
            <div class="title-copy">
              <span class="kicker">${cfg.kicker}</span>
              <h1 class="logo"><small>${cfg.gpt}와 함께하는</small>${cfg.name}</h1>
              <p class="title-sub">${cfg.sub}</p>
              <div class="unit-tags">${cfg.units.map(u=>`<span>${u}</span>`).join('')}</div>
              <div class="title-btns">
                <button class="jbtn gold" id="startBtn">▶ 모험 시작</button>
                <button class="chipbtn" id="bpBtn1">설계도 보기</button>
                <a class="chipbtn" href="../index.html">수업 허브로</a>
              </div>
            </div>
            <div class="hero-fig"><img src="${cfg.hero}" alt="${cfg.gpt} 캐릭터 수리" onerror="this.style.visibility='hidden'"></div>
          </div>
        </section>
        <section class="screen" id="map" hidden>
          <div class="bar">
            <button class="chipbtn" id="toTitle">← 처음 화면</button>
            <h2>미션 지도</h2><span class="grow"></span>
            <span class="star-total">★ <b class="num" id="starSum">0</b>/<span class="num">${cfg.missions.length*3}</span></span>
            <button class="chipbtn" id="bpBtn2">설계도</button>
            <button class="chipbtn" id="sndBtn" aria-label="소리 켜고 끄기">🔊</button>
          </div>
          <div class="map-area" id="mapArea"></div>
        </section>
        <section class="screen" id="play" hidden>
          <div class="hud">
            <button class="chipbtn" id="toMap">← 지도</button>
            <span class="mname" id="mName"></span>
            <span class="dots" id="dots"></span>
            <span class="grow" style="flex:1"></span>
            <span class="star-total">★ <b class="num" id="starSum2">0</b></span>
          </div>
          <div class="play-body"><div class="panel" id="stage"></div></div>
        </section>
        <section class="screen" id="result" hidden></section>
        <div class="guide" id="guide" hidden>
          <img class="face" id="face" alt="" src="${cfg.faces.happy}">
          <div class="bubble" id="bubble" aria-live="polite"><span class="who">${cfg.gpt}</span><span id="say"></span></div>
        </div>`);
      $('#startBtn').onclick = ()=>{ Sound.whoosh(); this.go('map'); };
      $('#bpBtn1').onclick = $('#bpBtn2').onclick = ()=>this.blueprint();
      $('#toTitle').onclick = ()=>this.go('title');
      $('#toMap').onclick = ()=>this.go('map');
      const sb = $('#sndBtn'); const paint=()=>sb.textContent = Sound.on?'🔊':'🔇'; paint(); sb.onclick=()=>{ Sound.toggle(); paint(); };
      $('#bubble').addEventListener('click', ()=>{ this._skip = true; });
      // 그림 미리 불러오기
      Object.values(cfg.faces).forEach(s=>{ const i=new Image(); i.src=s; });
      cfg.onReady && cfg.onReady(this);
      const h = location.hash.slice(1);
      if(h==='map') this.go('map'); else this.go('title');
    },
    go(screen){
      ['title','map','play','result'].forEach(s=>$('#'+s).hidden = s!==screen);
      document.body.classList.toggle('on-play', screen==='play');
      $('#guide').hidden = !(screen==='map' || screen==='play');
      if(screen==='map') this.drawMap();
      if(screen==='map'){ const next = this.nextMission(); this.say(next ? `다음 추천 미션은 <b>${next.name}</b>예요. 반짝이는 보석을 눌러 보세요!` : '모든 미션을 끝냈어요! 배지를 받으러 가요 🎉', next?'happy':'cheer'); }
    },
    starSum(){ return Object.values(this.save.stars).reduce((a,b)=>a+b,0); },
    nextMission(){ return this.cfg.missions.find(m=>!this.save.stars[m.id]); },
    drawMap(){
      const ms = this.cfg.missions, area = $('#mapArea'), next = this.nextMission();
      const pts = ms.map(m=>m.pos);
      let d = ''; pts.forEach((p,i)=>{ if(i===0) d+=`M${p[0]} ${p[1]}`; else { const q=pts[i-1]; const cx=(q[0]+p[0])/2; d+=` Q${cx} ${Math.min(q[1],p[1])-8} ${p[0]} ${p[1]}`; } });
      area.innerHTML = `<svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="0.7" stroke-dasharray="1.6 1.4" vector-effect="non-scaling-stroke" style="stroke-width:5px"/></svg>` +
        ms.map((m,i)=>{ const s=this.save.stars[m.id]||0; return `<button class="node ${s?'done':''} ${next&&next.id===m.id?'next':''} ${m.boss?'boss':''}" style="left:${m.pos[0]}%;top:${m.pos[1]}%" data-id="${m.id}">
          <span class="gem"><span class="n">${i+1}</span><img src="${m.icon}" alt="" onerror="this.remove()"></span>
          <span class="label">${m.name}<small>${m.short}</small></span>
          <span class="stars">${[0,1,2].map(k=>k<s?'★':'<span class="off">★</span>').join('')}</span></button>`; }).join('');
      $$('.node', area).forEach(b=>b.onclick=()=>{ Sound.pop(); this.start(b.dataset.id); });
      $('#starSum').textContent = this.starSum();
      if(!next && !this.save.badge){ setTimeout(()=>this.showResult(), 600); }
    },
    /* ---------- 수리 말풍선 ---------- */
    say(html, mood='happy', speed=16){
      const face = $('#face'), box = $('#say');
      const src = this.cfg.faces[mood] || this.cfg.faces.happy;
      if(face.getAttribute('src')!==src){ face.setAttribute('src', src); face.classList.remove('pop'); void face.offsetWidth; face.classList.add('pop'); }
      const token = (this._sayToken = (this._sayToken||0)+1); this._skip = false;
      box.innerHTML = html;
      if(reduce || speed===0) return Promise.resolve();
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT); const nodes=[]; let n; while((n=walker.nextNode())){ nodes.push([n,n.nodeValue]); n.nodeValue=''; }
      const caret = document.createElement('span'); caret.className='caret'; box.appendChild(caret);
      return new Promise(res=>{
        let i=0,j=0,c=0;
        const step=()=>{
          if(token!==this._sayToken){ res(); return; }
          if(this._skip){ nodes.forEach(([nd,t])=>nd.nodeValue=t); caret.remove(); res(); return; }
          for(let k=0;k<2 && i<nodes.length;k++){ const [nd,t]=nodes[i]; nd.nodeValue=t.slice(0,++j); if(j>=t.length){ i++; j=0; } }
          if(++c%3===0) Sound.type();
          if(i>=nodes.length){ caret.remove(); res(); return; }
          setTimeout(step, speed);
        }; step();
      });
    },
    /* ---------- 미션 ---------- */
    start(id){
      const m = this.cfg.missions.find(x=>x.id===id); if(!m) return;
      this.cur = {m, i:0, mistakes:0, marks:[], ctx:{}};
      $('#mName').textContent = m.name;
      this.go('play');
      if(m.intro) this.say(m.intro, 'happy');
      this.question();
    },
    dots(){ const c=this.cur; $('#dots').innerHTML = Array.from({length:c.m.count},(_,k)=>`<i class="${c.marks[k]||''} ${k===c.i?'now':''}"></i>`).join(''); $('#starSum2').textContent=this.starSum(); },
    question(){
      const c = this.cur; c.tries = 0; c.locked = false;
      const p = c.p = c.m.gen(c.i, c.ctx, this);
      const st = $('#stage'); st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop');
      st.innerHTML = `<span class="q-kicker">${c.m.name} · ${c.i+1}/${c.m.count}${p.kicker?' · '+p.kicker:''}</span><h2 class="q-title">${p.title}</h2><div class="q-box"></div><div class="q-after"></div>`;
      this.dots();
      const api = this.api(st);
      p.render($('.q-box', st), api);
      if(p.say) this.say(p.say, 'happy'); else if(c.i>0) this.say(pick(['다음 문제예요!','좋아요, 계속 가 볼까요?','이번 것도 할 수 있어요!','집중! 다음 문제예요.']), 'happy');
      $('#play').scrollTop = 0;
    },
    api(st){
      const self = this;
      return {
        stage: st,
        submit: v => self.submit(v),
        say: (h,m)=>self.say(h,m),
        get locked(){ return self.cur.locked; },
        num: s => { const t = String(s).replace(/[,\s]/g,'').replace(/[^0-9.\-]/g,''); return t===''?NaN:Number(t); },
        choices(box, opts, o={}){
          const g = document.createElement('div'); g.className='choices'; if(o.cols) g.style.gridTemplateColumns=`repeat(${o.cols},minmax(0,1fr))`;
          opts.forEach(op=>{ const b=document.createElement('button'); b.className='choice'; b.type='button'; b.innerHTML = op.html!=null?op.html:esc(op.label!=null?op.label:op); b.onclick=()=>{ if(self.cur.locked || b.disabled) return; const v = op.value!==undefined?op.value:(op.label!=null?op.label:op); self.cur.lastBtn=b; self.submit(v); }; g.appendChild(b); });
          box.appendChild(g); return g;
        },
        input(box, o={}){
          const r = document.createElement('div'); r.className='answer-row';
          r.innerHTML = `${o.before||''}<input class="ans ${o.sm?'sm':''}" type="text" inputmode="${o.mode||'numeric'}" autocomplete="off" placeholder="${o.placeholder||'답'}" aria-label="${o.label||'답 입력'}">${o.unit?`<span class="unit-l">${o.unit}</span>`:''}<button class="jbtn sm" type="button">확인</button>`;
          box.appendChild(r);
          const inp = $('input', r), btn = $('button', r);
          const go = ()=>{ if(!inp.value.trim()) { inp.focus(); return; } self.submit(o.raw? inp.value.trim() : this.num(inp.value)); };
          btn.onclick = go; inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.isComposing){ e.preventDefault(); go(); } });
          if(!('ontouchstart' in window)) setTimeout(()=>inp.focus(), 60);
          return inp;
        }
      };
    },
    submit(v){
      const c = this.cur; if(!c || c.locked) return;
      const p = c.p; let r = p.check(v);
      const ok = r===true;
      const st = $('#stage');
      if(ok){
        c.locked = true; c.marks[c.i] = c.tries===0 ? 'ok' : 'miss';
        if(c.lastBtn){ c.lastBtn.classList.add('correct'); c.lastBtn=null; }
        $$('.choice', st).forEach(b=>b.disabled=true);
        Sound.good(); st.classList.remove('flash-good'); void st.offsetWidth; st.classList.add('flash-good');
        if(c.tries===0) this.flyStar(st);
        this.say(`${pick(PRAISE)} ${p.praise||''}`, 'cheer');
        if(p.after) p.after($('.q-after', st));
        this.nextBtn(st);
      } else {
        c.tries++; c.mistakes++;
        if(c.lastBtn){ c.lastBtn.classList.add('wrong'); c.lastBtn.disabled = true; c.lastBtn=null; }
        Sound.bad();
        if(c.tries===1){
          const hint = typeof r==='string' ? r : (p.hint || '다시 한번 천천히 생각해 볼까요?');
          this.say('<b>힌트!</b> '+hint, 'think');
        } else {
          c.locked = true; c.marks[c.i] = 'miss';
          $$('.choice', st).forEach(b=>b.disabled=true);
          $('.q-after', st).innerHTML = `<div class="solution"><b>같이 풀어 봐요</b><br>${p.solution||''}</div>`;
          this.say('괜찮아요! 틀리면서 배우는 거예요. 풀이를 보고 다음 문제에서 다시 도전해요.', 'wow');
          this.nextBtn(st);
        }
      }
      this.dots();
    },
    nextBtn(st){
      const c = this.cur; const last = c.i >= c.m.count-1;
      const row = document.createElement('div'); row.className='next-row';
      row.innerHTML = `<button class="jbtn ${last?'gold':''}" type="button">${last?'미션 완료 ★':'다음 문제 ▶'}</button>`;
      $('.q-after', st).appendChild(row);
      const b = $('button', row); b.focus({preventScroll:true});
      b.onclick = ()=>{ Sound.tick(); if(last) this.finish(); else { c.i++; this.question(); } };
      setTimeout(()=>{ const pb=$('#play'); pb.scrollTo({top:pb.scrollHeight, behavior: reduce?'auto':'smooth'}); }, 80);
    },
    flyStar(from){
      if(reduce) return; const r = from.getBoundingClientRect(), t = $('#starSum2').getBoundingClientRect();
      const s = document.createElement('div'); s.className='flystar'; s.textContent='★'; s.style.left=(r.left+r.width/2)+'px'; s.style.top=(r.top+40)+'px'; document.body.appendChild(s);
      requestAnimationFrame(()=>{ s.style.transform=`translate(${t.left-(r.left+r.width/2)}px,${t.top-(r.top+40)}px) scale(.5) rotate(180deg)`; s.style.opacity='.2'; });
      setTimeout(()=>s.remove(), 950);
    },
    finish(){
      const c = this.cur, m = c.m;
      const stars = m.stars ? m.stars(c.mistakes, c.ctx) : (c.mistakes===0?3:c.mistakes<=2?2:1);
      const prev = this.save.stars[m.id]||0; if(stars>prev) this.save.stars[m.id]=stars; Store.set('mas-game-'+this.cfg.key, this.save);
      Sound.win(); if(stars===3) confetti();
      const idx = this.cfg.missions.indexOf(m), nextM = this.cfg.missions.slice(idx+1).find(x=>!this.save.stars[x.id]) || this.nextMission();
      const allDone = !this.nextMission();
      const ov = document.createElement('div'); ov.className='overlay';
      ov.innerHTML = `<div class="clear-card"><h2>미션 클리어!</h2><p style="margin:4px 0 6px;font-weight:700;color:var(--ink-2)">${esc(m.name)}</p>
        <div class="big-stars">${[0,1,2].map(k=>`<span class="${k<stars?'':'off'}">★</span>`).join('')}</div>
        <p style="margin:8px 0 0;color:var(--ink-2)">${c.mistakes===0?'실수 없이 완벽하게 해냈어요!':`실수 ${c.mistakes}번 — ${stars===3?'멋져요!':'다시 하면 별을 더 받을 수 있어요.'}`}</p>
        ${m.recap?`<div class="solution" style="text-align:left"><b>오늘의 핵심</b><br>${m.recap}</div>`:''}
        <div class="row">${allDone?'<button class="jbtn gold" data-a="badge">배지 받기 🏅</button>':nextM?`<button class="jbtn" data-a="next">다음: ${esc(nextM.name)} ▶</button>`:''}<button class="jbtn white sm" data-a="map">지도로</button><button class="jbtn white sm" data-a="again">다시 하기</button></div></div>`;
      document.body.appendChild(ov);
      this.say(stars===3?'별 3개! 진짜 수학 프로그램 디자이너 같아요!':'미션 성공! 다음 미션도 같이 가요.', 'cheer');
      $$('[data-a]', ov).forEach(b=>b.onclick=()=>{ const a=b.dataset.a; ov.remove(); Sound.tick();
        if(a==='next') this.start(nextM.id); else if(a==='again') this.start(m.id); else if(a==='badge') this.showResult(); else this.go('map'); });
    },
    showResult(){
      this.save.badge = true; Store.set('mas-game-'+this.cfg.key, this.save);
      const r = $('#result');
      r.innerHTML = `<p class="result-title">${this.cfg.badgeTitle}</p>
        <div class="badge-wrap"><img src="${this.cfg.badge}" alt="${this.cfg.badgeTitle} 배지" onerror="this.style.visibility='hidden'"></div>
        <h2 class="result-name" id="rName">${esc(this.save.name||'이름을 써 주세요')}</h2>
        <span class="star-total">모은 별 ★ <b class="num">${this.starSum()}</b> / ${this.cfg.missions.length*3}</span>
        <input class="name-in" id="nameIn" maxlength="10" placeholder="내 이름 쓰기" value="${esc(this.save.name||'')}" aria-label="이름">
        <div class="title-btns" style="justify-content:center"><button class="jbtn gold" id="getBadge">배지에 이름 새기기</button><button class="chipbtn" id="rMap">지도로</button><a class="chipbtn" href="../index.html">수업 허브로</a></div>`;
      this.go('result');
      $('#nameIn').oninput = e=>{ $('#rName').textContent = e.target.value || '이름을 써 주세요'; };
      $('#getBadge').onclick = ()=>{ this.save.name = $('#nameIn').value.trim(); Store.set('mas-game-'+this.cfg.key, this.save); Sound.win(); confetti(220); toast('배지를 받았어요!'); };
      $('#rMap').onclick = ()=>this.go('map');
      Sound.win(); confetti(220);
    },
    blueprint(){
      const ov = document.createElement('div'); ov.className='overlay';
      ov.innerHTML = `<div class="clear-card" style="max-width:640px;text-align:left;border-color:var(--accent);position:relative"><button class="modal-x" aria-label="닫기">×</button>
        <h2 style="margin-bottom:4px">설계도</h2><p style="margin:0 0 14px;color:var(--ink-2)">이 프로그램은 이렇게 설계했어요. 내 프로그램을 만들 때 그대로 따라 해 보세요.</p>
        <dl class="bp">${this.cfg.blueprint.map(([k,v])=>`<div class="bp-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <p style="margin:14px 0 0;font-weight:800;color:var(--accent-dark)">너라면 어떤 규칙을 더 넣고 싶나요?</p></div>`;
      document.body.appendChild(ov);
      const close=()=>ov.remove(); $('.modal-x', ov).onclick=close; ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
    }
  };
  window.Game = G;
})();
