/* Relay Rigger — engine.
   Levels come from levels.js (window.RR_LEVELS). Player physics constants are unchanged from the
   original prototype; renderer, scaling, input, audio, enemies, terminals and menus live here. */
(() => {
'use strict';

// ---------- constants ----------
const T=16, ART=2;                          // tile size (world units), art pixels per world unit
const G=760, WALK=88, AIR=260, AIRMAX=110, PUMP=300, REEL=120, MINL=10, RANGE=210, HOOKV=760;
const SKY=56;                               // camera may rise this far above a level so top decks aren't under the HUD
let VW=320, VH=180;                         // visible world size, set by resize()
const LEVELS=window.RR_LEVELS;

// ---------- utils ----------
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,k)=>a+(b-a)*k;
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

// ---------- save ----------
const save=store.get('save',null)||{unlocked:1,best:{}};
{ const old=store.get('best',null); if(old&&!save.best[0]){ save.best[0]=Object.assign({total:7},old); save.unlocked=Math.max(save.unlocked,2); } }
const persist=()=>store.set('save',save);

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
    thud(){noise(0.12,0.25,500,0.8,'lowpass',0,150); tone(220,120,0.1,'square',0.08);},
    squish(){noise(0.25,0.3,1600,2,'bandpass',0,300); tone(300,60,0.3,'sawtooth',0.1);},
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
    click(){tone(880,880,0.03,'square',0.04);},
    type(){tone(1200+Math.random()*900,1200,0.02,'square',0.018);},
    boot(){tone(200,800,0.25,'triangle',0.08);},
    done(){[523,784,1047,1568].forEach((f,i)=>tone(f,f,0.16,'triangle',0.1,i*0.08));},
    alarm(){[0,0.22,0.44].forEach(d=>tone(700,500,0.18,'sawtooth',0.06,d));},
    deny(){tone(220,180,0.18,'square',0.06); tone(180,140,0.2,'square',0.06,0.18);},
    charge(){tone(180,700,0.6,'sine',0.05);},
    spit(){noise(0.18,0.12,900,2,'bandpass',0,300); tone(500,200,0.15,'sine',0.06);},
    latch(){tone(900,300,0.25,'sine',0.08); noise(0.1,0.06,3000,4);},
    beam(){tone(120,480,0.4,'sine',0.06); noise(0.4,0.05,2000,6,'bandpass',0,6000);}
  };
  function setMuted(m){ muted=m; store.set('muted',m); if(master) master.gain.value=m?0:0.55; }
  return {init,S,setMuted,ambience};
})();
const sfx=Snd.S;
let isTouch=matchMedia('(pointer:coarse)').matches;
const buzz=ms=>{ if(isTouch&&navigator.vibrate) try{navigator.vibrate(ms);}catch(_){} };

// ---------- themes ----------
const THEMES={
  ridge:{sky:['#05061a','#141741','#33285a'],mtn:'#161a3e',mtnHi:'#2a3068',snow:'#3a4180',far:'towers',near:'pines',hill:'#0e1028',hillHi:'#1b1f47',tree:'#0b0d22',
    rain:true,aurora:0,ship:0,moon:true,pit:'dark',rock:['#262840','#212339','#1c1d33','#17182b'],grit:['#4a4e78','#6c71a3','#33365a'],grass:true},
  quarry:{sky:['#0b0820','#2c1c42','#6a3548'],mtn:'#241a38',mtnHi:'#3e2c56',snow:'#4e3a66',far:'towers',near:'pines',hill:'#150f24',hillHi:'#2a1d3e',tree:'#100b1c',
    rain:false,aurora:0,ship:0,moon:true,pit:'dark',rock:['#3a2c34','#33262e','#2a2028','#221a21'],grit:['#6a5058','#8e6e74','#46343c'],grass:false},
  dam:{sky:['#03081a','#0b2236','#1d4048'],mtn:'#0f2230',mtnHi:'#1c3a4a',snow:'#2e5566',far:'towers',near:'pines',hill:'#081620',hillHi:'#12303a',tree:'#061018',
    rain:true,aurora:0.45,ship:0,moon:false,pit:'water',rock:['#2c3236','#262b2f','#202428','#1a1d21'],grit:['#4c5a60','#6e7e84','#343e44'],grass:true},
  city:{sky:['#06051a','#1a1238','#4a2a4a'],mtn:'#120f2c',mtnHi:'#221c46',snow:'#221c46',far:'city',near:'buildings',hill:'#0c0a20',hillHi:'#1a1638',tree:'#0a0818',
    rain:true,aurora:0.15,ship:1,moon:false,pit:'dark',windows:true},
  uplink:{sky:['#020514','#0a1f2a','#1f4a3a'],mtn:'#0a1a24',mtnHi:'#16323a',snow:'#2a5a5a',far:'towers',near:'pines',hill:'#06121a',hillHi:'#0e2a2e',tree:'#040c12',
    rain:false,aurora:1,ship:2,moon:false,pit:'dark'}
};

// ---------- level ----------
let W=0,H=0,LW=0,LH=0, map=[], rockMap=[], sparkTiles=[], LI=0, LD=null, LDEF=null, TH=THEMES.ridge;
const tile=(tx,ty)=> (tx<0||tx>=W)?1 : (ty<0||ty>=H)?0 : map[ty][tx];
function buildLevelData(def){
  W=def.W; H=def.H; LW=W*T; LH=H*T;
  map=Array.from({length:H},()=>new Array(W).fill(0));
  rockMap=Array.from({length:H},()=>new Uint8Array(W));
  const d={start:[2,H-5],checks:[],relays:[],enemies:[],terms:[],goal:null,props:[]};
  const set=(x0,x1,y0,y1,v,rock)=>{ for(let y=Math.max(0,y0);y<=Math.min(H-1,y1);y++) for(let x=Math.max(0,x0);x<=Math.min(W-1,x1);x++){ map[y][x]=v; rockMap[y][x]=rock; } };
  const B={W,H,
    steel:(x0,x1,y0,y1)=>set(x0,x1,y0,y1,1,0), rock:(x0,x1,y0,y1)=>set(x0,x1,y0,y1,1,1),
    girder:(x0,x1,y)=>set(x0,x1,y,y,2,0), sparks:(x0,x1,y)=>set(x0,x1,y,y,3,0), air:(x0,x1,y0,y1)=>set(x0,x1,y0,y1,0,0),
    start:(x,y)=>{d.start=[x,y];}, check:(x,y)=>d.checks.push([x,y]), relay:(x,y)=>d.relays.push([x,y]),
    drone:(x0,x1,y)=>d.enemies.push({type:'drone',x:x0*T,y:y*T+8,x0:x0*T,x1:x1*T}),
    enemy:(type,x,y)=>d.enemies.push({type,x:x*T+8,y:y*T+8}),
    terminal:(x,y,cfg)=>d.terms.push({tx:x,ty:y,cfg}),
    goal:(x,y)=>{d.goal={tx:x,ty:y};},
    prop:(t,o)=>d.props.push(Object.assign({t},o))
  };
  def.build(B);
  set(0,0,0,H-1,1,0); set(W-1,W-1,0,H-1,1,0);
  sparkTiles=[]; for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(map[y][x]===3) sparkTiles.push([x,y]);
  if(!d.goal) d.goal={tx:W-6,ty:d.start[1]};
  return d;
}
function loadLevel(i){
  LI=clamp(i,0,LEVELS.length-1); LDEF=LEVELS[LI]; TH=THEMES[LDEF.theme]||THEMES.ridge;
  LD=buildLevelData(LDEF);
  buildLayer(); buildBackground();
  reset();
  resize();
}

// ---------- state ----------
let p, hook, rope, enemies, shots, relays, checks, terms, goal, parts, cam={x:0,y:0}, state='title', clock=0, falls=0, got=0, cp=0, tnow=0;
let shake=0, hitstop=0, flash=0, winT=0, fwT=0, reelAcc=0, stepPh=0, crackleT=0, lockMsgT=-9, allDoneT=-99;
const DIRS=['left','right','up','down','grab'];
const K={}, TT={}, GP={}, I={}; DIRS.forEach(k=>{K[k]=TT[k]=GP[k]=I[k]=false;});
let prevGrab=false;

// enemy stats: hp, half-width, half-height (world units)
const EN={drone:{hp:1,bx:7,by:5},hunter:{hp:1,bx:7,by:5},seeker:{hp:1,bx:7,by:6},skitter:{hp:2,bx:9,by:6},spitter:{hp:2,bx:8,by:8},leech:{hp:1,bx:6,by:6}};
const FLYERS={hunter:1,seeker:1,leech:1};
function makeEnemy(type,x,y,o={}){
  const e={type,x,y,vx:0,vy:0,hp:EN[type].hp,alive:true,ph:Math.random()*6,dir:1,t:1+Math.random()*2,flash:0,stun:0,dash:0,ground:false,
    x0:o.x0,x1:o.x1,wave:!!o.wave,term:o.term||null,lo:o.lo||0,latched:false,cool:1+Math.random(),charge:0};
  if(type==='skitter'&&!o.wave) e.y=(Math.floor(y/T)+1)*T-EN.skitter.by;
  if(type==='spitter'){ const tx=Math.floor(x/T), ty=Math.floor(y/T), v=tile(tx,ty+1); e.ceil=!(v===1||v===2); e.y=e.ceil?ty*T+8:(ty+1)*T-8; }
  return e;
}
function makeTerm(t){
  const x=t.tx*T+8, y=(t.ty+1)*T, sr=t.ty+1;
  let a=t.tx, b=t.tx; const ok=tx=>{const v=tile(tx,sr); return (v===1||v===2)&&tile(tx,t.ty)===0;};
  while(a>1&&ok(a-1)) a--; while(b<W-2&&ok(b+1)) b++;
  return {x,y,tx:t.tx,prog:0,state:'idle',time:t.cfg.time||14,waves:t.cfg.waves||[],wi:0,seg:[a,b],typeT:0,working:false,drain:0};
}

function reset(){
  cp=0;
  const s=LD.start;
  checks=[s,...LD.checks].map(([x,y],i)=>({x:x*T+8,y:(y+1)*T,on:i===0,raise:i===0?1:0}));
  p={x:s[0]*T+2,y:(s[1]+1)*T-20,w:12,h:20,vx:0,vy:0,face:1,onGround:false,hp:3,inv:0,walk:0,landV:0};
  hook={state:'idle',x:0,y:0,dx:0,dy:0,len:0,tile:0,tx:0,ty:0}; rope=0;
  enemies=LD.enemies.map(e=>makeEnemy(e.type,e.x,e.y,e));
  shots=[];
  relays=LD.relays.map(([x,y])=>({x:x*T+8,y:y*T+8,got:false,ph:Math.random()*6}));
  terms=LD.terms.map(makeTerm);
  goal={x:LD.goal.tx*T+8,y:(LD.goal.ty+1)*T,tx:LD.goal.tx,top:Math.max(3,(LD.goal.ty+1)*T-110)};
  parts=[]; clock=0; falls=0; got=0; shake=0; hitstop=0; flash=0; lockMsgT=-9; allDoneT=-99;
  cam={x:clamp(p.x-VW/2,0,Math.max(0,LW-VW)),y:Math.max(-SKY,LH-VH)};
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
function smoke(x,y,n=5,col){for(let i=0;i<n;i++) parts.push({t:'smoke',x:x+(Math.random()-0.5)*8,y:y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*20,vy:-10-Math.random()*20,life:0.6+Math.random()*0.6,max:1.2,g:-10,r:2+Math.random()*3,col});}
function debris(x,y,cols,n=8){for(let i=0;i<n;i++){const a=-Math.PI*Math.random(),s=60+Math.random()*120;parts.push({t:'debris',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,life:0.9+Math.random()*0.6,col:cols[i%cols.length],g:520,sz:1+(Math.random()*2|0)});}}
function dust(x,y,n=4,dir=0){for(let i=0;i<n;i++) parts.push({t:'smoke',x:x+(Math.random()-0.5)*8,y,vx:(Math.random()-0.5)*40+dir*20,vy:-8-Math.random()*16,life:0.35+Math.random()*0.25,max:0.6,g:0,r:1+Math.random()*1.5,col:'#6b6f9a'});}
function ring(x,y,col,max=60,life=0.8){parts.push({t:'ring',x,y,col,max,life,full:life,add:true});}
function popup(x,y,text,col){parts.push({t:'text',x,y,vx:0,vy:-26,life:1.1,full:1.1,g:0,text,col});}
function beam(x,y){parts.push({t:'beam',x,y,life:0.6,full:0.6,add:true});}

// ---------- gameplay ----------
function fire(){
  const hd=hand(); let dx,dy;
  if(I.up){dx=0;dy=-1;} else if(I.down){dx=p.face;dy=0;} else {dx=p.face*0.574;dy=-0.819;}
  hook={state:'fly',x:hd.x,y:hd.y,dx,dy,len:0,tile:0,tx:0,ty:0};
  sfx.fire();
}
function hurt(fall,srcX){
  if(!fall && p.inv>0) return;
  p.hp--; p.inv=1.3; hook.state='back'; burst(p.x+6,p.y+8,'#ff6a2c',12);
  shake=Math.max(shake,fall?3:4); flash=0.25; buzz(fall?90:45);
  if(fall) sfx.fall(); else sfx.hurt();
  if(fall || p.hp<=0){ if(p.hp<=0){p.hp=3;} falls++; respawn(); }
  else { const d=srcX!=null?(Math.sign(p.x+6-srcX)||-p.face):-p.face; p.vx=d*140; p.vy=-180; p.onGround=false; }
}
function respawn(){const c=checks[cp]; p.x=c.x-6; p.y=c.y-p.h; p.vx=p.vy=0; hook.state='idle'; p.inv=1.3; sparks(c.x,c.y-10,'#ffc23d',10,90);}

const ALIEN={seeker:1,skitter:1,spitter:1,leech:1};
function hitEnemy(e){
  e.hp--; e.flash=0.15;
  if(e.hp<=0){ killEnemy(e); return; }
  const d=Math.sign(e.x-(p.x+6))||1; e.stun=0.5;
  if(e.type==='skitter'){ e.vx=d*140; e.vy=-170; e.ground=false; }
  else if(e.type==='spitter'){ e.charge=0; e.cool=1.4; }
  else { e.vx=d*140; }
  sparks(e.x,e.y,ALIEN[e.type]?'#b6ff5a':'#ffe27a',8,140); sfx.thud(); shake=Math.max(shake,1.5); hitstop=0.04; buzz(15);
}
function killEnemy(e,quiet){
  e.alive=false;
  if(quiet){ smoke(e.x,e.y,4,'#3a8a90'); return; }
  const alien=ALIEN[e.type];
  if(alien){
    burst(e.x,e.y,'#b6ff5a',18,130); sparks(e.x,e.y,'#b6ff5a',10,160); smoke(e.x,e.y,5,'#2c5a36');
    debris(e.x,e.y,e.type==='skitter'?['#4e6b4a','#2c3a2c','#b6ff5a']:e.type==='spitter'?['#7a2a5e','#3a1430','#7dff6a']:e.type==='leech'?['#3fb0c0','#9af4f8']:['#5a2d86','#b6ff5a'],10);
    sfx.squish();
  } else {
    burst(e.x,e.y,'#ffc23d',16,120); sparks(e.x,e.y,'#ffe27a',14,200); smoke(e.x,e.y,6);
    debris(e.x,e.y,['#c33a4c','#7e1f2e','#5a5f8c','#9ea3c9'],10); sfx.punch();
  }
  ring(e.x,e.y,alien?'#b6ff5a':'#ffc23d',28,0.35);
  shake=Math.max(shake,3.5); hitstop=0.07; buzz(30);
  popup(e.x,e.y-10,{drone:'SCRAPPED',hunter:'SCRAPPED',seeker:'SCRAPPED',skitter:'SQUASHED',spitter:'POPPED',leech:'PRIED OFF'}[e.type],alien?'#b6ff5a':'#ffc23d');
}

function step(dt){
  const inp=(I.right?1:0)-(I.left?1:0);
  // hook
  if(hook.state==='fly'){
    let dist=HOOKV*dt;
    while(dist>0){
      const s=Math.min(3,dist); dist-=s; hook.x+=hook.dx*s; hook.y+=hook.dy*s; hook.len+=s;
      const e=enemies.find(e=>e.alive&&Math.abs(hook.x-e.x)<EN[e.type].bx+3&&Math.abs(hook.y-e.y)<EN[e.type].by+3);
      if(e){ hitEnemy(e); hook.state='back'; break; }
      const sh=shots.find(s=>s.life>0&&Math.abs(hook.x-s.x)<7&&Math.abs(hook.y-s.y)<7);
      if(sh){ sh.life=0; burst(sh.x,sh.y,'#b6ff5a',8,80); sparks(sh.x,sh.y,'#b6ff5a',6,120); sfx.pop(); hook.state='back'; break; }
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

// ---------- enemies ----------
function updateEnemies(dt,harm){
  const pcx=p.x+6, pcy=p.y+10;
  for(const e of enemies){ if(!e.alive) continue;
    e.ph+=dt; if(e.flash>0) e.flash-=dt; if(e.stun>0) e.stun-=dt;
    const b=EN[e.type];
    if(e.type==='drone'){
      e.x+=e.dir*30*dt; if(e.x>e.x1){e.x=e.x1;e.dir=-1;} if(e.x<e.x0){e.x=e.x0;e.dir=1;}
    } else if(e.type==='hunter'||e.type==='seeker'){
      const seek=e.type==='seeker', sp=seek?70:46;
      let tx=pcx, ty=pcy-3;
      if(seek){ tx+=Math.cos(e.ph*1.3)*26; ty+=Math.sin(e.ph*1.7)*16; }
      const dx=tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy)||1;
      const aware=harm&&(e.wave||d<(seek?250:280));
      if(seek&&aware&&e.stun<=0){ e.t-=dt; if(e.t<=0){ e.t=2.4+Math.random()*1.6; const ddx=pcx-e.x, ddy=pcy-e.y, dd=Math.hypot(ddx,ddy)||1; if(dd<150){ e.vx=ddx/dd*175; e.vy=ddy/dd*175; e.dash=0.45; } } }
      if(e.stun>0){ e.vx*=Math.pow(0.05,dt); e.vy*=Math.pow(0.05,dt); }
      else if(e.dash>0){ e.dash-=dt; }
      else if(aware){ const k=Math.min(1,dt*2.2); e.vx+=(dx/d*sp-e.vx)*k; e.vy+=(dy/d*sp-e.vy)*k; }
      else { e.vx*=Math.pow(0.2,dt); e.vy=Math.sin(e.ph*2)*8; }
      e.x+=e.vx*dt; e.y+=e.vy*dt; if(Math.abs(e.vx)>4) e.dir=e.vx>0?1:-1;
      e.x=clamp(e.x,24,LW-24); e.y=clamp(e.y,-SKY+8,LH-8);
    } else if(e.type==='skitter'){
      if(e.stun<=0&&e.ground){ const chase=harm&&Math.abs(pcx-e.x)<130&&Math.abs(pcy-e.y)<36; if(chase) e.dir=pcx>e.x?1:-1; e.vx=e.dir*(chase?74:36); }
      e.vy=Math.min(e.vy+G*dt,500);
      let nx=e.x+e.vx*dt; const sd=Math.sign(e.vx)||e.dir, ftx=Math.floor((nx+sd*b.bx)/T);
      const wall=tile(ftx,Math.floor((e.y-3)/T))===1||tile(ftx,Math.floor((e.y+3)/T))===1;
      if(wall){ nx=e.x; e.vx=0; if(e.stun<=0) e.dir=-sd; }
      else if(e.ground&&e.stun<=0){ const below=tile(ftx,Math.floor((e.y+b.by+2)/T)); if(below===0||below===3){ nx=e.x; e.dir=-sd; e.vx=0; } }
      e.x=nx;
      const feet0=e.y+b.by; let ny=e.y+e.vy*dt; e.ground=false;
      if(e.vy>=0){ const ty=Math.floor((ny+b.by)/T);
        for(const ox of [-6,0,6]){ const v=tile(Math.floor((e.x+ox)/T),ty); if((v===1||v===2||v===3)&&feet0<=ty*T+1){ ny=ty*T-b.by; e.vy=0; e.ground=true; break; } } }
      e.y=ny; if(e.y>LH+60){ e.alive=false; continue; }
      if(e.ground&&e.stun<=0&&e.vx===0) e.vx=e.dir*36;
    } else if(e.type==='spitter'){
      const dx=pcx-e.x, dy=pcy-e.y, d=Math.hypot(dx,dy); e.dir=dx>=0?1:-1;
      if(e.stun>0){}
      else if(e.charge>0){ e.charge-=dt; if(e.charge<=0){ const a=Math.atan2(dy,dx), s=105; shots.push({x:e.x+Math.cos(a)*8,y:e.y+Math.sin(a)*8,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:3.2}); sfx.spit(); e.cool=2.4; } }
      else { e.cool-=dt; if(e.cool<=0&&harm&&d<200){ e.charge=0.75; sfx.charge(); } }
    } else if(e.type==='leech'){
      const tm=e.term;
      if(!tm||tm.state==='done'){ killEnemy(e,true); continue; }
      if(e.latched){ e.x=tm.x+e.lo; e.y=tm.y-40+Math.sin(e.ph*4)*1.5; if(Math.random()<dt*5) sparks(e.x,e.y+8,'#5ae0e8',2,70); }
      else { const tx=tm.x+e.lo, ty=tm.y-40, dx=tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy)||1;
        if(d<4){ e.latched=true; sfx.latch(); popup(tm.x,tm.y-58,'LEECH!','#5ae0e8'); }
        else { const s=Math.min(d/dt,52); e.x+=dx/d*s*dt; e.y+=dy/d*s*dt+Math.sin(e.ph*5)*16*dt; } }
    }
    // contact damage (leeches only sabotage)
    if(harm&&e.alive&&e.type!=='leech'){
      const ey=(e.type==='drone'||e.type==='hunter')?e.y+Math.sin(e.ph*3)*2:e.y;
      if(p.x<e.x+b.bx&&p.x+p.w>e.x-b.bx&&p.y<ey+b.by&&p.y+p.h>ey-b.by) hurt(false,e.x);
    }
  }
  if(enemies.length>60||enemies.some(e=>!e.alive)) enemies=enemies.filter(e=>e.alive);
  // keep flying enemies from stacking on one spot
  for(let i=0;i<enemies.length;i++){ const a=enemies[i]; if(!FLYERS[a.type]||a.latched) continue;
    for(let j=i+1;j<enemies.length;j++){ const b=enemies[j]; if(!FLYERS[b.type]||b.latched) continue;
      const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy); if(d<16){ const k=(16-d)*0.5, nx=d?dx/d:1, ny=d?dy/d:0; a.x-=nx*k; a.y-=ny*k; b.x+=nx*k; b.y+=ny*k; } } }
  for(const s of shots){ if(s.life<=0) continue;
    s.x+=s.vx*dt; s.y+=s.vy*dt; s.life-=dt;
    if(tile(Math.floor(s.x/T),Math.floor(s.y/T))===1){ s.life=0; burst(s.x,s.y,'#b6ff5a',6,60); continue; }
    if(harm&&Math.abs(s.x-(p.x+6))<8&&Math.abs(s.y-(p.y+10))<11){ s.life=0; burst(s.x,s.y,'#b6ff5a',8,80); hurt(false,s.x); }
  }
  shots=shots.filter(s=>s.life>0);
}

// ---------- terminals ----------
function spawnWave(tm,types){
  sfx.alarm(); popup(tm.x,tm.y-66,'INCOMING!','#ff4150'); shake=Math.max(shake,1.5); buzz([20,40,20]);
  let side=Math.random()<0.5?-1:1, nLeech=enemies.filter(e=>e.alive&&e.type==='leech'&&e.term===tm).length;
  types.forEach((type,i)=>{
    side=-side;
    if(FLYERS[type]){
      const x=clamp(tm.x+side*(VW/2+24+i*12),24,LW-24), y=tm.y-50-Math.random()*50;
      const e=makeEnemy(type,x,y,{wave:true,term:type==='leech'?tm:null,lo:type==='leech'?[-7,0,7][(nLeech++)%3]:0});
      enemies.push(e);
    } else {
      const [a,b]=tm.seg, opts=[]; for(let tx=a+1;tx<=b-1;tx++) if(Math.abs(tx-tm.tx)>=4) opts.push(tx);
      const tx=opts.length?opts[(Math.random()*opts.length)|0]:(side>0?b:a);
      let y=tm.y-50; while(y>tm.y-120&&tile(tx,Math.floor(y/T))!==0) y-=T;
      const e=makeEnemy(type,tx*T+8,y,{wave:true}); e.dir=tm.x>e.x?1:-1; enemies.push(e);
      beam(e.x,y+10); sfx.beam();
    }
  });
}
function updateTerms(dt){
  for(const tm of terms){ if(tm.state==='done') continue;
    const near=p.onGround&&Math.abs(p.x+6-tm.x)<14&&Math.abs(p.y+p.h-tm.y)<3;
    tm.working=near&&hook.state==='idle'&&!I.left&&!I.right&&p.inv<1.0;
    if(tm.working&&tm.state==='idle'){ tm.state='active'; sfx.boot(); popup(tm.x,tm.y-66,'REROUTING','#5fe39a'); }
    const leeches=enemies.filter(e=>e.alive&&e.type==='leech'&&e.term===tm&&e.latched).length;
    tm.drain=leeches;
    tm.prog=clamp(tm.prog+((tm.working?1/tm.time:0)-leeches*0.045)*dt,0,1);
    if(tm.working){ tm.typeT-=dt; if(tm.typeT<=0){ tm.typeT=0.07+Math.random()*0.09; sfx.type(); } }
    while(tm.state==='active'&&tm.wi<tm.waves.length&&tm.prog>=tm.waves[tm.wi][0]){ spawnWave(tm,tm.waves[tm.wi].slice(1)); tm.wi++; }
    if(tm.prog>=1){
      tm.state='done'; sfx.done(); buzz([20,30,20]);
      ring(tm.x,tm.y-20,'#5fe39a',50,0.7); sparks(tm.x,tm.y-24,'#5fe39a',16,160);
      const left=terms.filter(t=>t.state!=='done').length; if(!left) allDoneT=tnow;
      popup(tm.x,tm.y-66,left?'NETWORK REROUTED':'UPLINK ONLINE','#5fe39a');
      for(const e of enemies) if(e.alive&&e.type==='leech'&&e.term===tm) killEnemy(e,true);
    }
  }
}

function update(dt){
  tnow+=dt;
  readInput();
  const edge=I.grab&&!prevGrab; prevGrab=I.grab;
  updateParts(dt);
  for(const c of checks) c.raise=Math.min(1,c.raise+(c.on?dt*2.5:0));
  if(state==='title'||state==='brief'||state==='levels'){
    updateEnemies(dt,false);
    const k=0.5-0.5*Math.cos(tnow*0.05);
    cam.x=k*(LW-VW); cam.y=lerp(LH-VH,goal.y-VH*0.65,clamp((k-0.3)/0.6,0,1)); clampCam();
    if(edge){ if(state==='brief') startLevel(); else if(state==='title') continueGame(); }
    return;
  }
  if(state==='pause'||state==='end') return;
  if(state==='win'){ winT+=dt; return; }
  if(state==='winning'){
    winT+=dt; fwT-=dt; updateEnemies(dt,false);
    if(fwT<=0){ fwT=0.28; const x=goal.x+(Math.random()-0.5)*140, y=goal.top+Math.random()*50;
      const col=['#ffc23d','#5fe39a','#ff6a2c','#e9e6f3','#ff4150'][Math.random()*5|0];
      sparks(x,y,col,22,150); ring(x,y,col,30,0.5); sfx.pop(); }
    const k=1-Math.exp(-dt*2); cam.x+=(goal.x-VW/2-cam.x)*k; cam.y+=(goal.top-30-cam.y)*k; clampCam();
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

  updateEnemies(dt,true);
  updateTerms(dt);
  // live cable
  for(let ty=Math.floor(p.y/T);ty<=Math.floor((p.y+p.h-0.01)/T);ty++)
    for(let tx=Math.floor(p.x/T);tx<=Math.floor((p.x+p.w-0.01)/T);tx++)
      if(tile(tx,ty)===3 && p.y+p.h>ty*T+8){hurt(false);}
  crackleT-=dt;
  if(crackleT<=0&&sparkTiles.length){ crackleT=0.05+Math.random()*0.25; let d=1e9; for(const [x,y] of sparkTiles) d=Math.min(d,Math.hypot(p.x-x*T,p.y-y*T)); if(d<220) sfx.crackle(0.12*(1-d/220)); }
  // relays
  for(const r of relays){ if(r.got) continue;
    if(Math.abs(p.x+6-r.x)<11&&Math.abs(p.y+10-r.y)<14){r.got=true;got++;burst(r.x,r.y,'#5fe39a',14,100);sparks(r.x,r.y,'#5fe39a',10,120);ring(r.x,r.y,'#5fe39a',24,0.4);popup(r.x,r.y-12,`RELAY ${got}/${relays.length}`,'#5fe39a');sfx.relay();buzz(15);} }
  // checkpoints
  checks.forEach((c,i)=>{ if(i>cp&&Math.abs(p.x+6-c.x)<10&&Math.abs(p.y+p.h-c.y)<24){cp=i;c.on=true;burst(c.x,c.y-16,'#ffc23d',10,70);popup(c.x,c.y-34,'CHECKPOINT','#ffc23d');sfx.check();} });
  // void
  if(p.y>LH+40) hurt(true);
  // goal (locked until every terminal is rerouted)
  if(p.x+p.w>(goal.tx-1)*T&&Math.abs(p.y+p.h-goal.y)<24){
    if(terms.every(t=>t.state==='done')) win();
    else if(tnow-lockMsgT>2.5){ lockMsgT=tnow; popup(goal.x,goal.y-60,'UPLINK OFFLINE','#ff4150'); sfx.deny(); }
  }

  shake=Math.max(0,shake-dt*18); if(flash>0) flash-=dt;

  // camera
  const tx=p.x+6-VW/2+p.face*28, ty=p.y+10-VH/2+8, k=1-Math.exp(-dt*6);
  cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k; clampCam();
}
function clampCam(){ cam.x=clamp(cam.x,0,Math.max(0,LW-VW)); cam.y=clamp(cam.y,-SKY,Math.max(-SKY,LH-VH)); }
function updateParts(dt){
  for(const q of parts){ q.x+=(q.vx||0)*dt; q.y+=(q.vy||0)*dt; q.vy=(q.vy||0)+(q.g||0)*dt; q.life-=dt;
    if(q.t==='debris'){ const v=tile(Math.floor(q.x/T),Math.floor(q.y/T)); if(v===1||v===2){ q.vy*=-0.35; q.vx*=0.6; q.y-=2; } } }
  parts=parts.filter(q=>q.life>0);
  if(parts.length>500) parts.splice(0,parts.length-500);
}

// ---------- canvas & scaling ----------
const cv=$('game');
let cx=cv.getContext('2d',{alpha:false});
let BW=640, BH=360, skyGrad=null, vignette=null, rain=[];
const isPortrait=()=>innerHeight>innerWidth*1.05;
function pickScale(dev,target,maxPx){ const f=dev/target, i=Math.floor(f); if(i>=1&&dev/i<=maxPx) return i; return Math.max(0.5,f); }
function resize(){
  // a pinch-zoomed page reports a tiny viewport; never shrink the game into it
  if(window.visualViewport&&Math.abs(visualViewport.scale-1)>0.02) return;
  const dpr=Math.min(window.devicePixelRatio||1,4), cw=innerWidth, ch=innerHeight;
  const dw=Math.round(cw*dpr), dh=Math.round(ch*dpr), portrait=isPortrait();
  let s, bw, bh;
  if(!portrait){ s=pickScale(dh,170*ART,250*ART); bw=Math.ceil(dw/s); bh=Math.ceil(dh/s); }
  else { s=pickScale(dw,280*ART,340*ART); bw=Math.ceil(dw/s); bh=Math.min(Math.ceil(dh/s),Math.round(bw*0.75)); }
  bw=Math.min(bw,LW*ART); bh=Math.min(bh,(LH+SKY)*ART);
  BW=bw; BH=bh; cv.width=bw; cv.height=bh; VW=bw/ART; VH=bh/ART;
  const cssW=bw*s/dpr, cssH=bh*s/dpr;
  cv.style.width=cssW+'px'; cv.style.height=cssH+'px';
  cv.style.left=((cw-cssW)/2)+'px';
  cv.style.top=(portrait?Math.max(0,(ch-cssH)/2-ch*0.16):(ch-cssH)/2)+'px';
  cx=cv.getContext('2d',{alpha:false}); cx.imageSmoothingEnabled=false;
  skyGrad=cx.createLinearGradient(0,0,0,BH);
  skyGrad.addColorStop(0,TH.sky[0]); skyGrad.addColorStop(0.5,TH.sky[1]); skyGrad.addColorStop(1,TH.sky[2]);
  const [vc,vx]=mk(BW,BH), g=vx.createRadialGradient(BW/2,BH/2,Math.min(BW,BH)*0.35,BW/2,BH/2,Math.hypot(BW,BH)*0.55);
  g.addColorStop(0,'rgba(3,3,12,0)'); g.addColorStop(1,'rgba(3,3,12,0.6)'); vx.fillStyle=g; vx.fillRect(0,0,BW,BH); vignette=vc;
  rain=TH.rain?Array.from({length:Math.round(BW*BH/5200)},()=>({x:Math.random()*BW,y:Math.random()*BH,s:260+Math.random()*160})):[];
  clampCam();
  drawnPaused=false; setUI();
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

// level layer: tiles, props and structures drawn once per level at 2 art px per world unit
let lights=[]; // static glowing things {x,y,col,size,flick,blink} in art px
let LC=document.createElement('canvas'), L=null;
function buildLayer(){
  LC.width=1; LC.height=1; // release the previous level's memory first
  [LC,L]=mk(LW*ART,LH*ART); lights=[];
  const r=(x,y,w,h,c)=>{L.fillStyle=c;L.fillRect(x,y,w,h);};
  const A=v=>Math.round(v*ART);
  const S=T*ART;
  const surf=row=>A((row+1)*T);
  const rockC=TH.rock||['#262840','#212339','#1c1d33','#17182b'], grit=TH.grit||['#4a4e78','#6c71a3','#33365a'];

  // back structures first
  const tc='#1a1e4a', tc2='#151839';
  for(const o of LD.props){
    if(o.t==='tower'){
      const gy=surf(o.row), top=A(o.top*T), l0=A(o.x0*T), r0=A(o.x1*T), l1=A((o.x0+2.6)*T), r1=A((o.x1-2.6)*T);
      for(let k=0;k<1;k+=1/12){ const k2=k+1/12, ya=lerp(gy,top,k), yb=lerp(gy,top,k2);
        const la=lerp(l0,l1,k), lb=lerp(l0,l1,k2), ra=lerp(r0,r1,k), rb=lerp(r0,r1,k2);
        pline(L,la,ya,ra,ya,tc,2); pline(L,la,ya,rb,yb,tc2,2); pline(L,ra,ya,lb,yb,tc2,2); }
      pline(L,l0,gy,l1,top,tc,4); pline(L,r0,gy,r1,top,tc,4);
    } else if(o.t==='pylon'){
      const x0=A(o.x*T), x1=A((o.x+1.5)*T), top=A(o.top*T), gy=surf(o.row);
      r(x0,top,4,gy-top,tc); r(x1,top,4,gy-top,tc);
      for(let y=top;y<gy-10;y+=56){ pline(L,x0,y,x1+3,Math.min(gy,y+56),tc2,2); pline(L,x1+3,y,x0,Math.min(gy,y+56),tc2,2); r(x0,y,x1-x0+4,2,tc); }
    } else if(o.t==='chains'){
      const x=A(o.x*T), y0=A(o.row*T), len=A(o.len);
      for(let y=0;y<len;y+=4) r(x+((y/4)%2?0:1),y0+y,2,3,(y/4)%2?'#3b3f6b':'#4b4f7c');
      r(x-2,y0+len,6,2,'#5b608f'); r(x-2,y0+len-2,2,2,'#5b608f');
    }
  }

  // tiles
  for(let ty=0;ty<H;ty++) for(let tx=0;tx<W;tx++){
    const v=map[ty][tx]; if(!v) continue;
    const ax=tx*S, ay=ty*S, h=hash(tx,ty);
    if(v===1 && rockMap[ty][tx]){ // earth / rock / concrete
      let depth=0; while(depth<3&&ty-depth-1>=0&&map[ty-depth-1][tx]===1) depth++;
      r(ax,ay,S,S,rockC[depth]);
      for(let i=0;i<7;i++){ const q=hash(tx*7+i,ty*13+i); r(ax+q%30,ay+(q>>5)%30,2+((q>>10)%3),1+((q>>13)%2),(q>>16)%2?rockC[0]:rockC[3]); if((q>>18)%3===0) r(ax+(q>>3)%30,ay+(q>>8)%30,1,1,grit[2]); }
      if(tile(tx,ty-1)!==1){
        r(ax,ay,S,6,grit[0]); r(ax,ay,S,1,grit[1]); r(ax,ay+6,S,2,grit[2]);
        for(let i=0;i<8;i++){ const q=hash(tx*31+i,ty); r(ax+q%31,ay+1+((q>>6)%4),1,1,(q>>9)%2?grit[1]:grit[2]); }
        if(TH.grass) for(let i=0;i<4;i++){ const q=hash(tx*17+i,99); const gx=ax+q%30; r(gx,ay-2,1,2,'#35524c'); r(gx+1,ay-3,1,3,'#44695c'); if((q>>8)%2) r(gx+2,ay-1,1,1,'#35524c'); }
        if(tile(tx,ty-1)===3){ r(ax+4,ay,24,3,'#16161f'); r(ax+10,ay+1,10,2,'#0c0c12'); }
      }
      if(tile(tx-1,ty)===0) r(ax,ay,2,S,grit[2]);
      if(tile(tx+1,ty)===0) r(ax+S-2,ay,2,S,'#121324');
    } else if(v===1){ // steel
      r(ax,ay,S,S,'#333a66');
      r(ax,ay,S,1,'#454f8a'); r(ax,ay,1,S,'#454f8a'); r(ax+S-1,ay,1,S,'#232a4f'); r(ax,ay+S-1,S,1,'#232a4f');
      r(ax+2,ay+15,S-4,1,'#2b3159'); r(ax+2,ay+16,S-4,1,'#3c4478');
      for(const [bx,by] of [[3,3],[27,3],[3,27],[27,27]]){ r(ax+bx,ay+by,2,2,'#5b66a0'); r(ax+bx,ay+by,1,1,'#8e98d0'); r(ax+bx+1,ay+by+1,1,1,'#20254a'); }
      if(TH.windows&&tile(tx,ty-1)===1&&tx>0&&tx<W-1&&h%3===0){ const lit=(h>>4)%3===0; r(ax+8,ay+6,16,12,'#141731'); r(ax+9,ay+7,14,10,lit?((h>>7)%4?'#ffc23d':'#8fd0ff'):'#1c2048'); if(lit) r(ax+9,ay+7,14,2,'#ffe08a'); }
      else if(h%4===0){ const rx=ax+4+((h>>3)%22); r(rx,ay+5,1,8+((h>>7)%14),'rgba(150,72,58,0.55)'); r(rx+1,ay+5,1,4,'rgba(150,72,58,0.35)'); }
      if(tile(tx,ty-1)!==1){ r(ax,ay,S,2,'#8b96d0'); r(ax,ay+2,S,1,'#5b66a0'); }
      if(tile(tx,ty+1)!==1&&ty<H-1){ for(let y=0;y<6;y++) for(let x=0;x<S;x++) r(ax+x,ay+S-6+y,1,1,(((ax+x)+y)>>2)%2?'#ffc23d':'#1d1f33'); r(ax,ay+S-7,S,1,'#1c2144'); }
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
      if(tile(tx+1,ty)!==2){ r(ax+S-3,ay,3,21,dk); r(ax+S-3,ay+6,3,11,dd); }
    } else if(v===3){ // broken cable base (live arcs drawn per frame)
      r(ax,ay+26,S,3,'#1b1c2a'); r(ax,ay+26,S,1,'#34364f');
      r(ax+6,ay+25,4,1,'#c87533'); r(ax+20,ay+27,5,1,'#c87533'); r(ax+14,ay+24,2,2,'#e39a50');
    }
  }
  // pits: find the lowest open run in each column that reaches the bottom
  for(let tx=1;tx<W-1;tx++){ if(map[H-1][tx]!==0) continue;
    let top=H-1; while(top>0&&map[top-1][tx]===0&&top>H-6) top--;
    const y0=top*S, g=L.createLinearGradient(0,y0,0,H*S); g.addColorStop(0,'rgba(4,4,14,0)'); g.addColorStop(0.35,'rgba(4,4,14,0.75)'); g.addColorStop(1,'#020208');
    L.fillStyle=g; L.fillRect(tx*S,y0,S,H*S-y0);
    if(TH.pit==='water'){ const wy=H*S-20; r(tx*S,wy,S,20,'#0a2230'); r(tx*S,wy,S,2,'#2f6a7a'); for(let i=0;i<3;i++){ const q=hash(tx,i+7); r(tx*S+q%28,wy+5+(q>>5)%12,4,1,'#1c4a5a'); } }
  }

  // props
  for(const o of LD.props){
    const x=A(o.x*T), g=o.row!=null?surf(o.row):0;
    switch(o.t){
      case 'cabin':
        r(x,g-58,96,58,'#252950'); for(let y=g-54;y<g;y+=6) r(x,y,96,1,'#1f2246');
        r(x-4,g-64,104,6,'#3a3f70'); r(x-4,g-64,104,1,'#5a60a0'); r(x-4,g-58,104,1,'#1a1d3d');
        r(x+10,g-42,18,42,'#191c3a'); r(x+10,g-42,18,1,'#3a3f70'); r(x+24,g-22,2,2,'#8f93b8');
        r(x+44,g-44,32,20,'#1a1d3d'); r(x+46,g-42,28,16,'#ffc23d'); r(x+46,g-42,28,5,'#ffe08a'); r(x+59,g-42,2,16,'#1a1d3d'); r(x+46,g-35,28,2,'#1a1d3d');
        r(x+36,g-56,44,8,'#ff6a2c'); for(let i=0;i<44;i+=6) r(x+36+i,g-56,3,8,'#1b0c05');
        r(x+6,g-4,26,4,'#3e426b'); r(x+6,g-4,26,1,'#5b608f');
        pline(L,x+84,g-64,x+84,g-100,'#5a5f8c',2); pline(L,x+78,g-92,x+90,g-92,'#5a5f8c',2); pline(L,x+80,g-84,x+88,g-84,'#5a5f8c',2);
        lights.push({x:x+60,y:g-34,col:'#ffc23d',size:70,flick:true},{x:x+84,y:g-101,col:'#ff4150',size:22,blink:1.4});
        break;
      case 'fence': {
        const x0=A(o.x0*T), x1=A(o.x1*T);
        for(let px=x0;px<x1;px+=48){ r(px,g-24,3,24,'#2c3058'); r(px,g-24,3,1,'#454a80'); }
        r(x0,g-20,x1-x0,2,'#2c3058'); r(x0,g-11,x1-x0,2,'#2c3058'); break; }
      case 'cone':
        r(x-6,g-2,14,2,'#1f1f2a');
        for(let i=0;i<14;i++){ const w=2+Math.round(i*0.55)*2; r(x+1-w/2,g-16+i,w,1,(i>=5&&i<=7)?'#e6e2d8':'#ff6a2c'); }
        r(x,g-16,1,12,'#ffa06f'); break;
      case 'sign':
        r(x,g-40,2,40,'#5a5f8c');
        for(let i=0;i<18;i++) r(x+1-Math.floor(i*0.6),g-60+i,1+Math.floor(i*0.6)*2,1,'#ffc23d');
        r(x-11,g-42,24,1,'#a77d1d');
        pline(L,x+2,g-55,x-1,g-49,'#1d1f33',1); pline(L,x-1,g-49,x+3,g-49,'#1d1f33',1); pline(L,x+3,g-49,x,g-44,'#1d1f33',1); break;
      case 'drum': {
        const cyp=g-14;
        for(let y=-14;y<=14;y++) for(let xx=-14;xx<=14;xx++){ const d=Math.hypot(xx,y); if(d<=14) r(x+xx,cyp+y,1,1,d>12?'#6e4a2c':d<4?'#2a1c14':((Math.round(d)%3)?'#4a3222':'#1a1b2c')); }
        r(x-14,g-1,28,1,'#0e0e16'); break; }
      case 'crates':
        for(const [ox,oy] of [[0,0],[52,0],[26,44]]){ const cxp=x+ox, y=g-44-oy;
          r(cxp,y,44,44,'#5a4630'); r(cxp,y,44,2,'#7a6242'); r(cxp,y+42,44,2,'#3d2f20'); r(cxp,y,2,44,'#3d2f20'); r(cxp+42,y,2,44,'#3d2f20');
          pline(L,cxp+3,y+3,cxp+40,y+40,'#3d2f20',2); pline(L,cxp+40,y+3,cxp+3,y+40,'#3d2f20',2); r(cxp+16,y+18,12,8,'#e6e2d8'); r(cxp+18,y+20,8,1,'#ff6a2c'); }
        break;
      case 'dish':
        r(x-2,g-30,4,30,'#5a5f8c'); r(x-8,g-3,16,3,'#3e426b');
        for(let y=-12;y<=12;y++) for(let xx=-5;xx<=5;xx++) if((xx*xx)/25+(y*y)/144<=1) r(x-6+xx+Math.round(y*0.35),g-44+y,1,1,xx<-2?'#8b88a3':(xx>2?'#e6e2d8':'#c9c6d8'));
        pline(L,x-6,g-44,x+8,g-50,'#8b88a3',1); r(x+8,g-52,3,3,'#5a5f8c');
        lights.push({x:x+9,y:g-51,col:'#ff4150',size:16,blink:1.1}); break;
      case 'vent':
        r(x-20,g-24,40,24,'#3a3f70'); r(x-20,g-24,40,2,'#5a60a0'); r(x+18,g-24,2,24,'#262a52');
        for(let i=0;i<5;i++) r(x-16,g-20+i*4,20,2,'#262a52');
        for(let y=-6;y<=6;y++) for(let xx=-6;xx<=6;xx++) if(xx*xx+y*y<=36) r(x+10+xx,g-12+y,1,1,(xx*xx+y*y<=6)?'#8f93b8':((Math.abs(xx)+Math.abs(y))%3?'#1d2045':'#4b4f7c'));
        break;
      case 'antenna':
        r(x-1,g-70,3,70,'#5a5f8c'); r(x-8,g-56,17,2,'#5a5f8c'); r(x-6,g-42,13,2,'#5a5f8c'); r(x-4,g-28,9,2,'#5a5f8c'); r(x-5,g-3,11,3,'#3e426b');
        lights.push({x:x,y:g-72,col:'#ff4150',size:20,blink:1.6}); break;
      case 'tank':
        for(const lx of [-20,-4,12]) r(x+lx,g-40,3,40,'#2c3058');
        pline(L,x-20,g-38,x+14,g-4,'#262a52',1); pline(L,x+14,g-38,x-20,g-4,'#262a52',1);
        r(x-26,g-80,52,40,'#4a3a2c'); r(x-26,g-80,52,2,'#6a5440'); for(let i=0;i<4;i++) r(x-26,g-72+i*9,52,1,'#2e2419');
        r(x-28,g-86,56,6,'#3a2e22'); r(x-4,g-92,8,6,'#3a2e22'); break;
    }
  }

  // transmitter mast (goal)
  { const gx=A(LD.goal.tx*T+8), base=A((LD.goal.ty+1)*T), top=A(Math.max(3,(LD.goal.ty+1)*T-110));
    for(let y=base;y>top;y-=2){ const k=(base-y)/(base-top), hw=Math.round(9-k*6), band=Math.floor((base-y)/18)%2;
      const c=band?'#e6e2d8':'#ff6a2c', cd=band?'#9d9aa8':'#a73d17';
      r(gx-hw,y-2,2,2,c); r(gx+hw-2,y-2,2,2,cd); }
    for(let y=base;y>top+10;y-=12){ const k=(base-y)/(base-top), hw=Math.round(9-k*6), k2=(base-y+12)/(base-top), hw2=Math.round(9-k2*6);
      pline(L,gx-hw+1,y,gx+hw2-2,y-12,'#c9c6d8',1); pline(L,gx+hw-2,y,gx-hw2+1,y-12,'#8b88a3',1); }
    for(let y=-9;y<=9;y++) for(let xx=-5;xx<=5;xx++) if((xx*xx)/25+(y*y)/81<=1) r(gx-14+xx,base-58+y,1,1,xx<-2?'#8b88a3':(xx>2?'#e6e2d8':'#c9c6d8'));
    r(gx-10,base-59,5,2,'#5a5f8c');
    r(gx+5,base-40,4,14,'#e6e2d8'); r(gx+5,base-40,1,14,'#ffffff'); r(gx-9,base-72,4,12,'#e6e2d8');
    r(gx-12,base-2,24,2,'#3e426b'); }
}

// background layers (seamlessly tiling strips), rebuilt per theme
let bg=null;
function buildBackground(){
  seed=7+LI*101;
  const TAU=Math.PI*2;
  const [mc,mx]=mk(1024,150);
  for(let x=0;x<1024;x++){
    const u=x/1024, h=Math.round(62+24*Math.sin(TAU*u*2+1+LI)+14*Math.sin(TAU*u*5+2)+6*Math.sin(TAU*u*13)+(hash(x>>2,5+LI)%4));
    mx.fillStyle=TH.mtn; mx.fillRect(x,150-h,1,h);
    mx.fillStyle=TH.mtnHi; mx.fillRect(x,150-h,1,1);
    if(h>88){ mx.fillStyle=TH.snow; mx.fillRect(x,150-h,1,Math.min(6,Math.round((h-88)/3)+1)); }
  }
  // far layer: radio towers or a city skyline
  const [tc,tx]=mk(1200,170), towerLights=[];
  if(TH.far==='city'){
    for(let x=0;x<1200;){ const w=24+Math.round(rnd()*44), h=50+Math.round(rnd()*110), top=170-h;
      tx.fillStyle='#141633'; tx.fillRect(x,top,w,h); tx.fillStyle='#1d2046'; tx.fillRect(x,top,w,1);
      for(let wy=top+5;wy<166;wy+=6) for(let wx=x+3;wx<x+w-3;wx+=5){ const q=rnd(); if(q<0.18){ tx.fillStyle=q<0.02?'#8fd0ff':(q<0.12?'#6e5a2a':'#b8913a'); tx.fillRect(wx,wy,2,3); } }
      if(rnd()<0.4){ const ax=x+Math.round(w/2); tx.fillStyle='#232856'; tx.fillRect(ax,top-18,2,18); towerLights.push({x:ax,y:top-19,ph:rnd()*2}); }
      x+=w+Math.round(rnd()*6); }
  } else {
    for(let i=0;i<7;i++){
      const x=80+i*170+Math.round(rnd()*60), h=70+Math.round(rnd()*80), top=170-h;
      pline(tx,x,top+6,x-Math.round(h*0.38),170,'#1e2250',1); pline(tx,x,top+6,x+Math.round(h*0.38),170,'#1e2250',1);
      tx.fillStyle='#232856'; tx.fillRect(x-1,top,3,h);
      for(let y=top+6;y<170;y+=8){ tx.fillStyle='#2e3468'; tx.fillRect(x-2,y,5,1); }
      towerLights.push({x,y:top-1,ph:rnd()*2});
    }
  }
  // near layer: pine hills or low buildings
  const [hc,hx]=mk(960,120);
  if(TH.near==='buildings'){
    for(let x=0;x<960;){ const w=30+Math.round(rnd()*50), h=40+Math.round(rnd()*60);
      hx.fillStyle=TH.hill; hx.fillRect(x,120-h,w,h); hx.fillStyle=TH.hillHi; hx.fillRect(x,120-h,w,1);
      for(let wy=120-h+6;wy<116;wy+=7) for(let wx=x+4;wx<x+w-4;wx+=6) if(rnd()<0.1){ hx.fillStyle='#4a3a20'; hx.fillRect(wx,wy,2,3); }
      x+=w; }
  } else {
    const hill=x=>Math.round(40+9*Math.sin(TAU*x/960*3)+5*Math.sin(TAU*x/960*7+1));
    for(let x=0;x<960;x++){ const h=hill(x); hx.fillStyle=TH.hill; hx.fillRect(x,120-h,1,h); hx.fillStyle=TH.hillHi; hx.fillRect(x,120-h,1,1); }
    for(let i=0;i<70;i++){
      const x=Math.round(i*960/70+rnd()*8), th=16+Math.round(rnd()*34), b=120-hill(x)+3;
      for(let y=0;y<th;y++){ const w=Math.max(1,Math.round((y/th)*th*0.32*(0.7+0.3*((y%6)/6)))); hx.fillStyle=TH.tree; hx.fillRect(x-w,b-th+y,w*2+1,1); if(y%6===0){ hx.fillStyle=TH.mtn; hx.fillRect(x-w,b-th+y,1,1);} }
      hx.fillStyle=TH.tree; hx.fillRect(x,b-2,1,4);
    }
  }
  // clouds
  const clouds=[];
  for(let i=0;i<4;i++){
    const [c,x]=mk(150,46);
    for(let k=0;k<9;k++){ const ox=18+rnd()*114, oy=18+rnd()*14, rx=12+rnd()*18, ry=7+rnd()*8;
      for(let yy=-ry;yy<=ry;yy++) for(let xx=-rx;xx<=rx;xx++){ const d=(xx*xx)/(rx*rx)+(yy*yy)/(ry*ry); if(d>1) continue;
        const X=Math.round(ox+xx), Y=Math.round(oy+yy); if(d>0.8&&(X+Y)%2) continue;
        x.fillStyle=yy<-ry*0.55?TH.mtnHi:TH.mtn; x.fillRect(X,Y,1,1); } }
    clouds.push({c,x:i*380+rnd()*120,y:14+rnd()*50,sp:3+rnd()*4});
  }
  // moon
  const [moon,ox]=mk(34,34);
  for(let y=-15;y<=15;y++) for(let x=-15;x<=15;x++){ const d=Math.hypot(x,y); if(d>15.2) continue;
    ox.fillStyle=d>13.5?'#c9c4ad':(x+y>8?'#d9d4bd':'#ece8d4'); ox.fillRect(17+x,17+y,1,1); }
  for(const [x,y,r] of [[10,12,3],[20,20,4],[22,9,2],[12,23,2]]) for(let yy=-r;yy<=r;yy++) for(let xx=-r;xx<=r;xx++) if(xx*xx+yy*yy<=r*r){ ox.fillStyle='#c9c4ad'; ox.fillRect(x+xx,y+yy,1,1); }
  const stars=Array.from({length:110},()=>({x:rnd(),y:rnd()*0.7,b:rnd(),ph:rnd()*6}));
  const [fc,fx]=mk(1,60), fg=fx.createLinearGradient(0,0,0,60);
  fg.addColorStop(0,'rgba(60,52,110,0)'); fg.addColorStop(0.6,'rgba(60,52,110,0.35)'); fg.addColorStop(1,'rgba(40,36,84,0.1)'); fx.fillStyle=fg; fx.fillRect(0,0,1,60);
  // aurora curtains
  let aur=null;
  if(TH.aurora){ const [ac,ax]=mk(900,140);
    for(let x=0;x<900;x++){ const u=x/900, top=20+18*Math.sin(TAU*u*3)+10*Math.sin(TAU*u*7+1), it=Math.max(0,0.5+0.5*Math.sin(TAU*u*5+2))*(0.6+0.4*Math.sin(TAU*u*11));
      if(it<0.05) continue; const g=ax.createLinearGradient(0,top,0,top+90); g.addColorStop(0,`rgba(120,255,170,${0.5*it})`); g.addColorStop(0.3,`rgba(60,220,140,${0.35*it})`); g.addColorStop(1,'rgba(40,120,160,0)');
      ax.fillStyle=g; ax.fillRect(x,top,1,90); }
    aur=ac; }
  // alien mothership
  let ship=null;
  if(TH.ship){ const sw=TH.ship===2?300:170, sh=Math.round(sw*0.26), [sc,sx]=mk(sw,sh), cxs=sw/2;
    for(let y=0;y<sh;y++) for(let x=0;x<sw;x++){ const dx=(x-cxs)/(sw/2), dyb=(y-sh*0.62)/(sh*0.38), dyt=(y-sh*0.45)/(sh*0.45);
      if(dx*dx+dyb*dyb<=1&&y>=sh*0.45){ sx.fillStyle=y>sh*0.8?'#0b0d18':((x+y)%7===0?'#1f2236':'#15182a'); sx.fillRect(x,y,1,1); }
      else if(dx*dx*4+dyt*dyt<=1&&y<sh*0.5){ sx.fillStyle=y<sh*0.2?'#2e3452':'#1d2136'; sx.fillRect(x,y,1,1); } }
    sx.fillStyle='#3a4266'; sx.fillRect(Math.round(sw*0.05),Math.round(sh*0.62),Math.round(sw*0.9),1);
    const [bc,bx]=mk(200,420), bgd=bx.createLinearGradient(0,0,0,420); bgd.addColorStop(0,'rgba(140,255,160,0.5)'); bgd.addColorStop(1,'rgba(140,255,160,0)');
    bx.fillStyle=bgd; bx.beginPath(); bx.moveTo(80,0); bx.lineTo(120,0); bx.lineTo(200,420); bx.lineTo(0,420); bx.fill();
    ship={c:sc,w:sw,h:sh,beam:bc}; }
  bg={mc,tc,hc,clouds,moon,stars,towerLights,fc,aur,ship};
}

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
  const skyLift=(LH-VH)*ART;
  for(const s of bg.stars){
    const x=Math.round(((s.x*BW*1.3-camX*0.03)%(BW*1.3)+BW*1.3)%(BW*1.3)), y=Math.round(s.y*BH-camY*0.03+skyLift*0.03);
    const tw=0.5+0.5*Math.sin(tnow*(1+s.b*2)+s.ph);
    R(x,y,1,1,s.b>0.85?(tw>0.5?'#ffffff':'#b9b7ff'):(tw>0.3?'#6d6fa8':'#44466f'));
    if(s.b>0.95&&tw>0.7){ R(x-1,y,3,1,'rgba(220,220,255,0.5)'); R(x,y-1,1,3,'rgba(220,220,255,0.5)'); }
  }
  if(bg.aur){ cx.globalCompositeOperation='lighter'; cx.globalAlpha=TH.aurora*(0.55+0.2*Math.sin(tnow*0.4));
    const w=bg.aur.width, off=-((((camX*0.02)+tnow*6)%w)+w)%w; for(let x=off;x<BW;x+=w) cx.drawImage(bg.aur,Math.round(x),Math.round(-camY*0.02+skyLift*0.02));
    cx.globalAlpha=1; cx.globalCompositeOperation='source-over'; }
  if(TH.moon){ const mx=Math.round(BW*0.76-camX*0.01), my=Math.round(26+(LH-VH-cam.y)*ART*0.02);
    cx.globalCompositeOperation='lighter'; cx.globalAlpha=0.35; cx.drawImage(glow('#9aa0ff'),mx-40,my-40,114,114); cx.globalAlpha=1; cx.globalCompositeOperation='source-over';
    cx.drawImage(bg.moon,mx,my); }
  if(bg.ship){ const s=bg.ship, sx=Math.round(BW*0.34-camX*0.012-s.w/2), sy=Math.round((TH.ship===2?14:30)-camY*0.015+skyLift*0.015+Math.sin(tnow*0.5)*2);
    cx.globalCompositeOperation='lighter'; cx.globalAlpha=0.06+0.05*Math.sin(tnow*1.3); { const bw=s.w*0.95; cx.drawImage(s.beam,sx+s.w/2-bw/2,sy+s.h*0.8,bw,BH); } cx.globalAlpha=1; cx.globalCompositeOperation='source-over';
    cx.drawImage(s.c,sx,sy);
    const n=14; for(let i=0;i<n;i++){ const a=Math.PI*(0.08+0.84*i/(n-1)), lx=sx+s.w/2-Math.cos(a)*s.w*0.46, ly=sy+s.h*0.62+Math.sin(a)*s.h*0.16;
      const on=Math.floor(tnow*6-i)%n<3; R(Math.round(lx),Math.round(ly),2,1,on?'#b6ff5a':'#2e5a2e'); }
  }
  for(const c of bg.clouds){ const w=1500, x=((c.x+tnow*c.sp-camX*0.06)%w+w)%w-160; cx.drawImage(c.c,Math.round(x),Math.round(c.y-camY*0.02+skyLift*0.02)); }
  const lift=(LH-VH-cam.y)*ART;
  const mB=(VH-48)*ART+lift*0.10, tB=(VH-44)*ART+lift*0.16, hB=(VH-38)*ART+lift*0.28;
  strip(bg.mc,0.10,mB); R(0,Math.round(mB),BW,BH,TH.mtn);
  strip(bg.tc,0.18,tB);
  { const w=bg.tc.width, off=-(((camX*0.18)%w)+w)%w, y0=Math.round(tB-bg.tc.height);
    for(const l of bg.towerLights) for(let x=off+l.x;x<BW+w;x+=w){ if(x<-4||x>BW+4) continue; if(((tnow+l.ph)%1.6)<0.8){ R(Math.round(x)-1,y0+l.y-1,3,2,'#ff4150'); cx.globalCompositeOperation='lighter'; cx.drawImage(glow('#ff4150'),Math.round(x)-6,y0+l.y-7,12,12); cx.globalCompositeOperation='source-over'; } } }
  cx.drawImage(bg.fc,0,Math.round(tB-50),BW,60);
  strip(bg.hc,0.30,hB); R(0,Math.round(hB),BW,BH,TH.hill);
}
function blitLevel(){
  const sx=clamp(camX,0,LC.width), sy=clamp(camY,0,LC.height), w=Math.min(BW-(sx-camX),LC.width-sx), h=Math.min(BH-(sy-camY),LC.height-sy);
  if(w>0&&h>0) cx.drawImage(LC,sx,sy,w,h,sx-camX,sy-camY,w,h);
  // when the camera rises above the level, continue the boundary walls up into the sky
  if(camY<0) for(const wx of [0,LC.width-32]){ if(wx-camX<-32||wx-camX>BW) continue;
    for(let y=-camY-32;y>-32;y-=32) cx.drawImage(LC,wx,64,32,32,wx-camX,y,32,32); }
}

function drawSparks(){
  for(const [tx,ty] of sparkTiles){ const sx=SX(tx*T), sy=SY(ty*T); if(sx<-40||sx>BW+40||sy<-40||sy>BH+40) continue;
    const f=Math.floor(tnow*16)+tx;
    const col=f%3?'#ffe27a':'#ffffff';
    let px=sx+4, py=sy+26;
    for(let i=1;i<=5;i++){ const nx=sx+4+i*5, ny=sy+26-((hash(f,i)%12)+2); pline(cx,px,py,nx,ny,col,1); px=nx; py=ny; }
    if(hash(f,tx)%5===0) sparks(tx*T+8,ty*T+12,'#ffe27a',2,120);
  }
}
function drawTerms(){
  for(const tm of terms){ const x=SX(tm.x), y=SY(tm.y); if(x<-60||x>BW+60) continue;
    const done=tm.state==='done', col=done?'#5fe39a':tm.state==='active'?(tm.drain?'#5ae0e8':'#ffc23d'):'#ff4150';
    R(x-11,y-36,22,36,'#2e3360'); R(x-11,y-36,22,1,'#4a5490'); R(x+10,y-36,1,36,'#1d2045'); R(x-11,y-36,1,36,'#4a5490');
    R(x-9,y-33,18,12,'#07140e');
    if(done){ for(let i=0;i<3;i++) R(x-7,y-31+i*3,4+((i*5)%9),1,'#5fe39a'); R(x+2,y-27,4,4,'#5fe39a'); }
    else if(tm.state==='active'){ for(let i=0;i<4;i++){ const q=hash(Math.floor(tnow*(tm.working?12:2))+i,tm.tx); R(x-7,y-31+i*2.5|0,2+q%13,1,tm.drain&&i%2?'#5ae0e8':'#5fe39a'); } }
    else if((tnow%1)<0.6){ R(x-1,y-31,2,5,'#ff4150'); R(x-1,y-25,2,2,'#ff4150'); }
    R(x-10,y-19,20,4,'#1d2045'); for(let i=0;i<6;i++) R(x-8+i*3,y-18,2,1,'#8f93b8');
    for(let i=0;i<3;i++) R(x-6,y-12+i*3,12,1,'#1d2045');
    R(x+6,y-48,1,12,'#8f93b8'); R(x+5,y-50,3,2,col);
    if(!done&&(tm.state==='active'||Math.abs(p.x+6-tm.x)<120)){
      R(x-21,y-60,42,6,'#0b0c1e'); R(x-20,y-59,Math.round(40*tm.prog),4,tm.drain?((tnow*8|0)%2?'#5ae0e8':'#2a8a98'):'#5fe39a');
      R(x-20,y-59,40,1,'rgba(255,255,255,0.12)');
    }
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
function drawEnemies(){
  for(const e of enemies){ if(!e.alive) continue;
    const bob=(e.type==='drone'||e.type==='hunter')?Math.sin(e.ph*3)*2:0;
    const x=SX(e.x), y=SY(e.y+bob); if(x<-50||x>BW+50||y<-50||y>BH+50) continue;
    const wh=e.flash>0, f=e.dir;
    const C=c=>wh?'#ffffff':c;
    const Rf=(ox,oy,w,h,c)=>R(f>0?x+ox:x-ox-w,y+oy,w,h,C(c));
    if(e.type==='drone'||e.type==='hunter'){
      const hun=e.type==='hunter', bl=Math.floor(tnow*30)%2;
      R(x-15,y-5,30,2,C('#4a4e7a'));
      R(x-17,y-8,5,4,C('#3e426b')); R(x+12,y-8,5,4,C('#3e426b'));
      R(x-14-(bl?8:4),y-10,bl?16:8,1,'rgba(200,205,235,0.75)'); R(x+14-(bl?8:4),y-10,bl?16:8,1,'rgba(200,205,235,0.75)');
      R(x-9,y-4,18,9,C(hun?'#8a2335':'#c33a4c')); R(x-8,y-5,16,1,C(hun?'#c4455a':'#ff6b7d')); R(x-9,y+4,18,2,C(hun?'#4e1320':'#7e1f2e'));
      if(hun){ R(x-8,y-7,2,3,C('#c4455a')); R(x+6,y-7,2,3,C('#c4455a')); R(x-9,y-1,18,1,C('#b6ff5a')); }
      else { R(x-7,y-2,2,4,C('#ffc23d')); R(x+5,y-2,2,4,C('#ffc23d')); }
      R(x+f*4-2,y-2,5,5,C('#1a1024')); R(x+f*4-1,y-1,3,3,C('#ff4150')); R(x+f*4,y-1,1,1,'#ffd0d4');
      R(x-1,y+6,2,4,C('#5a5f8c')); if(((tnow+e.ph)%0.6)<0.3) R(x-1,y+10,2,1,'#5fe39a');
    } else if(e.type==='seeker'){
      const ring=(tnow*20|0)%3;
      R(x-13,y-9,26,1,ring?'rgba(125,255,106,0.55)':'rgba(125,255,106,0.25)');
      R(x-8,y-6,16,11,C('#5a2d86')); R(x-6,y-8,12,2,C('#7a4ab0')); R(x-5,y-8,4,1,C('#a878e0')); R(x-8,y+4,16,2,C('#3a1a5a'));
      for(let i=0;i<3;i++){ const tx=x-5+i*5, w=Math.round(Math.sin(e.ph*6+i*2)*1.5); R(tx+w,y+6,1,4,C('#2c6b3a')); R(tx-w,y+10,1,3,C('#2c6b3a')); }
      Rf(1,-3,6,5,'#0f1a0c'); Rf(2,-2,4,3,'#b6ff5a'); Rf(4,-2,1,1,'#f0ffd0');
    } else if(e.type==='skitter'){
      const moving=e.ground&&Math.abs(e.vx)>1;
      for(let i=0;i<3;i++){ const lx=x-10+i*10, ph=moving?Math.sin(e.ph*16+i*2.1):0;
        pline(cx,lx,y+1,lx-2+Math.round(ph*2),y-6,C('#2c3a2c'),2); pline(cx,lx-2+Math.round(ph*2),y-6,lx+Math.round(ph*4),y+12,C('#2c3a2c'),2); }
      R(x-12,y-6,24,10,C('#4e6b4a')); R(x-10,y-9,20,3,C('#5c7a5a')); R(x-8,y-11,14,2,C('#6f906a')); R(x-6,y-10,6,1,C('#9dc090'));
      R(x-12,y+3,24,2,C('#2f422e')); R(x-6,y-4,3,2,C('#3a5238')); R(x+2,y-6,3,2,C('#3a5238'));
      Rf(9,-6,7,9,'#5c7a5a'); Rf(12,-4,2,2,'#b6ff5a'); Rf(9,-3,2,2,'#b6ff5a'); Rf(15,1,3,1,'#c8d8a0'); Rf(15,3,3,1,'#c8d8a0');
    } else if(e.type==='spitter'){
      const v=e.ceil?-1:1, Rv=(ox,oy,w,h,c)=>R(x+ox,v>0?y+oy:y-oy-h,w,h,C(c));
      const pulse=e.charge>0?1:0.5+0.5*Math.sin(tnow*3+e.ph);
      Rv(-10,6,20,2,'#3a1430'); Rv(-8,4,3,3,'#3a1430'); Rv(5,4,3,3,'#3a1430');
      Rv(-2,-2,4,8,'#5a1f48');
      Rv(-9,-14,18,13,'#7a2a5e'); Rv(-7,-16,14,2,'#8e3a70'); Rv(-6,-15,5,1,'#b35a90'); Rv(-9,-3,18,2,'#5a1f48');
      Rv(-3+e.dir*3,-11,6,6,e.charge>0?'#d6ff9a':(pulse>0.5?'#5fbf4a':'#3d8f3a')); Rv(-2+e.dir*3,-10,2,2,'#f0ffd0');
    } else if(e.type==='leech'){
      const lat=e.latched;
      R(x-6,y-6,12,7,C('#3fb0c0')); R(x-5,y-8,10,2,C('#5ae0e8')); R(x-3,y-9,6,1,C('#9af4f8'));
      R(x-3,y-4,2,2,'#0b2a30'); R(x+1,y-4,2,2,'#0b2a30');
      for(let i=0;i<4;i++){ const tx=x-5+i*3, w=Math.round(Math.sin(e.ph*6+i)*1); R(tx+w,y+1,1,(lat?12:6)+(i%2)*2,C('#2a8a98')); }
    }
  }
  for(const s of shots){ const x=SX(s.x), y=SY(s.y); R(x-2,y-2,5,5,'#7dff6a'); R(x-1,y-1,3,3,'#f0ffd0'); }
}
function drawGoal(){
  const gx=SX(goal.x), ty=SY(goal.top);
  if(gx<-80||gx>BW+80) return;
  const won=state==='winning'||state==='win', open=terms.every(t=>t.state==='done');
  if(won||(tnow%1.2)<0.6) R(gx-2,ty,4,3,won?'#ffe08a':open?'#5fe39a':'#ff4150');
}

function drawPlayer(){
  if(p.inv>0 && p.inv<1.15 && Math.floor(p.inv*14)%2) return;
  const white=p.inv>1.18, X=SX(p.x), Y=SY(p.y), f=p.face;
  const Rp=(x,y,w,h,c)=>{cx.fillStyle=white?'#ffffff':c; cx.fillRect(f>0?X+x:X+24-x-w,Y+y,w,h);};
  const air=!p.onGround, moving=!air&&Math.abs(p.vx)>1;
  let fl=0,bl=0,fLift=0,bLift=0;
  if(moving){ const s=Math.sin(p.walk); fl=Math.round(s*3); bl=-fl; fLift=s>0.35?2:0; bLift=s<-0.35?2:0; }
  else if(air){ const tr=clamp(-(p.vx*f)/60,-4,4); fl=Math.round(2+tr); bl=Math.round(-2+tr); fLift=p.vy<-40?3:2; bLift=p.vy<-40?1:0; }
  const working=terms.some(t=>t.working);
  const U=(!air&&!moving&&!working&&Math.sin(tnow*2.4)>0.55)?1:0;
  if(!air){ cx.fillStyle='rgba(0,0,10,0.35)'; cx.fillRect(X+2,Y+39,20,2); }
  const bsw=moving?-fl:(air?-3:0);
  Rp(6+Math.round(bsw*0.5),15+U,3,9,'#284660'); Rp(6+bsw,24+U,3,2,'#b97a55');
  const leg=(bx,dx,lift,c,cs)=>{
    const u=Math.round(dx/2);
    Rp(bx+u,28,6,4,c); Rp(bx+dx,32,6,4-lift,c); Rp(bx+dx,32,1,4-lift,cs); Rp(bx+dx+1,31,4,2,'#3e4577');
    const by=36-lift; Rp(bx+dx,by,8,3,'#1a1a24'); Rp(bx+dx,by+3,8,1,'#0b0b12'); Rp(bx+dx+3,by,2,1,'#ff6a2c');
  };
  leg(6,bl,bLift,'#1f2342','#15182f');
  Rp(5,14+U,14,13-U,'#35546d'); Rp(6,15+U,12,11-U,'#b6d63a'); Rp(6,15+U,2,11-U,'#86a02a'); Rp(16,15+U,2,11-U,'#d4f05a');
  Rp(6,21,12,2,'#e3e6f2'); Rp(6,22,12,1,'#a9adc4');
  Rp(8,13+U,8,2,'#2a4458'); Rp(5,14+U,3,3,'#2a4458');
  Rp(5,26,14,2,'#5a3a22'); Rp(14,26,3,2,'#d9b24a'); Rp(3,25,4,5,'#6e4a2c'); Rp(3,25,4,1,'#8a6040');
  leg(12,fl,fLift,'#2a2f55','#1f2342');
  const hy=U;
  Rp(7,7+hy,3,4,'#3a2618');
  Rp(8,6+hy,9,7,'#e0a57a'); Rp(8,11+hy,4,2,'#b97a55'); Rp(12,11+hy,5,2,'#8a5a3c'); Rp(14,11+hy,2,1,'#5b3826');
  Rp(17,8+hy,1,2,'#e0a57a'); Rp(14,8+hy,1,2,'#16172a'); Rp(13,7+hy,3,1,'#3a2618'); Rp(10,8+hy,2,2,'#b97a55');
  Rp(10,13+hy,5,1,'#b97a55');
  Rp(7,0+hy,10,1,'#f2c230'); Rp(6,1+hy,12,4,'#f2c230'); Rp(8,1+hy,3,1,'#ffe487'); Rp(8,2+hy,1,2,'#ffe487'); Rp(11,0+hy,2,4,'#ffd84e');
  Rp(6,4+hy,12,1,'#c8961c'); Rp(5,5+hy,12,1,'#c8961c'); Rp(16,5+hy,5,1,'#f2c230');
  Rp(17,2+hy,2,3,'#8b88a3'); Rp(19,2+hy,2,3,'#fff6c8');
  // front arm + gauntlet (points at the hook, or works the terminal keys)
  let a;
  if(hook.state!=='idle'){ const hx=hook.x-(p.x+6), hyw=hook.y-(p.y+8); a=Math.atan2(hyw,hx*f); }
  else if(air) a=-1.0;
  else if(working) a=0.35+Math.sin(tnow*18)*0.25;
  else a=Math.PI/2-0.35+(moving?fl*0.12:0);
  const ca=Math.cos(a), sa=Math.sin(a), shx=12, shy=16+U;
  for(let t=0;t<=8;t++) Rp(Math.round(shx+ca*t)-1,Math.round(shy+sa*t)-1,3,3,'#46708f');
  const gxl=Math.round(shx+ca*10), gyl=Math.round(shy+sa*10);
  Rp(gxl-3,gyl-3,7,7,'#ff6a2c'); Rp(gxl-3,gyl+3,7,1,'#a73d17'); Rp(gxl-2,gyl-3,3,1,'#ffa06f');
  Rp(gxl-1,gyl-1,2,2,hook.state==='att'?'#5fe39a':'#ffc23d');
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
    else if(q.t==='beam'){ const k=q.life/q.full; cx.globalAlpha=k*0.8; R(x-6,0,12,y,'#7dff6a'); R(x-2,0,4,y,'#e8ffe0'); cx.globalAlpha=1; }
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
  for(const e of enemies) if(e.alive){
    if(e.type==='drone'||e.type==='hunter') gl(SX(e.x+e.dir*2),SY(e.y+Math.sin(e.ph*3)*2),'#ff4150',26,0.6);
    else if(e.type==='seeker') gl(SX(e.x+e.dir*2),SY(e.y),'#7dff6a',30,0.6);
    else if(e.type==='skitter') gl(SX(e.x+e.dir*6),SY(e.y-1),'#b6ff5a',16,0.45);
    else if(e.type==='spitter') gl(SX(e.x+e.dir*1.5),SY(e.y+(e.ceil?4:-4)),'#7dff6a',e.charge>0?46:24,e.charge>0?0.8:0.35);
    else if(e.type==='leech') gl(SX(e.x),SY(e.y),'#5ae0e8',e.latched?40:28,0.55);
  }
  for(const s of shots) gl(SX(s.x),SY(s.y),'#7dff6a',24,0.8);
  for(const tm of terms){ const col=tm.state==='done'?'#5fe39a':tm.state==='active'?(tm.drain?'#5ae0e8':'#ffc23d'):'#ff4150';
    gl(SX(tm.x)+6,SY(tm.y)-49,col,26,0.7); gl(SX(tm.x),SY(tm.y)-27,'#5fe39a',40,tm.state==='idle'?0.08:0.25); }
  for(const c of checks) if(c.on) gl(SX(c.x)+1,SY(c.y)-52,'#ffc23d',40,0.55);
  for(const [tx,ty] of sparkTiles){ gl(SX(tx*T+8),SY(ty*T+12),'#ffe27a',48,0.3+0.3*Math.random()); }
  const gx=SX(goal.x), gty=SY(goal.top)+1, won=state==='winning'||state==='win', open=terms.every(t=>t.state==='done');
  if(won||(tnow%1.2)<0.6) gl(gx,gty,won?'#ffc23d':open?'#5fe39a':'#ff4150',won?90:30,0.8);
  if(won){ for(let i=0;i<3;i++){ const k=((tnow*0.7+i/3)%1), r=Math.round(14+k*220); cx.globalAlpha=(1-k)*0.6; cx.strokeStyle='#ffc23d'; cx.lineWidth=2; cx.beginPath(); cx.arc(gx,gty,r,Math.PI*0.1,Math.PI*0.9,true); cx.stroke(); } }
  if(lampPos&&state!=='winning'&&state!=='win'){ cx.globalAlpha=0.55;
    if(p.face>0) cx.drawImage(lamp,lampPos.lx,lampPos.ly-23);
    else { cx.save(); cx.translate(lampPos.lx,0); cx.scale(-1,1); cx.drawImage(lamp,0,lampPos.ly-23); cx.restore(); } }
  cx.globalAlpha=1;
  drawParts(true);
  cx.globalCompositeOperation='source-over';
}

function drawRain(){
  const dx=camX-lastCamX, dy=camY-lastCamY; lastCamX=camX; lastCamY=camY;
  if(!rain.length) return;
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
  drawTerms(); drawGoal(); drawChecks(); drawRelays(); drawEnemies();
  const lampPos=drawPlayer();
  drawParts(false);
  drawGlows(lampPos);
  drawRain();
  cx.drawImage(vignette,0,0);
  if(flash>0){ cx.fillStyle=`rgba(255,65,80,${flash*1.2})`; cx.fillRect(0,0,BW,BH); }
  if(state==='play'&&p.hp===1){ cx.globalAlpha=0.18+0.1*Math.sin(tnow*6); cx.drawImage(vignette,0,0); cx.fillStyle='rgba(255,40,60,0.12)'; cx.fillRect(0,0,BW,BH); cx.globalAlpha=1; }
}

// ---------- HUD ----------
const hudEl=$('hud'), hpEl=$('hp'), relEl=$('rel'), cabEl=$('cab'), timEl=$('tim'), hintEl=$('hint'), netEl=$('net'), netStat=$('netStat'), lvlEl=$('lvl');
let lastHud='', lastHint=null, hintAt=0;
const DYN={
  term0:"Stand still at the terminal to reroute the network. Walking away pauses the work.",
  term1:"Keep working. When enemies arrive, step away and punch them, then get back to the terminal.",
  leech:"A <b>leech</b> is draining the terminal! Punch it off with <b>GRAB</b>.",
  goal:"Network rerouted. Get to the transmitter mast.",
  locked:"The mast is locked. Reroute every terminal on this level first."
};
function hintText(s){ return isTouch?s:s.replace(/GRAB/g,'SPACE').replace(/▲/g,'↑').replace(/▼/g,'↓'); }
function pickHint(){
  if(state==='winning') return null;
  const tm=terms.find(t=>t.state!=='done'&&Math.abs(p.x+6-t.x)<11*T&&Math.abs(p.y-t.y)<7*T);
  if(tm){ if(tm.drain) return 'leech'; return tm.state==='idle'?'term0':'term1'; }
  if(tnow-lockMsgT<3) return 'locked';
  if(tnow-allDoneT<8) return 'goal';
  let hi=null; const tx=p.x/T; (LDEF.hints||[]).forEach((h,i)=>{if(tx>=h[0])hi=i;}); return hi;
}
function hud(){
  if(state!=='play'&&state!=='pause'&&state!=='winning'){ if(lastHint!=='none'){ lastHint='none'; hintEl.textContent=''; } return; }
  const cab=hook.state==='att'?(rope/16).toFixed(1)+' m':'— m';
  const nt=terms.filter(t=>t.state==='done').length, act=terms.find(t=>t.state==='active');
  const net=terms.length?(act?Math.floor(act.prog*100)+'%':nt+'/'+terms.length):'';
  const key=p.hp+'|'+got+'|'+cab+'|'+fmt(clock)+'|'+net;
  if(key!==lastHud){ lastHud=key;
    hpEl.innerHTML=[0,1,2].map(i=>`<i class="${i<p.hp?'':'off'}"></i>`).join('');
    hudEl.classList.toggle('low',p.hp===1);
    relEl.textContent=got+'/'+relays.length; cabEl.textContent=cab; timEl.textContent=fmt(clock);
    netStat.hidden=!terms.length; netEl.textContent=net; netStat.classList.toggle('net-on',terms.length>0&&nt===terms.length); }
  const hi=pickHint();
  if(hi!==lastHint){ lastHint=hi; const txt=hi==null?'':typeof hi==='string'?DYN[hi]:LDEF.hints[hi][1]; hintEl.innerHTML=hintText(txt); hintEl.classList.remove('fade'); hintAt=tnow; }
  else if(hi!=null&&typeof hi!=='string'&&tnow-hintAt>9) hintEl.classList.add('fade');
}

// ---------- flow & UI ----------
let drawnPaused=false;
const OVS={title:'ovTitle',levels:'ovLevels',brief:'ovBrief',pause:'ovPause',win:'ovWin',end:'ovEnd'};
function setUI(){
  const playing=state==='play', inRun=playing||state==='pause'||state==='winning';
  hudEl.hidden=!inRun;
  $('pauseBtn').hidden=!playing;
  $('touch').hidden=!(playing&&isTouch);
  for(const k in OVS) $(OVS[k]).hidden=state!==k;
  $('rotate').hidden=!((state==='title'||state==='brief')&&isTouch&&isPortrait());
  document.body.classList.toggle('touch',isTouch);
  document.body.classList.toggle('playing',playing);
  if(!playing) clearTouch();
}
const nextLevelIdx=()=>Math.min(save.unlocked,LEVELS.length)-1;
function refreshTitle(){
  const n=nextLevelIdx();
  $('startBtn').textContent=save.unlocked>1?(save.unlocked>LEVELS.length?'Replay from level 1':`Continue · Level ${n+1}`):'Start shift';
  const cleared=Object.keys(save.best).length;
  $('bestLine').textContent=cleared?`${cleared} of ${LEVELS.length} levels cleared`:'';
}
function continueGame(){ openBrief(save.unlocked>LEVELS.length?0:nextLevelIdx()); }
function toTitle(){ loadLevel(Math.min(LI,nextLevelIdx())); state='title'; Snd.ambience(false); refreshTitle(); setUI(); }
function openLevels(){
  const el=$('levelList'); el.innerHTML='';
  LEVELS.forEach((lv,i)=>{
    const b=document.createElement('button'), best=save.best[i], locked=i>=save.unlocked;
    b.type='button'; b.className='lvl-item'+(best?' done':''); b.disabled=locked;
    b.innerHTML=`<span class="n">${i+1}</span><span class="t"><b>${lv.name.toUpperCase()}</b><small>${locked?'Locked':best?`Record ${fmt(best.time)} · ${best.relays}/${best.total||'?'} relays`:'Not cleared yet'}</small></span>`;
    b.addEventListener('click',()=>{ sfx.click(); openBrief(i); });
    el.appendChild(b);
  });
  state='levels'; setUI();
}
function openBrief(i){
  Snd.init(); loadLevel(i); state='brief';
  $('briefNum').textContent=`LEVEL ${LI+1} OF ${LEVELS.length}`;
  $('briefName').textContent=LDEF.name.toUpperCase();
  $('briefPlace').textContent=LDEF.place;
  $('briefText').textContent=LDEF.brief;
  const nT=LD.terms.length;
  $('briefMeta').textContent=`${LD.relays.length} relays · ${nT} terminal${nT===1?'':'s'} to reroute`;
  Snd.ambience(false); setUI();
}
function startLevel(){
  Snd.init(); reset(); state='play'; prevGrab=true; lastHint=null; lastHud=''; lvlEl.textContent='L'+(LI+1);
  if(isTouch) goFullscreen();
  Snd.ambience(true);
  setUI();
}
function pause(){ if(state!=='play') return; state='pause'; drawnPaused=false; Snd.ambience(false); setUI(); }
function resume(){ if(state!=='pause') return; state='play'; prevGrab=true; last=performance.now(); Snd.init(); Snd.ambience(true); setUI(); }
function win(){
  state='winning'; winT=0; fwT=0; hook.state='idle'; p.vx=p.vy=0; shots=[];
  sfx.win(); buzz([30,60,30]); shake=2;
  setUI();
}
function showWin(){
  winT=0;
  const prev=save.best[LI], rec={time:clock,relays:got,total:relays.length,falls};
  const better=!prev||rec.relays>prev.relays||(rec.relays===prev.relays&&rec.time<prev.time);
  if(better) save.best[LI]=rec;
  save.unlocked=Math.max(save.unlocked,LI+2); persist();
  Snd.ambience(false);
  if(LI===LEVELS.length-1){
    state='end';
    $('endText').textContent=LDEF.ending||LDEF.outro;
    const tot=Object.values(save.best).reduce((a,b)=>a+b.time,0), rel=Object.values(save.best).reduce((a,b)=>a+b.relays,0), all=LEVELS.length;
    $('endStats').textContent=`Final level ${fmt(clock)} · ${got}/${relays.length} relays · Best total ${fmt(tot)} · ${rel} relays across ${Object.keys(save.best).length}/${all} levels`;
    setUI(); return;
  }
  state='win';
  $('winTitle').textContent='NETWORK SECURED';
  $('winOutro').textContent=LDEF.outro;
  $('winStats').textContent=`${LDEF.name} · ${fmt(clock)} · Relays ${got}/${relays.length} · Falls ${falls}`;
  $('winBest').textContent=better?(prev?'New record!':'Level cleared.'):`Record: ${fmt(prev.time)} · ${prev.relays}/${prev.total||relays.length} relays`;
  setUI();
}

function goFullscreen(){
  const el=document.documentElement, rq=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!rq||document.fullscreenElement||document.webkitFullscreenElement||isStandalone()) return;
  try{ const pr=rq.call(el,{navigationUI:'hide'}); if(pr&&pr.then) pr.then(lockLandscape).catch(()=>{}); }catch(_){}
}
function lockLandscape(){ try{ const o=screen.orientation; if(o&&o.lock) o.lock('landscape').catch(()=>{}); }catch(_){} }
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;

const on=(id,fn)=>$(id).addEventListener('click',fn);
on('startBtn',()=>{ sfx.click(); continueGame(); });
on('levelsBtn',()=>{ Snd.init(); sfx.click(); openLevels(); });
on('levelsBack',()=>{ sfx.click(); toTitle(); });
on('briefGo',startLevel);
on('againBtn',()=>{ reset(); startLevel(); });
on('nextBtn',()=>openBrief(LI+1));
on('winLevelsBtn',()=>{ sfx.click(); openLevels(); });
on('endBtn',()=>{ sfx.click(); toTitle(); });
on('resumeBtn',resume);
on('restartBtn',startLevel);
on('quitBtn',toTitle);
on('pauseBtn',()=>{ sfx.click(); pause(); });
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
function setTouchMode(t){ if(t===isTouch) return; isTouch=t; lastHint=null; setUI(); }
addEventListener('keydown',e=>{
  Snd.init();
  if(!matchMedia('(pointer:coarse)').matches) setTouchMode(false);
  if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter')) return;
  const k=KEYMAP[e.code]; if(k){K[k]=true;e.preventDefault();}
  if(e.code==='Escape'||e.code==='KeyP'){ if(state==='play') pause(); else if(state==='pause') resume(); e.preventDefault(); }
  if(e.code==='KeyM'){ Snd.setMuted(!muted); syncSound(); }
  if(e.code==='Enter'){ if(state==='title') continueGame(); else if(state==='brief') startLevel(); else if(state==='win') openBrief(LI+1); e.preventDefault(); }
});
addEventListener('keyup',e=>{const k=KEYMAP[e.code]; if(k){K[k]=false;e.preventDefault();}});
addEventListener('pointerdown',e=>{ Snd.init(); if(e.pointerType==='touch') setTouchMode(true); },{capture:true});
function clearKeys(){ DIRS.forEach(k=>{K[k]=false;}); clearTouch(); }
addEventListener('blur',()=>{ clearKeys(); pause(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){ clearKeys(); pause(); } });
addEventListener('contextmenu',e=>e.preventDefault());
// stop the browser's own pinch / double-tap zoom (iOS ignores user-scalable=no)
for(const ev of ['gesturestart','gesturechange','gestureend','dblclick']) document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{ if(e.touches.length>1||state==='play') e.preventDefault(); },{passive:false});

// touch: left thumb d-pad (slide between directions), right thumb GRAB
const stickZone=$('stickZone'), dpadEl=$('dpad'), arms={};
dpadEl.querySelectorAll('[data-d]').forEach(el=>{arms[el.dataset.d]=el;});
let stickId=null, grabId=null;
function stickAt(e){
  const r=dpadEl.getBoundingClientRect(), dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2), d=Math.hypot(dx,dy);
  const o={left:false,right:false,up:false,down:false};
  if(d>r.width*0.1){ const c=dx/d, s=dy/d; o.right=c>0.5; o.left=c<-0.5; o.down=s>0.5; o.up=s<-0.5; }
  for(const k in o){ TT[k]=o[k]; arms[k].classList.toggle('on',o[k]); }
}
function stickEnd(e){ if(e.pointerId!==stickId) return; stickId=null; for(const k in arms){ TT[k]=false; arms[k].classList.remove('on'); } }
stickZone.addEventListener('pointerdown',e=>{ e.preventDefault(); if(stickId!==null) return; stickId=e.pointerId; try{stickZone.setPointerCapture(e.pointerId);}catch(_){} stickAt(e); });
stickZone.addEventListener('pointermove',e=>{ if(e.pointerId===stickId) stickAt(e); });
['pointerup','pointercancel','lostpointercapture'].forEach(t=>stickZone.addEventListener(t,stickEnd));
const grabZone=$('grabZone'), grabBtn=$('grabBtn');
grabZone.addEventListener('pointerdown',e=>{ e.preventDefault(); if(grabId!==null) return; grabId=e.pointerId; try{grabZone.setPointerCapture(e.pointerId);}catch(_){} TT.grab=true; grabBtn.classList.add('on'); });
const grabEnd=e=>{ if(e.pointerId!==grabId) return; grabId=null; TT.grab=false; grabBtn.classList.remove('on'); };
['pointerup','pointercancel','lostpointercapture'].forEach(t=>grabZone.addEventListener(t,grabEnd));
for(const z of [stickZone,grabZone,cv]) z.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
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
    if(st&&!padStart){ if(state==='play') pause(); else if(state==='pause') resume(); else if(state==='title') continueGame(); else if(state==='brief') startLevel(); else if(state==='win') openBrief(LI+1); }
    padStart=st;
  }
}
function readInput(){ pollPad(); for(const k of DIRS) I[k]=K[k]||TT[k]||GP[k]; }

// ---------- boot ----------
addEventListener('resize',resize);
addEventListener('orientationchange',()=>setTimeout(resize,150));
if(window.visualViewport) visualViewport.addEventListener('resize',resize);
loadLevel(Math.max(0,nextLevelIdx())); syncSound(); refreshTitle(); setUI();
{ const m=/[?&]level=(\d+)/.exec(location.search); if(m) openBrief(+m[1]-1); } // ?level=N jumps to any level for testing
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
  info(){ return {state,lv:LI,x:+p.x.toFixed(1),y:+p.y.toFixed(1),tx:+(p.x/T).toFixed(1),ty:+((p.y+p.h)/T).toFixed(1),vx:+p.vx.toFixed(1),vy:+p.vy.toFixed(1),ground:p.onGround,hook:hook.state,rope:+rope.toFixed(1),hp:p.hp,got,cp,falls,
    enemies:enemies.filter(e=>e.alive).map(e=>e.type+'@'+(e.x/T).toFixed(1)+','+(e.y/T).toFixed(1)),terms:terms.map(t=>t.state+':'+t.prog.toFixed(2)),VW,VH}; },
  start(i){ openBrief(i); startLevel(); return this.info(); },
  teleport(x,y){ p.x=x; p.y=y; p.vx=p.vy=0; hook.state='idle'; },
  tile, enemies:()=>enemies, terms:()=>terms, p:()=>p
};

if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
