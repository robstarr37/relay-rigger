/* Relay Rigger test bot — scripted play for checking that levels can be finished.
   Open index.html?debug, then in the browser console:
     await import('./tools/testbot.js')   (or paste this file)
   and drive levels with TB.* (see the level walkthroughs in tools/walkthroughs.js). Not loaded by the game. */
(() => {
const r = window.__rr;
if (!r) throw new Error('Open the game with ?debug first');
const TB = window.TB = {
  r,
  // ---- top-down helpers ----
  ctr(){ const p=r.p(); return [p.x+6,p.y+6]; },
  tileOf(){ const [x,y]=this.ctr(); return [Math.floor(x/16),Math.floor(y/16)]; },
  walkable(x,y){ return !r.solidT(x,y)&&!r.pitT(x,y); },
  path(tx,ty){
    const [sx,sy]=this.tileOf(), key=(x,y)=>x+','+y, prev={}, q=[[sx,sy]]; prev[key(sx,sy)]=null;
    while(q.length){ const [x,y]=q.shift(); if(x===tx&&y===ty) break;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy, k=key(nx,ny); if(k in prev||!this.walkable(nx,ny)) continue; prev[k]=[x,y]; q.push([nx,ny]); } }
    if(!(key(tx,ty) in prev)) return null;
    const out=[]; let c=[tx,ty]; while(c){ out.unshift(c); c=prev[key(c[0],c[1])]; } return out;
  },
  goTile(x,y,maxF=200){ const tx=x*16+8, ty=y*16+8;
    for(let f=0;f<maxF;f++){ const [cx,cy]=this.ctr(), dx=tx-cx, dy=ty-cy; if(Math.abs(dx)<1.5&&Math.abs(dy)<1.5) return true;
      const k={}; if(Math.abs(dx)>=1.5) k[dx>0?'right':'left']=true; if(Math.abs(dy)>=1.5) k[dy>0?'down':'up']=true;
      r.run(1,k); if(r.p().fall>0) return false; }
    return false; },
  walkTo(x,y){ const pth=this.path(x,y); if(!pth) return 'NO PATH to '+x+','+y;
    for(const [a,b] of pth.slice(1)) if(!this.goTile(a,b)) return 'STUCK at '+this.tileOf()+' going '+a+','+b;
    r.run(2); return 'ok'; },
  face(d){ r.run(1,{[d]:true}); },
  grab(wait=120){ r.run(1,{grab:true}); for(let f=0;f<wait;f++){ r.run(1); if(r.hook().state==='idle') break; } },
  push(d,tiles){ const cs=()=>r.crates().filter(c=>!c.dead).map(c=>c.tx+','+c.ty).join('|'); let moves=0, last=cs();
    for(let f=0;f<600&&moves<tiles;f++){ r.run(1,{[d]:true}); const now=cs(); if(now!==last){ moves++; last=now; } }
    r.run(14); return moves; },
  // work terminal ti; punch anything that comes close; returns a summary
  fightTop(ti,max=120){
    for(let f=0;f<max*60;){ const tm=r.terms()[ti]; if(tm.state==='done') return 'done in '+(f/60).toFixed(1)+'s, hp '+r.p().hp+', falls '+r.info().falls;
      const [px,py]=this.ctr(); let tgt=null,bd=1e9;
      for(const e of r.enemies()){ if(!e.alive) continue; if(e.type==='leech'&&!e.latched) continue; if(e.type==='brood') continue; if(!this.sees(e)) continue; const d=Math.hypot(e.x-px,e.y-py); if(d<bd){bd=d;tgt=e;} }
      if(tgt&&bd<110){ const dx=tgt.x-px, dy=tgt.y-py; let dir=null; if(Math.abs(dy)<9) dir=dx>0?'right':'left'; else if(Math.abs(dx)<9) dir=dy>0?'down':'up';
        if(dir){ this.face(dir); r.run(1,{grab:true}); r.run(10); f+=12; }
        else { const k={}; if(Math.abs(dx)<Math.abs(dy)) k[dx>0?'right':'left']=true; else k[dy>0?'down':'up']=true; r.run(3,k); f+=3; } }
      else { const wx=tm.x, wy=tm.y+8; if(Math.hypot(wx-px,wy-py)>6){ const k={}; if(Math.abs(wx-px)>3) k[wx>px?'right':'left']=true; if(Math.abs(wy-py)>3) k[wy>py?'down':'up']=true; r.run(3,k); f+=3; } else { r.run(10); f+=10; } } }
    return 'timeout at '+r.terms()[ti].prog.toFixed(2); },
  crates(){ return JSON.stringify(r.crates().filter(c=>!c.dead).map(c=>[c.tx,c.ty])); },
  // walk onto a part and confirm it was picked up
  collect(x,y){ const before=r.partsHeld(); const w=this.walkTo(x,y); return w==='ok'&&r.partsHeld()===before+1?'got part ('+r.partsHeld()+' held)':'MISSED part at '+x+','+y+' ('+w+')'; },
  // stand next to a cracked wall, face it and grapple; confirm it opened
  grappleSecret(sx,sy,face,wx,wy){ const w=this.walkTo(sx,sy); if(w!=='ok') return w; this.face(face); this.grab(); return r.wallT(wx,wy)?'STILL WALL at '+wx+','+wy:'opened '+wx+','+wy; },
  // walk into a fuse box from an adjacent tile
  fitFuse(sx,sy,dir){ const w=this.walkTo(sx,sy); if(w!=='ok') return w; r.run(30,{[dir]:true}); r.run(5); const f=r.fuses().find(f=>Math.abs(f.tx-sx)+Math.abs(f.ty-sy)===1); return f?('fuse '+f.fitted+'/'+f.need):'no fuse next to '+sx+','+sy; },
  // ---- side-view helpers ----
  // swing across a gap from ground edge tile edgeTx: fire, pump with the swing, pay out to `rope`, let go at the forward peak, fire again
  chain(lv,edgeTx,g,landTx,opts={}){ r.start(lv); if(!opts.keepEnemies) r.enemies().forEach(e=>{e.alive=false;}); r.teleport((edgeTx-2)*16,g*16-20); r.run(10);
    let fired=false, swings=0, lastRel=-99; const fireAt=opts.fireAt??0.5, want=opts.rope??110, vxRel=opts.vxRel??60;
    for(let f=0;f<3000;f++){ const p=r.p(), h=r.hook(), info=r.info(), k={};
      if(!fired){ k.right=true; if(p.x+6>=(edgeTx+fireAt)*16){ k.grab=true; fired=true; } }
      else if(h.state==='att'){ k.grab=true;
        if(p.onGround) k.right=true;
        else { k[p.vx>=0?'right':'left']=true; if(info.rope<want) k.down=true;
          if(p.x+6>h.x+8&&p.vy<0&&p.vx>0&&p.vx<vxRel&&f-lastRel>20){ k.grab=false; k.down=false; lastRel=f; swings++; } } }
      else if(h.state==='fly'){ k.grab=true; k.right=true; }
      else { k.right=true; if(!p.onGround&&f-lastRel<90) k.grab=(f-lastRel)%2===1; }
      const i=r.run(1,k);
      if(i.falls>0) return 'FELL after '+swings+' swings';
      if(i.ground&&i.tx>=landTx&&i.hook!=='att'&&i.hook!=='fly') return 'landed at '+i.tx+' after '+swings+' swings';
    } return 'timeout'; },
  hold(keys,frames){ for(let f=0;f<frames;f++) r.run(1,keys); },
  // fire up, reel in, land on the girder above
  climb(){ const row0=r.info().ty; r.run(1,{}); r.run(1,{up:true,grab:true}); const f=this.until({up:true,grab:true},()=>r.hook().state==='idle'&&r.p().onGround&&r.info().ty<row0-0.5,240); return f<0?'CLIMB FAILED':'up to row '+r.info().ty; },
  walkSide(tx){ for(let f=0;f<900;f++){ const d=tx*16-(r.p().x+6); if(Math.abs(d)<6&&r.p().onGround) return 'ok'; r.run(1,{[d>0?'right':'left']:true}); } return 'walk timeout'; },
  // walk right to tx on ground row g (dropping off girders on the way); keepGoing = never stop walking (crumbling bridges)
  walkTill(tx,g,keepGoing){ const f0=r.info().falls; for(let f=0;f<900;f++){ r.run(1,{right:true}); const i=r.info(); if(i.tx>=tx&&i.ground&&Math.abs(i.ty-g)<0.5) return 'reached '+i.tx; if(i.falls>f0) return 'FELL'; } return 'timeout at '+r.info().tx; },
  // walk right (or left) to tx, punching ordinary enemies that come close; used across every side section
  walkFight(tx){ let f=0, fell=r.info().falls; while(f<2400){ const p=r.p(), px=p.x+6, py=p.y+7; if(Math.abs(px-tx*16)<4&&p.onGround) return 'at '+tx; if(r.info().falls>fell) return 'FELL';
      let tgt=null,bd=1e9; for(const e of r.enemies()){ if(!e.alive||['brood','core','gen','clamp'].includes(e.type)||(e.type==='leech'&&!e.latched)) continue; const d=Math.hypot(e.x-px,e.y-py); if(d<bd){bd=d;tgt=e;} }
      if(tgt&&bd<120&&p.onGround&&r.hook().state==='idle'){ const dx=tgt.x-px, dy=tgt.y-py; let aim=null; if(Math.abs(dy)<10) aim='h'; else if(Math.abs(dx)<10&&dy<0) aim='u'; else if(dy<0&&Math.abs(Math.abs(dx)/(-dy)-0.7)<0.35) aim='d';
        if(aim){ if(aim!=='u') r.run(1,{[dx>0?'right':'left']:true}); const k={grab:true}; if(aim==='h') k.down=true; if(aim==='u') k.up=true; r.run(1,k); r.run(10); f+=12; continue; } }
      r.run(3,{[tx*16>px?'right':'left']:true}); f+=3; }
    return 'timeout at '+r.info().tx; },
  // swing across a gap starting from ground edge tile edgeTx (the chain() logic, without restarting the level)
  swingAcross(edgeTx,g,landTx,opts={}){ this.walkFight(edgeTx-2); let fired=false, swings=0, lastRel=-99; const fireAt=opts.fireAt??0.5, want=opts.rope??110, vxRel=opts.vxRel??60;
    for(let f=0;f<3000;f++){ const p=r.p(), h=r.hook(), info=r.info(), k={};
      if(!fired){ k.right=true; if(p.x+6>=(edgeTx+fireAt)*16){ k.grab=true; fired=true; } }
      else if(h.state==='att'){ k.grab=true; if(p.onGround) k.right=true; else { k[p.vx>=0?'right':'left']=true; if(info.rope<want) k.down=true;
        if(p.x+6>(landTx-1.6)*16&&p.y+p.h<=g*16-1){ k.grab=false; k.down=false; k.right=true; lastRel=f; swings++; } // above the far ledge: let go and step on
        else if(p.x+6>h.x+8&&p.vy<0&&p.vx>0&&p.vx<vxRel&&p.x+6<(landTx-2)*16&&f-lastRel>20){ k.grab=false; k.down=false; lastRel=f; swings++; } } }
      else if(h.state==='fly'){ k.grab=true; k.right=true; }
      else { k.right=true; if(!p.onGround&&f-lastRel<90) k.grab=(f-lastRel)%2===1; }
      const i=r.run(1,k); if(i.falls>0) return 'FELL after '+swings+' swings';
      if(i.ground&&i.tx>=landTx){ r.run(2,{right:true}); return 'landed '+i.tx+' ('+swings+' swings)'; } }
    return 'timeout at '+r.info().tx; },
  // board a moving platform that runs between x0 and x1 on row g, ride it, step off past offTx
  ridePlatform(waitTx,x0,x1,g,offTx){ this.walkFight(waitTx); const q=r.plats().find(q=>Math.abs(q.x0-x0*16)<8&&Math.abs(q.y0-g*16)<8); if(!q) return 'no platform';
    const on=()=>r.p().plat===q&&r.p().onGround; this.until({},()=>q.x<=x0*16+6,900); const b=this.until({right:true},()=>on()&&Math.abs(r.p().x+6-(q.x+q.w/2))<10,300);
    this.until({},()=>q.x>=x1*16-4||!on(),900); const off=this.until({right:true},()=>r.p().onGround&&!r.p().plat&&r.info().tx>=offTx,300); return 'board '+b+' off '+off+' falls '+r.info().falls; },
  // side view: work terminal ti, punching (▼/diagonal/▲ + GRAB) whatever gets close; stays on the terminal's platform
  defendSide(ti,maxSec=150){ const log={punches:0,hits:0}; let hp=r.p().hp;
    for(let f=0;f<maxSec*60;){ const p=r.p(), tm=r.terms()[ti]; if(tm.state==='done') break; if(p.y+p.h>tm.y+40){ log.knockedOff=true; break; }
      const pcx=p.x+6, hy=p.y+7; let tgt=null,best=1e9;
      for(const e of r.enemies()){ if(!e.alive||(e.type==='leech'&&!e.latched)||Math.abs(e.y-hy)>120) continue; const d=Math.hypot(e.x-pcx,e.y-hy); if(d<best){best=d;tgt=e;} }
      if(tgt&&best<170){ const dx=tgt.x-pcx, dy=tgt.y-hy, dir=dx>0?'right':'left'; let aim=null;
        if(Math.abs(dy)<9) aim='down'; else if(Math.abs(dx)<8&&dy<0) aim='up'; else if(dy<0&&Math.abs(Math.abs(dx)/(-dy)-0.7)<0.35) aim='diag';
        if(aim){ if(Math.sign(dx)!==p.face&&aim!=='up'){ r.run(1,{[dir]:true}); f++; } const k={grab:true}; if(aim==='down') k.down=true; if(aim==='up') k.up=true; r.run(1,k); r.run(10); f+=11; log.punches++; }
        else { let want=dy<0?tgt.x-Math.sign(dx)*(-dy)*0.7:tgt.x-Math.sign(dx)*60; want=Math.max((tm.seg[0]+1)*16,Math.min(tm.seg[1]*16,want)); const mv=want>pcx?'right':'left'; if(Math.abs(want-pcx)>6){ r.run(4,{[mv]:true}); f+=4; } else { r.run(4); f+=4; } } }
      else { const d=tm.x-pcx; if(Math.abs(d)>5||!p.onGround){ r.run(3,{[d>0?'right':'left']:true}); f+=3; } else { r.run(10); f+=10; } }
      const nhp=r.p().hp; if(nhp<hp) log.hits++; hp=nhp; log.secs=(f/60).toFixed(1); }
    log.terms=r.info().terms.join(','); log.falls=r.info().falls; return JSON.stringify(log); },
  // hold keys until cond() or timeout (frames); returns frames used or -1
  until(keys,cond,max=1200){ const f0=r.info().falls; for(let f=0;f<max;f++){ if(cond()) return f; r.run(1,keys); if(r.info().falls>f0) return -2; } return -1; },
  sees(e){ const [px,py]=this.ctr(), d=Math.hypot(e.x-px,e.y-py), n=Math.ceil(d/6); for(let i=1;i<n;i++){ const k=i/n; if(r.wallT(Math.floor((px+(e.x-px)*k)/16),Math.floor((py+(e.y-py)*k)/16))) return false; } return true; },
  // clear nearby visible enemies (top-down)
  killNear(rad=130){ for(let k=0;k<80;k++){ const [px,py]=this.ctr(); const e=r.enemies().find(e=>e.alive&&e.type!=='leech'&&e.type!=='brood'&&Math.hypot(e.x-px,e.y-py)<rad&&this.sees(e)); if(!e) return 'clear';
      const dx=e.x-px, dy=e.y-py;
      if(Math.abs(dy)<9||Math.abs(dx)<9){ this.face(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')); r.run(1,{grab:true}); r.run(12); }
      else r.run(4,{[Math.abs(dx)<Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')]:true}); }
    return 'gave up'; }
};
})();
