/* Relay Rigger — side-scroll section composer.
   A composed side level is a run of sections laid end to end on a common ground row g. Each section declares its
   width, which tiles are ground, how to build itself, a one-time teaching hint, and a check script that drives the
   test bot across it. Generation is seeded, so a level is identical on every load. */
(() => {
let seed=1; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pick=a=>a[Math.floor(rnd()*a.length)];
const taught=new Set();
const PROPS=['cone','drum','crates','fence','sign','antenna','vent','tank','dish'];
const propAt=(B,t,x,g,opts={})=>{ if(t==='fence') B.prop('fence',{x0:x,x1:x+opts.len||x+8,row:g-1}); else B.prop(t,{x,row:g-1}); };

// tier 0 = safe, 1 = act 1, 2 = act 2/3, 3 = act 4
const SECTIONS={
  start:{w:12,tier:0,ground:[[0,11]],
    build(B,x,g){ B.start(x+2,g-1); B.prop('cabin',{x:x+3.5,row:g-1}); }, check(){ return 'start'; } },
  goal:{w:14,tier:0,ground:[[0,13]],
    build(B,x,g){ B.goal(x+7,g-1); B.prop('fence',{x0:x+1,x1:x+5,row:g-1}); B.prop('crates',{x:x+10,row:g-1}); },
    check(T,x){ T.walkFight(x+2); for(let f=0;f<600&&T.r.info().state==='play';f++) T.r.run(1,{right:true}); return 'goal '+T.r.info().state; } },
  flat:{w:16,tier:0,ground:[[0,15]],
    build(B,x,g,c){ propAt(B,pick(['cone','drum','crates','vent','tank']),x+4+Math.floor(rnd()*6),g); if(c.tier>=1&&rnd()<0.5) B.drone(x+4,x+12,g-1); else if(c.tier>=1&&rnd()<0.4) B.enemy('skitter',x+9,g-1); if(rnd()<0.6) B.relay(x+8,g-1); },
    check(T,x){ return 'flat '+T.walkFight(x+15); } },
  gap:{w:16,tier:1,ground:[[0,5],[10,15]],hint:"A gap. Fire up (▲ + GRAB) at the girder, reel in, and walk across it.",
    build(B,x,g){ B.girder(x,x+15,g-7); B.prop('cone',{x:x+4.4,row:g-1}); B.relay(x+8,g-8); },
    check(T,x,g){ return 'gap '+T.walkFight(x+3)+' '+T.climb()+' '+T.walkTill(x+12,g); } },
  ceilingSwing:{w:30,tier:1,ground:[[0,4],[17,29]],hint:"Hook the ceiling, swing low through the pit, and let go at the top of the arc.",
    build(B,x,g){ B.steel(x,x+24,g-13,g-12); B.prop('chains',{x:x+8,row:g-11,len:30}); B.prop('chains',{x:x+14,row:g-11,len:44}); B.relay(x+11,g+1); B.prop('cone',{x:x+17.4,row:g-1}); },
    check(T,x,g){ return 'swing '+T.swingAcross(x+4,g,x+17); } },
  ceilingRun:{w:38,tier:2,ground:[[0,4],[31,37]],hint:"One long ceiling over the gap. Swing, let go at the top, fire again straight away. Chain it across.",
    build(B,x,g){ B.steel(x,x+36,g-13,g-12); B.prop('chains',{x:x+9,row:g-11,len:24}); B.prop('chains',{x:x+18,row:g-11,len:40}); B.prop('chains',{x:x+26,row:g-11,len:20}); B.relay(x+17,g+1); },
    check(T,x,g){ return 'run '+T.swingAcross(x+4,g,x+31); } },
  anchorRun:{w:48,tier:2,ground:[[0,4],[42,47]],hint:"Separate girders over the pit. Swing from one to the next: let go at the top of each arc and fire again.",
    build(B,x,g){ for(let i=0;i<4;i++){ const c=x+11+8*i; B.girder(c-2,c+1,g-12); } B.relay(x+19,g-13); B.prop('sign',{x:x+2,row:g-1}); },
    check(T,x,g){ return 'hops '+T.swingAcross(x+4,g,x+42); } },
  cableHazard:{w:14,tier:1,ground:[[0,13]],hint:"Live cable ahead. Climb the girder and walk over it.",
    build(B,x,g){ B.girder(x,x+11,g-7); B.sparks(x+7,x+9,g-1); B.prop('sign',{x:x+4,row:g-1}); },
    check(T,x,g){ return 'cable '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkTill(x+13,g); } },
  climbOver:{w:18,tier:1,ground:[[0,17]],hint:"Over the pillar: fire up, reel in, step across.",
    build(B,x,g){ B.girder(x,x+5,g-4); B.girder(x+6,x+11,g-10); B.steel(x+12,x+16,g-10,g-1); B.relay(x+8,g-11); },
    check(T,x,g){ return 'over '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkSide(x+8)+' '+T.climb()+' '+T.walkTill(x+17,g); } },
  crumbleBridge:{w:25,tier:2,ground:[[0,5],[21,24]],hint:"This bridge crumbles behind you. Don't stop.",
    build(B,x,g){ B.crumble(x+6,x+20,g); B.prop('cone',{x:x+2.4,row:g-1}); },
    check(T,x,g){ const r=T.r; let s='crumble '+T.walkFight(x+3); for(let i=0;i<8;i++){ T.walkFight(x+3); r.run(10); } T.until({},()=>!r.crumbles().some(c=>c.gone||c.t>=0),400); return s+' '+T.walkTill(x+21,g,true); } },
  ferry:{w:26,tier:2,ground:[[0,3],[22,25]],hint:"Step onto the ferry platform and ride it across.",
    build(B,x,g){ B.platform(x+4,g,x+18,g,4); B.relay(x+12,g-3); },
    check(T,x,g){ return 'ferry '+T.ridePlatform(x+3,x+4,x+18,g,x+22); } },
  drones:{w:20,tier:1,ground:[[0,19]],
    build(B,x,g){ B.drone(x+3,x+9,g-1); B.drone(x+10,x+17,g-1); propAt(B,pick(['fence','drum','crates']),x+6,g); if(rnd()<0.5) B.relay(x+16,g-1); },
    check(T,x){ return 'drones '+T.walkFight(x+19); } },
  nest:{w:18,tier:2,ground:[[0,17]],
    build(B,x,g){ B.enemy('spitter',x+5,g-1); B.enemy('skitter',x+11,g-1); B.prop('crates',{x:x+13,row:g-1}); B.relay(x+8,g-1); },
    check(T,x){ return 'nest '+T.walkFight(x+17); } },
  liftUp:{w:22,tier:2,dg:-12,ground:[[0,13]],hint:"Ride the lift up.",
    build(B,x,g,c){ B.platform(x+10,g,x+10,g-12,4,{speed:34}); B.steel(x+14,x+21,g-12,c.H-1); B.prop('antenna',{x:x+18,row:g-13}); B.relay(x+18,g-13); },
    check(T,x,g){ const r=T.r; let s='lift '+T.walkFight(x+9); const q=r.plats().find(q=>Math.abs(q.x0-(x+10)*16)<8&&Math.abs(q.y0-g*16)<8); if(!q) return s+' no lift';
      const on=()=>r.p().plat===q&&r.p().onGround; T.until({},()=>q.y>=g*16-2&&q.hold>0.6,1500); // board as soon as it has arrived
      T.until({right:true},()=>on()&&Math.abs(r.p().x+6-(q.x+q.w/2))<10,300);
      const up=T.until({},()=>r.p().onGround&&r.info().ty<=g-12+0.5,2400); // ride up (or get scooped up while waiting in the shaft)
      return s+' '+(up>=0?'up ':'never rose ')+T.walkTill(x+15,g-12); } },
  dropDown:{w:14,tier:2,dg:12,grounds:g=>[[0,5,g],[6,13,g+12]],
    build(B,x,g){ B.prop('sign',{x:x+3,row:g-1}); B.relay(x+9,g+11); },
    check(T,x,g){ return 'drop '+T.walkTill(x+9,g+12); } },
  towerDeck:{w:60,tier:1,ground:[[0,59]],hint:"Climb the tower one girder at a time: fire up, reel in, step over. Reroute the terminal on the deck.",
    build(B,x,g,c){ B.girder(x+4,x+10,g-5); B.girder(x+8,x+14,g-10); B.girder(x+2,x+10,g-15); B.girder(x+8,x+52,g-19);
      B.terminal(x+30,g-20,c.term); B.check(x+12,g-20); B.relay(x+6,g-16); B.relay(x+44,g-20);
      B.prop('tower',{x0:x+1.4,x1:x+15.6,top:g-19,row:g-1}); B.prop('pylon',{x:x+24,top:g-18,row:g-1}); B.prop('pylon',{x:x+40,top:g-18,row:g-1}); B.prop('dish',{x:x+36,row:g-20});
      if(c.tier>=2) B.enemy('skitter',x+22,g-20); B.drone(x+34,x+48,g-20); },
    check(T,x,g,c){ let s='deck '+T.walkFight(x+5); for(let i=0;i<4;i++){ s+=' '+T.climb(); T.walkSide(x+9); } s+=' '+T.walkFight(x+30)+' '+T.defendSide(c.termIndex); return s+' '+T.walkTill(x+56,g); } },
};

function composeSide(def){
  const G=def.sgen; seed=G.seed||1; for(let i=0;i<5;i++) rnd();
  const g0=G.g||26, tier=G.tier||1, len=G.len||360, nTerms=G.terminal===false?0:(G.terminals||1);
  const deckAt=nTerms===1?[0.55]:nTerms===2?[0.38,0.76]:[0.3,0.58,0.85];
  const pool=(G.pool||Object.keys(SECTIONS).filter(k=>!['start','goal','towerDeck'].includes(k)&&SECTIONS[k].tier<=tier)).filter(k=>SECTIONS[k]);
  const hazards=pool.filter(k=>!['flat','drones','nest'].includes(k)), breathers=pool.filter(k=>['flat','drones','nest'].includes(k));
  const list=[{name:'start',x:0,g:g0}]; let x=SECTIONS.start.w, g=g0, last='start', run=0, decks=0;
  const fits=k=>{ const dg=SECTIONS[k].dg||0; return g+dg>=22&&g+dg<=(G.maxG||g0+12); };
  while(x<len-SECTIONS.goal.w-40){
    let name;
    if(decks<nTerms&&x>len*deckAt[decks]&&g>=22){ name='towerDeck'; decks++; }
    else if((run>=2||last==='climbOver')&&breathers.length){ name=pick(breathers.filter(k=>k!==last)); }
    else { const opts=hazards.filter(k=>k!==last&&fits(k)&&!(k==='crumbleBridge'&&(last==='nest'||last==='drones'))); name=opts.length?pick(opts):pick(breathers.length?breathers:pool); }
    run=['flat','drones','nest'].includes(name)?0:run+1;
    list.push({name,x,g}); x+=SECTIONS[name].w; g+=SECTIONS[name].dg||0; last=name;
  }
  while(decks<nTerms){ list.push({name:'towerDeck',x,g}); x+=SECTIONS.towerDeck.w; decks++; }
  list.push({name:'goal',x,g}); const W=x+SECTIONS.goal.w+2, H=Math.max(...list.map(s=>s.g))+4;
  const hints=[], ctx={H:0,tier,term:G.term||{time:14,waves:[[0.1,'hunter','hunter'],[0.4,'skitter','hunter'],[0.75,'skitter','skitter','seeker']]},termIndex:0};
  const ENEMY_HINTS={skitter:"Skitters take <b>two</b> punches: ▼ + GRAB, twice.",seeker:"Purple seekers hunt you and lunge. Punch them before they close in.",spitter:"A spitter pod. Punch its plasma out of the air, or punch the pod twice."};
  for(const s of list){ const sec=SECTIONS[s.name]; if(sec.hint&&!taught.has(s.name)){ taught.add(s.name); hints.push([s.x,sec.hint]); } }
  const probe={ drone(){}, enemy(t,x){ if(ENEMY_HINTS[t]&&!taught.has('enemy:'+t)){ taught.add('enemy:'+t); hints.push([x-4,ENEMY_HINTS[t]]); } } };
  { const noop=()=>{}; const PB=new Proxy(probe,{get:(o,k)=>o[k]||noop}); const s0=seed; seed=(G.seed||1)*7+3; for(const s of list) SECTIONS[s.name].build(PB,s.x,s.g,ctx); seed=s0; }
  const sections=list.map(s=>({name:s.name,x:s.x,w:SECTIONS[s.name].w,g:s.g}));
  ctx.H=H;
  const rock=G.steel?'steel':'rock';
  const build=B=>{ seed=(G.seed||1)*7+3;
    for(const s of list){ const sec=SECTIONS[s.name]; const grounds=sec.grounds?sec.grounds(s.g):sec.ground.map(([a,b])=>[a,b,s.g]); for(const [a,b,row] of grounds) B[rock](s.x+a,s.x+b,row,H-1);
      if(sec.tier>0&&s.name!=='towerDeck'&&s.name!=='goal') B.check(s.x+1,s.g-1);
      sec.build(B,s.x,s.g,ctx); } };
  return {W,H,build,hints,sections};
}
function composeAll(levels){ taught.clear(); for(const k of ['gap','ceilingSwing','climbOver','cableHazard','towerDeck']) taught.add(k); /* level 1 teaches these by hand */ for(const lv of levels) if(lv.mode!=='top'&&lv.sgen){ const c=composeSide(lv); Object.assign(lv,{W:c.W,H:c.H,build:c.build,hints:c.hints,sections:c.sections}); } }
window.RR_SECTIONS={SECTIONS,composeSide,composeAll};
})();
