/* Relay Rigger — side-scroll section composer.
   A composed side level is a run of sections laid end to end on a common ground row g. Each section declares its
   width, which tiles are ground, how to build itself, a one-time teaching hint, and a check script that drives the
   test bot across it. Generation is seeded, so a level is identical on every load.
   Hybrid levels keep a hand-built set piece in def.extra(B, endX): with sgen.extraFirst it is drawn first and the
   composed run starts at sgen.x0; otherwise it is drawn after the run, shifted to endX-1 (see shiftB in levels.js). */
(() => {
let seed=1; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pick=a=>a[Math.floor(rnd()*a.length)];
const taught=new Set();
// a short steel overhang above the ground; its underside has a crack, and a hard hat is sealed inside
const hatOverhang=(B,x,g)=>{ B.steel(x-1,x+1,g-7,g-6); B.crack(x,g-6,false); B.hat(x,g-7); };
// a pocket like the hat's, with a dossier page sealed inside
const pageOverhang=(B,x,g)=>{ B.steel(x-1,x+1,g-7,g-6); B.crack(x,g-6,false); B.page(x,g-7); };
const propAt=(B,t,x,g,opts={})=>{ if(t==='fence') B.prop('fence',{x0:x,x1:x+opts.len||x+8,row:g-1}); else B.prop(t,{x,row:g-1}); };

// tier 0 = safe, 1 = act 1, 2 = act 2/3, 3 = act 4. Tier-3 extras never consume rnd() below tier 3, so lower levels keep their layouts.
const SECTIONS={
  start:{w:12,tier:0,ground:[[0,11]],
    build(B,x,g){ B.start(x+2,g-1); B.prop('cabin',{x:x+3.5,row:g-1}); }, check(){ return 'start'; } },
  goal:{w:14,tier:0,ground:[[0,13]],
    build(B,x,g){ B.goal(x+7,g-1); B.prop('fence',{x0:x+1,x1:x+5,row:g-1}); B.prop('crates',{x:x+10,row:g-1}); },
    check(T,x){ T.walkFight(x+2); for(let f=0;f<600&&T.r.info().state==='play';f++) T.r.run(1,{right:true}); return 'goal '+T.r.info().state; } },
  flat:{w:16,tier:0,ground:[[0,15]],
    build(B,x,g,c){ propAt(B,pick(['cone','drum','crates','vent','tank']),x+4+Math.floor(rnd()*6),g); if(c.forceHat||(c.tier>=1&&rnd()<0.45)){ hatOverhang(B,x+11,g); c.forceHat=false; }
      if(c.tier>=1&&rnd()<0.5) B.drone(x+4,x+12,g-1); else if(c.tier>=1&&rnd()<0.4&&c.prev!=='crumbleBridge') B.enemy('skitter',x+9,g-1); /* a skitter here would wander back onto the planks */ else if(c.tier>=3&&rnd()<0.5) B.enemy('seeker',x+10,g-4);
      if(rnd()<0.6) B.relay(x+8,g-1); },
    check(T,x){ return 'flat '+T.walkFight(x+15); },
    page(B,x,g){ pageOverhang(B,x+5,g); }, pageCheck(T,x){ return 'flat '+T.walkFight(x+4)+' '+T.crackUp(x+5)+' '+T.walkFight(x+15); } },
  gap:{w:16,tier:1,ground:[[0,5],[10,15]],hint:"A gap. Fire up (▲ + GRAB) at the girder, reel in, and walk across it.",
    build(B,x,g){ B.girder(x,x+15,g-7); B.prop('cone',{x:x+4.4,row:g-1}); B.relay(x+8,g-8); },
    check(T,x,g){ return 'gap '+T.walkFight(x+3)+' '+T.calmSpell(x+3)+' '+T.climb()+' '+T.walkTill(x+12,g); } },
  ceilingSwing:{w:30,tier:1,ground:[[0,4],[17,29]],hint:"Hook the ceiling, swing low through the pit, and let go at the top of the arc.",
    build(B,x,g){ B.steel(x,x+24,g-13,g-12); B.prop('chains',{x:x+8,row:g-11,len:30}); B.prop('chains',{x:x+14,row:g-11,len:44}); B.relay(x+11,g+1); B.prop('cone',{x:x+17.4,row:g-1});
      if(rnd()<0.5){ B.girder(x+25,x+28,g-14); B.hat(x+12,g-14); } },
    check(T,x,g){ return 'swing '+T.swingAcross(x+4,g,x+17); } },
  ceilingRun:{w:40,tier:2,ground:[[0,4],[31,39]],hint:"One long ceiling over the gap. Swing, let go at the top, fire again straight away. Chain it across.",
    build(B,x,g){ B.steel(x,x+36,g-13,g-12); B.prop('chains',{x:x+9,row:g-11,len:24}); B.prop('chains',{x:x+18,row:g-11,len:40}); B.prop('chains',{x:x+26,row:g-11,len:20}); B.relay(x+17,g+1);
      if(rnd()<0.6){ B.girder(x+37,x+39,g-14); B.hat(x+18,g-14); } },
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
    build(B,x,g,c){ B.drone(x+3,x+9,g-1); B.drone(x+10,x+17,g-1); propAt(B,pick(['fence','drum','crates']),x+6,g); if(rnd()<0.5) B.relay(x+16,g-1); if(c.tier>=3) B.enemy('hunter',x+14,g-5); },
    check(T,x){ return 'drones '+T.walkFight(x+19); } },
  nest:{w:18,tier:2,ground:[[0,17]],
    build(B,x,g,c){ B.enemy('spitter',x+5,g-1); B.enemy('skitter',x+11,g-1); B.prop('crates',{x:x+13,row:g-1}); B.relay(x+8,g-1); if(c.tier>=3) B.enemy('seeker',x+15,g-4); },
    check(T,x){ return 'nest '+T.walkFight(x+17); } },
  liftUp:{w:22,tier:2,dg:-12,ground:[[0,13]],hint:"Ride the lift up.",
    build(B,x,g,c){ B.platform(x+10,g,x+10,g-12,4,{speed:34}); B.steel(x+14,x+21,g-12,c.H-1); B.prop('antenna',{x:x+18,row:g-13}); B.relay(x+18,g-13); },
    check(T,x,g){ const r=T.r; let s='lift '+T.walkFight(x+9); const q=r.plats().find(q=>Math.abs(q.x0-(x+10)*16)<8&&Math.abs(q.y0-g*16)<8); if(!q) return s+' no lift';
      const on=()=>r.p().plat===q&&r.p().onGround; T.holdAt(x+9,()=>q.y>=g*16-2&&q.hold>0.6,1500); // board as soon as it has arrived
      T.until({right:true},()=>on()&&Math.abs(r.p().x+6-(q.x+q.w/2))<10,300);
      const up=T.until({},()=>r.p().onGround&&r.info().ty<=g-12+0.5,2400); // ride up (or get scooped up while waiting in the shaft)
      return s+' '+(up>=0?'up ':'never rose ')+T.walkTill(x+15,g-12); } },
  dropDown:{w:14,tier:2,dg:12,grounds:g=>[[0,5,g],[6,13,g+12]],
    build(B,x,g){ B.prop('sign',{x:x+3,row:g-1}); B.relay(x+9,g+11); },
    check(T,x,g){ return 'drop '+T.walkTill(x+9,g+12); } },
  // a cable line strung from a ledge down to a lower landing: hook it and slide. Slope matches the hand-built Skyhook lines.
  zipDown:{w:44,tier:3,dg:12,grounds:g=>[[0,7,g],[36,43,g+12]],hint:"A zip line. Fire up at the cable and hold GRAB to slide down it. Let go early to drop off.",
    build(B,x,g){ B.zip(x+4,g-4,x+37,g+9); /* the line starts back over the ledge, so firing up from anywhere near the edge catches it */ B.prop('antenna',{x:x+2,row:g-1}); B.prop('sign',{x:x+1,row:g-1}); B.relay(x+22,g+4); B.prop('dish',{x:x+41,row:g+11}); },
    check(T,x,g){ const r=T.r; let s='zip '+T.walkFight(x+7), got=-1;
      for(let a=0;a<4&&got<0;a++){ T.walkSide(x+6.5); T.calmSpell(x+6.5); r.run(2,{}); got=T.until({up:true,grab:true},()=>r.hook().state==='zip',90); }
      if(got<0) return s+' NO CATCH';
      const land=T.until({grab:true},()=>r.hook().state!=='zip'&&r.p().onGround,700);
      return s+' '+(land>=0?'landed '+r.info().tx:'LOST')+' '+T.walkTill(x+42,g+12); } },
  // a relay terminal at ground level, for levels where a fall from a tower deck would hurt
  groundDeck:{w:44,tier:1,ground:[[0,43]],hint:"A relay terminal on the ground. Work it, and fight off whatever comes.",
    build(B,x,g,c){ B.terminal(x+20,g-1,c.term); B.check(x+6,g-1); B.relay(x+12,g-1); B.relay(x+34,g-1);
      B.prop('fence',{x0:x+8,x1:x+16,row:g-1}); B.prop('crates',{x:x+30,row:g-1}); B.prop('antenna',{x:x+24,row:g-1}); B.prop('pylon',{x:x+38,top:g-14,row:g-1});
      if(c.tier>=2) B.enemy('skitter',x+36,g-1); B.drone(x+26,x+40,g-4); },
    check(T,x,g,c){ return 'ground deck '+T.walkFight(x+20)+' '+T.defendSide(c.termIndex)+' '+T.walkFight(x+42); } },
  // ---- over/under and elevation sections: from level 2 on, the route stops being one flat line
  // a raised slab with a tunnel underneath: walk under (skitters) or climb over from the girder stub (a drone, a relay)
  slabTunnel:{w:24,tier:1,ground:[[0,23]],hint:"Over or under? The tunnel is quicker; the top is quieter.",
    build(B,x,g,c){ B.steel(x+6,x+17,g-6,g-3); B.girder(x+1,x+6,g-7); B.relay(x+12,g-7); B.relay(x+9,g-1); B.enemy('skitter',x+11,g-1); if(c.tier>=2) B.enemy('skitter',x+15,g-1); if(c.tier>=2) B.drone(x+8,x+16,g-7); B.prop('sign',{x:x+3,row:g-1}); B.prop('vent',{x:x+20,row:g-1}); },
    check(T,x){ return 'tunnel '+T.walkFight(x+23); },
    page(B,x,g){ B.page(x+15,g-7); }, pageCheck(T,x){ const n0=T.r.pages().filter(q=>q.got).length; const s='tunnel-top '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkFight(x+15); return s+(T.r.pages().filter(q=>q.got).length>n0?' page':' NO PAGE')+' '+T.walkFight(x+23); } },
  // the same slab over live cable: hook its underside and swing through in short arcs, or take the top
  slabSparks:{w:28,tier:2,ground:[[0,27]],hint:"Live cable under the slab. Hook the slab's underside and swing over it, or go over the top.",
    build(B,x,g,c){ B.steel(x+6,x+21,g-8,g-5); B.girder(x+1,x+6,g-9); B.sparks(x+10,x+11,g-1); B.sparks(x+16,x+17,g-1); B.relay(x+13,g-1); B.relay(x+13,g-9); B.drone(x+8,x+19,g-9); B.prop('chains',{x:x+13,row:g-4,len:20}); if(c.tier>=3) B.enemy('seeker',x+24,g-4); },
    check(T,x,g){ return 'slab '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkFight(x+26); } },
  // two tiers: a long live cable on the ground, girders at two heights above it
  twoTier:{w:32,tier:1,ground:[[0,31]],hint:"The cable runs the whole way. Climb to the first girder, up to the second, and drop off its far end.",
    build(B,x,g,c){ B.girder(x+2,x+14,g-6); B.girder(x+12,x+28,g-11); B.sparks(x+7,x+26,g-1); B.relay(x+8,g-7); B.relay(x+20,g-12); B.prop('fence',{x0:x+3,x1:x+6,row:g-1}); if(c.tier>=2) B.drone(x+14,x+26,g-12); B.prop('pylon',{x:x+29,top:g-12,row:g-1}); },
    check(T,x,g){ return 'tiers '+T.walkFight(x+4)+' '+T.climb()+' '+T.walkSide(x+13)+' '+T.climb()+' '+T.walkFight(x+30); },
    page(B,x,g){ B.page(x+27,g-12); } },
  // a shaft of staggered girders up to a higher ledge
  shaftUp:{w:20,tier:2,dg:-12,grounds:g=>[[0,9,g],[10,19,g-12]],hint:"Up the shaft: the girders stagger. Fire up from under each one.",
    build(B,x,g,c){ B.girder(x+5,x+9,g-4); B.girder(x+7,x+11,g-8); B.girder(x+5,x+9,g-12); B.relay(x+7,g-9); B.relay(x+14,g-13); B.prop('tower',{x0:x+4.4,x1:x+10.6,top:g-12,row:g-1}); if(c.tier>=3) B.enemy('seeker',x+3,g-6); B.prop('antenna',{x:x+16,row:g-13}); },
    check(T,x,g){ let s='shaft '+T.walkFight(x+8); for(let i=0;i<3;i++){ s+=' '+T.climb(); T.walkSide(x+8); } return s+' '+T.walkTill(x+18,g-12); } },
  // a hollow under a boulder: drop in, walk the hollow, hook the girder past it to climb out
  dip:{w:20,tier:1,depth:4,grounds:g=>[[0,5,g],[6,14,g+4],[15,19,g]],hint:"A hollow under the rock. Drop in, and hook the girder past the boulder to climb out.",
    build(B,x,g,c){ B.rock(x+6,x+12,g-10,g-3); B.girder(x+13,x+16,g-3); B.relay(x+9,g+3); B.enemy('skitter',x+10,g+3); if(c.tier>=2) B.enemy('spitter',x+7,g+3); B.prop('sign',{x:x+3,row:g-1}); B.prop('drum',{x:x+18,row:g-1}); },
    check(T,x,g){ return 'dip '+T.walkTill(x+8,g+4)+' '+T.walkFight(x+14)+' '+T.climb()+' '+T.walkTill(x+18,g); } },   // x+14: a shot from the boulder's edge column would hook its underside
  // a pit under a low ceiling: short-rope swings, several in a row
  lowCeilingPit:{w:22,tier:2,ground:[[0,4],[15,21]],hint:"Low ceiling over the pit: short swings. Hook, swing, let go, hook again.",
    build(B,x,g,c){ B.steel(x+2,x+17,g-6,g-5); B.prop('chains',{x:x+8,row:g-4,len:10}); B.prop('chains',{x:x+12,row:g-4,len:12}); B.relay(x+9,g+1); B.prop('cone',{x:x+16.4,row:g-1}); if(c.tier>=3) B.enemy('seeker',x+19,g-3); },
    check(T,x,g){ return 'low '+T.swingAcross(x+4,g,x+15,{rope:48,vxRel:90}); } },
  towerDeck:{w:60,tier:1,ground:[[0,59]],hint:"Climb the tower one girder at a time: fire up, reel in, step over. Reroute the terminal on the deck.",
    build(B,x,g,c){ B.girder(x+4,x+10,g-5); B.girder(x+8,x+14,g-10); B.girder(x+2,x+10,g-15); B.girder(x+8,x+52,g-19);
      B.terminal(x+30,g-20,c.term); B.check(x+12,g-20); B.relay(x+6,g-16); B.relay(x+44,g-20);
      B.prop('tower',{x0:x+1.4,x1:x+15.6,top:g-19,row:g-1}); B.prop('pylon',{x:x+24,top:g-18,row:g-1}); B.prop('pylon',{x:x+40,top:g-18,row:g-1}); B.prop('dish',{x:x+36,row:g-20});
      if(c.tier>=2) B.enemy('skitter',x+22,g-20); B.drone(x+34,x+48,g-20); },
    page(B,x,g){ B.page(x+51,g-20); },
    check(T,x,g,c){ let s='deck '+T.walkFight(x+5); for(let i=0;i<4;i++){ let cl=T.climb(); if(/FAILED/.test(cl)){ T.walkSide(x+9); cl=T.climb(); } s+=' '+cl; T.walkSide(x+9); } s+=' '+T.walkFight(x+30)+' '+T.defendSide(c.termIndex); return s+' '+T.walkFight(x+56); } },
};
const BREATH=['flat','drones','nest'], DECKS=['towerDeck','groundDeck'];

function composeSide(def){
  const G=def.sgen; seed=G.seed||1; for(let i=0;i<5;i++) rnd();
  const g0=G.g||26, tier=G.tier||1, len=G.len||360, nTerms=G.terminal===false?0:(G.terminals||1), x0=G.x0||0;
  const deckAt=nTerms===1?[0.55]:nTerms===2?[0.38,0.76]:[0.3,0.58,0.85];
  const deckName=def.fallDamage||G.deck==='ground'?'groundDeck':'towerDeck';
  const pool=(G.pool||Object.keys(SECTIONS).filter(k=>!['start','goal',...DECKS].includes(k)&&SECTIONS[k].tier<=tier)).filter(k=>SECTIONS[k]);
  const hazards=pool.filter(k=>!BREATH.includes(k)), breathers=pool.filter(k=>BREATH.includes(k));
  const list=[]; let x=x0, g=g0, last='start', run=0, decks=0;
  if(!G.noStart){ list.push({name:'start',x,g}); x+=SECTIONS.start.w; }
  // levels with fall damage never drop the worker: no descents, and the terminal stays on the ground
  const fits=k=>{ const dg=SECTIONS[k].dg||0; if(def.fallDamage&&dg>0) return false; return g+dg>=22&&g+dg<=(G.maxG||g0+12); };
  const tail=(G.noGoal?0:SECTIONS.goal.w)+40;
  while(x<len-tail){
    let name;
    if(decks<nTerms&&x>len*deckAt[decks]&&g>=22){ name=deckName; decks++; }
    else if((run>=2||last==='climbOver')&&breathers.length){ name=pick(breathers.filter(k=>k!==last)); }
    else { const opts=hazards.filter(k=>k!==last&&fits(k)&&!(k==='crumbleBridge'&&(last==='nest'||last==='drones'))); name=opts.length?pick(opts):pick(breathers.length?breathers:pool); }
    if(last==='crumbleBridge'&&name==='nest') name='flat';
    run=BREATH.includes(name)?0:run+1;
    list.push({name,x,g}); x+=SECTIONS[name].w; g+=SECTIONS[name].dg||0; last=name;
  }
  while(decks<nTerms){ list.push({name:deckName,x,g}); x+=SECTIONS[deckName].w; decks++; }
  if(!G.noGoal){ list.push({name:'goal',x,g}); x+=SECTIONS.goal.w; }
  const endX=x;
  const W=Math.max(endX+2,G.extraFirst?(G.extraW||0):(G.extraW?endX-1+G.extraW:0)), H=Math.max(Math.max(...list.map(s=>s.g+(SECTIONS[s.name].depth||0)))+4,G.extraH||0);   // depth: a section whose floor dips below its ground row
  const hints=[], ctx={H,tier,term:G.term||{time:14,waves:[[0.1,'hunter','hunter'],[0.4,'skitter','hunter'],[0.75,'skitter','skitter','seeker']]},termIndex:G.termBase||0};
  const ENEMY_HINTS={skitter:"Skitters take <b>two</b> punches: ▼ + GRAB, twice.",seeker:"Purple seekers hunt you and lunge. Punch them before they close in.",spitter:"A spitter pod. Punch its plasma out of the air, or punch the pod twice.",hunter:"Hunters fly in from above. Punch up (▲ + GRAB) or diagonally when they dive."};
  for(const s of list){ const sec=SECTIONS[s.name]; if(sec.hint&&!taught.has(s.name)){ taught.add(s.name); hints.push([s.x,sec.hint]); } }
  const probe={ drone(){}, enemy(t,x){ if(ENEMY_HINTS[t]&&!taught.has('enemy:'+t)){ taught.add('enemy:'+t); hints.push([x-4,ENEMY_HINTS[t]]); } } };
  let nHats=0; probe.hat=()=>{ nHats++; };
  { const noop=()=>{}; const PB=new Proxy(probe,{get:(o,k)=>o[k]||noop}); const s0=seed; seed=(G.seed||1)*7+3; for(const s of list) SECTIONS[s.name].build(PB,s.x,s.g,ctx); seed=s0; }
  if(!nHats&&list.some(s=>s.name==='flat')) ctx.forceHat=true;
  { const spots=list.filter(s=>SECTIONS[s.name].page), want=G.pages??1; for(let i=0;i<want&&spots.length;i++) spots[Math.min(spots.length-1,Math.floor((i+0.5)*spots.length/want))].page=true; }
  const sections=list.map(s=>({name:s.name,x:s.x,w:SECTIONS[s.name].w,g:s.g,page:!!s.page}));
  const rock=G.steel?'steel':'rock';
  const build=B=>{ if(def.extra&&G.extraFirst) def.extra(B,endX); seed=(G.seed||1)*7+3; let prev=null;
    for(const s of list){ const sec=SECTIONS[s.name]; const grounds=sec.grounds?sec.grounds(s.g):sec.ground.map(([a,b])=>[a,b,s.g]); for(const [a,b,row] of grounds) B[rock](s.x+a,s.x+b,row,H-1);
      if(sec.tier>0&&!DECKS.includes(s.name)&&s.name!=='goal') B.check(s.x+1,s.g-1);
      ctx.prev=prev; sec.build(B,s.x,s.g,ctx); if(s.page) sec.page(B,s.x,s.g,ctx); prev=s.name; }
    if(def.extra&&!G.extraFirst) def.extra(B,endX); };
  return {W,H,build,hints,sections,endX};
}
function composeAll(levels){ taught.clear(); for(const k of ['gap','ceilingSwing','climbOver','cableHazard','towerDeck']) taught.add(k); /* level 1 teaches these by hand */
  for(const lv of levels) if(lv.mode!=='top'&&lv.sgen){ const c=composeSide(lv), G=lv.sgen, off=G.shiftHints?c.endX-1:0;
    const hand=(lv.hints||[]).map(([hx,t])=>[hx+off,t]);
    Object.assign(lv,{W:c.W,H:c.H,build:c.build,hints:hand.concat(c.hints).sort((a,b)=>a[0]-b[0]),sections:c.sections,endX:c.endX});
    if(lv.flood&&lv.floodAt!=null) lv.flood.trigger=c.endX-1+lv.floodAt; } }
window.RR_SECTIONS={SECTIONS,composeSide,composeAll};
})();
