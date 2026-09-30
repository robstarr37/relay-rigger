/* Scripted walkthroughs that prove each level can be finished.
   Load tools/testbot.js first, then this file; call e.g. WALK.composed(6). Each returns a step log.
   Long levels run in pieces: composed(lv, calm, from, to) and composedSide(lv, calm, {resume:true}) pause after
   ~38 s of real time (the console call limit) and continue from where they stopped on the next call. */
(() => {
const T = window.TB, r = window.__rr;
const WALK = window.WALK = {
  substation9(calm){ return this.composed(6,calm); },

  // ---- side-view set pieces ----
  // hook the beam at a shaft edge, step off, pay out cable, land without fall damage
  rappel(lv,edgeTx,g){ r.teleport((edgeTx-1)*16,g*16-20); r.run(5); const hp0=r.p().hp;
    T.until({right:true},()=>r.p().x+6>=(edgeTx+0.3)*16,120); r.run(1,{right:true,grab:true});
    const att=T.until({grab:true,right:true},()=>r.hook().state==='att',60);
    T.until({grab:true,right:true},()=>!r.p().onGround,120); T.until({grab:true,down:true},()=>r.info().rope>=205,400); T.hold({grab:true},40);
    T.until({},()=>r.p().onGround,300);
    return 'attach '+att+', landed row '+r.info().ty+', hp '+hp0+'->'+r.p().hp; },
  // the hand-built descent of Quarry Descent (enemies removed), down to the pit terminal
  quarryDescent(){ const log=[]; r.start(10); r.enemies().forEach(e=>{e.alive=false;});
    log.push('shaft 1 '+this.rappel(10,30,7));
    r.teleport(71.5*16,22*16-20); r.run(3); const q=r.plats()[0];
    T.until({},()=>r.p().plat===q&&q.dy>0,1500); T.until({},()=>q.y>=40*16-1,1500); log.push('lift down '+T.until({right:true},()=>r.p().onGround&&!r.p().plat&&r.info().tx>=75,300));
    log.push('shaft 2 '+this.rappel(10,110,40));
    r.teleport(130*16+2,56*16-20); r.run(10); log.push('terminal '+T.defendSide(0));
    return log.join('\n'); },
  // the composed pit floor of Quarry Descent, from the pit terminal onwards
  quarryTail(calm){ r.start(10); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.teleport(130*16+2,56*16-20); r.run(10);
    const t='terminal '+T.defendSide(0); return t+'\n'+this.composedSide(10,calm,{resume:true}); },
  climbSide(){ const row0=r.info().ty; r.run(1,{}); r.run(1,{up:true,grab:true});
    const f=T.until({up:true,grab:true},()=>r.hook().state==='idle'&&r.p().onGround&&r.info().ty<row0-0.5,240); return f<0?'FAIL':r.info().ty; },
  walkSide(tx){ const dir=tx*16>r.p().x+6?'right':'left'; return T.until({[dir]:true},()=>Math.abs(r.p().x+6-tx*16)<4&&r.p().onGround,900); },
  // the flooding shaft at the end of Pumping Station: climb it and work the top terminal
  // resume = carry on from the end of a composedSide(12) run instead of restarting at the shaft
  pumpTail(calm,resume){ if(!resume){ r.start(12); if(calm) r.enemies().forEach(e=>{e.alive=false;}); } const off=r.def().endX-1; if(!resume){ r.teleport((off+3)*16,67*16-20); r.run(5); } const out=['shaft starts at '+off];
    const W=this.walkSide.bind(this), C=this.climbSide.bind(this);
    for(const [kind,arg] of [['w',16.5],['c'],['w',19.5],['c'],['c'],['c'],['w',54.5],['c'],['w',57.5],['c'],['c'],['c'],['w',94.4],['c'],['c'],['c'],['c'],['w',106.5]]){
      const v=kind==='w'?(/^at /.test(T.walkFight(arg+off))?1:-1):C(); if(v==='FAIL'||v<0) return 'FAILED at '+kind+' '+(arg||'')+' row '+r.info().ty; }
    out.push('reached the terminal: row '+r.info().ty+', water row '+(r.water().y/16).toFixed(1)+', falls '+r.info().falls);
    out.push('terminal '+T.defendSide(1)+' water row '+(r.water().y/16).toFixed(1));
    for(let f=0;f<600&&r.info().state==='play';f++) r.run(1,{right:true}); out.push('RESULT '+r.info().state);
    return out.join('\n'); },
  // fight the Ship Anchor: cut clamps bottom-up, dodge bands by climbing or dropping
  shipAnchor(){ r.start(14); const A=()=>r.anchor(); let f=0, hits=0, hp=r.p().hp, dodges=0; const clamps=()=>r.enemies().filter(e=>e.type==='clamp'&&e.alive);
    const feetRow=()=>Math.round((r.p().y+r.p().h)/16);
    const climb=()=>{ r.run(1,{}); r.run(1,{up:true,grab:true}); for(let i=0;i<120;i++){ r.run(1,{up:true,grab:true}); f++; if(r.hook().state==='idle'&&r.p().onGround) break; } };
    const walkX=(tx)=>{ for(let i=0;i<240;i++){ const d=tx*16-(r.p().x+6); if(Math.abs(d)<3||(!r.p().onGround&&i>5)) break; r.run(1,{[d>0?'right':'left']:true}); f++; } };
    while(f<60*240&&clamps().length&&r.info().state==='play'){
      const p=r.p(), pcy=p.y+p.h/2, b=A().band, h=r.p().hp; if(h<hp) hits+=hp-h; hp=h;
      if(b&&b.tel>0&&Math.abs(pcy-b.y)<30&&p.onGround){ dodges++; if(feetRow()>15){ walkX(30.5); climb(); } else { walkX(33); for(let i=0;i<60&&!r.p().onGround;i++){ r.run(1); f++; } } continue; }
      const c=clamps().sort((a,b)=>b.y-a.y)[0], want=Math.round(c.y/16-0.5)+1, row=feetRow();
      if(!p.onGround){ r.run(1); f++; continue; }
      if(row>want){ walkX(30.5); climb(); continue; }
      if(row<want){ walkX(33); for(let i=0;i<80&&!r.p().onGround;i++){ r.run(1); f++; } continue; }
      if(Math.abs(r.p().x+6-30.5*16)>6){ walkX(30.5); continue; }
      r.run(1,{right:true}); r.run(1,{down:true,grab:true}); r.run(12); f+=14; }
    return 'state '+r.info().state+', clamps left '+clamps().length+', '+(f/60).toFixed(0)+'s, hits '+hits+', deaths '+r.info().falls+', dodges '+dodges; },
  // can the worker get over the tether on the high walkway?
  anchorCrossing(){ r.start(14); r.anchor().pt=999; r.anchor().st=999; r.enemies().forEach(e=>{ if(e.type!=='clamp') e.alive=false; });
    r.teleport(28*16,15*16-20); r.run(5); const hp0=r.p().hp; const c=this.climbSide();
    const cross=T.until({right:true},()=>r.p().x+6>45*16,600); T.until({right:true},()=>r.p().onGround&&r.info().ty>=15,300);
    return 'climb to '+c+', crossed '+(cross>=0)+', now at '+r.info().tx+',row '+r.info().ty+', hp '+hp0+'->'+r.p().hp; },
  // the final boss with every attack live: generators by climbing, then the core. Dodges each band once
  // (sidestep a vertical band, climb out of a horizontal one) and punches up, across or diagonally.
  heartOfTheShip(limitMs=40000){ const t0=performance.now(); r.start(19); let f=0, hits=0, hp=r.p().hp, handled=null, dodges=0; const B=()=>r.boss();
    const gens=()=>r.enemies().filter(e=>e.type==='gen'&&e.alive), core=()=>r.enemies().find(e=>e.type==='core'&&e.alive);
    const tick=(k={})=>{ r.run(1,k); f++; const h=r.p().hp; if(h<hp) hits+=hp-h; hp=h; };
    const climb=()=>{ tick({}); tick({up:true,grab:true}); for(let i=0;i<150&&!(r.hook().state==='idle'&&r.p().onGround);i++) tick({up:true,grab:true}); };
    const dodge=()=>{ const b=B().band, p=r.p(); if(!b||b.tel<=0||b===handled) return false; handled=b;
      const hit=b.axis==='v'?Math.abs(p.x+6-b.pos)<30:Math.abs(p.y+p.h/2-b.pos)<30; if(!hit) return false; dodges++;
      if(b.axis==='v'){ const dir=(p.x+6)<b.pos?'left':'right'; for(let i=0;i<45&&b.tel>0;i++) tick({[dir]:true}); } else if(p.onGround) climb(); return true; };
    const row=()=>Math.round((r.p().y+r.p().h)/16);
    const fend=()=>{ const p=r.p(); if(!p.onGround||r.hook().state!=='idle') return false; const px=p.x+6, py=p.y+7;
      if(r.pulseCd()<=0&&r.enemies().some(e=>e.alive&&(e.type==='seeker'||e.type==='hunter')&&Math.hypot(e.x-px,e.y-py)<80)){ tick({pulse:true}); tick({}); return true; }
      const e=r.enemies().find(e=>e.alive&&(e.type==='seeker'||e.type==='hunter')&&Math.hypot(e.x-px,e.y-py)<110); if(!e) return false;
      const dx=e.x-px, dy=e.y-py; let aim=null; if(Math.abs(dy)<10) aim='h'; else if(Math.abs(dx)<10&&dy<0) aim='u'; else if(dy<0&&Math.abs(Math.abs(dx)/(-dy)-0.7)<0.35) aim='d';
      if(!aim) return false; if(aim!=='u') tick({[dx>0?'right':'left']:true}); const k={grab:true}; if(aim==='h') k.down=true; if(aim==='u') k.up=true; tick(k); for(let q=0;q<8;q++) tick(); return true; };
    const goTo=(tx,trow)=>{ for(let i=0;i<400;i++){ if(dodge()||fend()) continue; const p=r.p(); if(!p.onGround){ tick(); continue; }
        const rw=row(), west=tx<36; const col=west?(trow===34?8:14.4):(trow===34?62:57.4);
        if(rw===trow){ const d=tx*16-(p.x+6); if(Math.abs(d)<3) return true; tick({[d>0?'right':'left']:true}); continue; }
        if(rw<trow){ tick({[west?'left':'right']:true}); continue; }
        const c2=rw===40?(west?8:62):col; const d=c2*16-(p.x+6); if(Math.abs(d)>3){ tick({[d>0?'right':'left']:true}); continue; } climb(); } return false; };
    const punchGen=(tx,trow,dir)=>{ for(let tries=0;tries<12;tries++){ const n=gens().length; if(!goTo(tx,trow)) continue;
        for(let i=0;i<6&&gens().length===n;i++){ if(dodge()) break; fend(); tick({[dir]:true}); tick({down:true,grab:true}); for(let k=0;k<12;k++) tick(); }
        if(gens().length<n) return true; } return false; };
    punchGen(7,34,'right'); punchGen(15,21,'right'); punchGen(64.5,34,'left'); punchGen(56.5,21,'left');
    while(core()&&performance.now()-t0<limitMs){ if(dodge()||fend()) continue; const p=r.p(); if(!p.onGround){ tick(); continue; }
      if(row()!==21){ goTo(55,21); continue; }
      const c=core(), dy=c.y-(p.y+7), dx=c.x-(p.x+6); let aim=null;
      if(Math.abs(dy)<22&&Math.abs(dx)<200) aim='h'; else if(Math.abs(dx)<22&&dy<0&&dy>-200) aim='u'; else if(dy<0&&Math.abs(Math.abs(dx)/(-dy)-0.7)<0.3&&Math.hypot(dx,dy)<200) aim='d';
      if(aim){ if(aim!=='u') tick({[dx>0?'right':'left']:true}); const k={grab:true}; if(aim==='h') k.down=true; if(aim==='u') k.up=true; tick(k); for(let q=0;q<10;q++) tick(); }
      else { const want=Math.max(49*16+6,Math.min(57*16,c.x)); if(Math.abs(want-(p.x+6))>8) tick({[want>p.x+6?'right':'left']:true}); else tick(); } }
    r.run(60); return 'gens left '+gens().length+', core '+(core()?'alive hp '+core().hp:'destroyed')+', '+(f/60).toFixed(0)+'s, hits '+hits+', deaths '+r.info().falls+', bands dodged '+dodges+', state '+r.info().state; },

  // ---- composed top-down levels: follow the level's own route, using each room type's solve script ----
  composed(lv,calm,from=0,to=1e9,maxMs=38000){ const log=[], t0=performance.now();
    if(!from){ r.start(lv); if(calm) r.enemies().forEach(e=>{ if(e.type!=='brood') e.alive=false; }); r.run(20); }
    const RR=window.RR_ROOMS, def=r.def(), cells=def.rooms.cells, byId=id=>cells[id];
    const Rof=c=>({g:(lx,ly)=>[c.ox+(c.flipX?RR.RW-1-lx:lx),c.oy+(c.flipY?RR.RH-1-ly:ly)],dir:d=>c.flipX?({left:'right',right:'left'}[d]||d):c.flipY?({up:'down',down:'up'}[d]||d):d,
      pitNS:c.pitNS,termIndex:c.termIndex,exitGroup:c.exitGroup,meta:c.meta||{},
      beyond:s=>{ const [dx,dy]=RR.DOOR_LOCAL[s]; return [c.ox+dx+(s==='E'?1:s==='W'?-1:0),c.oy+dy+(s==='S'?1:s==='N'?-1:0)]; }});
    const roomAt=()=>{ const [tx,ty]=T.tileOf(); return cells.find(c=>tx>=c.ox&&tx<c.ox+RR.RW&&ty>=c.oy&&ty<c.oy+RR.RH); };
    let cur=from?roomAt():cells.find(c=>c.type==='startRoom'), fromSide=from?this._from:null; if(!cur) return 'not inside a room at '+T.tileOf();
    let i=from; const end=Math.min(to,def.route.length);
    for(;i<end;i++){ if(performance.now()-t0>maxMs){ log.push('PAUSED at step '+i); break; }
      const step=def.route[i];
      if(step.solve!=null){ const c=byId(step.solve); const t=RR.TYPES[c.type]; log.push(c.cx+','+c.cy+' '+c.type+': '+(t.solve?t.solve(T,Rof(c)):'-')); continue; }
      const to2=byId(step.go); const side=Object.keys(cur.links).find(s=>cur.links[s].to===to2.cy*def.rooms.cols+to2.cx); if(!side){ log.push('NO LINK '+cur.cx+','+cur.cy+' -> '+to2.cx+','+to2.cy); continue; }
      const ct=RR.TYPES[cur.type]; if(ct.cross&&fromSide&&fromSide!==side) log.push('  cross '+ct.cross(T,Rof(cur),fromSide,side));
      const [dx,dy]=RR.DOOR_LOCAL[side], door=[cur.ox+dx,cur.oy+dy];
      if(cur.links[side].kind==='secret'&&r.wallT(door[0],door[1])){ const stand=[cur.ox+dx-(side==='E'?1:side==='W'?-1:0),cur.oy+dy-(side==='S'?1:side==='N'?-1:0)]; const face={N:'up',S:'down',E:'right',W:'left'}[side]; log.push('  secret '+T.grappleSecret(stand[0],stand[1],face,door[0],door[1])); }
      const inside=[to2.ox+(side==='E'?0:side==='W'?RR.RW-1:6),to2.oy+(side==='S'?0:side==='N'?RR.RH-1:4)];
      T.killNear(180); const w=RR.until(T,()=>{ T.walkToSafe(inside[0],inside[1]); },()=>{ const [tx,ty]=T.tileOf(); return tx>=to2.ox&&tx<to2.ox+RR.RW&&ty>=to2.oy&&ty<to2.oy+RR.RH; },4);
      log.push('-> '+to2.cx+','+to2.cy+' ('+to2.type+') '+w); fromSide=RR.OPP[side]; cur=to2; }
    this._from=fromSide;
    if(i>=def.route.length){ r.run(30); log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls+' parts '+r.pickups().filter(q=>q.got).length+'/'+r.pickups().length+' terms '+r.info().terms.join(',')); }
    else log.push('NEXT '+i+' of '+def.route.length);
    return log.join('\n'); },
  // ---- composed side levels: run every section's own check in order ----
  // opts: resume (carry on from the current position), wind:false (switch the level's gusts off), maxMs
  composedSide(lv,calm,o={}){ const log=[], t0=performance.now(); if(!o.resume){ r.start(lv); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(10); }
    const def=r.def(); if(def.wind){ if(def.wind.force0==null) def.wind.force0=def.wind.force; def.wind.force=o.wind===false?0:def.wind.force0; }
    const S=window.RR_SECTIONS.SECTIONS, ctx={termIndex:def.sgen.termBase||0}; let paused=false, skipped=0, problem=false;
    for(const s of def.sections){ if(s.name!=='goal'&&r.info().tx>=s.x+s.w-2){ if(s.name==='towerDeck'||s.name==='groundDeck') ctx.termIndex++; skipped++; continue; }
      if(performance.now()-t0>(o.maxMs||38000)){ log.push('PAUSED before '+s.name+' at '+s.x); paused=true; break; }
      if(problem){ r.teleport((s.x+1)*16,s.g*16-20); r.run(5); log.push('  (skipped ahead to '+s.name+' at '+s.x+')'); }   // a failed section would otherwise sink every later check
      const res=S[s.name].check(T,s.x,s.g,ctx); if(s.name==='towerDeck'||s.name==='groundDeck') ctx.termIndex++; log.push(s.x+' '+res); problem=/FELL|FAILED|timeout|no platform|NO CATCH|LOST/.test(res); if(problem) log.push('  ^ problem in '+s.name+' at '+s.x); }
    if(skipped) log.unshift(skipped+' sections already passed');
    if(!paused){ r.run(30); log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls+' relays '+r.info().got+' clock '+document.getElementById('tim').textContent); }
    return log.join('\n'); }
};
})();
