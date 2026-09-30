/* Scripted walkthroughs that prove each top-down level can be finished.
   Load tools/testbot.js first, then this file; call e.g. WALK.substation9(). Each returns a step log. */
(() => {
const T = window.TB, r = window.__rr;
// retry an action (clearing enemies between tries) until check() passes
const until=(act,check,tries=5)=>{ for(let i=0;i<tries;i++){ if(check()) return 'ok'; T.killNear(160); act(); r.run(5); } return check()?'ok':'FAILED'; };
const WALK = window.WALK = {
  substation9(calm){ const log=[]; r.start(6); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(30);
    log.push('R1 part 1: '+T.collect(9,2)+' | crate->plate '+T.walkTo(6,4)+' '+T.push('down',1)+' '+T.walkTo(5,6)+' '+T.push('right',3)+' door A '+r.gstate()['1']);
    log.push('R1 secret: '+T.grappleSecret(12,7,'down',12,8)+' | part 2: '+T.collect(10,9));
    log.push('R2 post east: '+T.walkTo(17,4)); T.face('right'); T.grab(); log.push(' at '+T.tileOf()+' | block E->plate '+T.walkTo(23,1)+' '+T.push('down',5));
    log.push(' post west: '+T.walkTo(21,4)); T.face('left'); T.grab(); log.push(' at '+T.tileOf()+' | block W->plate '+T.walkTo(14,6)+' '+T.push('right',2)+' '+T.walkTo(17,5)+' '+T.push('down',1)+' door B '+r.gstate()['2']);
    log.push('R2->R3: '+T.walkTo(17,4)); T.face('right'); T.grab(); log.push(' at '+T.tileOf()+' '+T.walkTo(27,5));
    log.push('R3 lever: '+T.walkTo(28,4)); T.face('down'); T.grab(); log.push(' door L '+r.gstate()['4']+' | part 3: '+T.collect(37,1)+' | fuse: '+T.fitFuse(30,7,'down')+' door F '+r.gstate()['3']);
    log.push('R6 crate pull: '+T.walkTo(33,17)); T.face('right'); T.grab(); T.grab(); log.push(' crates '+T.crates()+' | part 4: '+T.collect(37,17));
    log.push('terminal: '+T.walkTo(32,13)+' fitted '+r.terms()[0].have+'/'+r.terms()[0].need+' held '+r.partsHeld()+' | '+T.fightTop(0)); r.run(10);
    log.push('exit: '+T.killNear(200)+' '+T.walkTo(3,15)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls+' parts '+r.pickups().filter(q=>q.got).length+'/'+r.pickups().length);
    return log.join('\n'); },
  hiveRelay(calm){ const log=[]; r.start(9); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(60);
    log.push('clear room '+T.killNear(200));
    log.push('A plates '+T.walkTo(4,3)+' '+T.push('right',4)+' '+T.walkTo(4,6)+' '+T.push('right',4)+' door '+r.gstate()['1']);
    log.push('B posts '+T.walkTo(14,4)); T.face('right'); T.grab(); T.face('down'); T.grab(); T.face('right'); T.grab(); log.push(' at '+T.tileOf());
    log.push('C fill '+T.walkTo(25,2)+' '+T.push('right',2)+' '+T.walkTo(28,2)); T.face('right'); T.grab();
    log.push(' spitter '+T.walkTo(33,5)+' '+T.killNear(250)+' lever '+T.walkTo(31,5)); T.face('right'); T.grab(); log.push(' door '+r.gstate()['2']);
    log.push('D terminal '+T.walkTo(33,10)+' cp '+r.info().cp+' '+T.killNear()+' '+T.walkTo(30,11)+' '+T.fightTop(0)); r.run(10); log.push(' west door '+r.gstate()['term0']);
    log.push('E bridge '+T.killNear()+' '+T.walkTo(21,11)+' '+T.killNear(220)+' '+T.push('down',4)+' '+r.gstate()['3']+' '+until(()=>T.walkTo(11,14),()=>T.tileOf()[0]===11));
    log.push('F lever '+until(()=>{ T.walkTo(6,15); T.face('up'); T.grab(); },()=>r.gstate()['4'])+' '+until(()=>{ T.walkTo(6,21); T.face('down'); T.grab(); },()=>T.tileOf()[1]===25)+' cp '+r.info().cp);
    log.push('G plates '+T.killNear(200)+' '+T.walkTo(14,21)+' '+T.push('right',7)+' '+T.walkTo(22,22)+' '+T.push('up',1)+' '+T.walkTo(14,24)+' '+T.push('right',7)+' '+T.walkTo(22,23)+' '+T.push('down',1)+' door '+r.gstate()['5']);
    log.push('H terminal '+T.killNear()+' '+T.walkTo(26,22)+' cp '+r.info().cp+' '+T.killNear(250)+' '+T.walkTo(30,20)+' '+T.fightTop(1)+' '+T.killNear()+' '+T.walkTo(34,26)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls+' relays '+r.info().got);
    return log.join('\n'); },
  cableTunnels(calm){ const log=[]; r.start(11); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(30);
    log.push('timed door '+T.walkTo(9,6)+' door '+r.gstate()['1']+' '+T.walkTo(14,4));
    log.push('belt crate '+T.walkTo(15,2)+' '+T.push('down',3)+' '+T.walkTo(14,6)+' '+T.push('right',1)); T.until({},()=>!r.pitT(24,6),420); log.push(' gap filled '+!r.pitT(24,6)+' '+T.walkTo(28,6));
    log.push('plate by belt '+T.walkTo(41,2)+' '+T.push('left',1)); T.until({},()=>r.gstate()['2'],420); log.push(' door B '+r.gstate()['2']+' '+T.walkTo(36,10));
    log.push('terminal '+T.walkTo(37,11)+' '+T.walkTo(33,11)+' '+T.fightTop(0)); r.run(10); log.push(' door '+r.gstate()['term0']+' '+T.killNear()+' '+T.walkTo(27,14));
    log.push('belt run '+T.killNear(200)+' '+T.walkTo(26,12)+' '+T.walkTo(12,12));
    log.push('exit '+T.walkTo(3,15)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls);
    return log.join('\n'); },
  burrow(calm){ const log=[]; r.start(13); if(calm) r.enemies().forEach(e=>{ if(e.type!=='brood') e.alive=false; }); r.run(30);
    log.push('posts '+T.killNear(160)+' '+T.walkTo(15,4)); T.face('right'); T.grab(); T.face('down'); T.grab(); T.face('right'); T.grab(); log.push(' at '+T.tileOf());
    log.push('terminal '+T.walkTo(25,10)+' '+T.walkTo(20,11)+' '+T.fightTop(0)); r.run(10); log.push(' door '+r.gstate()['term0']);
    log.push('to arena '+T.killNear()+' '+T.walkTo(12,14)+' '+T.walkTo(6,20)+' cp '+r.info().cp);
    const hits=()=>{ const b=r.enemies().find(e=>e.type==='brood'); return b?(b.alive?b.hp:0):0; };
    log.push(' crate W '+until(()=>{ T.walkTo(7,22); T.push('right',4); },()=>hits()<=2)+' hp '+hits());
    log.push(' crate E '+until(()=>{ T.walkTo(18,23); T.push('left',4); },()=>hits()<=1)+' hp '+hits());
    log.push(' crate S '+until(()=>{ T.walkTo(12,27); T.push('up',3); },()=>hits()<=0)+' hp '+hits());
    r.run(10); log.push(' door '+r.gstate()['boss']+' '+T.killNear(200)+' '+T.walkTo(35,23)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls);
    return log.join('\n'); },

  // ---- side-view Act 3 checks ----
  // hook the beam at a shaft edge, step off, pay out cable, land without fall damage
  rappel(lv,edgeTx,g){ r.teleport((edgeTx-1)*16,g*16-20); r.run(5); const hp0=r.p().hp;
    T.until({right:true},()=>r.p().x+6>=(edgeTx+0.3)*16,120); r.run(1,{right:true,grab:true});
    const att=T.until({grab:true,right:true},()=>r.hook().state==='att',60);
    T.until({grab:true,right:true},()=>!r.p().onGround,120); T.until({grab:true,down:true},()=>r.info().rope>=205,400); T.hold({grab:true},40);
    T.until({},()=>r.p().onGround,300);
    return 'attach '+att+', landed row '+r.info().ty+', hp '+hp0+'->'+r.p().hp; },
  quarryDescent(){ const log=[]; r.start(10); r.enemies().forEach(e=>{e.alive=false;});
    log.push('shaft 1 '+this.rappel(10,30,7));
    r.teleport(71.5*16,22*16-20); r.run(3); const q=r.plats()[0];
    T.until({},()=>r.p().plat===q&&q.dy>0,1500); T.until({},()=>q.y>=40*16-1,1500); log.push('lift down '+T.until({right:true},()=>r.p().onGround&&!r.p().plat&&r.info().tx>=75,300));
    log.push('shaft 2 '+this.rappel(10,110,40));
    r.teleport(130*16+2,56*16-20); r.run(10); log.push('terminal '+T.defendSide(0));
    return log.join('\n'); },
  climbSide(){ const row0=r.info().ty; r.run(1,{}); r.run(1,{up:true,grab:true});
    const f=T.until({up:true,grab:true},()=>r.hook().state==='idle'&&r.p().onGround&&r.info().ty<row0-0.5,240); return f<0?'FAIL':r.info().ty; },
  walkSide(tx){ const dir=tx*16>r.p().x+6?'right':'left'; return T.until({[dir]:true},()=>Math.abs(r.p().x+6-tx*16)<4&&r.p().onGround,900); },
  // climb the whole flooding shaft with enemies removed; reports the water level when you reach the terminal
  pumpingStation(){ r.start(12); r.enemies().forEach(e=>{e.alive=false;}); r.run(5); const out=[];
    const W=this.walkSide.bind(this), C=this.climbSide.bind(this);
    for(const [kind,arg] of [['w',16.5],['c'],['w',19.5],['c'],['c'],['c'],['w',54.5],['c'],['w',57.5],['c'],['c'],['c'],['w',94.4],['c'],['c'],['c'],['c'],['w',106.5]]){
      const v=kind==='w'?W(arg):C(); if(v==='FAIL'||v<0) return 'FAILED at '+kind+' '+(arg||'')+' row '+r.info().ty; }
    out.push('reached the terminal: row '+r.info().ty+', water row '+(r.water().y/16).toFixed(1)+', falls '+r.info().falls);
    out.push('terminal '+T.defendSide(0)+' water row '+(r.water().y/16).toFixed(1));
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
  // ---- Act 4 top-down ----
  beamAt(x,y){ return r.beams().find(b=>b.tx===x&&b.ty===y); },
  // wait for a pulsing beam to switch off (and not be about to switch on)
  waitOff(x,y){ const b=this.beamAt(x,y); return T.until({},()=>!b.active&&!b.warn,400); },
  relayArray(calm){ const log=[]; r.start(16); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(20);
    log.push('pulse beam '+T.walkTo(7,6)+' '+this.waitOff(8,0)+' '+T.walkTo(12,6)+' hp '+r.p().hp);
    log.push('block beam '+T.walkTo(16,1)+' '+T.push('down',2)+' '+T.walkTo(21,4)+' '+T.walkTo(29,6)+' hp '+r.p().hp);
    log.push('lever '+T.walkTo(32,2)); T.face('right'); T.grab(); log.push(' beams off '+r.gstate()['1']);
    log.push('terminal 1 '+T.walkTo(35,2)+' '+T.fightTop(0)); r.run(10);
    log.push('belt beams '+T.walkTo(35,10)+' '+T.walkTo(34,11)+' '+this.waitOff(33,18)+' '+T.walkTo(32,11)+' '+this.waitOff(31,18)+' '+T.walkTo(29,11)+' '+T.walkTo(27,14)+' hp '+r.p().hp);
    log.push('terminal 2 '+T.walkTo(26,13)+' '+this.waitOff(28,12)+' '+T.walkTo(24,11)+' cp '+r.info().cp+' '+T.walkTo(20,11)+' '+T.fightTop(1)); r.run(10);
    log.push('out '+T.killNear(200)+' '+T.walkTo(20,11)+' '+this.waitOff(28,12)+' '+T.walkTo(16,13)+' '+this.waitOff(28,15)+' '+T.walkTo(14,16)+' '+T.walkTo(12,16)+' '+T.walkTo(3,12)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls);
    return log.join('\n'); },
  hullBreach(calm){ const log=[]; r.start(18); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(20);
    log.push('crate through pad '+T.walkTo(5,6)+' '+T.push('right',4)+' crates '+T.crates());
    T.walkTo(9,6); T.until({right:true},()=>T.tileOf()[0]>=13,120); log.push(' teleported to '+T.tileOf());
    log.push('plate '+T.walkTo(15,2)+' '+T.push('right',10)+' '+T.walkTo(26,1)+' '+T.push('down',5)+' door '+r.gstate()['1']+' '+T.walkTo(29,4));
    log.push('terminal 1 '+T.walkTo(35,2)+' '+T.fightTop(0)); r.run(10);
    log.push('beam + pad '+T.walkTo(41,4)+' '+this.waitOff(43,5)+' '+T.walkTo(41,7)); T.until({down:true},()=>T.tileOf()[1]>=11,120); log.push(' at '+T.tileOf());
    log.push('belt crate '+T.walkTo(41,13)+' '+T.push('left',1)); T.until({},()=>!r.pitT(31,13),420); log.push(' filled '+!r.pitT(31,13)+' '+T.walkTo(30,13)); T.until({down:true},()=>T.tileOf()[0]>=20&&T.tileOf()[1]<=12,160); log.push(' at '+T.tileOf());
    log.push('terminal 2 '+T.walkTo(20,11)+' '+T.fightTop(1)); r.run(10);
    log.push('out '+T.killNear(200)+' '+T.walkTo(18,13)+' '+this.waitOff(28,14)+' '+T.walkTo(14,15)+' '+T.walkTo(12,15)+' '+T.walkTo(4,13)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls);
    return log.join('\n'); },
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
    // punch a flyer that has come close (across, up or diagonally)
    const fend=()=>{ const p=r.p(); if(!p.onGround||r.hook().state!=='idle') return false; const px=p.x+6, py=p.y+7;
      const e=r.enemies().find(e=>e.alive&&(e.type==='seeker'||e.type==='hunter')&&Math.hypot(e.x-px,e.y-py)<110); if(!e) return false;
      const dx=e.x-px, dy=e.y-py; let aim=null; if(Math.abs(dy)<10) aim='h'; else if(Math.abs(dx)<10&&dy<0) aim='u'; else if(dy<0&&Math.abs(Math.abs(dx)/(-dy)-0.7)<0.35) aim='d';
      if(!aim) return false; if(aim!=='u') tick({[dx>0?'right':'left']:true}); const k={grab:true}; if(aim==='h') k.down=true; if(aim==='u') k.up=true; tick(k); for(let q=0;q<8;q++) tick(); return true; };
    // stand on (x, row); routes: floor(40) -> low girder(34) -> high girder(21), via the overlap columns 14 (west) and 57 (east)
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
  // can the worker get over the tether on the high walkway?
  anchorCrossing(){ r.start(14); r.anchor().pt=999; r.anchor().st=999; r.enemies().forEach(e=>{ if(e.type!=='clamp') e.alive=false; });
    r.teleport(28*16,15*16-20); r.run(5); const hp0=r.p().hp; const c=this.climbSide();
    const cross=T.until({right:true},()=>r.p().x+6>45*16,600); T.until({right:true},()=>r.p().onGround&&r.info().ty>=15,300);
    return 'climb to '+c+', crossed '+(cross>=0)+', now at '+r.info().tx+',row '+r.info().ty+', hp '+hp0+'->'+r.p().hp; }
};
})();
