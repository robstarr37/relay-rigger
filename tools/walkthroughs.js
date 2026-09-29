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
    return log.join('\n'); }
};
})();
