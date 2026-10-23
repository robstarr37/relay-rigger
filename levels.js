/* Relay Rigger — level data.
   Each level's build(B) draws tiles and places things through the builder B (see game.js):
     B.rock / B.steel(x0,x1,y0,y1)   solid ground (rock looks like earth, steel like plating)
     B.girder(x0,x1,y)               one-way girder you can stand on and climb onto
     B.sparks(x0,x1,y)               live cable (hurts)
     B.start(x,y) B.check(x,y)       spawn / checkpoints, y = the row the worker stands in
     B.relay(x,y)                    collectible relay box
     B.drone(x0,x1,y)                patrolling drone
     B.enemy(type,x,y)               'hunter' | 'seeker' | 'skitter' | 'spitter' (on floor or hanging from ceiling)
     B.terminal(x,y,{time,waves})    work station; waves: [progress 0..1, ...enemy types]
     B.goal(x,y)                     transmitter mast (locked until every terminal is done)
     B.prop(type,{...})              decoration only
   Composed levels give sgen (side, see sections.js) or gen (top-down, see rooms.js) instead of build/map; a hybrid
   keeps a hand-built set piece in extra(B, endX).
   All coordinates are tiles (16 world units). Sections below reuse geometry measured from level 1,
   so every gap and climb is known to be passable with the swing physics. */
(() => {
// g = ground surface row (ground tiles fill g .. H-1)
const M = {
  // pit x..x+4, girder above it
  girderGap(B,x,g){ B.girder(x-6,x+9,g-7); },
  // two girders up and over a steel pillar that blocks the ground
  climbOver(B,x,g){ B.girder(x,x+5,g-4); B.girder(x+6,x+11,g-10); B.steel(x+12,x+16,g-10,g-1); },
  // ceiling slab to swing from; pit x+5..x+16
  ceilingSwing(B,x,g){ B.steel(x,x+24,g-13,g-12); },
  // girder bridge over a live cable at x+7..x+9
  cableHazard(B,x,g){ B.girder(x,x+11,g-7); B.sparks(x+7,x+9,g-1); },
  // girder staircase up to a deck at g-19 that runs to deckEnd
  towerClimb(B,x,g,deckEnd){ B.girder(x+2,x+8,g-5); B.girder(x+6,x+12,g-10); B.girder(x,x+8,g-15); B.girder(x+6,deckEnd,g-19); },
  // one long ceiling over a wide pit x+5..x+4+len: swing, let go, fire again, repeat
  ceilingRun(B,x,g,len){ B.steel(x,x+len+10,g-13,g-12); },
  // n short girders hanging over a pit that starts at x+5; ground resumes at x+18+8*(n-1).
  // Spacing measured with the test bot: first girder 7 tiles past the edge, then one every 8.
  anchorRun(B,x,g,n){ for(let i=0;i<n;i++){ const c=x+11+8*i; B.girder(c-2,c+1,g-12); } },
};

// a builder whose x coordinates are offset by dx, so a hand-built set piece can sit at the end of a composed run
const shiftB=(B,dx)=>({ W:B.W,H:B.H,
  steel:(x0,x1,y0,y1)=>B.steel(x0+dx,x1+dx,y0,y1), rock:(x0,x1,y0,y1)=>B.rock(x0+dx,x1+dx,y0,y1), air:(x0,x1,y0,y1)=>B.air(x0+dx,x1+dx,y0,y1),
  girder:(x0,x1,y)=>B.girder(x0+dx,x1+dx,y), sparks:(x0,x1,y)=>B.sparks(x0+dx,x1+dx,y), crumble:(x0,x1,y)=>B.crumble(x0+dx,x1+dx,y),
  start:(x,y)=>B.start(x+dx,y), check:(x,y)=>B.check(x+dx,y), relay:(x,y)=>B.relay(x+dx,y), goal:(x,y)=>B.goal(x+dx,y), hat:(x,y)=>B.hat(x+dx,y), crack:(x,y,r)=>B.crack(x+dx,y,r),
  drone:(x0,x1,y)=>B.drone(x0+dx,x1+dx,y), enemy:(t,x,y)=>B.enemy(t,x+dx,y), terminal:(x,y,c)=>B.terminal(x+dx,y,c),
  platform:(x0,y0,x1,y1,w,o)=>B.platform(x0+dx,y0,x1+dx,y1,w,o), zip:(x0,y0,x1,y1)=>B.zip(x0+dx,y0,x1+dx,y1),
  anchor:(x,rows)=>B.anchor(x+dx,rows), core:(x,y,gens)=>B.core(x+dx,y,gens.map(([gx,gy])=>[gx+dx,gy])),
  prop:(t,o)=>{ const q=Object.assign({},o); for(const k of ['x','x0','x1']) if(q[k]!=null) q[k]+=dx; B.prop(t,q); } });

const LEVELS = [
// ------------------------------------------------------------------ 1
{
  act:1, hot:true, name:'Kestrel Ridge', par:40, place:'Transmitter KRX-7 · 02:40', theme:'ridge', W:96, H:28,
  brief:"The ridge is dark. One jack over the shack is still live. Hook it and the cable carries the carrier: swing it across the gap, plug the tap on the far side, and the towers answer. Let go at speed and a hot cable throws a cue. Bring what's left up to the mast.",
  outro:"The ridge just came back, every tower you can see. Those drones weren't ours, and they were eating the carrier on purpose.",
  report:"KRX-7 back on air. Dispatch says the drones came off a transport that put down in Harrow quarry two nights ago. Nobody at the ministry is returning calls.",
  build(B){
    const g=22;
    // the opening swing: same proportions as a ceiling swing the test bot already clears
    B.rock(2,6,g,27); B.rock(19,94,g,27);
    B.steel(2,26,g-13,g-12);
    // both rows: the hook bites the underside, and a steep shot can clip the course above it
    for(let i=4;i<=20;i++){ B.jack(i,g-13,'live'); B.jack(i,g-12,'live'); }
    B.jack(20,g-1,'tap');
    B.relay(13,g+1); B.relay(16,g-4); B.relay(24,g-1); B.relay(52,g-6); B.relay(64,g-16);
    B.prop('chains',{x:10,row:g-11,len:36}); B.prop('chains',{x:16,row:g-11,len:50});
    B.prop('cabin',{x:3.4,row:g-1}); B.prop('antenna',{x:23,row:g-1}); B.prop('sign',{x:5,row:g-1});
    B.start(3,g-1); B.check(22,g-1);
    B.drone(30,40,g-1);
    B.steel(41,43,g-7,g-6); B.crack(42,g-6,false); B.page(42,g-7);
    B.girder(46,52,g-5); for(let i=46;i<=52;i++) B.jack(i,g-5,'live');
    B.girder(50,56,g-10); B.girder(44,82,g-15);
    B.jack(66,g-16,'mast'); B.goal(74,g-16); B.check(52,g-16);
    B.prop('tower',{x0:43.4,x1:58.6,top:g-15,row:g-1}); B.prop('dish',{x:74,row:g-16});
    B.prop('pylon',{x:30,top:g-14,row:g-1}); B.prop('cone',{x:28.4,row:g-1});
  },
  hints:[
    [0,  "That ceiling jack is <b>LIVE</b>. Hold <b>GRAB</b> and walk off the edge. You can't jump. The cable carries the carrier."],
    [10, "Let go at the top. A hot cable throws a <b>cue</b> that snatches relays and staggers drones."],
    [19, "Walk into the <b>tap</b> before the feed dumps. Solid ground shorts it. Girders hold it. The towers answer when you plug in."],
    [28, "<b>▼ + GRAB</b> punches straight ahead. One drone. Knock it out of the air."],
    [44, "The page is in the cracked pocket. <b>▲ + GRAB</b> opens it. Then fire up at the girder, hold <b>▲</b> and reel in. Hooking that girder puts the carrier back on the cable."],
    [60, "The mast takes a hot feed. Walk it home."]
  ]
},
// ------------------------------------------------------------------ 2
{
  act:1, hot:true, name:'Harrow Quarry', par:85, place:'Relay HQ-2 · 21:15', theme:'quarry',
  sgen:{pages:2,seed:2,tier:1,g:38,script:['patchSwing','dip','drones','flat','towerDeck']},
  brief:"Relay HQ-2 in the old quarry went dark at the same minute as Kestrel. One hot swing across the pit, then the hollow under the rock. The night crew radioed about “something” on the quarry floor, then stopped answering.",
  outro:"Those weren't animals. Head office says keep it quiet. Head office is wrong.",
  report:"Quarry relay rerouted. The drones talk on a signal nobody at the station recognises: it rides on top of our own carrier. The interference team says it isn't terrestrial.",

},
// ------------------------------------------------------------------ 3
{
  act:1, hot:true, name:'Blackwater Dam', par:105, place:'Emergency antenna BW-1 · 23:50', theme:'dam',
  sgen:{seed:3,tier:2,g:38,script:['cableHazard','ferry','twoTier','nest','towerDeck']},
  brief:"The dam antenna carries every emergency channel in the valley. Live cable on the spillway, then the ferry. Something is feeding on the terminal from the inside. Ride across and take it back.",
  outro:"Emergency channels restored. There were lights over the mountains all night, and they're moving toward the city.",
  report:"Dam line restored. We overheard a government channel discussing a 'contained incident' on the coast. They knew something was coming before it came.",

},
// ------------------------------------------------------------------ 4
{
  act:1, hot:true, name:'Meridian Rooftops', par:95, place:'City relay grid · 01:05', theme:'city',
  sgen:{seed:4,tier:2,g:38,steel:true,script:['crumbleBridge','slabTunnel','anchorRun','climbOver','towerDeck']},
  brief:"There's a ship over Meridian City. The rooftop grid is coming apart: a bridge that crumbles if you hesitate, a tunnel or the roof, then a run of separate anchors. One terminal up top. Don't stop.",
  outro:"Meridian's grid is ours again. One link is left: the Skyline Uplink can reach the whole coast.",
  report:"Rooftop mesh is up. Two of the drones were carrying hull plating with markings nobody can read: dense, light, takes a beating. Engineering wants more of it for a shield rig.",

},
// ------------------------------------------------------------------ 5
{
  act:1, hot:true, name:'Skyline Uplink', par:160, place:'Coastal uplink SK-1 · 03:33', theme:'uplink',
  sgen:{seed:5,tier:2,g:38,terminals:2,steel:true,script:['patchSwing','ceilingRun','liftUp','towerDeck','dropDown','nest','towerDeck']},
  brief:"This is it. Carry the carrier across one long ceiling, ride the lift, and reroute both uplink terminals. The warning goes out to every radio, phone and screen on the coast. They know it too.",
  outro:"",
  report:"Uplink live. We saw the ship: hanging over the coast, dark, jamming everything for sixty miles. The ministry has ordered a blackout on the footage. They had a file on this before it arrived.",
  actEnd:{title:'WARNING BROADCAST',text:"Every radio, phone and screen on the coast just heard the warning. The roads are filling, the shelters are opening, and the ship over Meridian has stopped moving. You kept the lines open."},

},
// ================================================================== ACT 2 · INTERFERENCE
// ------------------------------------------------------------------ 6
{
  act:2, hot:true, name:'Pylon Run', par:95, place:'Northern trunk line · 22:10', theme:'storm',
  sgen:{seed:6,tier:2,g:38,script:['ceilingRun','crumbleBridge','anchorRun','nest','cableHazard','towerDeck']},
  brief:"The warning got out, and they noticed. One long ceiling, a bridge that dies behind you, then the pylons. Storm cells are dropping the trunk line. Keep it alive.",
  outro:"The line is holding. But the junk wrapped round the pylons wasn't storm damage. It was growing.",
  report:"Pylon line rerouted. The things on the pylons aren't drones. They're alive, and they're hunting the signal. Keep them at arm's length; punches work.",

},
// ------------------------------------------------------------------ 7 (top-down)
{
  act:2, mode:'top', name:'Substation 9', par:70, place:'Substation 9 · 23:40', theme:'station',
  brief:"Something has moved into Substation 9 and sealed it from the inside. The doors run on pressure plates and old levers. Get in, reroute the switching terminal, and get out through the service hatch.",
  outro:"Switching restored. The things in there were nesting between the transformers.",
  report:"Substation switching back. There was a terminal in there running the ship's own code. The night-shift cryptographer thinks she can turn their jamming against them one day.",
  gen:{cols:3,rows:3,seed:7,need:1,mainLen:5,secret:0.4,types:['plateCrate','leverGate','postPit','den'],time:10}

},
// ------------------------------------------------------------------ 8
{
  act:2, hot:true, name:'Floodgate', par:120, place:'Carrow Dam spillway · 02:05', theme:'flood',
  sgen:{seed:8,tier:2,g:38,script:['ferry','dropDown','liftUp','gap','nest','towerDeck']},
  brief:"They opened the floodgates to drown the valley relays. This stretch is rides: ferry down, lift back up, one gap. Take the dam terminal back.",
  outro:"Gates shut, relays dry. Whatever opened them knew exactly which valve to turn.",
  report:"Spillway relay secured. The ship is dropping pods into the valley. Someone upstairs is calling it a weather event.",

},
// ------------------------------------------------------------------ 9
{
  act:2, hot:true, name:'Freight Yard', par:195, place:'Harlow freight yard · 04:30', theme:'yard',
  sgen:{seed:9,tier:2,g:38,terminals:2,script:['liftUp','ferry','anchorRun','towerDeck','crumbleBridge','drones','towerDeck']},
  brief:"The freight yard's crane lines carry the backbone for three cities, and the ship is hovering right over them. A lift, a ferry, a run of anchors, then two terminals. Don't stop moving.",
  outro:"Both yard terminals rerouted. Before it pulled back, the ship dropped something into the hills. Something big.",
  report:"Freight yard live. A wagon in there was packed with alien plating. The first shield plates are on their way to the workshop; a rig that soaks one hit is weeks out, not months.",

},
// ------------------------------------------------------------------ 10 (top-down)
{
  act:2, mode:'top', name:'The Hive Relay', par:180, place:'Relay Vault 7 · 05:55', theme:'hive',
  brief:"Whatever they dropped burrowed straight into Relay Vault 7 and grew a hive around it. Every signal in the region routes through that vault. Go in, reroute both terminals, and get back out.",
  outro:"",
  report:"Vault 7 rerouted. The hive had grown around our own relay: they use our network to find the rest of it. Expect them to dig.",
  gen:{cols:5,rows:3,pages:2,seed:10,terminals:2,need:[1,2],mainLen:9,secret:0.6,tier:2,hold:3.0,loops:2,
       types:['plateCrate','leverGate','heavyPair','postPit','cagedFuse','den','timedPlate','sokoban'],
       terms:[{time:14,waves:[[0.1,'skitter','skitter'],[0.45,'leech','seeker'],[0.75,'skitter','skitter','leech']]},
              {time:16,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech','skitter'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','leech','skitter']]}]}
},

// ================================================================== ACT 3 · UNDERTOW
// ------------------------------------------------------------------ 11
{
  act:3, name:'Quarry Descent', par:240, place:'Harrow deep pit · 20:30', theme:'pit', fallDamage:true,
  brief:"The ship dropped a drill into Harrow's old deep pit, and the relay at the bottom is the only line left into the valley. Get down there, follow the pit floor east, and don't just jump: the drops are long enough to hurt now.",
  outro:"The valley line is back. Something at the bottom of that pit was drilling towards the pumping station.",
  report:"Pit relay up. The drill at the bottom is theirs, and it cuts steel like paper. Salvage a cutter from one of those and no sealed plate will stop a rigger again.",
  sgen:{seed:11,x0:149,g:56,tier:3,noStart:true,terminals:1,termBase:1,extraFirst:true,extraW:150,extraH:64,maxG:56,
        script:['gap','nest','cableHazard','groundDeck','flat']},
  // the hand-built descent; the composed pit floor runs east from x=149
  extra(B){
    B.rock(1,30,7,11);                    // top ledge
    B.steel(27,44,2,3);                   // beam over the first shaft: hook it and lower yourself
    B.rock(1,70,22,26);                   // second ledge
    B.platform(71,22,71,40,4,{speed:34}); // lift down to the third ledge
    B.rock(75,110,40,44);                 // third ledge
    B.girder(104,118,36);                 // girder over the second shaft
    B.rock(106,148,56,63);                // the bottom
    B.start(3,6); B.check(36,21); B.check(77,39); B.check(114,55);
    [[12,6],[33,15],[45,21],[62,21],[100,39],[113,46],[124,55],[140,55]].forEach(r=>B.relay(...r));
    B.drone(40,52,21); B.enemy('spitter',64,21); B.enemy('skitter',90,39); B.enemy('seeker',96,34);
    B.enemy('skitter',120,55); B.enemy('spitter',146,55);
    B.terminal(130,55,{time:16,waves:[[0.1,'seeker','hunter'],[0.4,'leech','leech','skitter'],[0.7,'skitter','skitter','seeker']]});
    B.crack(70,23,true); B.hat(69,23); B.steel(108,110,50,51); B.crack(109,51,false); B.hat(109,50);
    B.prop('cabin',{x:4,row:6}); B.prop('sign',{x:26,row:6}); B.prop('chains',{x:30,row:4,len:30}); B.prop('chains',{x:40,row:4,len:50});
    B.prop('drum',{x:50,row:21}); B.prop('crates',{x:8,row:21}); B.prop('cone',{x:70.4,row:21}); B.prop('sign',{x:79,row:39});
    B.prop('drum',{x:96,row:39}); B.prop('chains',{x:108,row:37,len:40}); B.prop('crates',{x:132,row:55}); B.prop('antenna',{x:110,row:55});
  },
  hints:[
    [0,  "Quarry Descent. Long drops hurt now: fall more than about ten tiles and you lose a hard hat."],
    [24, "Hook the beam over the shaft, step off, then hold <b>▼</b> to pay out cable and lower yourself. Let go near the bottom."],
    [66, "Ride the lift down."],
    [102,"Another shaft. Hook the girder, step off and lower yourself."],
    [118,"The pit relay. Reroute it."],
    [150,"The pit floor runs east: a gap, a nest, live cable, then the ground terminal."]
  ]
},

// ------------------------------------------------------------------ 12 (top-down)
{
  act:3, mode:'top', name:'Cable Tunnels', par:155, place:'Harrow cable tunnels · 22:15', theme:'station',
  brief:"The drill broke into the old cable tunnels under the valley. The doors down here are on timers and the belts still run. Reroute the junction terminal and find the way out.",
  outro:"Junction rerouted. The tunnels lead straight to the pumping station, and the water in them is rising.",
  report:"Junction rerouted. The tunnels connect to the pumping station, and the station to the sea. They came up from under us.",
  gen:{cols:5,rows:4,must:['beltCrate','timedPlate'],seed:12,need:3,mainLen:11,secret:0.6,tier:2,hold:2.8,loops:3,
       types:['plateCrate','timedPlate','beltCrate','heavyPair','sokoban','postChain','cagedFuse','den','leverGate'],
       terms:[{time:15,waves:[[0.1,'skitter','skitter'],[0.4,'leech','hunter'],[0.7,'skitter','skitter','leech']]}]}
},

// ------------------------------------------------------------------ 13
{
  act:3, hot:true, name:'Pumping Station', par:160, place:'Valley pumping station · 00:40', theme:'pump',
  flood:{row:73,trigger:4,speed:12,max:14}, floodAt:4,
  brief:"They've jammed the station's pumps open and the whole shaft is flooding. Cross the valley to the station; the control terminal is at the very top of the shaft. Climb, and don't stop. Some of the old walkways give way under you.",
  outro:"Pumps reversed. The water's going down, and far below something huge has started to move.",
  report:"Pumps reversed. Something huge moved under the station on the way out. Sonar lost it heading for the gorge.",
  sgen:{seed:13,g:68,tier:3,terminals:1,noGoal:true,extraW:124,extraH:72,maxG:68,shiftHints:true,
        script:['gap','drones','nest','ceilingSwing','towerDeck']},
  // the hand-built flooding shaft, shifted to the end of the composed valley run
  extra(B,x0){ const S=shiftB(B,x0-1);
    const g=68;
    S.rock(1,40,g,71);
    // stack 1 up to deck 1 (row 49)
    S.girder(14,20,63); S.girder(18,24,58); S.girder(12,20,53);
    S.girder(18,34,49); S.crumble(35,40,49); S.girder(41,56,49);
    // stack 2 up to deck 2 (row 30)
    S.girder(52,58,44); S.crumble(56,62,39); S.girder(50,58,34);
    S.girder(56,69,30); S.crumble(70,75,30); S.girder(76,94,30);
    // stack 3 up to the control deck (row 11)
    S.crumble(90,96,25); S.girder(94,100,20); S.crumble(88,96,15);
    S.girder(94,121,11);
    S.check(20,48); S.check(58,29); S.check(97,10);
    [[10,67],[22,57],[38,47],[60,38],[73,28],[92,24],[98,19],[112,10]].forEach(r=>S.relay(...r));
    S.drone(25,33,48); S.enemy('seeker',46,40); S.enemy('skitter',84,29); S.enemy('spitter',78,29); S.enemy('seeker',92,17);
    S.terminal(106,10,{time:15,waves:[[0.1,'hunter','hunter'],[0.35,'leech','seeker'],[0.6,'skitter','skitter','leech'],[0.85,'seeker','seeker']]});
    S.goal(118,10); S.steel(30,32,62,63); S.crack(31,63,false); S.hat(31,62); S.steel(80,82,24,25); S.crack(81,25,false); S.hat(81,24);
    S.prop('crates',{x:28,row:67}); S.prop('tank',{x:36,row:67}); S.prop('vent',{x:8,row:67});
    S.prop('tower',{x0:11.4,x1:25.6,top:49,row:67}); S.prop('tower',{x0:49.4,x1:63.6,top:30,row:48}); S.prop('tower',{x0:87.4,x1:101.6,top:11,row:29});
    S.prop('antenna',{x:120,row:10});
  },
  hints:[
    [0,  "Pumping Station. The water is coming up behind you. Climb!"],
    [30, "Cracked walkway ahead: it gives way a moment after you land on it. Keep moving."],
    [50, "Up the next stack. Some of these girders crumble too, so fire up again straight away."],
    [86, "Last climb. The control terminal is above the water line."]
  ]
},

// ------------------------------------------------------------------ 14 (top-down)
{
  act:3, mode:'top', name:'The Burrow', par:250, place:'Beneath the station · 02:20', theme:'burrow',
  brief:"Whatever flooded the station came up from here: a burrow full of them, and no lights. Your headlamp is all you've got. Reroute the deep relay, then deal with what's guarding the way out.",
  outro:"",
  report:"Deep relay rerouted and the brood mother is down. In her chamber: a government survey marker, dated years before the invasion. Somebody mapped this place.",
  gen:{cols:5,rows:4,must:['postChain','timedPlate'],seed:14,need:2,boss:true,mainLen:10,secret:0.6,tier:2,hold:2.6,loops:2,
       types:['heavyPair','postChain','sokoban','leverGate','cagedFuse','den','timedPlate','plateCrate'],
       terms:[{time:15,waves:[[0.1,'skitter','skitter'],[0.4,'leech','seeker'],[0.7,'skitter','skitter','leech']]}]}
},

// ------------------------------------------------------------------ 15 (boss)
{
  act:3, name:'Ship Anchor', par:100, place:'Carrow gorge · 04:05', theme:'gorge', W:70, H:40,
  brief:"The ship has dropped a tether into Carrow gorge, a living cable pumping energy up into it. Cut the four clamps holding it down. It will fight back: when a red band lights up across the gorge, get out of it.",
  outro:"",
  report:"Tether cut. The ship is running north along the coast, and it's building towers on the hills: jammers, one for every band we have.",
  actEnd:{title:'TETHER CUT',text:"The tether whipped back into the clouds and the ship lurched away from the coast, trailing sparks. For the first time, it's running. End of Act 3."},
  build(B){
    B.rock(1,68,36,39);
    B.steel(10,60,3,4);                              // a high ceiling to swing from
    // girder decks either side of the tether, one per clamp
    B.girder(22,31,29); B.girder(39,48,29);
    B.girder(22,31,22); B.girder(39,48,22);
    B.girder(22,31,15); B.girder(39,48,15);
    B.girder(26,44,10);                              // high walkway over the tether: the only safe way across
    // side perches to dodge onto
    B.girder(6,13,32); B.girder(57,64,32); B.girder(6,13,25); B.girder(57,64,25); B.girder(6,13,18); B.girder(57,64,18);
    B.anchor(35,[35,28,21,14]);
    B.start(4,35); B.check(64,35); B.crack(25,4,false); B.hat(25,3); B.crack(45,4,false); B.hat(45,3); B.page(60,24);
    [[10,31],[60,31],[10,24],[60,24],[27,14],[43,14]].forEach(r=>B.relay(...r));
    B.prop('sign',{x:3,row:35}); B.prop('crates',{x:14,row:35}); B.prop('drum',{x:52,row:35}); B.prop('cone',{x:66,row:35});
  },
  hints:[
    [0,  "Ship Anchor. Punch the clamps off the tether (▼ + GRAB) from the girders at the same height. Don't touch the tether: cross over the top on the high walkway."],
    [20, "When a red band lights up, get above or below it before it fires."]
  ]
},
// ================================================================== ACT 4 · SIGNAL
// ------------------------------------------------------------------ 16
{
  act:4, hot:true, name:'Storm Front', par:190, place:'Kestrel coast line · 21:00', theme:'storm',
  wind:{period:7,warn:1.3,dur:2.6,force:230},
  brief:"The ship is riding a storm back in. Gusts shove you off a girder, and the shock cell still throws everything back: press PULSE. Gap, ferry, low ceiling, then the tower. Swing between the gusts.",
  outro:"The line held through the storm. Down the coast, the relay array is powering up.",
  report:"Coast line held. The pulse cell works, and the workshop thinks the same tech can fold light. A cloak, if we find a power cell big enough.",
  sgen:{seed:16,tier:3,g:26,terminals:2,maxG:38,
        script:['gap','ferry','lowCeilingPit','anchorRun','towerDeck','crumbleBridge','nest','towerDeck']},
  hints:[
    [0,  "Storm Front. You now carry a shock cell: <b>PULSE</b> knocks back everything near you and burns up plasma, then recharges. Watch for the GUST warning: the wind shoves you sideways."],
    [40, "Swings in a gale: time them between gusts, and stand still on ferries to brace."]
  ]
},

// ------------------------------------------------------------------ 17 (top-down)
{
  act:4, mode:'top', name:'Relay Array', par:195, place:'Coastal relay array · 23:15', theme:'station',
  brief:"The coast's relay array is the one weapon we have: aim it at the ship and it can knock out the shields. The aliens got here first and rigged the array rooms with security beams. Get both control terminals online.",
  outro:"The array is locked on. The ship's shields are flickering.",
  report:"Array online and aimed. Their shields are down for ten minutes, long enough to get onto the hull. Note from the array crew: their beams can't see through their own plating.",
  gen:{cols:6,rows:4,must:['beamHall','beltCrate'],seed:17,terminals:2,need:[1,2],mainLen:13,secret:0.6,tier:3,hold:2.4,loops:3,
       types:['beamHall','sokoban','beltCrate','timedPlate','heavyPair','postChain','cagedFuse','den','leverGate'],
       terms:[{time:15,waves:[[0.1,'skitter','hunter'],[0.45,'leech','leech'],[0.75,'skitter','skitter','seeker']]},
              {time:16,waves:[[0.08,'seeker','seeker'],[0.35,'leech','skitter'],[0.6,'skitter','skitter','leech'],[0.85,'hunter','hunter']]}]}
},

// ------------------------------------------------------------------ 18
{
  act:4, hot:true, name:'Skyhook', par:215, place:'Above the Kestrel hills · 02:45', theme:'sky',
  wind:{period:10,warn:1.3,dur:2,force:140},
  brief:"The array knocked the ship's shields out for a few minutes and it dropped low, trailing its own cable lines over the hills. Ride those lines up into the sky and get onto the hull before it recovers.",
  outro:"You're on the hull. There's a hatch, and it isn't locked.",
  report:"Hull reached. From the deck we counted the fleet: eleven ships in the clouds, and one far bigger behind the moon. The towers on the hills are its relays.",
  sgen:{seed:18,tier:3,g:30,steel:true,terminals:2,maxG:54,
        script:['zipDown','liftUp','zipDown','anchorRun','towerDeck','ferry','towerDeck']},
  hints:[
    [0,  "Skyhook. The ship's cable lines trail down over the hills: ride them. Lifts take you back up. Watch the gusts."]
  ]
},

// ------------------------------------------------------------------ 19 (top-down)
{
  act:4, mode:'top', name:'Hull Breach', par:230, place:'Inside the mothership · 03:30', theme:'ship',
  brief:"You're inside. The ship's rooms are sealed and connected only by teleport pads, and most of the lights are out. Reroute the ship's own relays to broadcast our signal, and the core will be wide open.",
  outro:"The ship's own relays are broadcasting our signal. The core is exposed.",
  report:"Ship relays rerouted. Their jammers are a network, like ours. Knock out the towers and the whole fleet goes blind.",
  gen:{cols:6,rows:4,must:['teleCrate','beamHall'],seed:19,terminals:2,need:[1,2],mainLen:14,secret:0.7,tier:3,hold:2.2,loops:3,
       types:['teleCrate','beamHall','sokoban','beltCrate','timedPlate','postChain','cagedFuse','den','heavyPair'],
       terms:[{time:15,waves:[[0.1,'skitter','seeker'],[0.4,'leech','leech'],[0.7,'skitter','skitter','seeker']]},
              {time:17,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech','skitter'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','hunter','hunter']]}]}
},

// ------------------------------------------------------------------ 20 (final boss)
{
  act:4, name:'Heart of the Ship', par:695, place:'The mothership core', theme:'core', W:72, H:44,
  brief:"The core. Four generators keep its shield up: destroy them, then destroy it. When a red band lights up, it can come across the chamber or straight down it. Move.",
  outro:"",
  report:"Core destroyed. This ship is down, but the towers on the hills are still humming and the fleet is coming. Next stop: the jammers.",
  actEnd:{title:'SIGNAL CLEAR',text:"The core burst and the mothership fell out of the sky into the sea off Kestrel Ridge. Every tower you climbed is still standing, and every channel on the coast is carrying the same message: it's over. Thanks for playing Relay Rigger."},
  build(B){
    B.steel(1,70,40,43); B.steel(6,66,2,3);
    B.girder(6,14,34); B.girder(57,65,34); B.girder(2,7,26); B.girder(64,69,26); B.girder(18,24,30); B.girder(47,53,30); B.girder(14,22,21); B.girder(49,57,21); B.girder(31,41,28);
    B.girder(8,26,12); B.girder(46,64,12);
    B.platform(27,40,27,12,4,{speed:40}); B.platform(42,40,42,12,4,{speed:40,phase:1});
    B.core(36,19,[[10,33],[61,33],[18,20],[53,20]]);
    B.start(4,39); B.check(68,39); B.page(5,25); B.steel(10,12,28,29); B.crack(11,29,false); B.hat(11,28); B.steel(60,62,28,29); B.crack(61,29,false); B.hat(61,28);
    [[7,33],[64,33],[20,20],[51,20],[36,27],[15,11]].forEach(r=>B.relay(...r));
  },
  hints:[
    [0,  "The core. Its shield holds while any generator stands: punch the four generators on the girders. When the hunters crowd you, <b>PULSE</b>."],
    [30, "Climb from the low girders to the high ones, or ride the lifts. Red bands can come down the chamber too."]
  ]
},
// ================================================================== ACT 5 · JAMMERS
// ------------------------------------------------------------------ 21
{
  act:5, hot:true, name:'Static Hill', place:'Kestrel hills, north slope · 06:10', theme:'jammer',
  par:95,
  brief:"The first jammer tower stands on the hill above the ridge, and its static hangs over the slopes in sheets: your cable won't bite inside the haze. Get up the hill, reroute the relay in the tower's shadow, and learn how the static behaves.",
  outro:"Relay back. The haze is thinner on the north face: that's the way into the tower.",
  report:"North slope relay up. The static is a field, not a weapon: it only stops cable and radio. Engineering says the shield plates shrug it off entirely, and they've finished a rig. It went up the hill ahead of you; it's somewhere on the ladder.",
  sgen:{seed:21,tier:3,g:38,maxG:50,terminals:1,
        script:['staticLeap','releaseGate','slabTunnel','drones','patchSwing','towerDeck']},
  hints:[[0,"Static Hill. The purple haze is jammer static: nothing to hook inside it. Swing in, let go, and fly through."]]
},
// ------------------------------------------------------------------ 22
{
  act:5, mode:'top', name:'Jammer Yard', place:'Jammer tower, control yard · 07:40', theme:'jamroom',
  par:175,
  brief:"The tower's control rooms are dug into the hill. They've laid static across the pits so nothing can be pulled over them, and the switches that drop the fields are never on the side you need them. Reroute the yard terminal and find the stairs up.",
  outro:"Yard terminal rerouted. The static fields all run off one bus, and the bus runs to the tower.",
  report:"Yard rerouted. Each field has a cutout plate: weight on the plate, field off. Their engineers built in a safety switch for themselves, and left it where anyone can push a crate onto it. Keep that in mind inside the ships.",
  gen:{cols:5,rows:4,seed:22,need:3,mainLen:11,secret:0.6,tier:3,hold:2.2,loops:3,must:['staticPosts','beamHall'],
       types:['staticPosts','beamHall','sokoban','timedPlate','beltCrate','heavyPair','postChain','cagedFuse','den','leverGate'],
       terms:[{time:16,waves:[[0.1,'skitter','seeker'],[0.4,'leech','leech','hunter'],[0.7,'skitter','skitter','seeker']]}]}
},
// ------------------------------------------------------------------ 23
{
  act:5, hot:true, name:'Pylon Ladder', place:'Jammer tower, the climb · 09:15', theme:'jammer',
  par:115,
  brief:"The tower is a hundred rows of pylon and ladder, and the only way is up: shaft after shaft, lift after lift. The shield rig the workshop sent up is somewhere on the way. The relay deck is near the top.",
  outro:"Deck rerouted, and the rig fits. The next hit is on the plating, not on you.",
  report:"Shield rig recovered and fitted: it soaks one hit, then takes eight seconds to recharge. Don't lean on it. From the deck we could see the second tower on the far ridge, and the trolley line the aliens strung between them.",
  sgen:{seed:23,tier:3,g:110,maxG:122,terminals:1,
        script:['shaftUp','liftUp','shaftTall','kitLedge','shaftUp','towerDeck']},
  hints:[[0,"Pylon Ladder. Up, and up. Rest on the ledges; the terminal is near the top."]]
},
// ------------------------------------------------------------------ 24
{
  act:5, hot:true, name:'Trolley Line', place:'Between the towers · 11:30', theme:'jammer',
  par:195,
  brief:"They strung a cable trolley between the two towers to carry their equipment. It still runs. Hook a trolley as it passes, hang on, and let go over the next ridge; some of the anchors on this stretch give way the moment you hook them.",
  outro:"Across the valley. The second tower is bigger, and it's humming.",
  report:"Trolley line crossed. The anchors that crack when hooked are a defence, not decay: they are tuned to our cable. Expect more of them on the ships. The second tower's mast carries five clamps, like the tether did.",
  sgen:{seed:24,tier:3,g:38,maxG:50,terminals:2,
        script:['trolleyRun','anchorChain','staticLeap','towerDeck','releaseGate','flat','towerDeck']},
  hints:[[0,"Trolley Line. The trolleys run overhead: hook one from below and ride it."]]
},
// ------------------------------------------------------------------ 25 (boss)
{
  act:5, name:'Jammer One', par:55, place:'Second tower, the mast · 13:00', theme:'jammer', W:84, H:46,
  brief:"The jammer mast is held by five clamps, and the tower fires bands of charge across the decks whenever you get close. Static blankets some of the perches you'd dodge onto. Cut every clamp and the tower goes quiet.",
  outro:"",
  actEnd:null,
  report:"First jammer down. Half the coast's channels came back the moment the mast fell. The fleet noticed: scout ships are peeling off and coming down over the hills.",
  build(B){
    B.rock(1,82,42,45); B.steel(12,72,3,4);
    B.girder(28,38,35); B.girder(46,56,35); B.girder(28,38,28); B.girder(46,56,28); B.girder(28,38,21); B.girder(46,56,21); B.girder(28,38,14); B.girder(46,56,14);
    B.girder(30,54,9);
    B.girder(6,15,38); B.girder(69,78,38); B.girder(6,15,31); B.girder(69,78,31); B.girder(6,15,24); B.girder(69,78,24); B.girder(6,15,17); B.girder(69,78,17);
    B.static(60,80,19,33); B.static(2,22,10,20);
    B.anchor(42,[41,34,27,20,13]);
    B.start(4,41); B.check(78,41); B.crack(30,4,false); B.hat(30,3); B.crack(54,4,false); B.hat(54,3); B.page(10,37);
    [[10,30],[74,37],[10,23],[74,23],[32,13],[52,13],[42,8]].forEach(r=>B.relay(...r));
    B.drone(30,36,20); B.drone(48,55,13);
    B.prop('sign',{x:3,row:41}); B.prop('crates',{x:20,row:41}); B.prop('drum',{x:60,row:41}); B.prop('antenna',{x:42,row:8});
  },
  hints:[
    [0,"Jammer One. Punch the clamps off the mast (▼ + GRAB) from the decks at their height. The static over the perches means you can't hook into them: pick your dodge side."],
    [24,"When a band lights up, get above or below it. The high walkway crosses over the mast."]
  ]
},
// ------------------------------------------------------------------ 26
{
  act:5, mode:'top', name:'Dead Air', place:'Second tower, lower levels · 15:20', theme:'jamroom',
  par:215,
  brief:"Below the mast the tower is dark and sealed, every room reached by pad or beam lane, and the static fields are wired to the terminals themselves. Two terminals to reroute, and they've hidden the parts well.",
  outro:"Both terminals rerouted. The tower's own logs mention a landing zone on the coast road.",
  report:"Dead air cleared. In the terminal logs: the scouts land where the towers' coverage overlaps, so with both towers down they will land blind. Also in the logs, a HALYARD access code. Somebody has been logging in.",
  gen:{cols:6,rows:4,seed:26,terminals:2,need:[1,2],mainLen:13,secret:0.7,tier:3,hold:2.0,loops:3,must:['staticPosts','teleCrate'],
       types:['staticPosts','teleCrate','beamHall','sokoban','timedPlate','postChain','cagedFuse','den','heavyPair','beltCrate'],
       terms:[{time:15,waves:[[0.1,'skitter','seeker'],[0.4,'leech','leech'],[0.7,'skitter','skitter','seeker']]},
              {time:17,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech','skitter'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','hunter','hunter']]}]}
},
// ------------------------------------------------------------------ 27
{
  act:5, hot:true, name:'Ridge Run', place:'Kestrel ridge road · 17:45', theme:'jammer', wind:{period:9,warn:1.3,dur:2,force:150},
  par:220,
  brief:"The ridge road runs the whole length of the hills, and they've thrown everything at it: cracking anchors, static, gates, a trolley, and a wind off the sea. Two relays to reroute on the way. Nothing on this road happens twice.",
  outro:"Ridge road clear. From here the second tower's shadow reaches the coast.",
  report:"Ridge relays rerouted. We tested the shield in the static: it holds. The workshop has started on the cloak; the cell they need is the kind the scout ships run on. Bring one back if you can.",
  sgen:{seed:27,tier:3,g:38,maxG:62,terminals:2,
        script:['anchorChain','staticLeap','releaseGate','trolleyRun','towerDeck','lowCeilingPit','zipDown','towerDeck']},
  hints:[[0,"Ridge Run. Everything at once, and a wind. Time your swings between gusts."]]
},
// ------------------------------------------------------------------ 28
{
  act:5, mode:'top', name:'Relay Graveyard', place:'Under the second tower · 20:05', theme:'hive',
  par:180,
  brief:"They dumped every relay they tore out of the coast under the second tower, and a hive has grown over the pile. Something is nesting in it. Find the parts, reroute the terminal, and deal with what's guarding the stairs.",
  outro:"The nest is cleared and the terminal's ours. The stairs go up the mast.",
  report:"Graveyard relay rerouted, brood mother down. Among the dumped relays: twenty of ours, and one that isn't. It carries a HALYARD serial plate. The ministry built relays for them.",
  gen:{cols:6,rows:4,seed:28,need:3,boss:true,mainLen:12,secret:0.6,tier:3,hold:2.0,loops:3,must:['staticPosts','sokoban'],
       types:['staticPosts','sokoban','heavyPair','postChain','leverGate','cagedFuse','den','timedPlate','plateCrate','beltCrate'],
       terms:[{time:16,waves:[[0.1,'skitter','skitter'],[0.4,'leech','seeker'],[0.7,'skitter','skitter','leech']]}]}
},
// ------------------------------------------------------------------ 29
{
  act:5, hot:true, name:'Mast Approach', place:'Second tower, the mast climb · 22:30', theme:'jammer', wind:{period:8,warn:1.3,dur:2.2,force:170},
  par:120,
  brief:"The second mast is taller, and the wind up here is worse. Cracking anchors, lifts, and a long way down. The relay deck is at the very top, under the dish.",
  outro:"Top deck rerouted. The dish is right there.",
  report:"Mast deck rerouted. The dish is aimed at the sea, not at us: it was talking to the fleet. Cut it and the fleet loses its eyes on the coast. Whatever lands after that lands blind.",
  sgen:{seed:29,tier:3,g:120,maxG:132,terminals:1,
        script:['shaftTall','anchorChain','liftUp','shaftUp','towerDeck']},
  hints:[[0,"Mast Approach. The anchors up here crack when hooked, and the gusts are worse. Climb between them."]]
},
// ------------------------------------------------------------------ 30 (boss)
{
  act:5, name:'Jammer Prime', par:385, place:'Second tower, the dish · 23:50', theme:'jammer', W:76, H:46,
  brief:"The dish is powered by four generators on the mast girders and shielded by all four. Static hangs under the dish so nothing can be hooked from below. Climb, break the generators, then bring the dish down from the high girders.",
  outro:"",
  actEnd:{title:'JAMMERS DOWN',text:"The dish fell through the deck and the hum that had sat over the coast for a week stopped all at once. Every channel is open. Out at sea the scout ships are coming down anyway, blind and in a hurry. End of Act 5."},
  report:"Both jammers down. The fleet has lost the coast, and the scouts are landing wherever they can: the first is on the beach road. Their ships run on the cells the workshop wants for the cloak. Board one.",
  build(B){
    B.steel(1,74,40,43); B.steel(6,70,2,3);
    B.girder(6,14,34); B.girder(57,67,34); B.girder(2,7,26); B.girder(68,73,26); B.girder(18,24,30); B.girder(49,55,30); B.girder(14,22,21); B.girder(51,59,21); B.girder(33,43,28);
    B.girder(8,26,12); B.girder(48,66,12);
    B.platform(29,40,29,12,4,{speed:40}); B.platform(44,40,44,12,4,{speed:40,phase:1});
    B.static(26,50,22,27);
    B.core(38,19,[[10,33],[61,33],[18,20],[53,20]]);
    B.start(4,39); B.check(70,39); B.page(10,11); B.steel(10,12,28,29); B.crack(11,29,false); B.hat(11,28); B.steel(62,64,28,29); B.crack(63,29,false); B.hat(63,28);
    [[7,33],[64,33],[20,20],[51,20],[38,27],[15,11],[60,11]].forEach(r=>B.relay(...r));
    B.prop('dish',{x:38,row:11}); B.prop('antenna',{x:12,row:11});
  },
  hints:[
    [0,"Jammer Prime. Four generators guard the dish. Climb the girders and punch each one, then the dish itself from the high girders. The haze under the dish won't take a hook."],
    [20,"When a band lights up, step out of its line. Vertical bands: sidestep. Horizontal bands: climb."]
  ]
},

];

// the cover-up dossier: one page hidden per level (two in a couple of them), collected in any order, kept across runs
window.RR_PAGES=[
  {lv:1,title:"KRX-7 maintenance log, torn out",text:"'Ministry inspection, 14 months ago. They asked about the tower's bearing to the coast. Not about the tower.'"},
  {lv:2,title:"Quarry haulage ticket",text:"A sealed container delivered to the pit floor. Consignee: Ministry of Signals, Project HALYARD."},
  {lv:2,title:"Photograph, overexposed",text:"A dark hull in the clouds. Pencilled on the back: 'Not the first one. R.'"},
  {lv:3,title:"Dam engineer's memo",text:"'Told to log the tremors as turbine resonance. They are not turbine resonance.'"},
  {lv:4,title:"Rooftop lease, Meridian block",text:"Paid from a numbered ministry account for 'antenna trials'. The antenna was never ours."},
  {lv:5,title:"HALYARD briefing fragment",text:"'Signature first recorded 9 yrs ago. Public disclosure NOT RECOMMENDED. Monitor the coast.'"},
  {lv:6,title:"Pylon inspection sheet",text:"Every box ticked OK. Stapled behind it: a photo of the same pylon with something nesting in it."},
  {lv:7,title:"Substation shift log",text:"'Men in grey suits took the switching records. Said they were ministry. Didn't show ID.'"},
  {lv:8,title:"Weather service draft, unpublished",text:"'The valley event is not meteorological. Recommend evacuation.' Stamped WITHHELD."},
  {lv:9,title:"Freight manifest",text:"'Alien plating, 4 tonnes, destination REDACTED.' Somebody has been collecting it for longer than we have been fighting."},
  {lv:10,title:"Vault 7 access list",text:"The last visitor before the hive: a HALYARD badge, two weeks before the first drone."},
  {lv:10,title:"Lab note, Vault 7",text:"'The hive routes signal through our relays by design. They learned our network from someone.'"},
  {lv:11,title:"Drill telemetry printout",text:"Alien glyphs down one side, ministry letterhead down the other."},
  {lv:12,title:"Tunnel survey, seven years old",text:"The burrow shafts are already drawn in, labelled 'anomalous voids. Do not disclose.'"},
  {lv:13,title:"Pumping station work order",text:"'Keep the sump open on request from HALYARD.' Signed the night the station flooded."},
  {lv:14,title:"Survey marker tag, brood chamber",text:"'HALYARD site 3, mapped. Specimen contained.' It was not contained."},
  {lv:15,title:"Gorge clearance notice",text:"Residents moved out 'for landslide works'. The tether came down a week later."},
  {lv:16,title:"Coastguard log",text:"'Towers going up on the hills overnight. Told to stand down by the ministry.'"},
  {lv:17,title:"Array schematic, second sheet",text:"A mode nobody told us about: it turns the array into a jammer of its own."},
  {lv:18,title:"HALYARD memo",text:"'The fleet will arrive regardless. Objective: be first to the Mothership's core.' They wanted it, not us."},
  {lv:19,title:"Lanyard, alien console",text:"A ministry badge, clipped to their equipment. Somebody from HALYARD was here before us."},
  {lv:20,title:"Signed order",text:"'Let the jammers stand until the fleet lands. Then we take the core.' Secretary, Project HALYARD."},
  {lv:21,title:"Hill lease",text:"The north slope was sold to a ministry holding company a month before the towers went up. The seller: HALYARD."},
  {lv:22,title:"Control yard manifest",text:"Crates of static emitters, delivered by road. Our road. Signed for by a ministry driver."},
  {lv:23,title:"Workshop note, stapled to the rig",text:"'Plating from the freight yard. It stops their static cold. Don't tell the ministry we have it.'"},
  {lv:24,title:"Trolley line survey",text:"The cable route was surveyed two years ago. By a ministry crew. For 'pylon maintenance'."},
  {lv:25,title:"Mast blueprint",text:"The clamps are a ministry pattern: the same clamps hold up our own transmitters."},
  {lv:26,title:"Access log",text:"HALYARD-7 logged in to the tower's terminals eleven times. The last time was yesterday."},
  {lv:27,title:"Ridge road closure order",text:"'Closed for resurfacing.' The road was never resurfaced. The towers went up while it was closed."},
  {lv:28,title:"Relay serial plate",text:"HALYARD-RELAY-003. The ministry's own factory mark, on a relay built for the hive."},
  {lv:29,title:"Weather memo",text:"'The sea wind will keep the riggers off the mast.' Somebody counted on it."},
  {lv:30,title:"Dish alignment card",text:"Bearing to the fleet, and a second bearing: to the ministry's own tower on the hill above the capital."},
];
window.RR_DOSSIER_END={
  full:"Every page of the dossier is accounted for. The ministry had the ship's signature on file for nine years, its survey crews mapped the burrows, and the jammers went up on land the government cleared. Project HALYARD invited this, and wanted the core for itself. The broadcast goes out with all of it attached.",
  partial:"Most of the dossier is here: enough to prove the ministry knew, not enough to prove who signed. The missing pages are still out there.",
  thin:"The dossier is thin. Whatever the ministry knew stays buried for now. The pages are still out there, if anyone goes back for them."
};
window.RR_LEVELS = LEVELS;
window.RR_ACTS = ['Lights Out','Interference','Undertow','Signal','Jammers'];
})();
