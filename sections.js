/* Relay Rigger — side-scroll section composer.
   A composed side level is a run of sections laid end to end on a common ground row g. Each section declares its
   width, which tiles are ground, how to build itself, a one-time teaching hint, and a check script that drives the
   test bot across it. Generation is seeded, so a level is identical on every load.
   Hybrid levels keep a hand-built set piece in def.extra(B, endX): with sgen.extraFirst it is drawn first and the
   composed run starts at sgen.x0; otherwise it is drawn after the run, shifted to endX-1 (see shiftB in levels.js).
   sgen.vary rolls each section's dimensions per instance (pit widths, ceiling heights, anchor counts: the params
   object v reaches build and check); sgen.unique allows each hazard type once per level. Both are off for acts 1-4. */
(() => {
let seed=1; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pick=a=>a[Math.floor(rnd()*a.length)];
const taught=new Set();
// a short steel overhang above the ground; its underside has a crack, and a hard hat is sealed inside
const hatOverhang=(B,x,g)=>{ B.steel(x-1,x+1,g-7,g-6); B.crack(x,g-6,false); B.hat(x,g-7); };
// a pocket like the hat's, with a dossier page sealed inside
const pageOverhang=(B,x,g)=>{ B.steel(x-1,x+1,g-7,g-6); B.crack(x,g-6,false); B.page(x,g-7); };
const propAt=(B,t,x,g,opts={})=>{ if(t==='fence') B.prop('fence',{x0:x,x1:x+opts.len||x+8,row:g-1}); else B.prop(t,{x,row:g-1}); };
const V=(v,d)=>Object.assign({},d,v||{});   // instance params with defaults

// tier 0 = safe, 1 = act 1, 2 = act 2/3, 3 = act 4+. Tier-3 extras never consume rnd() below tier 3, so lower levels keep their layouts.
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
  // pit of pw tiles with a girder gh rows up
  gap:{w:16,tier:1,ground:v=>{ const {pw}=V(v,{pw:4}); return [[0,5],[6+pw,15]]; },vary:r=>({pw:3+Math.floor(r()*3),gh:6+Math.floor(r()*3)}),hint:"A gap. Fire up (▲ + GRAB) at the girder, reel in, and walk across it.",
    build(B,x,g,c,v){ const {gh}=V(v,{gh:7}); B.girder(x,x+15,g-gh); B.prop('cone',{x:x+4.4,row:g-1}); B.relay(x+8,g-gh-1); },
    check(T,x,g){ return 'gap '+T.walkFight(x+3)+' '+T.calmSpell(x+3)+' '+T.climb()+' '+T.walkTill(x+12,g); } },
  // ceiling slab over a pit pw wide, ch rows up
  ceilingSwing:{w:v=>18+V(v,{pw:12}).pw,tier:1,ground:v=>{ const {pw}=V(v,{pw:12}); return [[0,4],[5+pw,17+pw]]; },vary:r=>({pw:11+Math.floor(r()*4),ch:12+Math.floor(r()*2)}),hint:"Hook the ceiling, swing low through the pit, and let go at the top of the arc.",
    build(B,x,g,c,v){ const {pw,ch}=V(v,{pw:12,ch:12}); B.steel(x,x+pw+12,g-ch-1,g-ch); B.prop('chains',{x:x+8,row:g-ch+1,len:30}); B.prop('chains',{x:x+14,row:g-ch+1,len:44}); B.relay(x+Math.floor(pw/2)+5,g+1); B.prop('cone',{x:x+pw+5.4,row:g-1});
      if(rnd()<0.5){ B.girder(x+pw+13,x+pw+16,g-ch-2); B.hat(x+12,g-ch-2); } },
    check(T,x,g,c,v){ const {pw,ch}=V(v,{pw:12,ch:12}); return 'swing '+T.swingAcross(x+4,g,x+5+pw,{fireUp:ch>12}); } },
  // one long ceiling over a pit len wide
  ceilingRun:{w:v=>14+V(v,{len:26}).len,tier:2,ground:v=>{ const {len}=V(v,{len:26}); return [[0,4],[5+len,13+len]]; },vary:r=>({len:24+2*Math.floor(r()*3)}),hint:"One long ceiling over the gap. Swing, let go at the top, fire again straight away. Chain it across.",
    build(B,x,g,c,v){ const {len}=V(v,{len:26}); B.steel(x,x+len+10,g-13,g-12); B.prop('chains',{x:x+9,row:g-11,len:24}); B.prop('chains',{x:x+18,row:g-11,len:40}); B.prop('chains',{x:x+26,row:g-11,len:20}); B.relay(x+Math.floor(len/2)+4,g+1);
      if(rnd()<0.6){ B.girder(x+len+11,x+len+13,g-14); B.hat(x+18,g-14); } },
    check(T,x,g,c,v){ const {len}=V(v,{len:26}); return 'run '+T.swingAcross(x+4,g,x+5+len); } },
  // n short girders hanging over a pit: swing from one to the next
  anchorRun:{w:v=>16+8*V(v,{n:4}).n,tier:2,ground:v=>{ const {n}=V(v,{n:4}); return [[0,4],[18+8*(n-1),15+8*n]]; },vary:r=>({n:3+Math.floor(r()*3)}),hint:"Separate girders over the pit. Swing from one to the next: let go at the top of each arc and fire again.",
    build(B,x,g,c,v){ const {n}=V(v,{n:4}); for(let i=0;i<n;i++){ const cc=x+11+8*i; B.girder(cc-2,cc+1,g-12); } B.relay(x+19,g-13); B.prop('sign',{x:x+2,row:g-1}); },
    check(T,x,g,c,v){ const {n}=V(v,{n:4}); return 'hops '+T.swingAcross(x+4,g,x+18+8*(n-1)); } },
  // the same, but every girder gives way a moment after you hook it: each swing has to gain ground
  anchorChain:{w:v=>16+8*V(v,{n:5}).n,tier:3,ground:v=>{ const {n}=V(v,{n:5}); return [[0,4],[18+8*(n-1),15+8*n]]; },vary:r=>({n:4+Math.floor(r()*2)}),hint:"These anchors crack the moment you hook them. Swing, let go, hook the next: never swing twice on one.",
    build(B,x,g,c,v){ const {n}=V(v,{n:5}); for(let i=0;i<n;i++){ const cc=x+11+8*i; B.crumble(cc-2,cc+1,g-12,{hook:true}); } B.relay(x+19,g-13); B.prop('sign',{x:x+2,row:g-1}); },
    check(T,x,g,c,v){ const {n}=V(v,{n:5}); return 'chain '+T.swingAcross(x+4,g,x+18+8*(n-1)); } },
  // a short ceiling, then a haze of static over the far half of the pit: your hook won't bite in it, so swing, let go and fly
  staticLeap:{w:32,tier:3,ground:[[0,4],[19,31]],vary:r=>({sw:4+Math.floor(r()*3)}),hint:"Static. Your hook won't bite inside the haze: swing, let go at the right moment, and fly through it.",
    build(B,x,g,c,v){ const {sw}=V(v,{sw:5}); B.steel(x,x+13,g-13,g-12); B.static(x+19-sw,x+18,g-15,g+3); B.prop('chains',{x:x+6,row:g-11,len:30}); B.prop('chains',{x:x+11,row:g-11,len:40}); B.relay(x+9,g+1); B.prop('antenna',{x:x+22,row:g-1}); },
    check(T,x,g){ return 'leap '+T.swingAcross(x+4,g,x+19,{vxRel:140,fireAt:0.3,minFwd:70}); } },
  // swing from the ceiling and let go so you pass through the window in the gate: too early and you hit the post, too late and you hit the lintel
  releaseGate:{w:36,tier:2,ground:[[0,4],[23,35]],vary:r=>({gh:Math.floor(r()*3)-1,gx:22+2*Math.floor(r()*2)}),hint:"A gate with a window. Swing from the ceiling and let go at just the right moment to sail through it.",
    build(B,x,g,c,v){ const {gh,gx}=V(v,{gh:0,gx:22}); B.steel(x,x+20,g-13,g-12); B.steel(x+gx,x+gx+1,g-11,g-8+gh); B.steel(x+gx,x+gx+1,g-4+gh,g+3); B.prop('chains',{x:x+10,row:g-11,len:36}); B.relay(x+gx,g-6+gh); B.relay(x+12,g+1); B.prop('sign',{x:x+2,row:g-1}); },
    check(T,x,g,c,v){ const {gh,gx}=V(v,{gh:0,gx:22}); return 'gate '+T.swingAcross(x+4,g,x+23,{window:{x:x+gx,top:g-7+gh,bot:g-5+gh}}); } },
  // a trolley runs along the ceiling over the pit: hook it from below, hang on, let go over the far side
  trolleyRun:{w:40,tier:3,ground:[[0,4],[35,39]],hint:"The trolley runs on a cable overhead. Hook it as it passes, hang on, and drop off over the far side.",
    build(B,x,g){ B.platform(x+2,g-12,x+36,g-12,3,{speed:50,pause:0.6}); /* it runs back over the ledge, so you can hook it from solid ground */ B.steel(x,x+39,g-14,g-14); B.relay(x+18,g+1); B.prop('antenna',{x:x+37,row:g-1}); },
    check(T,x,g){ const r=T.r; let s='trolley '+T.walkFight(x+3); const q=r.plats().find(q=>Math.abs(q.y0-(g-12)*16)<8&&Math.abs(q.x0-(x+2)*16)<8); if(!q) return s+' no trolley';
      T.holdAt(x+3,()=>q.x<=(x+3)*16+4&&q.dx>=0,1200); T.walkSide(x+3.5);
      let got=-1; for(let a=0;a<3&&got<0;a++){ r.run(2,{}); got=T.until({up:true,grab:true},()=>r.hook().state==='att'&&r.hook().plat===q,80); }
      if(got<0) return s+' NO CATCH';
      T.until({grab:true,up:true},()=>r.info().rope<=100,120); const ride=T.until({grab:true},()=>q.x>=(x+34)*16,900);
      T.until({right:true},()=>r.p().onGround,300); return s+(ride>=0?' rode':' DROPPED')+' '+T.walkTill(x+38,g); } },
  cableHazard:{w:14,tier:1,ground:[[0,13]],hint:"Live cable ahead. Climb the girder and walk over it.",
    build(B,x,g){ B.girder(x,x+11,g-7); B.sparks(x+7,x+9,g-1); B.prop('sign',{x:x+4,row:g-1}); },
    check(T,x,g){ return 'cable '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkTill(x+13,g); } },
  climbOver:{w:18,tier:1,ground:[[0,17]],hint:"Over the pillar: fire up, reel in, step across.",
    build(B,x,g){ B.girder(x,x+5,g-4); B.girder(x+6,x+11,g-10); B.steel(x+12,x+16,g-10,g-1); B.relay(x+8,g-11); },
    check(T,x,g){ return 'over '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkSide(x+8)+' '+T.climb()+' '+T.walkTill(x+17,g); } },
  crumbleBridge:{w:v=>10+V(v,{len:15}).len,tier:2,ground:v=>{ const {len}=V(v,{len:15}); return [[0,5],[6+len,9+len]]; },vary:r=>({len:13+2*Math.floor(r()*3)}),hint:"This bridge crumbles behind you. Don't stop.",
    build(B,x,g,c,v){ const {len}=V(v,{len:15}); B.crumble(x+6,x+5+len,g); B.prop('cone',{x:x+2.4,row:g-1}); },
    check(T,x,g,c,v){ const {len}=V(v,{len:15}); const r=T.r; let s='crumble '+T.walkFight(x+3); for(let i=0;i<8;i++){ T.walkFight(x+3); r.run(10); } T.until({},()=>!r.crumbles().some(c=>c.gone||c.t>=0),400); return s+' '+T.walkTill(x+6+len,g,true); } },
  ferry:{w:v=>8+V(v,{len:18}).len,tier:2,ground:v=>{ const {len}=V(v,{len:18}); return [[0,3],[len+4,len+7]]; },vary:r=>({len:14+4*Math.floor(r()*3)}),hint:"Step onto the ferry platform and ride it across.",
    build(B,x,g,c,v){ const {len}=V(v,{len:18}); B.platform(x+4,g,x+len,g,4); B.relay(x+Math.floor(len/2)+3,g-3); },
    check(T,x,g,c,v){ const {len}=V(v,{len:18}); return 'ferry '+T.ridePlatform(x+3,x+4,x+len,g,x+len+4); } },
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
  // ---- over/under and elevation sections: from level 2 on, the route stops being one flat line
  // a raised slab with a tunnel underneath: walk under (skitters) or climb over from the girder stub (a drone, a relay)
  slabTunnel:{w:v=>12+V(v,{sl:12}).sl,tier:1,ground:v=>[[0,11+V(v,{sl:12}).sl]],vary:r=>({sl:10+2*Math.floor(r()*3)}),hint:"Over or under? The tunnel is quicker; the top is quieter.",
    build(B,x,g,c,v){ const {sl}=V(v,{sl:12}); B.steel(x+6,x+5+sl,g-6,g-3); B.girder(x+1,x+6,g-7); B.relay(x+Math.floor(sl/2)+6,g-7); B.relay(x+9,g-1); B.enemy('skitter',x+11,g-1); if(c.tier>=2) B.enemy('skitter',x+sl+3,g-1); if(c.tier>=2) B.drone(x+8,x+sl+4,g-7); B.prop('sign',{x:x+3,row:g-1}); B.prop('vent',{x:x+sl+8,row:g-1}); },
    check(T,x,g,c,v){ const {sl}=V(v,{sl:12}); return 'tunnel '+T.walkFight(x+11+sl); },
    page(B,x,g,c,v){ const {sl}=V(v,{sl:12}); B.page(x+sl+3,g-7); }, pageCheck(T,x,g,c,v){ const {sl}=V(v,{sl:12}); const n0=T.r.pages().filter(q=>q.got).length; const s='tunnel-top '+T.walkFight(x+2)+' '+T.climb()+' '+T.walkFight(x+sl+3); return s+(T.r.pages().filter(q=>q.got).length>n0?' page':' NO PAGE')+' '+T.walkFight(x+11+sl); } },
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
  // a taller shaft with a ledge halfway: two climbs with a breath between
  shaftTall:{w:24,tier:3,dg:-24,grounds:g=>[[0,7,g],[8,23,g-24]],hint:"A tall shaft. Climb to the ledge, catch your breath, then the rest of the way.",
    build(B,x,g,c){ B.girder(x+3,x+7,g-4); B.girder(x+5,x+9,g-8); B.girder(x+3,x+9,g-12); B.girder(x+5,x+9,g-16); B.girder(x+3,x+7,g-20); B.girder(x+5,x+9,g-24); B.steel(x+10,x+23,g-24,c.H-1);
      B.relay(x+5,g-13); B.relay(x+7,g-25); if(c.tier>=3) B.enemy('seeker',x+15,g-27); /* nothing patrols the ledge itself: a skitter there swallows every shot from below */ B.prop('tower',{x0:x+2.4,x1:x+10.6,top:g-24,row:g-1}); B.prop('dish',{x:x+16,row:g-25}); },
    check(T,x,g){ let s='tall '+T.walkFight(x+6); for(let i=0;i<2;i++){ s+=' '+T.climb(); T.walkSide(x+6); } s+=' '+T.climb(); T.walkFight(x+6); for(let i=0;i<3;i++){ s+=' '+T.climb(); T.walkSide(x+6); } return s+' '+T.walkTill(x+20,g-24); } },
  // a hollow under a boulder: drop in, walk the hollow, hook the girder past it to climb out
  dip:{w:20,tier:1,depth:4,grounds:g=>[[0,5,g],[6,14,g+4],[15,19,g]],hint:"A hollow under the rock. Drop in, and hook the girder past the boulder to climb out.",
    build(B,x,g,c){ B.rock(x+6,x+12,g-10,g-3); B.girder(x+13,x+16,g-3); B.relay(x+9,g+3); B.enemy('skitter',x+10,g+3); if(c.tier>=2) B.enemy('spitter',x+7,g+3); B.prop('sign',{x:x+3,row:g-1}); B.prop('drum',{x:x+18,row:g-1}); },
    check(T,x,g){ return 'dip '+T.walkTill(x+8,g+4)+' '+T.walkFight(x+14)+' '+T.climb()+' '+T.walkTill(x+18,g); } },   // x+14: a shot from the boulder's edge column would hook its underside
  // a pit under a low ceiling: short-rope swings, several in a row
  lowCeilingPit:{w:v=>12+V(v,{pw:10}).pw,tier:2,ground:v=>{ const {pw}=V(v,{pw:10}); return [[0,4],[5+pw,11+pw]]; },vary:r=>({pw:9+Math.floor(r()*3)}),hint:"Low ceiling over the pit: short swings. Hook, swing, let go, hook again.",
    build(B,x,g,c,v){ const {pw}=V(v,{pw:10}); B.steel(x+2,x+pw+7,g-6,g-5); B.prop('chains',{x:x+8,row:g-4,len:10}); B.prop('chains',{x:x+12,row:g-4,len:12}); B.relay(x+9,g+1); B.prop('cone',{x:x+pw+6.4,row:g-1}); if(c.tier>=3) B.enemy('seeker',x+pw+9,g-3); },
    check(T,x,g,c,v){ const {pw}=V(v,{pw:10}); return 'low '+T.swingAcross(x+4,g,x+5+pw,{rope:48,vxRel:90}); } },
  // a relay terminal at ground level, for levels where a fall from a tower deck would hurt
  groundDeck:{w:44,tier:1,ground:[[0,43]],hint:"A relay terminal on the ground. Work it, and fight off whatever comes.",
    build(B,x,g,c){ B.terminal(x+20,g-1,c.term); B.check(x+6,g-1); B.relay(x+12,g-1); B.relay(x+34,g-1);
      B.prop('fence',{x0:x+8,x1:x+16,row:g-1}); B.prop('crates',{x:x+30,row:g-1}); B.prop('antenna',{x:x+24,row:g-1}); B.prop('pylon',{x:x+38,top:g-14,row:g-1});
      if(c.tier>=2) B.enemy('skitter',x+36,g-1); B.drone(x+26,x+40,g-4); },
    check(T,x,g,c){ return 'ground deck '+T.walkFight(x+20)+' '+T.defendSide(c.termIndex)+' '+T.walkFight(x+42); } },
  // a high girder with a piece of field kit on it: a nine-row climb off the route
  kitLedge:{w:18,tier:1,ground:[[0,17]],hint:"Something glints on the high girder.",
    build(B,x,g){ B.girder(x+9,x+14,g-9); B.item('shield',x+12,g-10); B.prop('pylon',{x:x+15,top:g-10,row:g-1}); B.relay(x+4,g-1); },
    check(T,x,g){ const r=T.r; const n0=r.items().filter(q=>q.got).length; let s='kit '+T.walkFight(x+11)+' '+T.climb()+' '+T.walkFight(x+12); return s+(r.items().filter(q=>q.got).length>n0?' got':' NO KIT')+' '+T.walkFight(x+17); } },
  towerDeck:{w:60,tier:1,ground:[[0,59]],hint:"Climb the tower one girder at a time: fire up, reel in, step over. Reroute the terminal on the deck.",
    build(B,x,g,c){ B.girder(x+4,x+10,g-5); B.girder(x+8,x+14,g-10); B.girder(x+2,x+10,g-15); B.girder(x+8,x+52,g-19);
      B.terminal(x+30,g-20,c.term); B.check(x+12,g-20); B.relay(x+6,g-16); B.relay(x+44,g-20);
      B.prop('tower',{x0:x+1.4,x1:x+15.6,top:g-19,row:g-1}); B.prop('pylon',{x:x+24,top:g-18,row:g-1}); B.prop('pylon',{x:x+40,top:g-18,row:g-1}); B.prop('dish',{x:x+36,row:g-20});
      if(c.tier>=2) B.enemy('skitter',x+22,g-20); B.drone(x+34,x+48,g-20); },
    page(B,x,g){ B.page(x+51,g-20); },
    check(T,x,g,c){ let s='deck ';
      const up=()=>{ s+=T.walkFight(x+5); for(let i=0;i<4;i++){ if(T.r.info().ty<=g-19+0.5) break; let cl=T.climb(); if(/FAILED/.test(cl)){ T.walkSide(x+9); cl=T.climb(); } s+=' '+cl; T.walkSide(x+9); } s+=' '+T.walkFight(x+30); };
      up(); for(let tries=0;tries<3;tries++){ const d=T.defendSide(c.termIndex); s+=' '+d; if(!/knockedOff/.test(d)) break; s+=' (back up)'; up(); }   /* knocked off the deck: climb back and carry on */
      return s+' '+T.walkFight(x+56); } },
};
const BREATH=['flat','drones','nest'], DECKS=['towerDeck','groundDeck'];
const wOf=(sec,v)=>typeof sec.w==='function'?sec.w(v):sec.w;
const groundsOf=(sec,g,v)=>sec.grounds?sec.grounds(g,v):(typeof sec.ground==='function'?sec.ground(v):sec.ground).map(([a,b])=>[a,b,g]);

function composeSide(def){
  const G=def.sgen; seed=G.seed||1; for(let i=0;i<5;i++) rnd();
  const g0=G.g||26, tier=G.tier||1, len=G.len||360, nTerms=G.terminal===false?0:(G.terminals||1), x0=G.x0||0;
  const deckAt=G.deckAt||(nTerms===1?[0.55]:nTerms===2?[0.38,0.76]:[0.3,0.58,0.85]); let mustIdx=0;
  const deckName=def.fallDamage||G.deck==='ground'?'groundDeck':'towerDeck';
  const pool=(G.pool||Object.keys(SECTIONS).filter(k=>!['start','goal',...DECKS].includes(k)&&SECTIONS[k].tier<=tier)).filter(k=>SECTIONS[k]);
  const hazards=pool.filter(k=>!BREATH.includes(k)), breathers=pool.filter(k=>BREATH.includes(k));
  const list=[]; let x=x0, g=g0, last='start', run=0, decks=0; const used=new Set();
  if(!G.noStart){ list.push({name:'start',x,g}); x+=SECTIONS.start.w; }
  // levels with fall damage never drop the worker: no descents, and the terminal stays on the ground
  const fits=k=>{ const dg=SECTIONS[k].dg||0; if(def.fallDamage&&dg>0) return false; return g+dg>=22&&g+dg<=(G.maxG||g0+12); };
  const tail=(G.noGoal?0:SECTIONS.goal.w)+40;
  while(x<len-tail){
    let name;
    if(decks<nTerms&&x>len*deckAt[decks]&&g>=22){ name=deckName; decks++; }
    else if(G.must&&(()=>{ while(mustIdx<G.must.length&&used.has(G.must[mustIdx])) mustIdx++; return mustIdx<G.must.length&&x>len*(0.2+0.3*mustIdx)&&fits(G.must[mustIdx])&&G.must[mustIdx]!==last; })()){ name=G.must[mustIdx++]; }   // a level's signature sections, spread along the run
    else if((run>=2||last==='climbOver')&&breathers.length){ name=pick(breathers.filter(k=>k!==last)); }
    else { let opts=hazards.filter(k=>k!==last&&fits(k)&&!(k==='crumbleBridge'&&(last==='nest'||last==='drones'))); if(G.unique){ const fresh=opts.filter(k=>!used.has(k)); opts=fresh.length?fresh:(breathers.length&&run<2?breathers.filter(k=>k!==last):opts); } name=opts.length?pick(opts):pick(breathers.length?breathers:pool); }   // unique: once every hazard has been used, breathe rather than repeat
    if(last==='crumbleBridge'&&name==='nest') name='flat';
    run=BREATH.includes(name)?0:run+1; if(!BREATH.includes(name)) used.add(name);
    const sec=SECTIONS[name], v=G.vary&&sec.vary?sec.vary(rnd):undefined;
    list.push({name,x,g,v}); x+=wOf(sec,v); g+=sec.dg||0; last=name;
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
  { const noop=()=>{}; const PB=new Proxy(probe,{get:(o,k)=>o[k]||noop}); const s0=seed; seed=(G.seed||1)*7+3; for(const s of list) SECTIONS[s.name].build(PB,s.x,s.g,ctx,s.v); seed=s0; }
  if(!nHats&&list.some(s=>s.name==='flat')) ctx.forceHat=true;
  { const spots=list.filter(s=>SECTIONS[s.name].page), want=G.pages??1; for(let i=0;i<want&&spots.length;i++) spots[Math.min(spots.length-1,Math.floor((i+0.5)*spots.length/want))].page=true; }
  const sections=list.map(s=>({name:s.name,x:s.x,w:wOf(SECTIONS[s.name],s.v),g:s.g,page:!!s.page,v:s.v}));
  const rock=G.steel?'steel':'rock';
  const build=B=>{ if(def.extra&&G.extraFirst) def.extra(B,endX); seed=(G.seed||1)*7+3; let prev=null;
    for(const s of list){ const sec=SECTIONS[s.name]; for(const [a,b,row] of groundsOf(sec,s.g,s.v)) B[rock](s.x+a,s.x+b,row,H-1);
      if(sec.tier>0&&!DECKS.includes(s.name)&&s.name!=='goal') B.check(s.x+1,s.g-1);
      ctx.prev=prev; sec.build(B,s.x,s.g,ctx,s.v); if(s.page) sec.page(B,s.x,s.g,ctx,s.v); prev=s.name; }
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
