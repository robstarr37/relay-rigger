/* Relay Rigger — mobile-first build.
   Physics constants, level layout and hint text are unchanged from the original prototype;
   everything around them (renderer, scaling, input, audio, saves, menus) is new. */
(() => {
'use strict';

// ---------- constants ----------
const T=16, W=140, H=26, ART=2;            // tile size (world units), level size (tiles), art pixels per world unit
const LW=W*T, LH=H*T;
const G=760, WALK=88, AIR=260, AIRMAX=110, PUMP=300, REEL=120, MINL=10, RANGE=210, HOOKV=760;
let VW=320, VH=180;                         // visible world size, set by resize()

// ---------- level ----------
const map = Array.from({length:H}, () => new Array(W).fill(0)); // 0 air, 1 steel/concrete, 2 girder (one-way), 3 live cable sparks
const fill=(x0,x1,y0,y1,v)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)map[y][x]=v;};
fill(0,0,0,H-1,1); fill(W-1,W-1,0,H-1,1);
fill(1,16,22,H-1,1); fill(22,52,22,H-1,1); fill(65,W-2,22,H-1,1);
fill(11,26,15,15,2); fill(28,33,18,18,2); fill(34,39,12,12,2); fill(40,44,12,21,1);
fill(48,72,9,10,1);
fill(71,82,15,15,2); fill(78,80,21,21,3);
fill(88,94,17,17,2); fill(92,98,12,12,2); fill(86,94,7,7,2); fill(92,136,3,3,2);
const tile=(tx,ty)=> (tx<0||tx>=W)?1 : (ty<0||ty>=H)?0 : map[ty][tx];

const RELAYS=[[8,21],[30,17],[59,23],[76,14],[96,11],[88,6],[126,2]];
const DRONES=[[26,36,21],[66,74,21],[102,110,2],[116,124,2]];
const CHECKS=[[2,21],[47,21],[87,21],[98,2]];
const GOAL_X=132;

const HINTS=[
  [0,  "Hold <b>GRAB</b> to fire your cable at the girder above. Walk off the edge and swing. You can't jump."],
  [22, "Press <b>▼ + GRAB</b> to punch straight ahead. Knock that drone out of the air."],
  [32, "Press <b>▲ + GRAB</b> to fire straight up, then hold <b>▲</b> to reel in and climb onto the girder."],
  [45, "Hook the ceiling, swing low through the pit, and let go at the top of the arc."],
  [65, "Live cable on the ground ahead. Climb the girder and walk over it."],
  [84, "Climb the tower one girder at a time: fire up, reel in, step over."],
  [95, "Up top. Clear the deck and reach the transmitter mast."]
];

// ---------- utils ----------
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hash=(x,y)=>{let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0; h=Math.imul(h^(h>>>13),1274126177); return (h^(h>>>16))>>>0;};
let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
function mk(w,h){const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.imageSmoothingEnabled=false; return [c,x];}
// crisp pixel line (Bresenham) with square pen of size t
function pline(c,x0,y0,x1,y1,col,t=1){
  x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
  c.fillStyle=col; const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, o=t>>1; let e=dx+dy;
  for(let n=0;n<4000;n++){ c.fillRect(x0-o,y0-o,t,t); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){e+=dy;x0+=sx;} if(e2<=dx){e+=dx;y0+=sy;} }
}
const store={
  get(k,d){try{const v=localStorage.getItem('relayrigger.'+k); return v==null?d:JSON.parse(v);}catch(_){return d;}},
  set(k,v){try{localStorage.setItem('relayrigger.'+k,JSON.stringify(v));}catch(_){}}
};
const fmt=t=>{const m=Math.floor(t/60), s=t-m*60; return String(m).padStart(2,'0')+':'+s.toFixed(1).padStart(4,'0');};

// ---------- audio (procedural, no files) ----------
let muted=store.get('muted',false);
const Snd=(()=>{
  let ac=null, master=null, nb=null, amb=null;
  function init(){
    if(ac){ if(ac.state==='suspended') ac.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    try{ ac=new AC(); }catch(_){ return; }
    master=ac.createGain(); master.gain.value=muted?0:0.55; master.connect(ac.destination);
    nb=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate); const d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }
  function tone(f0,f1,dur,type,vol,delay=0){
    if(!ac||muted) return; const t=ac.currentTime+delay, o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f0,t); if(f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+0.03);
  }
  function noise(dur,vol,freq,q=1,type='bandpass',delay=0,f1=freq){
    if(!ac||muted) return; const t=ac.currentTime+delay, s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
    s.buffer=nb; s.loop=true; f.type=type; f.Q.value=q; f.frequency.setValueAtTime(freq,t); if(f1!==freq) f.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t,Math.random()); s.stop(t+dur+0.03);
  }
  function ambience(on){
    if(!ac) return;
    if(on&&!amb){ const s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
      s.buffer=nb; s.loop=true; f.type='lowpass'; f.frequency.value=380; g.gain.value=0.05;
      s.connect(f); f.connect(g); g.connect(master); s.start(); amb=s; }
    else if(!on&&amb){ try{amb.stop();}catch(_){} amb=null; }
  }
  const S={
    fire(){tone(260,900,0.09,'square',0.06); noise(0.07,0.05,3500,1);},
    attach(){tone(1500,1100,0.05,'square',0.07); noise(0.06,0.12,5200,5);},
    fling(){noise(0.2,0.09,700,1,'bandpass',0,2600);},
    punch(){noise(0.3,0.4,900,0.7,'lowpass',0,110); tone(170,40,0.28,'sawtooth',0.16);},
    relay(){[660,880,1320].forEach((f,i)=>tone(f,f,0.11,'square',0.06,i*0.06));},
    check(){[440,554,659,880].forEach((f,i)=>tone(f,f,0.14,'triangle',0.12,i*0.07));},
    hurt(){tone(440,90,0.3,'sawtooth',0.12); noise(0.14,0.16,1300,1);},
    fall(){tone(950,110,0.55,'triangle',0.11);},
    land(v){noise(0.08,Math.min(0.2,v/2600),380,1,'lowpass');},
    step(){noise(0.03,0.03,1700,2);},
    reel(){tone(1900,1900,0.014,'square',0.022);},
    crackle(v){noise(0.03+Math.random()*0.06,v,2500+Math.random()*4000,3);},
    pop(){noise(0.25,0.12,1400,1,'lowpass',0,200);},
    win(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,f,0.2,'square',0.07,i*0.12));},
    click(){tone(880,880,0.03,'square',0.04);}
  };
  function setMuted(m){ muted=m; store.set('muted',m); if(master) master.gain.value=m?0:0.55; }
  return {init,S,setMuted,ambience};
})();
const sfx=Snd.S;
let isTouch=matchMedia('(pointer:coarse)').matches;
const buzz=ms=>{ if(isTouch&&navigator.vibrate) try{navigator.vibrate(ms);}catch(_){} };

// ---------- state ----------
let p, hook, rope, drones, relays, checks, parts, cam, state='title', clock=0, falls=0, got=0, cp, tnow=0;
let shake=0, hitstop=0, flash=0, winT=0, fwT=0, reelAcc=0, stepPh=0, crackleT=0;
const DIRS=['left','right','up','down','grab'];
const K={}, TT={}, GP={}, I={}; DIRS.forEach(k=>{K[k]=TT[k]=GP[k]=I[k]=false;});
let prevGrab=false;

function reset(){
  cp=0;
  p={x:CHECKS[0][0]*T+2,y:22*T-20,w:12,h:20,vx:0,vy:0,face:1,onGround:false,hp:3,inv:0,walk:0,landV:0};
  hook={state:'idle',x:0,y:0,dx:0,dy:0,len:0,tile:0,tx:0,ty:0}; rope=0;
  drones=DRONES.map(([a,b,r])=>({x:a*T,y:r*T+8,x0:a*T,x1:b*T,dir:1,alive:true,ph:Math.random()*6}));
  relays=RELAYS.map(([x,y])=>({x:x*T+8,y:y*T+8,got:false,ph:Math.random()*6}));
  checks=CHECKS.map(([x,y],i)=>({x:x*T+8,y:(y+1)*T,on:i===0,raise:i===0?1:0}));
  parts=[]; clock=0; falls=0; got=0; shake=0; hitstop=0; flash=0;
  cam={x:0,y:LH-VH};
}

const hand=()=>({x:p.x+p.w/2,y:p.y+7});
function boxSolid(x,y,w,h){
  for(let ty=Math.floor(y/T);ty<=Math.floor((y+h-0.01)/T);ty++)
    for(let tx=Math.floor(x/T);tx<=Math.floor((x+w-0.01)/T);tx++) if(tile(tx,ty)===1) return true;
  return false;
}
function moveX(dx){
  if(!dx) return; p.x+=dx;
  const y0=Math.floor(p.y/T), y1=Math.floor((p.y+p.h-0.01)/T);
  if(dx>0){const tx=Math.floor((p.x+p.w-0.01)/T); for(let ty=y0;ty<=y1;ty++) if(tile(tx,ty)===1){p.x=tx*T-p.w;p.vx=Math.min(p.vx,0);break;}}
  else {const tx=Math.floor(p.x/T); for(let ty=y0;ty<=y1;ty++) if(tile(tx,ty)===1){p.x=(tx+1)*T;p.vx=Math.max(p.vx,0);break;}}
}
function moveY(dy){
  if(!dy) return; const pb=p.y+p.h; p.y+=dy;
  const x0=Math.floor(p.x/T), x1=Math.floor((p.x+p.w-0.01)/T);
  if(dy>0){const ty=Math.floor((p.y+p.h-0.01)/T);
    for(let tx=x0;tx<=x1;tx++){const v=tile(tx,ty); if(v===1||(v===2&&pb<=ty*T+0.5)){p.y=ty*T-p.h;p.landV=Math.max(p.landV,p.vy);p.vy=Math.min(p.vy,0);p.onGround=true;break;}}}
  else {const ty=Math.floor(p.y/T); for(let tx=x0;tx<=x1;tx++) if(tile(tx,ty)===1){p.y=(ty+1)*T;p.vy=Math.max(p.vy,0);break;}}
}

// ---------- particles ----------
function burst(x,y,col,n=10,sp=90){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=sp*(0.3+Math.random());parts.push({t:'dot',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,life:0.4+Math.random()*0.4,col,g:300});}}
function sparks(x,y,col,n=8,sp=160){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=sp*(0.4+Math.random());parts.push({t:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:0.2+Math.random()*0.3,col,g:420,add:true});}}
function smoke(x,y,n=5){for(let i=0;i<n;i++) parts.push({t:'smoke',x:x+(Math.random()-0.5)*8,y:y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*20,vy:-10-Math.random()*20,life:0.6+Math.random()*0.6,max:1.2,g:-10,r:2+Math.random()*3});}
function debris(x,y,cols,n=8){for(let i=0;i<n;i++){const a=-Math.PI*Math.random(),s=60+Math.random()*120;parts.push({t:'debris',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:0.9+Math.random()*0.6,col:cols[i%cols.length],g:520,sz:1+(Math.random()*2|0)});}}
function dust(x,y,n=4,dir=0){for(let i=0;i<n;i++) parts.push({t:'smoke',x:x+(Math.random()-0.5)*8,y,vx:(Math.random()-0.5)*40+dir*20,vy:-8-Math.random()*16,life:0.35+Math.random()*0.25,max:0.6,g:0,r:1+Math.random()*1.5,col:'#6b6f9a'});}
function ring(x,y,col,max=60,life=0.8){parts.push({t:'ring',x,y,col,max,life,full:life,add:true});}
function popup(x,y,text,col){parts.push({t:'text',x,y,vx:0,vy:-26,life:1.1,full:1.1,g:0,text,col});}

// ---------- gameplay ----------
function fire(){
  const hd=hand(); let dx,dy;
  if(I.up){dx=0;dy=-1;} else if(I.down){dx=p.face;dy=0;} else {dx=p.face*0.574;dy=-0.819;}
  hook={state:'fly',x:hd.x,y:hd.y,dx,dy,len:0,tile:0,tx:0,ty:0};
  sfx.fire();
}
function hurt(fall){
  if(!fall && p.inv>0) return;
  p.hp--; p.inv=1.3; hook.state='back'; burst(p.x+6,p.y+8,'#ff6a2c',12);
  shake=Math.max(shake,fall?3:4); flash=0.25; buzz(fall?90:45);
  if(fall) sfx.fall(); else sfx.hurt();
  if(fall || p.hp<=0){ if(p.hp<=0){p.hp=3;} falls++; respawn(); }
  else { p.vx=-p.face*140; p.vy=-180; p.onGround=false; }
}
function respawn(){const c=checks[cp]; p.x=c.x-6; p.y=c.y-p.h; p.vx=p.vy=0; hook.state='idle'; p.inv=1.3; sparks(c.x,c.y-10,'#ffc23d',10,90);}

function step(dt){
  const inp=(I.right?1:0)-(I.left?1:0);
  // hook
  if(hook.state==='fly'){
    let dist=HOOKV*dt;
    while(dist>0){
      const s=Math.min(3,dist); dist-=s; hook.x+=hook.dx*s; hook.y+=hook.dy*s; hook.len+=s;
      const dr=drones.find(d=>d.alive&&Math.abs(hook.x-d.x)<10&&Math.abs(hook.y-d.y)<8);
      if(dr){ dr.alive=false; hook.state='back';
        burst(dr.x,dr.y,'#ffc23d',16,120); sparks(dr.x,dr.y,'#ffe27a',14,200); smoke(dr.x,dr.y,6);
        debris(dr.x,dr.y,['#c33a4c','#7e1f2e','#5a5f8c','#9ea3c9'],10); ring(dr.x,dr.y,'#ffc23d',28,0.35);
        sfx.punch(); shake=Math.max(shake,3.5); hitstop=0.07; buzz(30); popup(dr.x,dr.y-10,'SCRAPPED','#ffc23d');
        break; }
      const tx=Math.floor(hook.x/T), ty=Math.floor(hook.y/T), v=tile(tx,ty);
      if(v===1||v===2){
        const hd=hand(); rope=Math.max(MINL,Math.hypot(hd.x-hook.x,hd.y-hook.y));
        Object.assign(hook,{tile:v,tx,ty}); burst(hook.x,hook.y,'#e9e6f3',4,50); sparks(hook.x,hook.y,'#fff6c8',4,90);
        hook.state=I.grab?'att':'back';
        if(hook.state==='att'){ sfx.attach(); buzz(8); }
        break;
      }
      if(hook.len>=RANGE){hook.state='back';break;}
    }
  } else if(hook.state==='back'){
    const hd=hand(), dx=hd.x-hook.x, dy=hd.y-hook.y, d=Math.hypot(dx,dy), s=900*dt;
    if(d<=s+2) hook.state='idle'; else {hook.x+=dx/d*s; hook.y+=dy/d*s;}
  }
  // player control
  const att=hook.state==='att';
  if(att){
    const r0=rope;
    if(I.up) rope=Math.max(MINL,rope-REEL*dt);
    if(I.down) rope=Math.min(RANGE,rope+REEL*dt);
    reelAcc+=Math.abs(rope-r0);
    if(p.onGround){ if(inp){p.vx=inp*WALK;p.face=inp;} else p.vx*=0.7; }
    else if(inp){ const hd=hand(), dx=hd.x-hook.x, dy=hd.y-hook.y, d=Math.hypot(dx,dy)||1;
      p.vx+=(dy/d)*inp*PUMP*dt; p.vy+=(-dx/d)*inp*PUMP*dt; p.face=inp; }
  } else if(p.onGround){
    if(inp){p.vx=inp*WALK;p.face=inp;} else {const dec=900*dt; p.vx=Math.abs(p.vx)<dec?0:p.vx-Math.sign(p.vx)*dec;}
  } else if(inp){
    if(inp>0&&p.vx<AIRMAX) p.vx=Math.min(AIRMAX,p.vx+AIR*dt);
    if(inp<0&&p.vx>-AIRMAX) p.vx=Math.max(-AIRMAX,p.vx-AIR*dt);
    p.face=inp;
  }
  p.vy=Math.min(p.vy+G*dt,560);
  p.vx=Math.max(-520,Math.min(520,p.vx));
  moveX(p.vx*dt); p.onGround=false; moveY(p.vy*dt);
  if(hook.state==='att'){
    const hd=hand(), dx=hd.x-hook.x, dy=hd.y-hook.y, d=Math.hypot(dx,dy)||1;
    if(d>rope){
      const nx=dx/d, ny=dy/d, c=d-rope, oy=p.y;
      moveX(-nx*c); moveY(-ny*c); if(p.y<oy-0.3) p.onGround=false;
      const vr=p.vx*nx+p.vy*ny; if(vr>0){p.vx-=nx*vr;p.vy-=ny*vr;}
    }
    if(hook.tile===2 && rope<=MINL+0.5 && d<=MINL+5){
      const ny=hook.ty*T-p.h, nx=Math.max(hook.tx*T-4,Math.min(hook.x-p.w/2,(hook.tx+1)*T-p.w+4));
      if(!boxSolid(nx,ny,p.w,p.h)){p.x=nx;p.y=ny;p.vx=p.vy=0;p.onGround=true;hook.state='idle'; dust(p.x+6,p.y+p.h,5); sfx.land(900);}
    }
  }
}

function updateDrones(dt,harm){
  for(const d of drones){ if(!d.alive) continue; d.ph+=dt;
    d.x+=d.dir*30*dt; if(d.x>d.x1){d.x=d.x1;d.dir=-1;} if(d.x<d.x0){d.x=d.x0;d.dir=1;}
    const dy=d.y+Math.sin(d.ph*3)*2;
    if(harm&&p.x<d.x+7&&p.x+p.w>d.x-7&&p.y<dy+5&&p.y+p.h>dy-5) hurt(false);
  }
}

function update(dt){
  tnow+=dt;
  readInput();
  const edge=I.grab&&!prevGrab; prevGrab=I.grab;
  updateParts(dt);
  for(const c of checks) c.raise=Math.min(1,c.raise+(c.on?dt*2.5:0));
  if(state==='title'){
    updateDrones(dt,false);
    const k=0.5-0.5*Math.cos(tnow*0.05);
    cam.x=k*(LW-VW); cam.y=(LH-VH)*(1-Math.min(1,Math.max(0,(k-0.45)/0.4)));
    if(edge) startGame(); return;
  }
  if(state==='pause') return;
  if(state==='win'){ if(edge&&winT>1) startGame(); winT+=dt; return; }
  if(state==='winning'){
    winT+=dt; fwT-=dt; updateDrones(dt,false);
    if(fwT<=0){ fwT=0.28; const x=GOAL_X*T+8+(Math.random()-0.5)*140, y=10+Math.random()*50;
      const col=['#ffc23d','#5fe39a','#ff6a2c','#e9e6f3','#ff4150'][Math.random()*5|0];
      sparks(x,y,col,22,150); ring(x,y,col,30,0.5); sfx.pop(); }
    const k=1-Math.exp(-dt*2); cam.x+=(GOAL_X*T+8-VW/2-cam.x)*k; cam.y+=(-SKY-cam.y)*k; clampCam();
    shake=Math.max(0,shake-dt*20);
    if(winT>2.4) showWin();
    return;
  }
  // play
  if(hitstop>0){ hitstop-=dt; return; }
  clock+=dt;
  if(p.inv>0) p.inv-=dt;
  if(edge && hook.state==='idle') fire();
  if(hook.state==='att' && !I.grab){ hook.state='back'; if(!p.onGround&&Math.hypot(p.vx,p.vy)>150) sfx.fling(); }
  const wasGround=p.onGround; p.landV=0;
  const n=4; for(let i=0;i<n;i++) step(dt/n);
  if(p.onGround&&!wasGround&&p.landV>200){ dust(p.x+6,p.y+p.h,Math.min(10,p.landV/60|0)); sfx.land(p.landV); if(p.landV>420) shake=Math.max(shake,1.5); }
  if(Math.abs(p.vx)>1&&p.onGround){ p.walk+=dt*10; if(Math.floor(p.walk/Math.PI)!==stepPh){ stepPh=Math.floor(p.walk/Math.PI); sfx.step(); if(Math.random()<0.5) dust(p.x+6-p.face*4,p.y+p.h,1,-p.face); } }
  if(reelAcc>5){ reelAcc=0; sfx.reel(); }

  updateDrones(dt,true);
  // sparks
  for(let ty=Math.floor(p.y/T);ty<=Math.floor((p.y+p.h-0.01)/T);ty++)
    for(let tx=Math.floor(p.x/T);tx<=Math.floor((p.x+p.w-0.01)/T);tx++)
      if(tile(tx,ty)===3 && p.y+p.h>ty*T+8){hurt(false);}
  crackleT-=dt;
  if(crackleT<=0){ crackleT=0.05+Math.random()*0.25; const d=Math.hypot(p.x-79.5*T,p.y-21*T); if(d<220) sfx.crackle(0.12*(1-d/220)); }
  // relays
  for(const r of relays){ if(r.got) continue;
    if(Math.abs(p.x+6-r.x)<11&&Math.abs(p.y+10-r.y)<14){r.got=true;got++;burst(r.x,r.y,'#5fe39a',14,100);sparks(r.x,r.y,'#5fe39a',10,120);ring(r.x,r.y,'#5fe39a',24,0.4);popup(r.x,r.y-12,`RELAY ${got}/${relays.length}`,'#5fe39a');sfx.relay();buzz(15);} }
  // checkpoints
  checks.forEach((c,i)=>{ if(i>cp&&Math.abs(p.x+6-c.x)<10&&Math.abs(p.y+p.h-c.y)<24){cp=i;c.on=true;burst(c.x,c.y-16,'#ffc23d',10,70);popup(c.x,c.y-34,'CHECKPOINT','#ffc23d');sfx.check();} });
  // void
  if(p.y>LH+40) hurt(true);
  // goal
  if(p.x+p.w>(GOAL_X-1)*T && p.y<5*T) win();

  shake=Math.max(0,shake-dt*18); if(flash>0) flash-=dt;

  // camera
  const tx=p.x+6-VW/2+p.face*28, ty=p.y+10-VH/2+8, k=1-Math.exp(-dt*6);
  cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k; clampCam();
}
const SKY=56; // camera may rise this far above the level so the top deck is not hidden under the HUD
function clampCam(){ cam.x=clamp(cam.x,0,LW-VW); cam.y=clamp(cam.y,-SKY,LH-VH); }
function updateParts(dt){
  for(const q of parts){ q.x+=(q.vx||0)*dt; q.y+=(q.vy||0)*dt; q.vy=(q.vy||0)+(q.g||0)*dt; q.life-=dt;
    if(q.t==='debris'){ const v=tile(Math.floor(q.x/T),Math.floor(q.y/T)); if(v===1||v===2){ q.vy*=-0.35; q.vx*=0.6; q.y-=2; } } }
  parts=parts.filter(q=>q.life>0);
  if(parts.length>400) parts.splice(0,parts.length-400);
}

// ---------- canvas & scaling ----------
const cv=$('game');
let cx=cv.getContext('2d',{alpha:false});
let BW=640, BH=360, skyGrad=null, vignette=null, rain=[];
const isPortrait=()=>innerHeight>innerWidth*1.05;
function pickScale(dev,target,maxPx){ const f=dev/target, i=Math.floor(f); if(i>=1&&dev/i<=maxPx) return i; return Math.max(0.5,f); }
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,4), cw=innerWidth, ch=innerHeight;
  const dw=Math.round(cw*dpr), dh=Math.round(ch*dpr), portrait=isPortrait();
  let s, bw, bh;
  if(!portrait){ s=pickScale(dh,170*ART,250*ART); bw=Math.ceil(dw/s); bh=Math.ceil(dh/s); }
  else { s=pickScale(dw,280*ART,340*ART); bw=Math.ceil(dw/s); bh=Math.min(Math.ceil(dh/s),Math.round(bw*0.75)); }
  bw=Math.min(bw,LW*ART); bh=Math.min(bh,LH*ART);
  BW=bw; BH=bh; cv.width=bw; cv.height=bh; VW=bw/ART; VH=bh/ART;
  const cssW=bw*s/dpr, cssH=bh*s/dpr;
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  cv.style.left=((cw-cssW)/2)+'px';
  cv.style.top=(portrait?Math.max(0,(ch-cssH)/2-ch*0.16):(ch-cssH)/2)+'px';
  cx=cv.getContext('2d',{alpha:false}); cx.imageSmoothingEnabled=false;
  skyGrad=cx.createLinearGradient(0,0,0,BH);
  skyGrad.addColorStop(0,'#05061a'); skyGrad.addColorStop(0.5,'#141741'); skyGrad.addColorStop(1,'#33285a');
  const [vc,vx]=mk(BW,BH), g=vx.createRadialGradient(BW/2,BH/2,Math.min(BW,BH)*0.35,BW/2,BH/2,Math.hypot(BW,BH)*0.55);
  g.addColorStop(0,'rgba(3,3,12,0)'); g.addColorStop(1,'rgba(3,3,12,0.6)'); vx.fillStyle=g; vx.fillRect(0,0,BW,BH); vignette=vc;
  rain=Array.from({length:Math.round(BW*BH/5200)},()=>({x:Math.random()*BW,y:Math.random()*BH,s:260+Math.random()*160}));
  if(cam) clampCam();
  $('rotate').hidden=!(portrait&&isTouch&&state==='title');
  drawnPaused=false;
}

// ---------- pre-rendered art ----------
const glowCache={};
function glow(col){
  if(glowCache[col]) return glowCache[col];
  const [c,x]=mk(64,64), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,col); g.addColorStop(0.25,col+'99'); g.addColorStop(1,col+'00');
  x.fillStyle=g; x.fillRect(0,0,64,64); return glowCache[col]=c;
}
const lamp=(()=>{ // headlamp cone, pointing right from (0,23)
  const [c,x]=mk(110,48), g=x.createLinearGradient(0,0,110,0);
  g.addColorStop(0,'rgba(255,240,190,0.5)'); g.addColorStop(1,'rgba(255,240,190,0)');
  x.fillStyle=g; x.beginPath(); x.moveTo(0,22); x.lineTo(110,2); x.lineTo(110,46); x.lineTo(0,26); x.fill(); return c;
})();

// level layer: static tiles, props and structures drawn once at 2 art px per world unit
const lights=[]; // static glowing things {x,y,col,size,flick} in art px
const [LC,L]=mk(LW*ART,LH*ART);
(function buildLevel(){
  const r=(x,y,w,h,c)=>{L.fillStyle=c;L.fillRect(x,y,w,h);};
  const A=v=>Math.round(v*ART);
  const GY=A(22*T); // ground surface

  // back structures: the climbing tower behind x 85..99 and deck pylons
  const tc='#1a1e4a', tc2='#151839';
  const legL=[[A(85.4*T),GY],[A(88*T),A(3*T)]], legR=[[A(99.6*T),GY],[A(97*T),A(3*T)]];
  const lerp=(a,b,k)=>a+(b-a)*k;
  for(let k=0;k<1;k+=1/12){
    const k2=k+1/12, ya=lerp(GY,A(3*T),k), yb=lerp(GY,A(3*T),k2);
    const la=lerp(legL[0][0],legL[1][0],k), lb=lerp(legL[0][0],legL[1][0],k2), ra=lerp(legR[0][0],legR[1][0],k), rb=lerp(legR[0][0],legR[1][0],k2);
    pline(L,la,ya,ra,ya,tc,2); pline(L,la,ya,rb,yb,tc2,2); pline(L,ra,ya,lb,yb,tc2,2);
  }
  pline(L,legL[0][0],legL[0][1],legL[1][0],legL[1][1],tc,4); pline(L,legR[0][0],legR[0][1],legR[1][0],legR[1][1],tc,4);
  for(const px of [110,124]){
    const x0=A(px*T), x1=A((px+1.5)*T), top=A(4*T);
    r(x0,top,4,GY-top,tc); r(x1,top,4,GY-top,tc);
    for(let y=top;y<GY-10;y+=56){ pline(L,x0,y,x1+3,y+56,tc2,2); pline(L,x1+3,y,x0,y+56,tc2,2); r(x0,y,x1-x0+4,2,tc); }
  }
  // hanging chains under the ceiling block
  for(const [cxT,len] of [[50.5,34],[57.5,22],[63.5,40],[69.5,26]]){
    const x=A(cxT*T), y0=A(11*T);
    for(let y=0;y<len*ART;y+=4) r(x+((y/4)%2?0:1),y0+y,2,3,(y/4)%2?'#3b3f6b':'#4b4f7c');
    r(x-2,y0+len*ART,6,2,'#5b608f'); r(x-2,y0+len*ART-2,2,2,'#5b608f');
  }

  // tiles
  for(let ty=0;ty<H;ty++) for(let tx=0;tx<W;tx++){
    const v=map[ty][tx]; if(!v) continue;
    const ax=tx*T*ART, ay=ty*T*ART, S=T*ART, h=hash(tx,ty);
    if(v===1 && ty>=22){ // ground rock
      const shades=['#262840','#212339','#1c1d33','#17182b'];
      r(ax,ay,S,S,shades[Math.min(3,ty-22)]);
      for(let i=0;i<7;i++){ const q=hash(tx*7+i,ty*13+i); r(ax+q%30,ay+(q>>5)%30,2+((q>>10)%3),1+((q>>13)%2),(q>>16)%2?'#2e3150':'#181a2e'); }
      if(tile(tx,ty-1)!==1){
        r(ax,ay,S,6,'#4a4e78'); r(ax,ay,S,1,'#6c71a3'); r(ax,ay+6,S,2,'#33365a');
        for(let i=0;i<8;i++){ const q=hash(tx*31+i,ty); r(ax+q%31,ay+1+((q>>6)%4),1,1,(q>>9)%2?'#7a7fae':'#3a3d63'); }
        for(let i=0;i<4;i++){ const q=hash(tx*17+i,99); const gx=ax+q%30; r(gx,ay-2,1,2,'#35524c'); r(gx+1,ay-3,1,3,'#44695c'); if((q>>8)%2) r(gx+2,ay-1,1,1,'#35524c'); }
        if(tile(tx,ty-1)===3){ r(ax+4,ay,24,3,'#16161f'); r(ax+10,ay+1,10,2,'#0c0c12'); }
      }
      if(tile(tx-1,ty)===0){ r(ax,ay,2,S,'#3a3d63'); }
      if(tile(tx+1,ty)===0){ r(ax+S-2,ay,2,S,'#121324'); }
    } else if(v===1){ // steel
      r(ax,ay,S,S,'#333a66');
      r(ax,ay,S,1,'#454f8a'); r(ax,ay,1,S,'#454f8a'); r(ax+S-1,ay,1,S,'#232a4f'); r(ax,ay+S-1,S,1,'#232a4f');
      r(ax+2,ay+15,S-4,1,'#2b3159'); r(ax+2,ay+16,S-4,1,'#3c4478');
      for(const [bx,by] of [[3,3],[27,3],[3,27],[27,27]]){ r(ax+bx,ay+by,2,2,'#5b66a0'); r(ax+bx,ay+by,1,1,'#8e98d0'); r(ax+bx+1,ay+by+1,1,1,'#20254a'); }
      if(h%4===0){ const rx=ax+4+((h>>3)%22); r(rx,ay+5,1,8+((h>>7)%14),'rgba(150,72,58,0.55)'); r(rx+1,ay+5,1,4,'rgba(150,72,58,0.35)'); }
      if(tile(tx,ty-1)!==1){ r(ax,ay,S,2,'#8b96d0'); r(ax,ay+2,S,1,'#5b66a0'); }
      if(tile(tx,ty+1)!==1){ for(let y=0;y<6;y++) for(let x=0;x<S;x+=1){ if((((ax+x)+y)>>2)%2) r(ax+x,ay+S-6+y,1,1,'#ffc23d'); else r(ax+x,ay+S-6+y,1,1,'#1d1f33'); } r(ax,ay+S-7,S,1,'#1c2144'); }
      if(tile(tx-1,ty)!==1) r(ax,ay,2,S,'#5b66a0');
      if(tile(tx+1,ty)!==1) r(ax+S-2,ay,2,S,'#1c2144');
    } else if(v===2){ // girder
      const band=Math.floor(tx/2)%2===0;
      const main=band?'#ff6a2c':'#e6e2d8', hi=band?'#ffa983':'#ffffff', dk=band?'#a73d17':'#9d9aa8', dd=band?'#6e2410':'#5f5c6c';
      pline(L,ax+1,ay+7,ax+16,ay+17,dd,2); pline(L,ax+16,ay+17,ax+31,ay+7,dd,2);
      r(ax,ay+6,2,12,dd);
      r(ax,ay,S,6,main); r(ax,ay,S,1,hi); r(ax,ay+5,S,1,dk);
      r(ax+4,ay+2,2,2,dk); r(ax+26,ay+2,2,2,dk); r(ax+4,ay+2,1,1,hi); r(ax+26,ay+2,1,1,hi);
      r(ax,ay+17,S,4,main); r(ax,ay+17,S,1,hi); r(ax,ay+20,S,1,dk);
      r(ax,ay+21,S,2,'rgba(0,0,10,0.35)');
      if(tile(tx-1,ty)!==2){ r(ax,ay,3,21,dk); r(ax,ay,1,21,hi); }
      if(tile(tx+1,ty)!==2){ r(ax+S-3,ay,3,21,dk); r(ax+S-3,ay+6,3,11,dd); pline(L,ax+16,ay+17,ax+30,ay+7,dd,2); }
    } else if(v===3){ // broken cable base (live arcs drawn per frame)
      r(ax,ay+26,S,3,'#1b1c2a'); r(ax,ay+26,S,1,'#34364f');
      r(ax+6,ay+25,4,1,'#c87533'); r(ax+20,ay+27,5,1,'#c87533'); r(ax+14,ay+24,2,2,'#e39a50');
    }
  }
  // pit darkness
  for(let tx=0;tx<W;tx++) if(map[22][tx]===0){
    const g=L.createLinearGradient(0,A(21*T),0,LH*ART); g.addColorStop(0,'rgba(4,4,14,0)'); g.addColorStop(0.35,'rgba(4,4,14,0.75)'); g.addColorStop(1,'#020208');
    L.fillStyle=g; L.fillRect(tx*T*ART,A(21*T),T*ART,LH*ART-A(21*T));
  }

  // props (drawn in front of back structures; all decorative)
  // site cabin
  { const x=A(56), g=GY;
    r(x,g-58,96,58,'#252950'); for(let y=g-54;y<g;y+=6) r(x,y,96,1,'#1f2246');
    r(x-4,g-64,104,6,'#3a3f70'); r(x-4,g-64,104,1,'#5a60a0'); r(x-4,g-58,104,1,'#1a1d3d');
    r(x+10,g-42,18,42,'#191c3a'); r(x+10,g-42,18,1,'#3a3f70'); r(x+24,g-22,2,2,'#8f93b8');
    r(x+44,g-44,32,20,'#1a1d3d'); r(x+46,g-42,28,16,'#ffc23d'); r(x+46,g-42,28,5,'#ffe08a'); r(x+59,g-42,2,16,'#1a1d3d'); r(x+46,g-35,28,2,'#1a1d3d');
    r(x+36,g-56,44,8,'#ff6a2c'); for(let i=0;i<44;i+=6) r(x+36+i,g-56,3,8,'#1b0c05');
    r(x+6,g-4,26,4,'#3e426b'); r(x+6,g-4,26,1,'#5b608f');
    pline(L,x+84,g-64,x+84,g-100,'#5a5f8c',2); pline(L,x+78,g-92,x+90,g-92,'#5a5f8c',2); pline(L,x+80,g-84,x+88,g-84,'#5a5f8c',2);
    lights.push({x:x+60,y:g-34,col:'#ffc23d',size:70,flick:true},{x:x+84,y:g-101,col:'#ff4150',size:22,blink:1.4});
  }
  // fence
  for(let x=A(22.2*T);x<A(39.8*T);x+=48){ r(x,GY-24,3,24,'#2c3058'); r(x,GY-24,3,1,'#454a80'); }
  r(A(22.2*T),GY-20,A(17.6*T),2,'#2c3058'); r(A(22.2*T),GY-11,A(17.6*T),2,'#2c3058');
  // cones
  for(const wx of [246,836,1046]){ const x=A(wx), g=GY;
    r(x-6,g-2,14,2,'#1f1f2a');
    for(let i=0;i<14;i++){ const w=2+Math.round(i*0.55)*2; r(x+1-w/2,g-16+i,w,1,(i>=5&&i<=7)?'#e6e2d8':'#ff6a2c'); }
    r(x+1-1,g-16,1,12,'#ffa06f'); }
  // warning sign by the live cable
  { const x=A(75.2*T), g=GY; r(x,g-40,2,40,'#5a5f8c');
    for(let i=0;i<18;i++){ r(x+1-Math.floor(i*0.6),g-60+i,1+Math.floor(i*0.6)*2,1,'#ffc23d'); }
    r(x-11,g-42,24,1,'#a77d1d');
    pline(L,x+2,g-55,x-1,g-49,'#1d1f33',1); pline(L,x-1,g-49,x+3,g-49,'#1d1f33',1); pline(L,x+3,g-49,x,g-44,'#1d1f33',1); }
  // cable drum
  { const cxp=A(68.5*T), cyp=GY-14;
    for(let y=-14;y<=14;y++) for(let x=-14;x<=14;x++){ const d=Math.hypot(x,y); if(d<=14) r(cxp+x,cyp+y,1,1,d>12?'#6e4a2c':d<4?'#2a1c14':((Math.round(d)%3)?'#4a3222':'#1a1b2c')); }
    r(cxp-14,GY-1,28,1,'#0e0e16'); }
  // crates
  for(const [wx,wy] of [[1596,0],[1622,0],[1609,22]]){ const x=A(wx), y=GY-44-A(wy);
    r(x,y,44,44,'#5a4630'); r(x,y,44,2,'#7a6242'); r(x,y+42,44,2,'#3d2f20'); r(x,y,2,44,'#3d2f20'); r(x+42,y,2,44,'#3d2f20');
    pline(L,x+3,y+3,x+40,y+40,'#3d2f20',2); pline(L,x+40,y+3,x+3,y+40,'#3d2f20',2); r(x+16,y+18,12,8,'#e6e2d8'); r(x+18,y+20,8,1,'#ff6a2c'); }

  // transmitter mast (goal)
  { const gx=A(GOAL_X*T+8), base=A(3*T), top=6;
    for(let y=base;y>top;y-=2){ const k=(base-y)/(base-top), hw=Math.round(9-k*6), band=Math.floor((base-y)/18)%2;
      const c=band?'#e6e2d8':'#ff6a2c', cd=band?'#9d9aa8':'#a73d17';
      r(gx-hw,y-2,2,2,c); r(gx+hw-2,y-2,2,2,cd); }
    for(let y=base;y>top+10;y-=12){ const k=(base-y)/(base-top), hw=Math.round(9-k*6), k2=(base-y+12)/(base-top), hw2=Math.round(9-k2*6);
      pline(L,gx-hw+1,y,gx+hw2-2,y-12,'#c9c6d8',1); pline(L,gx+hw-2,y,gx-hw2+1,y-12,'#8b88a3',1); }
    for(let y=-9;y<=9;y++) for(let x=-5;x<=5;x++) if((x*x)/25+(y*y)/81<=1) r(gx-14+x,base-58+y,1,1,x<-2?'#8b88a3':(x>2?'#e6e2d8':'#c9c6d8'));
    r(gx-10,base-59,5,2,'#5a5f8c');
    r(gx+5,base-40,4,14,'#e6e2d8'); r(gx+5,base-40,1,14,'#ffffff'); r(gx-9,base-72,4,12,'#e6e2d8');
    r(gx-12,base-2,24,2,'#3e426b'); }
})();

// background layers (seamlessly tiling strips)
const bg=(()=>{
  const TAU=Math.PI*2;
  // far mountains
  const [mc,mx]=mk(1024,150);
  for(let x=0;x<1024;x++){
    const u=x/1024, h=Math.round(62+24*Math.sin(TAU*u*2+1)+14*Math.sin(TAU*u*5+2)+6*Math.sin(TAU*u*13)+(hash(x>>2,5)%4));
    mx.fillStyle='#161a3e'; mx.fillRect(x,150-h,1,h);
    mx.fillStyle='#2a3068'; mx.fillRect(x,150-h,1,1);
    if(h>88){ mx.fillStyle='#3a4180'; mx.fillRect(x,150-h,1,Math.min(6,Math.round((h-88)/3)+1)); }
  }
  // distant radio towers
  const [tc,tx]=mk(1200,170), towerLights=[];
  for(let i=0;i<7;i++){
    const x=80+i*170+Math.round(rnd()*60), h=70+Math.round(rnd()*80), top=170-h;
    pline(tx,x,top+6,x-Math.round(h*0.38),170,'#1e2250',1); pline(tx,x,top+6,x+Math.round(h*0.38),170,'#1e2250',1);
    tx.fillStyle='#232856'; tx.fillRect(x-1,top,3,h);
    for(let y=top+6;y<170;y+=8){ tx.fillStyle='#2e3468'; tx.fillRect(x-2,y,5,1); }
    towerLights.push({x,y:top-1,ph:rnd()*2});
  }
  // near hills with pines
  const [hc,hx]=mk(960,120);
  const hill=x=>Math.round(40+9*Math.sin(TAU*x/960*3)+5*Math.sin(TAU*x/960*7+1));
  for(let x=0;x<960;x++){ const h=hill(x); hx.fillStyle='#0e1028'; hx.fillRect(x,120-h,1,h); hx.fillStyle='#1b1f47'; hx.fillRect(x,120-h,1,1); }
  for(let i=0;i<70;i++){
    const x=Math.round(i*960/70+rnd()*8), th=16+Math.round(rnd()*34), b=120-hill(x)+3;
    for(let y=0;y<th;y++){ const w=Math.max(1,Math.round((y/th)*th*0.32*(0.7+0.3*((y%6)/6)))); hx.fillStyle='#0b0d22'; hx.fillRect(x-w,b-th+y,w*2+1,1); if(y%6===0) { hx.fillStyle='#161a3e'; hx.fillRect(x-w,b-th+y,1,1);} }
    hx.fillStyle='#0b0d22'; hx.fillRect(x,b-2,1,4);
  }
  // clouds
  const clouds=[];
  for(let i=0;i<4;i++){
    const [c,x]=mk(150,46);
    for(let k=0;k<9;k++){ const ox=18+rnd()*114, oy=18+rnd()*14, rx=12+rnd()*18, ry=7+rnd()*8;
      for(let yy=-ry;yy<=ry;yy++) for(let xx=-rx;xx<=rx;xx++){ const d=(xx*xx)/(rx*rx)+(yy*yy)/(ry*ry); if(d>1) continue;
        const X=Math.round(ox+xx), Y=Math.round(oy+yy); if(d>0.8&&(X+Y)%2) continue;
        x.fillStyle=yy<-ry*0.55?'#3a3f7a':'#232752'; x.fillRect(X,Y,1,1); } }
    clouds.push({c,x:i*380+rnd()*120,y:14+rnd()*50,sp:3+rnd()*4});
  }
  // moon
  const [moon,ox]=mk(34,34);
  for(let y=-15;y<=15;y++) for(let x=-15;x<=15;x++){ const d=Math.hypot(x,y); if(d>15.2) continue;
    ox.fillStyle=d>13.5?'#c9c4ad':(x+y>8?'#d9d4bd':'#ece8d4'); ox.fillRect(17+x,17+y,1,1); }
  for(const [x,y,r] of [[10,12,3],[20,20,4],[22,9,2],[12,23,2]]) for(let yy=-r;yy<=r;yy++) for(let xx=-r;xx<=r;xx++) if(xx*xx+yy*yy<=r*r){ ox.fillStyle='#c9c4ad'; ox.fillRect(x+xx,y+yy,1,1); }
  const stars=Array.from({length:110},()=>({x:rnd(),y:rnd()*0.7,b:rnd(),ph:rnd()*6}));
  // fog band
  const [fc,fx]=mk(1,60), fg=fx.createLinearGradient(0,0,0,60);
  fg.addColorStop(0,'rgba(60,52,110,0)'); fg.addColorStop(0.6,'rgba(60,52,110,0.35)'); fg.addColorStop(1,'rgba(40,36,84,0.1)'); fx.fillStyle=fg; fx.fillRect(0,0,1,60);
  return {mc,tc,hc,clouds,moon,stars,towerLights,fc};
})();

// ---------- drawing ----------
let camX=0, camY=0, lastCamX=0, lastCamY=0;
const SX=wx=>Math.round(wx*ART)-camX, SY=wy=>Math.round(wy*ART)-camY;
const R=(x,y,w,h,c)=>{cx.fillStyle=c;cx.fillRect(x,y,w,h);};
function strip(img,f,bottom){
  const w=img.width, y=Math.round(bottom-img.height); let x=-(((camX*f)%w)+w)%w;
  for(;x<BW;x+=w) cx.drawImage(img,Math.round(x),y);
}

function drawBg(){
  cx.fillStyle=skyGrad; cx.fillRect(0,0,BW,BH);
  for(const s of bg.stars){
    const x=Math.round(((s.x*BW*1.3-camX*0.03)%(BW*1.3)+BW*1.3)%(BW*1.3)), y=Math.round(s.y*BH-camY*0.03+(LH-VH)*ART*0.03);
    const tw=0.5+0.5*Math.sin(tnow*(1+s.b*2)+s.ph);
    R(x,y,1,1,s.b>0.85?(tw>0.5?'#ffffff':'#b9b7ff'):(tw>0.3?'#6d6fa8':'#44466f'));
    if(s.b>0.95&&tw>0.7){ R(x-1,y,3,1,'rgba(220,220,255,0.5)'); R(x,y-1,1,3,'rgba(220,220,255,0.5)'); }
  }
  const mx=Math.round(BW*0.76-camX*0.01), my=Math.round(26+(LH-VH-cam.y)*ART*0.02);
  cx.globalCompositeOperation='lighter'; cx.globalAlpha=0.35; cx.drawImage(glow('#9aa0ff'),mx-40,my-40,114,114); cx.globalAlpha=1; cx.globalCompositeOperation='source-over';
  cx.drawImage(bg.moon,mx,my);
  for(const c of bg.clouds){ const w=1500, x=((c.x+tnow*c.sp-camX*0.06)%w+w)%w-160; cx.drawImage(c.c,Math.round(x),Math.round(c.y-camY*0.02+(LH-VH)*ART*0.02)); }
  const lift=(LH-VH-cam.y)*ART;
  const mB=(VH-48)*ART+lift*0.10, tB=(VH-44)*ART+lift*0.16, hB=(VH-38)*ART+lift*0.28;
  strip(bg.mc,0.10,mB); R(0,Math.round(mB),BW,BH,'#161a3e');
  strip(bg.tc,0.18,tB);
  { const w=bg.tc.width, off=-(((camX*0.18)%w)+w)%w, y0=Math.round(tB-bg.tc.height);
    for(const l of bg.towerLights) for(let x=off+l.x;x<BW+w;x+=w){ if(x<-4||x>BW+4) continue; if(((tnow+l.ph)%1.6)<0.8){ R(Math.round(x)-1,y0+l.y-1,3,2,'#ff4150'); cx.globalCompositeOperation='lighter'; cx.drawImage(glow('#ff4150'),Math.round(x)-6,y0+l.y-7,12,12); cx.globalCompositeOperation='source-over'; } } }
  cx.drawImage(bg.fc,0,Math.round(tB-50),BW,60);
  strip(bg.hc,0.30,hB); R(0,Math.round(hB),BW,BH,'#0e1028');
}

function blitLevel(){
  const sx=clamp(camX,0,LC.width), sy=clamp(camY,0,LC.height), w=Math.min(BW-(sx-camX),LC.width-sx), h=Math.min(BH-(sy-camY),LC.height-sy);
  if(w>0&&h>0) cx.drawImage(LC,sx,sy,w,h,sx-camX,sy-camY,w,h);
  // when the camera rises above the level, continue the boundary walls up into the sky
  if(camY<0) for(const wx of [0,LC.width-32]){ if(wx-camX<-32||wx-camX>BW) continue;
    for(let y=-camY-32;y>-32;y-=32) cx.drawImage(LC,wx,64,32,32,wx-camX,y,32,32); }
}

function drawSparks(){
  for(const tx of [78,79,80]){ const sx=SX(tx*T), sy=SY(21*T); if(sx<-40||sx>BW+40) continue;
    const f=Math.floor(tnow*16)+tx;
    const col=f%3?'#ffe27a':'#ffffff';
    let px=sx+4, py=sy+26;
    for(let i=1;i<=5;i++){ const nx=sx+4+i*5, ny=sy+26-((hash(f,i)%12)+2); pline(cx,px,py,nx,ny,col,1); px=nx; py=ny; }
    if(hash(f,tx)%5===0) sparks(tx*T+8,21*T+12,'#ffe27a',2,120);
  }
}

function drawChecks(){
  for(const c of checks){ const x=SX(c.x), y=SY(c.y); if(x<-30||x>BW+30) continue;
    R(x-5,y-3,12,3,'#3e426b'); R(x-5,y-3,12,1,'#5b608f');
    R(x,y-50,2,47,'#8f93b8'); R(x+1,y-50,1,47,'#5a5f8c');
    R(x-2,y-55,6,5,'#3e426b'); R(x-1,y-54,4,3,c.on?'#ffe08a':'#4b4f7c');
    const fy=Math.round(y-46+(1-c.raise)*28);
    for(let i=0;i<14;i++){ const o=c.on?Math.round(Math.sin(tnow*6-i*0.55)*1.2*(i/14)):Math.round(i*0.4);
      R(x+2+i,fy+o,1,9-(c.on?0:Math.round(i*0.25)),c.on?(i<7?'#ff6a2c':'#ffc23d'):'#4b4f7c'); }
  }
}

function drawRelays(){
  for(const r of relays){ if(r.got) continue;
    const x=SX(r.x), y=SY(r.y+Math.sin(tnow*3+r.ph)*1.5); if(x<-30||x>BW+30) continue;
    R(x-3,y-9,6,2,'#8f93b8'); R(x-1,y-11,2,2,'#8f93b8');
    R(x-9,y-7,18,14,'#e6e2d8'); R(x-9,y-7,18,1,'#ffffff'); R(x-9,y+6,18,1,'#9d9aa8');
    R(x-8,y-6,16,11,'#2e3360');
    for(let i=0;i<3;i++) R(x+1,y-4+i*3,6,1,'#1d2045');
    const on=((tnow+r.ph)%0.8)<0.4;
    R(x-6,y-4,3,3,on?'#5fe39a':'#1f6b45'); R(x-6,y+1,4,2,'#ffc23d');
    R(x+6,y-17,1,10,'#8f93b8'); R(x+5,y-18,3,2,'#ff4150');
  }
}

function drawDrones(){
  for(const d of drones){ if(!d.alive) continue;
    const x=SX(d.x), y=SY(d.y+Math.sin(d.ph*3)*2); if(x<-40||x>BW+40) continue;
    const bl=Math.floor(tnow*30)%2, f=d.dir;
    R(x-15,y-5,30,2,'#4a4e7a');
    R(x-17,y-8,5,4,'#3e426b'); R(x+12,y-8,5,4,'#3e426b');
    R(x-14-(bl?8:4),y-10,bl?16:8,1,'rgba(200,205,235,0.75)'); R(x+14-(bl?8:4),y-10,bl?16:8,1,'rgba(200,205,235,0.75)');
    R(x-9,y-4,18,9,'#c33a4c'); R(x-8,y-5,16,1,'#ff6b7d'); R(x-9,y+4,18,2,'#7e1f2e');
    R(x-7,y-2,2,4,'#ffc23d'); R(x+5,y-2,2,4,'#ffc23d');
    R(x+f*4-2,y-2,5,5,'#1a1024'); R(x+f*4-1,y-1,3,3,'#ff4150'); R(x+f*4,y-1,1,1,'#ffd0d4');
    R(x-1,y+6,2,4,'#5a5f8c'); if(((tnow+d.ph)%0.6)<0.3) R(x-1,y+10,2,1,'#5fe39a');
  }
}

function drawGoal(){
  const gx=SX(GOAL_X*T+8), base=SY(3*T);
  if(gx<-80||gx>BW+80) return;
  const on=state==='winning'||state==='win', bt=((tnow%1.2)<0.6)||on;
  if(bt) R(gx-2,5-camY,4,3,on?'#ffe08a':'#ff4150');
  if(on&&Math.floor(tnow*4)%2===0) R(gx-4,base-60,1,1,'#ffffff');
}

function drawPlayer(){
  if(p.inv>0 && p.inv<1.15 && Math.floor(p.inv*14)%2) return;
  const white=p.inv>1.18, X=SX(p.x), Y=SY(p.y), f=p.face;
  const Rp=(x,y,w,h,c)=>{cx.fillStyle=white?'#ffffff':c; cx.fillRect(f>0?X+x:X+24-x-w,Y+y,w,h);};
  const air=!p.onGround, moving=!air&&Math.abs(p.vx)>1;
  let fl=0,bl=0,fLift=0,bLift=0;
  if(moving){ const s=Math.sin(p.walk); fl=Math.round(s*3); bl=-fl; fLift=s>0.35?2:0; bLift=s<-0.35?2:0; }
  else if(air){ const tr=clamp(-(p.vx*f)/60,-4,4); fl=Math.round(2+tr); bl=Math.round(-2+tr); fLift=p.vy<-40?3:2; bLift=p.vy<-40?1:0; }
  const U=(!air&&!moving&&Math.sin(tnow*2.4)>0.55)?1:0;
  if(!air){ cx.fillStyle='rgba(0,0,10,0.35)'; cx.fillRect(X+2,Y+39,20,2); }
  // back arm
  const bsw=moving?-fl:(air?-3:0);
  Rp(6+Math.round(bsw*0.5),15+U,3,9,'#284660'); Rp(6+bsw,24+U,3,2,'#b97a55');
  // legs
  const leg=(bx,dx,lift,c,cs)=>{
    const u=Math.round(dx/2);
    Rp(bx+u,28,6,4,c); Rp(bx+dx,32,6,4-lift,c); Rp(bx+dx,32,1,4-lift,cs); Rp(bx+dx+1,31,4,2,'#3e4577');
    const by=36-lift; Rp(bx+dx,by,8,3,'#1a1a24'); Rp(bx+dx,by+3,8,1,'#0b0b12'); Rp(bx+dx+3,by,2,1,'#ff6a2c');
  };
  leg(6,bl,bLift,'#1f2342','#15182f');
  // torso
  Rp(5,14+U,14,13-U,'#35546d'); Rp(6,15+U,12,11-U,'#b6d63a'); Rp(6,15+U,2,11-U,'#86a02a'); Rp(16,15+U,2,11-U,'#d4f05a');
  Rp(6,21,12,2,'#e3e6f2'); Rp(6,22,12,1,'#a9adc4');
  Rp(8,13+U,8,2,'#2a4458'); Rp(5,14+U,3,3,'#2a4458');
  Rp(5,26,14,2,'#5a3a22'); Rp(14,26,3,2,'#d9b24a'); Rp(3,25,4,5,'#6e4a2c'); Rp(3,25,4,1,'#8a6040');
  leg(12,fl,fLift,'#2a2f55','#1f2342');
  // head
  const hy=U;
  Rp(7,7+hy,3,4,'#3a2618');
  Rp(8,6+hy,9,7,'#e0a57a'); Rp(8,11+hy,4,2,'#b97a55'); Rp(12,11+hy,5,2,'#8a5a3c'); Rp(14,11+hy,2,1,'#5b3826');
  Rp(17,8+hy,1,2,'#e0a57a'); Rp(14,8+hy,1,2,'#16172a'); Rp(13,7+hy,3,1,'#3a2618'); Rp(10,8+hy,2,2,'#b97a55');
  Rp(10,13+hy,5,1,'#b97a55');
  Rp(7,0+hy,10,1,'#f2c230'); Rp(6,1+hy,12,4,'#f2c230'); Rp(8,1+hy,3,1,'#ffe487'); Rp(8,2+hy,1,2,'#ffe487'); Rp(11,0+hy,2,4,'#ffd84e');
  Rp(6,4+hy,12,1,'#c8961c'); Rp(5,5+hy,12,1,'#c8961c'); Rp(16,5+hy,5,1,'#f2c230');
  Rp(17,2+hy,2,3,'#8b88a3'); Rp(19,2+hy,2,3,'#fff6c8');
  // front arm + gauntlet (points at the hook when the cable is out)
  let a;
  if(hook.state!=='idle'){ const hx=hook.x-(p.x+6), hyw=hook.y-(p.y+8); a=Math.atan2(hyw,hx*f); }
  else if(air) a=-1.0;
  else a=Math.PI/2-0.35+(moving?fl*0.12:0);
  const ca=Math.cos(a), sa=Math.sin(a), shx=12, shy=16+U;
  for(let t=0;t<=8;t++) Rp(Math.round(shx+ca*t)-1,Math.round(shy+sa*t)-1,3,3,'#46708f');
  const gxl=Math.round(shx+ca*10), gyl=Math.round(shy+sa*10);
  Rp(gxl-3,gyl-3,7,7,'#ff6a2c'); Rp(gxl-3,gyl+3,7,1,'#a73d17'); Rp(gxl-2,gyl-3,3,1,'#ffa06f');
  Rp(gxl-1,gyl-1,2,2,hook.state==='att'?'#5fe39a':'#ffc23d');
  // cable + hook claw
  if(hook.state!=='idle'){
    const gsx=f>0?X+gxl:X+24-gxl, gsy=Y+gyl, kx=SX(hook.x), ky=SY(hook.y);
    const d=Math.hypot(hook.x-hand().x,hook.y-hand().y);
    if(hook.state==='att'&&d<rope-4){
      const sag=Math.min(40,(rope-d)*ART*0.6); let lx=gsx, ly=gsy;
      for(let i=1;i<=12;i++){ const k=i/12, nx=gsx+(kx-gsx)*k, ny=gsy+(ky-gsy)*k+Math.sin(k*Math.PI)*sag; pline(cx,lx,ly+1,nx,ny+1,'#555981',1); pline(cx,lx,ly,nx,ny,'#d7d9ee',1); lx=nx; ly=ny; }
    } else { pline(cx,gsx,gsy+1,kx,ky+1,'#555981',1); pline(cx,gsx,gsy,kx,ky,'#e9eaf8',1); }
    R(kx-2,ky-2,5,5,'#ff6a2c'); R(kx-2,ky-2,5,1,'#ffa06f'); R(kx-4,ky-4,2,2,'#e6e2d8'); R(kx+3,ky-4,2,2,'#e6e2d8');
  }
  return {lx:f>0?X+20:X+4, ly:Y+3+U};
}

function drawParts(add){
  for(const q of parts){ if(!!q.add!==add) continue;
    const x=SX(q.x), y=SY(q.y);
    if(q.t==='dot'){ const s=q.life>0.3?2:1; R(x,y,s,s,q.col); }
    else if(q.t==='spark'){ R(x,y,2,1,q.col); R(x-Math.round(q.vx*0.02),y-Math.round(q.vy*0.02),1,1,q.col); }
    else if(q.t==='smoke'){ const k=q.life/(q.max||1), r=Math.round((q.r||2)*(2-k)*ART/2); cx.globalAlpha=Math.max(0,k)*0.6; R(x-r,y-r,r*2,r*2,q.col||'#3d4070'); cx.globalAlpha=1; }
    else if(q.t==='debris'){ R(x,y,q.sz*2,q.sz*2,q.col); }
    else if(q.t==='ring'){ const k=1-q.life/q.full, r=Math.round(k*q.max*ART); cx.globalAlpha=1-k; cx.strokeStyle=q.col; cx.lineWidth=2; cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.stroke(); cx.globalAlpha=1; }
    else if(q.t==='text'){ cx.globalAlpha=Math.min(1,q.life/0.3); cx.font='900 16px "Big Shoulders Stencil Display", Impact, sans-serif'; cx.textAlign='center';
      cx.fillStyle='#0b0c1e'; cx.fillText(q.text,x+1,y+1); cx.fillStyle=q.col; cx.fillText(q.text,x,y); cx.globalAlpha=1; }
  }
}

function drawGlows(lampPos){
  cx.globalCompositeOperation='lighter';
  const gl=(x,y,col,s,a)=>{ if(x<-s||x>BW+s||y<-s||y>BH+s) return; cx.globalAlpha=a; cx.drawImage(glow(col),Math.round(x-s/2),Math.round(y-s/2),s,s); };
  for(const l of lights){ const x=l.x-camX, y=l.y-camY;
    if(l.blink&&(tnow%l.blink)>l.blink/2) continue;
    gl(x,y,l.col,l.size,l.flick?0.45+0.08*Math.sin(tnow*13)*Math.sin(tnow*7):0.7); }
  for(const r of relays) if(!r.got){ gl(SX(r.x),SY(r.y),'#5fe39a',44,0.28+0.12*Math.sin(tnow*4+r.ph)); }
  for(const d of drones) if(d.alive){ gl(SX(d.x+d.dir*2),SY(d.y+Math.sin(d.ph*3)*2),'#ff4150',26,0.6); }
  for(const c of checks) if(c.on) gl(SX(c.x)+1,SY(c.y)-52,'#ffc23d',40,0.55);
  for(const tx of [78,79,80]){ gl(SX(tx*T+8),SY(21*T+12),'#ffe27a',48,0.3+0.3*Math.random()); }
  const gx=SX(GOAL_X*T+8), won=state==='winning'||state==='win';
  if(won||(tnow%1.2)<0.6) gl(gx,6-camY,won?'#ffc23d':'#ff4150',won?90:30,0.8);
  if(won){ for(let i=0;i<3;i++){ const k=((tnow*0.7+i/3)%1), r=Math.round(14+k*220); cx.globalAlpha=(1-k)*0.6; cx.strokeStyle='#ffc23d'; cx.lineWidth=2; cx.beginPath(); cx.arc(gx,6-camY,r,Math.PI*0.1,Math.PI*0.9,true); cx.stroke(); } }
  if(lampPos&&(state==='play'||state==='title')){ cx.globalAlpha=0.55;
    if(p.face>0) cx.drawImage(lamp,lampPos.lx,lampPos.ly-23);
    else { cx.save(); cx.translate(lampPos.lx,0); cx.scale(-1,1); cx.drawImage(lamp,0,lampPos.ly-23); cx.restore(); } }
  cx.globalAlpha=1;
  drawParts(true);
  cx.globalCompositeOperation='source-over';
}

function drawRain(){
  const dx=camX-lastCamX, dy=camY-lastCamY; lastCamX=camX; lastCamY=camY;
  cx.fillStyle='rgba(150,158,220,0.22)';
  const dt=1/60;
  for(const d of rain){
    if(state!=='pause'){ d.y+=d.s*dt; d.x-=d.s*0.25*dt; }
    d.x-=dx; d.y-=dy;
    if(d.y>BH){d.y-=BH+8; d.x=Math.random()*BW;} if(d.y<-8) d.y+=BH; if(d.x<-4) d.x+=BW+8; if(d.x>BW+4) d.x-=BW+8;
    const x=Math.round(d.x), y=Math.round(d.y); cx.fillRect(x,y,1,3); cx.fillRect(x-1,y+3,1,3);
  }
}

function draw(){
  let sx=0, sy=0; if(shake>0){ sx=(Math.random()-0.5)*shake*2; sy=(Math.random()-0.5)*shake*2; }
  camX=Math.round((cam.x+sx)*ART); camY=Math.round((cam.y+sy)*ART);
  cx.imageSmoothingEnabled=false;
  drawBg();
  blitLevel();
  drawSparks();
  drawGoal(); drawChecks(); drawRelays(); drawDrones();
  const lampPos=drawPlayer();
  drawParts(false);
  drawGlows(lampPos);
  drawRain();
  cx.drawImage(vignette,0,0);
  if(flash>0){ cx.fillStyle=`rgba(255,65,80,${flash*1.2})`; cx.fillRect(0,0,BW,BH); }
  if(state==='play'&&p.hp===1){ cx.globalAlpha=0.18+0.1*Math.sin(tnow*6); cx.drawImage(vignette,0,0); cx.fillStyle='rgba(255,40,60,0.12)'; cx.fillRect(0,0,BW,BH); cx.globalAlpha=1; }
}

// ---------- HUD ----------
const hudEl=$('hud'), hpEl=$('hp'), relEl=$('rel'), cabEl=$('cab'), timEl=$('tim'), hintEl=$('hint');
let lastHud='', lastHint=-1, hintAt=0;
function hintText(s){ return isTouch?s:s.replace(/GRAB/g,'SPACE').replace(/▲/g,'↑').replace(/▼/g,'↓'); }
function hud(){
  if(state!=='play'&&state!=='pause'&&state!=='winning'){ if(lastHint!==-2){ lastHint=-2; hintEl.textContent=''; } return; }
  const cab=hook.state==='att'?(rope/16).toFixed(1)+' m':'— m';
  const key=p.hp+'|'+got+'|'+cab+'|'+fmt(clock);
  if(key!==lastHud){ lastHud=key;
    hpEl.innerHTML=[0,1,2].map(i=>`<i class="${i<p.hp?'':'off'}"></i>`).join('');
    hudEl.classList.toggle('low',p.hp===1);
    relEl.textContent=got+'/'+relays.length; cabEl.textContent=cab; timEl.textContent=fmt(clock); }
  let hi=0; const tx=p.x/T; HINTS.forEach((h,i)=>{if(tx>=h[0])hi=i;}); if(p.y<5*T&&tx>90) hi=HINTS.length-1;
  if(state==='winning') hi=-3;
  if(hi!==lastHint){ lastHint=hi; hintEl.innerHTML=hi>=0?hintText(HINTS[hi][1]):''; hintEl.classList.remove('fade'); hintAt=tnow; }
  else if(hi>=0&&tnow-hintAt>9) hintEl.classList.add('fade');
}

// ---------- flow & UI ----------
let drawnPaused=false;
function setUI(){
  const playing=state==='play', inRun=playing||state==='pause'||state==='winning';
  hudEl.hidden=!inRun;
  $('pauseBtn').hidden=!playing;
  $('touch').hidden=!(playing&&isTouch);
  $('ovTitle').hidden=state!=='title';
  $('ovPause').hidden=state!=='pause';
  $('ovWin').hidden=state!=='win';
  $('rotate').hidden=!(state==='title'&&isTouch&&isPortrait());
  document.body.classList.toggle('touch',isTouch);
  if(!playing) clearTouch();
}
function startGame(){
  Snd.init(); reset(); state='play'; prevGrab=true; lastHint=-1; lastHud='';
  if(isTouch) goFullscreen();
  Snd.ambience(true);
  setUI();
}
function pause(){ if(state!=='play') return; state='pause'; drawnPaused=false; Snd.ambience(false); setUI(); }
function resume(){ if(state!=='pause') return; state='play'; prevGrab=true; last=performance.now(); Snd.init(); Snd.ambience(true); setUI(); }
function toTitle(){ state='title'; reset(); Snd.ambience(false); showBest(); setUI(); }
function win(){
  state='winning'; winT=0; fwT=0; hook.state='idle'; p.vx=p.vy=0;
  sfx.win(); buzz([30,60,30]); shake=2;
  setUI();
}
function showWin(){
  state='win'; winT=0;
  $('winStats').textContent=`Off air for ${fmt(clock)} · Relays ${got}/${relays.length} · Falls ${falls}`;
  const prev=store.get('best',null), rec={time:clock,relays:got,falls};
  const better=!prev||rec.relays>prev.relays||(rec.relays===prev.relays&&rec.time<prev.time);
  if(better){ store.set('best',rec); $('winBest').textContent=prev?'New record!':'First record set.'; }
  else $('winBest').textContent=`Record: ${fmt(prev.time)} · ${prev.relays}/${RELAYS.length} relays`;
  Snd.ambience(false); setUI();
}
function showBest(){
  const b=store.get('best',null);
  $('bestLine').textContent=b?`Record: ${fmt(b.time)} · ${b.relays}/${RELAYS.length} relays`:'';
}

function goFullscreen(){
  const el=document.documentElement, rq=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!rq||document.fullscreenElement||document.webkitFullscreenElement||isStandalone()) return;
  try{ const pr=rq.call(el,{navigationUI:'hide'}); if(pr&&pr.then) pr.then(lockLandscape).catch(()=>{}); }catch(_){}
}
function lockLandscape(){ try{ const o=screen.orientation; if(o&&o.lock) o.lock('landscape').catch(()=>{}); }catch(_){} }
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;

$('startBtn').addEventListener('click',startGame);
$('againBtn').addEventListener('click',startGame);
$('resumeBtn').addEventListener('click',resume);
$('restartBtn').addEventListener('click',startGame);
$('quitBtn').addEventListener('click',toTitle);
$('pauseBtn').addEventListener('click',()=>{ sfx.click(); pause(); });
const soundBtn=$('soundBtn');
const syncSound=()=>{ soundBtn.textContent='Sound: '+(muted?'off':'on'); };
soundBtn.addEventListener('click',()=>{ Snd.init(); Snd.setMuted(!muted); syncSound(); sfx.click(); });
const fsBtn=$('fsBtn');
if((document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)&&!isStandalone()){
  fsBtn.hidden=false;
  fsBtn.addEventListener('click',()=>{
    if(document.fullscreenElement||document.webkitFullscreenElement){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); }
    else goFullscreen();
  });
}

// install hints
const installTip=$('installTip');
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(isIOS&&!isStandalone()){ installTip.hidden=false; installTip.textContent='Tip: tap Share, then “Add to Home Screen” to play fullscreen.'; }
let deferredInstall=null;
addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); deferredInstall=e; installTip.hidden=false; installTip.innerHTML='';
  const b=document.createElement('button'); b.className='alt'; b.type='button'; b.textContent='Install game';
  b.addEventListener('click',()=>{ deferredInstall.prompt(); deferredInstall.userChoice.finally(()=>{ deferredInstall=null; installTip.hidden=true; }); });
  installTip.appendChild(b);
});

// ---------- input ----------
const KEYMAP={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'grab',KeyJ:'grab',KeyZ:'grab'};
function setTouchMode(t){ if(t===isTouch) return; isTouch=t; lastHint=-1; setUI(); }
addEventListener('keydown',e=>{
  Snd.init();
  if(!matchMedia('(pointer:coarse)').matches) setTouchMode(false);
  if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter')) return;
  const k=KEYMAP[e.code]; if(k){K[k]=true;e.preventDefault();}
  if(e.code==='Escape'||e.code==='KeyP'){ if(state==='play') pause(); else if(state==='pause') resume(); e.preventDefault(); }
  if(e.code==='KeyM'){ Snd.setMuted(!muted); syncSound(); }
  if(e.code==='Enter'&&(state==='title'||state==='win')){startGame();e.preventDefault();}
});
addEventListener('keyup',e=>{const k=KEYMAP[e.code]; if(k){K[k]=false;e.preventDefault();}});
addEventListener('pointerdown',e=>{ Snd.init(); if(e.pointerType==='touch') setTouchMode(true); },{capture:true});
function clearKeys(){ DIRS.forEach(k=>{K[k]=false;}); clearTouch(); }
addEventListener('blur',()=>{ clearKeys(); pause(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ clearKeys(); pause(); } });
addEventListener('contextmenu',e=>e.preventDefault());

// touch: left thumb d-pad (slide between directions), right thumb GRAB
const stickZone=$('stickZone'), dpadEl=$('dpad'), arms={};
dpadEl.querySelectorAll('[data-d]').forEach(el=>{arms[el.dataset.d]=el;});
let stickId=null, grabId=null;
function stickAt(e){
  const r=dpadEl.getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2), d=Math.hypot(dx,dy);
  const on={left:false,right:false,up:false,down:false};
  if(d>r.width*0.1){ const c=dx/d, s=dy/d; on.right=c>0.5; on.left=c<-0.5; on.down=s>0.5; on.up=s<-0.5; }
  for(const k in on){ TT[k]=on[k]; arms[k].classList.toggle('on',on[k]); }
}
function stickEnd(e){ if(e.pointerId!==stickId) return; stickId=null; for(const k in arms){ TT[k]=false; arms[k].classList.remove('on'); } }
stickZone.addEventListener('pointerdown',e=>{ e.preventDefault(); if(stickId!==null) return; stickId=e.pointerId; try{stickZone.setPointerCapture(e.pointerId);}catch(_){} stickAt(e); });
stickZone.addEventListener('pointermove',e=>{ if(e.pointerId===stickId) stickAt(e); });
['pointerup','pointercancel','lostpointercapture'].forEach(t=>stickZone.addEventListener(t,stickEnd));
const grabZone=$('grabZone'), grabBtn=$('grabBtn');
grabZone.addEventListener('pointerdown',e=>{ e.preventDefault(); if(grabId!==null) return; grabId=e.pointerId; try{grabZone.setPointerCapture(e.pointerId);}catch(_){} TT.grab=true; grabBtn.classList.add('on'); });
const grabEnd=e=>{ if(e.pointerId!==grabId) return; grabId=null; TT.grab=false; grabBtn.classList.remove('on'); };
['pointerup','pointercancel','lostpointercapture'].forEach(t=>grabZone.addEventListener(t,grabEnd));
function clearTouch(){ stickId=grabId=null; DIRS.forEach(k=>{TT[k]=false;}); for(const k in arms) arms[k].classList.remove('on'); grabBtn.classList.remove('on'); }

// gamepad
let padStart=false;
function pollPad(){
  DIRS.forEach(k=>{GP[k]=false;});
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  for(const g of pads){ if(!g) continue;
    const b=i=>!!(g.buttons[i]&&g.buttons[i].pressed), ax=g.axes[0]||0, ay=g.axes[1]||0;
    GP.left=GP.left||b(14)||ax<-0.45; GP.right=GP.right||b(15)||ax>0.45;
    GP.up=GP.up||b(12)||ay<-0.45; GP.down=GP.down||b(13)||ay>0.45;
    GP.grab=GP.grab||b(0)||b(1)||b(2)||b(5)||b(7);
    const st=b(9);
    if(st&&!padStart){ if(state==='play') pause(); else if(state==='pause') resume(); else if(state==='title'||state==='win') startGame(); }
    padStart=st;
  }
}
function readInput(){ pollPad(); for(const k of DIRS) I[k]=K[k]||TT[k]||GP[k]; }

// ---------- boot ----------
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,150));
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
reset(); resize(); syncSound(); showBest(); setUI();
let last=performance.now();
function loop(now){
  const dt=Math.min(1/30,(now-last)/1000); last=now;
  update(dt);
  if(state!=='pause'||!drawnPaused){ draw(); drawnPaused=state==='pause'; }
  hud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// test hook: ?debug exposes a frame stepper for automated checks
if(/[?&]debug\b/.test(location.search)) window.__rr={
  run(n,keys={}){ DIRS.forEach(k=>{K[k]=!!keys[k];}); for(let i=0;i<n;i++) update(1/60); draw(); hud(); return this.info(); },
  info(){ return {state,x:+p.x.toFixed(1),y:+p.y.toFixed(1),vx:+p.vx.toFixed(1),vy:+p.vy.toFixed(1),ground:p.onGround,hook:hook.state,rope:+rope.toFixed(1),hp:p.hp,got,cp,falls,VW,VH,BW,BH}; },
  start:startGame, teleport(x,y){p.x=x;p.y=y;p.vx=p.vy=0;}
};

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
