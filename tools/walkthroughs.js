/* Scripted walkthroughs that prove each top-down level can be finished.
   Load tools/testbot.js first, then this file; call e.g. WALK.substation9(). Each returns a step log. */
(() => {
const T = window.TB, r = window.__rr;
// retry an action (clearing enemies between tries) until check() passes
const until=(act,check,tries=5)=>{ for(let i=0;i<tries;i++){ if(check()) return 'ok'; T.killNear(160); act(); r.run(5); } return check()?'ok':'FAILED'; };
const WALK = window.WALK = {
  substation9(calm){ const log=[]; r.start(6); if(calm) r.enemies().forEach(e=>{e.alive=false;}); r.run(30);
    log.push('crate→plate '+T.walkTo(5,2)+' '+T.push('down',3)+' door '+r.gstate()['1']);
    log.push('post '+T.walkTo(13,4)); T.face('right'); T.grab(); log.push(' at '+T.tileOf());
    log.push('pull crate '+T.walkTo(23,5)); T.face('right'); T.grab(); log.push(' gap filled '+!r.pitT(24,5));
    log.push('lever '+T.walkTo(32,2)); T.face('right'); T.grab(); log.push(' bridge '+r.gstate()['2']);
    log.push('terminal '+T.walkTo(35,10)+' '+T.walkTo(29,10)+' '+T.fightTop(0));
    log.push('exit '+T.killNear()+' '+T.walkTo(22,14)); r.run(30);
    log.push('RESULT '+r.info().state+' hp '+r.p().hp+' falls '+r.info().falls);
    return log.join('\n'); },
  // calm=true removes enemies to prove the puzzles are solvable; terminal waves still spawn
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
  // can the worker get over the tether on the high walkway?
  anchorCrossing(){ r.start(14); r.anchor().pt=999; r.anchor().st=999; r.enemies().forEach(e=>{ if(e.type!=='clamp') e.alive=false; });
    r.teleport(28*16,15*16-20); r.run(5); const hp0=r.p().hp; const c=this.climbSide();
    const cross=T.until({right:true},()=>r.p().x+6>45*16,600); T.until({right:true},()=>r.p().onGround&&r.info().ty>=15,300);
    return 'climb to '+c+', crossed '+(cross>=0)+', now at '+r.info().tx+',row '+r.info().ty+', hp '+hp0+'->'+r.p().hp; }
};
})();
