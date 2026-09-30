/* Relay Rigger — top-down room composer.
   A composed level is a grid of rooms (13x9 interiors, one-tile walls, doors at edge midpoints). A spanning tree
   picks the main path from the start room to the exit; rooms on it are "gates" whose puzzle unlocks the next
   door; rooms off it hold parts, relays, enemies or secrets. Every room type carries its own solve script so
   tools/walkthroughs.js can prove a level. Generation is seeded, so a level is identical on every load. */
(() => {
const RW=13, RH=9, PX=RW+1, PY=RH+1;                 // interior size and cell pitch
const SIDES=['N','E','S','W'], OPP={N:'S',S:'N',E:'W',W:'E'};
const DOOR_LOCAL={N:[6,-1],S:[6,9],W:[-1,4],E:[13,4]};
const RESERVED=new Set(['#',' ','.','C','o','P','X','K','R','T','S','Z','Q','H','M','%','*','@','<','>','^','v']);
const TRIG_POOL='abdefghijklmnpqrstuwxyz'.split('');
const DOOR_POOL='ABDEFGIJLNOUVWY0123456789!$&()+-=?[]{}|~'.split('').filter(c=>!RESERVED.has(c));

let seed=1; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const pick=a=>a[Math.floor(rnd()*a.length)];
const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

// ---------- room types ----------
// build(ctx) writes tiles through ctx.put(lx,ly,ch) (mirroring applied), ctx.plate(lx,ly,g), ctx.lever(lx,ly,g),
// ctx.fuse(lx,ly,g,need), ctx.cageDoor(lx,ly,g). solve(T,R) drives the test bot; R.g(lx,ly) maps local tiles to global.
const TYPES={
  plateCrate:{ gate:true, hint:"Crates open doors: push the crate onto the plate.",
    fits:()=>true,
    build(c){ c.put(4,2,'C'); c.plate(8,2,c.exitGroup); },
    solve(T,R){ return 'crate '+T.walkTo(...R.g(3,2))+' '+T.push(R.dir('right'),4); } },
  leverGate:{ gate:true, hint:"Levers flip when the cable hits them. That one is across the pit.",
    fits:d=>!(d.has('N')&&d.has('S')),
    build(c){ if(c.doors.has('S')) c.flipY=true; for(let x=2;x<=10;x++){ c.put(x,6,' '); c.put(x,7,' '); } c.lever(6,8,c.exitGroup); },
    solve(T,R){ const w=T.walkTo(...R.g(6,5)); T.face(R.dir('down')); T.grab(); return 'lever '+w; } },
  heavyPair:{ gate:true, hint:"Heavy blocks only push. One on each plate.",
    fits:()=>true,
    build(c){ c.put(3,2,'@'); c.put(9,2,'@'); c.plate(3,6,c.exitGroup); c.plate(9,6,c.exitGroup); },
    solve(T,R){ return 'blocks '+T.walkTo(...R.g(3,1))+' '+T.push(R.dir('down'),4)+' '+T.walkTo(...R.g(9,1))+' '+T.push(R.dir('down'),4); } },
  postPit:{ gate:false, hint:"Face a post and press <b>GRAB</b> to pull yourself across.",
    fits:d=>([...d].every(s=>s==='W'||s==='E')||[...d].every(s=>s==='N'||s==='S')),
    build(c){ const ns=[...c.doors].every(s=>s==='N'||s==='S'); c.pitNS=ns;
      if(ns){ for(let x=0;x<RW;x++) for(let y=3;y<=5;y++) c.put(x,y,' '); c.put(6,1,'o'); c.put(6,7,'o'); }
      else { for(let y=0;y<RH;y++) for(let x=5;x<=7;x++) c.put(x,y,' '); c.put(3,4,'o'); c.put(9,4,'o'); } },
    // crossing a pit room: from one side to the other
    cross(T,R,from,to){ const ns=R.pitNS; const a=ns?(from==='N'?[6,2]:[6,6]):(from==='W'?[4,4]:[8,4]); const face=ns?(from==='N'?'down':'up'):(from==='W'?'right':'left');
      return until(T,()=>{ T.walkTo(...R.g(...a)); T.killNear(120); T.face(face); T.grab(); },()=>{ const [tx,ty]=T.tileOf(); const [gx,gy]=R.g(...(ns?(from==='N'?[6,6]:[6,2]):(from==='W'?[8,4]:[4,4]))); return Math.abs(tx-gx)<=1&&Math.abs(ty-gy)<=1; },6); },
    solve(){ return 'pit'; } },
  cagedFuse:{ gate:true, fuse:true, hint:"The fuse box is caged: crate onto the plate opens the cage, then walk into the fuse box with a part.",
    fits:d=>!(d.has('E')&&d.has('W')),
    build(c){ if(c.doors.has('E')) c.flipX=true; for(let x=8;x<=12;x++) for(let y=2;y<=6;y++) c.put(x,y,'#'); for(let x=9;x<=11;x++) for(let y=3;y<=5;y++) c.put(x,y,'.');
      c.put(3,6,'C'); const cage=c.group(); c.plate(5,6,cage); c.door(8,4,cage,true); c.fuse(11,4,c.exitGroup,1); },
    solve(T,R){ return 'cage '+T.walkTo(...R.g(2,6))+' '+T.push(R.dir('right'),2)+' fuse '+T.fitFuse(...R.g(10,4),R.dir('right')); } },
  den:{ gate:false, hint:"",
    fits:()=>true,
    build(c){ c.put(2,1,'S'); c.put(10,7,'S'); c.put(6,4,'R'); c.put(3,6,'C'); c.put(9,2,'C'); },
    solve(T,R){ return 'den '+T.killNear(220); } },
  // rewards
  partRoom:{ reward:true, build(c){ c.put(6,4,'*'); c.put(2,1,'R'); if(!c.secret&&rnd()<0.5) c.put(10,7,'S'); }, solve(T,R){ T.killNear(200); return T.collect(...R.g(6,4)); } },
  startRoom:{ build(c){ c.put(6,4,'P'); }, solve(){ return 'start'; } },
  exitRoom:{ build(c){ c.put(6,4,'X'); c.put(10,1,'R'); }, solve(T,R){ return 'exit '+T.walkTo(...R.g(6,4)); } },
  terminalRoom:{ build(c){ c.put(6,1,'T'); c.put(2,7,'C'); c.put(10,7,'C'); }, solve(T,R){ return 'terminal '+T.walkTo(...R.g(6,2))+' '+T.fightTop(R.termIndex); } },
};
function until(T,act,check,tries=5){ for(let i=0;i<tries;i++){ if(check()) return 'ok'; T.killNear(160); act(); T.r.run(5); } return check()?'ok':'FAILED'; }

// ---------- composer ----------
const taught=new Set();
function compose(def){
  const G=def.gen; seed=G.seed||1; for(let i=0;i<5;i++) rnd();
  const cols=G.cols, rows=G.rows, need=G.need||2, W=cols*PX+1, H=rows*PY+1;
  const key=(x,y)=>y*cols+x, cells=[]; for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) cells.push({cx:x,cy:y,id:key(x,y),links:{},tree:[],type:null,mirror:{x:false,y:false}});
  const at=(x,y)=>(x<0||y<0||x>=cols||y>=rows)?null:cells[key(x,y)];
  const nb=c=>[['N',at(c.cx,c.cy-1)],['E',at(c.cx+1,c.cy)],['S',at(c.cx,c.cy+1)],['W',at(c.cx-1,c.cy)]].filter(([,n])=>n);
  // spanning tree by randomised depth-first walk from a start cell on the left edge
  const start=at(0,Math.floor(rnd()*rows)); const seen=new Set([start.id]), grown=[start]; start.parent=null; start.depth=0;
  while(grown.length){ const c=rnd()<(G.branchy??0.6)?pick(grown):grown[grown.length-1]; const opts=nb(c).filter(([,n])=>!seen.has(n.id)); if(!opts.length){ grown.splice(grown.indexOf(c),1); continue; }
    const [s,n]=pick(opts); seen.add(n.id); n.parent=c; n.pside=OPP[s]; n.depth=c.depth+1; c.tree.push([s,n]); c.links[s]={to:n,kind:'open'}; n.links[OPP[s]]={to:c,kind:'open'}; grown.push(n); }
  // exit = the leaf whose depth is closest to the wanted main-path length; main path = its ancestry
  const wantLen=G.mainLen||Math.round(cells.length*0.55); const leaves=cells.filter(c=>c.tree.length===0&&c!==start&&c.depth>=3);
  const exit=(leaves.length?leaves:cells.filter(c=>c!==start)).sort((a,b)=>Math.abs(a.depth-wantLen)-Math.abs(b.depth-wantLen)||b.depth-a.depth)[0];
  const main=[]; for(let c=exit;c;c=c.parent) main.unshift(c); main.forEach((c,i)=>c.mainIdx=i);
  for(const c of cells) if(c.mainIdx==null){ let a=c; while(a.mainIdx==null) a=a.parent; c.attach=a.mainIdx; } else c.attach=c.mainIdx;
  // loop edges between cells that hang off the same main room (never a shortcut past a gate)
  const loops=[]; for(const c of shuffle(cells.slice())){ for(const [s,n] of nb(c)){ if(c.links[s]||n.attach!==c.attach||loops.length>=(G.loops??2)) continue; if(rnd()<0.5){ c.links[s]={to:n,kind:'open'}; n.links[OPP[s]]={to:c,kind:'open'}; loops.push([c,n]); } } }
  // room roles
  start.type='startRoom'; exit.type='exitRoom';
  const gates=main.slice(1,-1); const term=gates[gates.length-1]; term.type='terminalRoom'; term.termIndex=0;
  const puzzleGates=gates.slice(0,-1);
  const fuseIdx=puzzleGates.length>=3?Math.floor(puzzleGates.length/2):-1;
  const pool=(G.types||['plateCrate','leverGate','heavyPair','postPit','cagedFuse','den']).filter(t=>TYPES[t]);
  let last=null;
  puzzleGates.forEach((c,i)=>{ const doors=new Set(Object.keys(c.links));
    let opts=pool.filter(t=>t!=='cagedFuse'&&t!==last&&TYPES[t].fits(doors)); if(i===fuseIdx&&TYPES.cagedFuse.fits(doors)) opts=['cagedFuse'];
    if(!opts.length) opts=['den']; c.type=pick(opts); last=c.type; });
  // parts: one per fuse room plus what the terminal needs, all in branch rooms reachable before they are needed
  const branches=cells.filter(c=>c.mainIdx==null); const fuseMain=fuseIdx>=0?puzzleGates[fuseIdx].mainIdx:-1;
  const wantFuse=fuseIdx>=0&&puzzleGates[fuseIdx].type==='cagedFuse'?1:0;
  const early=shuffle(branches.filter(c=>c.attach<fuseMain)), later=shuffle(branches.filter(c=>c.attach>=fuseMain&&c.attach<term.mainIdx));
  const partCells=[]; if(wantFuse&&early.length) partCells.push(early.pop()); const rest=shuffle(early.concat(later)); while(partCells.length<need+wantFuse&&rest.length) partCells.push(rest.pop());
  const termNeed=Math.max(1,partCells.length-wantFuse);
  for(const c of partCells){ c.type='partRoom'; const leaf=Object.keys(c.links).length===1; if(leaf&&rnd()<(G.secret??0.5)){ const side=Object.keys(c.links)[0]; c.links[side].kind='secret'; c.links[side].to.links[OPP[side]].kind='secret'; } }
  for(const c of branches) if(!c.type) c.type=rnd()<0.6?'den':'partRoom'; // spare part rooms give a little slack
  const spareParts=branches.filter(c=>c.type==='partRoom'&&!partCells.includes(c)); for(const c of spareParts) c.type='den';
  // ---- emit tiles
  const g=Array.from({length:H},()=>new Array(W).fill('#'));
  const keyDef={}, hints=[]; let trig=0, door=0; const nextTrig=()=>TRIG_POOL[trig++%TRIG_POOL.length], nextDoor=()=>DOOR_POOL[door++%DOOR_POOL.length];
  let group=0;
  for(const c of cells){
    const ox=1+c.cx*PX, oy=1+c.cy*PY; c.ox=ox; c.oy=oy;
    for(let y=0;y<RH;y++) for(let x=0;x<RW;x++) g[oy+y][ox+x]='.';
    const t=TYPES[c.type], doors=new Set(Object.keys(c.links));
    const nextSide=c.mainIdx!=null&&main[c.mainIdx+1]?Object.keys(c.links).find(s=>c.links[s].to===main[c.mainIdx+1]):null;
    const ctx={doors,exitGroup:null,flipX:false,flipY:false,group:()=>String(++group),secret:Object.values(c.links).some(l=>l.kind==='secret'),
      put(lx,ly,ch){ const [gx,gy]=map(lx,ly); g[gy][gx]=ch; },
      plate(lx,ly,gr){ const ch=nextTrig(); keyDef[ch]={t:'plate',g:gr}; this.put(lx,ly,ch); },
      lever(lx,ly,gr){ const ch=nextTrig(); keyDef[ch]={t:'lever',g:gr}; this.put(lx,ly,ch); },
      fuse(lx,ly,gr,need){ const ch=nextTrig(); keyDef[ch]={t:'fuse',g:gr,need}; this.put(lx,ly,ch); },
      door(lx,ly,gr,latch){ const ch=nextDoor(); keyDef[ch]={t:'door',g:gr,latch:!!latch}; this.put(lx,ly,ch); } };
    const map=(lx,ly)=>[ox+(ctx.flipX?RW-1-lx:lx),oy+(ctx.flipY?RH-1-ly:ly)];
    if(t.gate&&nextSide){ ctx.exitGroup=ctx.group(); }
    t.build(ctx); c.flipX=ctx.flipX; c.flipY=ctx.flipY; c.exitGroup=ctx.exitGroup; c.pitNS=ctx.pitNS;
    if(c.type==='terminalRoom'){ c.exitGroup='term0'; }
    // the door out towards the next main room is locked by this room's puzzle; a checkpoint sits inside the entry door
    if(c.mainIdx!=null&&c.mainIdx>0){ const [dx,dy]=DOOR_LOCAL[c.pside]; const inside=[6+(c.pside==='W'?1:c.pside==='E'?-1:0)+0,4+(c.pside==='N'?1:c.pside==='S'?-1:0)]; const [ix,iy]=[ox+(c.pside==='W'?0:c.pside==='E'?RW-1:6),oy+(c.pside==='N'?0:c.pside==='S'?RH-1:4)]; if(g[iy][ix]==='.') g[iy][ix]='K'; }
    if(t.hint&&!taught.has(c.type)){ taught.add(c.type); hints.push([ox+6,oy+4,t.hint]); }
    if(c.type==='startRoom'&&!taught.has('intro')){ taught.add('intro'); hints.push([ox+6,oy+4,"Top-down view. The terminal needs spare parts, and every one is hidden somewhere in these rooms. The map at the top left shows where you have been. Stuck? Pause has Reset puzzle."]); }
  }
  // doors between rooms
  for(const c of cells) for(const s of Object.keys(c.links)){ const l=c.links[s]; if(l.done) continue; l.done=true; c.links[s].to.links[OPP[s]].done=true;
    const [dx,dy]=DOOR_LOCAL[s]; const gx=c.ox+dx, gy=c.oy+dy;
    if(l.kind==='secret') g[gy][gx]='%';
    else if(c.mainIdx!=null&&main[c.mainIdx+1]===l.to&&c.exitGroup){ const ch=nextDoor(); keyDef[ch]={t:'door',g:c.exitGroup,latch:c.exitGroup!=='term0'}; g[gy][gx]=ch; }
    else if(l.to.mainIdx!=null&&main[l.to.mainIdx+1]===c&&l.to.exitGroup){ const ch=nextDoor(); keyDef[ch]={t:'door',g:l.to.exitGroup,latch:l.to.exitGroup!=='term0'}; g[gy][gx]=ch; }
    else g[gy][gx]='.'; }
  if(!taught.has('secret')){ const sc=cells.find(c=>c.type!=='partRoom'&&Object.values(c.links).some(l=>l.kind==='secret')); if(sc){ taught.add('secret'); hints.push([sc.ox+6,sc.oy+4,"Some walls are cracked, and dust drifts off them. Fire your cable at a crack to break through."]); } }
  // route for the test bot: walk the main path, detouring into every branch that holds a part
  const route=[]; const visitBranch=(c,from)=>{ for(const [s,n] of c.tree){ if(n.mainIdx!=null) continue; const has=n.type==='partRoom'||n.tree.some(([,m])=>subHasPart(m)); if(!has) continue; route.push({go:n,via:c}); route.push({solve:n}); visitBranch(n,c); route.push({go:c,via:n}); } };
  const subHasPart=n=>n.type==='partRoom'||n.tree.some(([,m])=>subHasPart(m));
  main.forEach((c,i)=>{ if(i>0) route.push({go:c,via:main[i-1]}); visitBranch(c); if(c.type!=='startRoom') route.push({solve:c}); });
  const terms=[{time:G.time||14,parts:termNeed,waves:G.waves||[[0.15,'skitter'],[0.5,'skitter','hunter'],[0.8,'skitter','skitter']]}];
  return {map:g.map(r=>r.join('')),key:keyDef,terms,hints,rooms:{cols,rows,px:PX,py:PY,cells:cells.map(c=>({cx:c.cx,cy:c.cy,type:c.type,ox:c.ox,oy:c.oy,mainIdx:c.mainIdx,links:Object.fromEntries(Object.entries(c.links).map(([s,l])=>[s,{to:l.to.id,kind:l.kind}])),flipX:c.flipX,flipY:c.flipY,pitNS:c.pitNS,termIndex:c.termIndex,pside:c.pside}))},route:route.map(s=>s.go?{go:s.go.id,via:s.via.id}:{solve:s.solve.id})};
}
// compose every generated level once, in campaign order, so teaching hints appear only the first time a room type is used
function composeAll(levels){ taught.clear(); for(const lv of levels) if(lv.mode==='top'&&lv.gen){ const c=compose(lv); Object.assign(lv,{map:c.map,key:c.key,terms:c.terms,hints:c.hints,rooms:c.rooms,route:c.route}); } }
window.RR_ROOMS={TYPES,compose,composeAll,until,RW,RH,PX,PY,DOOR_LOCAL,OPP};
})();
