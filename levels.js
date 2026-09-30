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

const LEVELS = [
// ------------------------------------------------------------------ 1
{
  act:1, name:'Kestrel Ridge', place:'Transmitter KRX-7 · 02:40', theme:'ridge', W:140, H:26,
  brief:"Last night's storm knocked seven relay boxes loose and took the Kestrel Ridge transmitter off air. Somebody's drones are crawling all over the tower. Swing up, reroute the network from the deck terminal and get it broadcasting again.",
  outro:"Back on air. But those drones weren't ours — and they were jamming the signal on purpose.",
  build(B){
    B.rock(1,16,22,25); B.rock(22,52,22,25); B.rock(65,138,22,25);
    B.girder(11,26,15); B.girder(28,33,18); B.girder(34,39,12); B.steel(40,44,12,21);
    B.steel(48,72,9,10);
    B.girder(71,82,15); B.sparks(78,80,21);
    B.girder(88,94,17); B.girder(92,98,12); B.girder(86,94,7); B.girder(92,136,3);
    B.start(2,21); B.check(47,21); B.check(87,21); B.check(98,2);
    [[8,21],[30,17],[59,23],[76,14],[96,11],[88,6],[126,2]].forEach(r=>B.relay(...r));
    B.drone(26,36,21); B.drone(66,74,21); B.drone(116,124,2);
    B.terminal(103,2,{time:12,waves:[[0.12,'hunter','hunter'],[0.55,'hunter','hunter','hunter']]});
    B.goal(132,2); B.crack(40,21,false); B.hat(41,21); B.hat(60,8); B.girder(73,75,8);
    B.prop('tower',{x0:85.4,x1:99.6,top:3,row:21});
    B.prop('pylon',{x:110,top:4,row:21}); B.prop('pylon',{x:124,top:4,row:21});
    B.prop('chains',{x:50.5,row:11,len:34}); B.prop('chains',{x:57.5,row:11,len:22}); B.prop('chains',{x:63.5,row:11,len:40}); B.prop('chains',{x:69.5,row:11,len:26});
    B.prop('cabin',{x:3.5,row:21}); B.prop('fence',{x0:22.2,x1:39.8,row:21});
    B.prop('cone',{x:15.4,row:21}); B.prop('cone',{x:52.2,row:21}); B.prop('cone',{x:65.4,row:21});
    B.prop('sign',{x:75.2,row:21}); B.prop('drum',{x:68.5,row:21}); B.prop('crates',{x:99.7,row:21});
  },
  hints:[
    [0,  "Hold <b>GRAB</b> to fire your cable at the girder above. Walk off the edge and swing. You can't jump."],
    [22, "Press <b>▼ + GRAB</b> to punch straight ahead. Knock that drone out of the air."],
    [32, "Press <b>▲ + GRAB</b> to fire straight up, then hold <b>▲</b> to reel in and climb onto the girder."],
    [45, "Hook the ceiling, swing low through the pit, and let go at the top of the arc."],
    [65, "Live cable on the ground ahead. Climb the girder and walk over it."],
    [84, "Climb the tower one girder at a time: fire up, reel in, step over."],
    [95, "Up top. Reroute the terminal, then reach the transmitter mast."]
  ]
},
// ------------------------------------------------------------------ 2
{
  act:1, name:'Harrow Quarry', place:'Relay HQ-2 · 21:15', theme:'quarry',
  sgen:{seed:2,len:380,tier:1,g:26},
  brief:"Relay HQ-2 in the old quarry went dark at the same minute as Kestrel. The night crew radioed about “something” moving on the quarry floor, then stopped answering.",
  outro:"Those weren't animals. Head office says keep it quiet. Head office is wrong.",

},
// ------------------------------------------------------------------ 3
{
  act:1, name:'Blackwater Dam', place:'Emergency antenna BW-1 · 23:50', theme:'dam',
  sgen:{seed:3,len:400,tier:2,g:26,pool:['flat','gap','ceilingSwing','cableHazard','climbOver','drones','ceilingRun','ferry','nest']},
  brief:"The dam antenna carries every emergency channel in the valley. Something is feeding on its terminal from the inside. Get up there and take it back.",
  outro:"Emergency channels restored. There were lights over the mountains all night, and they're moving toward the city.",

},
// ------------------------------------------------------------------ 4
{
  act:1, name:'Meridian Rooftops', place:'City relay grid · 01:05', theme:'city',
  sgen:{seed:4,len:430,tier:2,g:26,terminals:2,steel:true,pool:['flat','gap','ceilingSwing','climbOver','drones','anchorRun','crumbleBridge','nest','ceilingRun']},
  brief:"There's a ship over Meridian City. The rooftop relay grid is the only way left to get a warning out, and they're tearing it down block by block. Two terminals to reroute.",
  outro:"Meridian's grid is ours again. One link is left: the Skyline Uplink can reach the whole coast.",

},
// ------------------------------------------------------------------ 5
{
  act:1, name:'Skyline Uplink', place:'Coastal uplink SK-1 · 03:33', theme:'uplink',
  sgen:{seed:5,len:440,tier:2,g:38,terminals:2,steel:true,pool:['flat','gap','ceilingSwing','climbOver','drones','anchorRun','ceilingRun','liftUp','dropDown','nest']},
  brief:"This is it. Reroute both uplink terminals and the warning goes out to every radio, phone and screen on the coast. They know it too. Expect everything.",
  outro:"",
  actEnd:{title:'WARNING BROADCAST',text:"Every radio, phone and screen on the coast just heard the warning. The roads are filling, the shelters are opening, and the ship over Meridian has stopped moving. You kept the lines open."},

},
// ================================================================== ACT 2 · INTERFERENCE
// ------------------------------------------------------------------ 6
{
  act:2, name:'Pylon Run', place:'Northern trunk line · 22:10', theme:'storm',
  sgen:{seed:6,len:460,tier:2,g:26,pool:['flat','gap','ceilingRun','climbOver','drones','cableHazard','anchorRun','crumbleBridge','nest']},
  brief:"The warning got out, and they noticed. Storm cells are rolling down the northern trunk line and the pylons are dropping one by one. Ride the storm and keep the line alive.",
  outro:"The line is holding. But the junk wrapped round the pylons wasn't storm damage. It was growing.",

},
// ------------------------------------------------------------------ 7 (top-down)
{
  act:2, mode:'top', name:'Substation 9', place:'Substation 9 · 23:40', theme:'station',
  brief:"Something has moved into Substation 9 and sealed it from the inside. The doors run on pressure plates and old levers. Get in, reroute the switching terminal, and get out through the service hatch.",
  outro:"Switching restored. The things in there were nesting between the transformers.",
  gen:{cols:4,rows:3,seed:7,need:2,mainLen:6,secret:0.5,types:['plateCrate','leverGate','heavyPair','postPit','cagedFuse','den'],time:12}

},
// ------------------------------------------------------------------ 8
{
  act:2, name:'Floodgate', place:'Carrow Dam spillway · 02:05', theme:'flood',
  sgen:{seed:8,len:470,tier:2,g:38,pool:['flat','gap','ceilingSwing','ferry','liftUp','dropDown','anchorRun','drones','nest','crumbleBridge']},
  brief:"They opened the floodgates to drown the valley relays. The ferries and service lifts still run on backup power. Ride them across the spillway and take the dam terminal back.",
  outro:"Gates shut, relays dry. Whatever opened them knew exactly which valve to turn.",

},
// ------------------------------------------------------------------ 9
{
  act:2, name:'Freight Yard', place:'Harlow freight yard · 04:30', theme:'yard',
  sgen:{seed:9,len:500,tier:2,g:38,terminals:2,pool:['flat','gap','ceilingRun','climbOver','liftUp','dropDown','ferry','anchorRun','drones','nest','crumbleBridge','cableHazard']},
  brief:"The freight yard's crane lines carry the backbone cables for three cities, and the ship is hovering right over them. Two terminals, a long way apart. Don't stop moving.",
  outro:"Both yard terminals rerouted. Before it pulled back, the ship dropped something into the hills. Something big.",

},
// ------------------------------------------------------------------ 10 (top-down)
{
  act:2, mode:'top', name:'The Hive Relay', place:'Relay Vault 7 · 05:55', theme:'hive',
  brief:"Whatever they dropped burrowed straight into Relay Vault 7 and grew a hive around it. Every signal in the region routes through that vault. Go in, reroute both terminals, and get back out.",
  outro:"",
  actEnd:{title:'SIGNAL HOLDS',text:"Vault 7 is ours and the hive has gone quiet. Further down the line, something much bigger is waking up. End of Act 2."},
  map:[
    "#####################################",
    "#..........R#..       ..#...  ......#",
    "#...........#..       ..#.C.  ...C..#",
    "#....C...a..#..       ..#...  ......#",
    "#.P.........AK.  .o   ..#...  ......#",
    "#...........#..       ..#...  .....b#",
    "#....C...a..#..       ......  ......#",
    "#...........#..  .    .o#...  ....R.#",
    "#......S....#R.  o    ..#...  .....Z#",
    "#################################B###",
    "#..   e   ..#.      ....####..T.....#",
    "#..       ..#.  Q   ....##$#....K...#",
    "#..       ..#.      .C..##%#........#",
    "#...........#.      ....#...........#",
    "#.............EEEEEE....D...........#",
    "#..S........#.      ....#...........#",
    "#........S..#.      .c..#.R.........#",
    "#R..........#.      ....#...........#",
    "######F##############################",
    "#.........R.#...........#.....T.....#",
    "#.....K.....#.........f.#..........R#",
    "#...........#..C........#...........#",
    "#           #.....S.....G.K.........#",
    "#           #...........#........Z..#",
    "#           #..C........#...........#",
    "#.............K.......f.#...........#",
    "#R....o.....#R..........#.........X.#",
    "#####################################"
  ],
  key:{ a:{t:'plate',g:1}, A:{t:'door',g:1}, b:{t:'lever',g:2}, B:{t:'door',g:2}, D:{t:'door',g:'term0'},
        c:{t:'plate',g:3}, E:{t:'bridge',g:3}, e:{t:'lever',g:4}, F:{t:'door',g:4}, f:{t:'plate',g:5}, G:{t:'door',g:5} },
  terms:[{time:14,waves:[[0.1,'skitter','skitter'],[0.45,'leech','seeker'],[0.75,'skitter','skitter','leech']]},
         {time:16,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech','skitter'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','leech','skitter']]}],
  hints:[
    [3,4,  "The hive. Two plates need two crates."],
    [14,4, "Chain the posts: pull, turn, pull again."],
    [26,5, "Fill the gap with both crates, then grapple the lever."],
    [31,12,"This terminal also unlocks the door to the west."],
    [21,11,"Hold the bridge out with a crate on the plate."],
    [6,14, "Grapple the lever across the pit."],
    [4,20, "Pull yourself over the chasm."],
    [15,22,"Push both crates onto the plates. Line them up first."],
    [27,21,"The last terminal. Hold it."]
  ]
},
// ================================================================== ACT 3 · UNDERTOW
// ------------------------------------------------------------------ 11
{
  act:3, name:'Quarry Descent', place:'Harrow deep pit · 20:30', theme:'pit', W:150, H:64, fallDamage:true,
  brief:"The ship dropped a drill into Harrow's old deep pit, and the relay at the bottom is the only line left into the valley. Get down there, and don't just jump: the drops are long enough to hurt now.",
  outro:"The valley line is back. Something at the bottom of that pit was drilling towards the pumping station.",
  build(B){
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
    B.goal(144,55); B.crack(70,23,true); B.hat(69,23); B.steel(108,110,50,51); B.crack(109,51,false); B.hat(109,50);
    B.prop('cabin',{x:4,row:6}); B.prop('sign',{x:26,row:6}); B.prop('chains',{x:30,row:4,len:30}); B.prop('chains',{x:40,row:4,len:50});
    B.prop('drum',{x:50,row:21}); B.prop('crates',{x:8,row:21}); B.prop('cone',{x:70.4,row:21}); B.prop('sign',{x:79,row:39});
    B.prop('drum',{x:96,row:39}); B.prop('chains',{x:108,row:37,len:40}); B.prop('crates',{x:132,row:55}); B.prop('antenna',{x:110,row:55});
  },
  hints:[
    [0,  "Quarry Descent. Long drops hurt now: fall more than about ten tiles and you lose a hard hat."],
    [24, "Hook the beam over the shaft, step off, then hold <b>▼</b> to pay out cable and lower yourself. Let go near the bottom."],
    [66, "Ride the lift down."],
    [102,"Another shaft. Hook the girder, step off and lower yourself."],
    [118,"The pit relay. Reroute it."]
  ]
},
// ------------------------------------------------------------------ 12 (top-down)
{
  act:3, mode:'top', name:'Cable Tunnels', place:'Harrow cable tunnels · 22:15', theme:'station',
  brief:"The drill broke into the old cable tunnels under the valley. The doors down here are on timers and the belts still run. Reroute the junction terminal and find the way out.",
  outro:"Junction rerouted. The tunnels lead straight to the pumping station, and the water in them is rising.",
  map:[
    "############################################",
    "#..........R.#.......... ...#..............#",
    "#............#.......... .R.#...b<<<<<<<C..#",
    "#............#.C........ ...#..............#",
    "#.P..........AK......... ...#..............#",
    "#............#.......... ...#..............#",
    "#........a...#..>>>>>>>> .....K............#",
    "#............#.......... ...#..............#",
    "#............#.......... ...#.............R#",
    "####################################B#######",
    "#............#..............####.T.........#",
    "#.R..........#..............##$#.....K.....#",
    "#............D.<<<<<<<<<<.c.##%#...........#",
    "#..........K.#..............#..............#",
    "#............#..............E..............#",
    "#..X.........#..........S...#..v...........#",
    "#............#.R............#..v...........#",
    "#............#..............#     .........#",
    "############################################"
  ],
  key:{ a:{t:'plate',g:1,hold:2}, A:{t:'door',g:1}, b:{t:'plate',g:2,hold:1.2}, B:{t:'door',g:2}, E:{t:'door',g:'term0'}, c:{t:'plate',g:3,hold:2.5}, D:{t:'door',g:3} },
  terms:[{time:15,waves:[[0.1,'skitter','skitter'],[0.4,'leech','hunter'],[0.7,'skitter','skitter','leech']]}],
  hints:[
    [4,4,  "Timed plates: the door stays open for a moment after you step off. Run for it."],
    [17,4, "Conveyor belts carry crates, and you. Push the crate onto the belt."],
    [34,5, "This plate is too far from its door to run it. Let the belt deliver the crate onto it."],
    [34,12,"Reroute the junction. Mind the belt into the pit."],
    [24,13,"Timed door again, and it's a long way. Ride the belt to make it."],
    [8,14, "The exit is just ahead."]
  ]
},
// ------------------------------------------------------------------ 13
{
  act:3, name:'Pumping Station', place:'Valley pumping station · 00:40', theme:'pump', W:124, H:72,
  flood:{row:73,trigger:4,speed:12,max:14},
  brief:"They've jammed the station's pumps open and the whole shaft is flooding. The control terminal is at the very top. Climb, and don't stop. Some of the old walkways give way under you.",
  outro:"Pumps reversed. The water's going down, and far below something huge has started to move.",
  build(B){
    const g=68;
    B.rock(1,40,g,71);
    // stack 1 up to deck 1 (row 49)
    B.girder(14,20,63); B.girder(18,24,58); B.girder(12,20,53);
    B.girder(18,34,49); B.crumble(35,40,49); B.girder(41,56,49);
    // stack 2 up to deck 2 (row 30)
    B.girder(52,58,44); B.crumble(56,62,39); B.girder(50,58,34);
    B.girder(56,69,30); B.crumble(70,75,30); B.girder(76,94,30);
    // stack 3 up to the control deck (row 11)
    B.crumble(90,96,25); B.girder(94,100,20); B.crumble(88,96,15);
    B.girder(94,121,11);
    B.start(3,67); B.check(20,48); B.check(58,29); B.check(97,10);
    [[10,67],[22,57],[38,47],[60,38],[73,28],[92,24],[98,19],[112,10]].forEach(r=>B.relay(...r));
    B.drone(25,33,48); B.enemy('seeker',46,40); B.enemy('skitter',84,29); B.enemy('spitter',78,29); B.enemy('seeker',92,17);
    B.terminal(106,10,{time:15,waves:[[0.1,'hunter','hunter'],[0.35,'leech','seeker'],[0.6,'skitter','skitter','leech'],[0.85,'seeker','seeker']]});
    B.goal(118,10); B.steel(30,32,62,63); B.crack(31,63,false); B.hat(31,62); B.steel(80,82,24,25); B.crack(81,25,false); B.hat(81,24);
    B.prop('crates',{x:28,row:67}); B.prop('tank',{x:36,row:67}); B.prop('vent',{x:8,row:67});
    B.prop('tower',{x0:11.4,x1:25.6,top:49,row:67}); B.prop('tower',{x0:49.4,x1:63.6,top:30,row:48}); B.prop('tower',{x0:87.4,x1:101.6,top:11,row:29});
    B.prop('antenna',{x:120,row:10});
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
  act:3, mode:'top', name:'The Burrow', place:'Beneath the station · 02:20', theme:'burrow',
  brief:"Whatever flooded the station came up from here: a burrow full of them, and no lights. Your headlamp is all you've got. Reroute the deep relay, then deal with what's guarding the way out.",
  outro:"",
  map:[
    "########################################",
    "#..........R.#..         ..#############",
    "#.......S....#..         R.#############",
    "#............#..         ..#############",
    "#.P..........#..    .o   ..#############",
    "#...............         ..#############",
    "#............#K.         ..#############",
    "#........S...#..    .    .o#############",
    "#............#..    o    ..#############",
    "#########################.##############",
    "#............####...T......#############",
    "#..R.........##$#.......K..#############",
    "#.........K..##%#..........#############",
    "#............#.............#############",
    "#...S........E.............#############",
    "#............#.............#############",
    "#............#.R...........#############",
    "#............#.............#######$#####",
    "######.###########################%#####",
    "#..........................####........#",
    "#.....K......C.............##$#......R.#",
    "#........................R.##%#........#",
    "#.......C...M..............#...........#",
    "#................C.........#.......X...#",
    "#..........................#...........#",
    "#...C......................#...........#",
    "#...........C........C.....F...........#",
    "#.R........................#...........#",
    "#..........................#...........#",
    "########################################"
  ],
  key:{ E:{t:'door',g:'term0'}, F:{t:'door',g:'boss'} },
  terms:[{time:15,waves:[[0.1,'skitter','skitter'],[0.4,'leech','seeker'],[0.7,'skitter','skitter','leech']]}],
  hints:[
    [3,4,  "No lights down here. Keep your headlamp pointed where you're going: the glowing eyes are skitters."],
    [15,5, "Pull yourself across the chasm, post to post."],
    [22,12,"Reroute the deep relay. It unlocks the door west."],
    [6,21, "The Brood Mother. Punches bounce off her armour, so push crates into her. Three hits."],
    [30,24,"She's down. Get out."]
  ]
},
// ------------------------------------------------------------------ 15 (boss)
{
  act:3, name:'Ship Anchor', place:'Carrow gorge · 04:05', theme:'gorge', W:70, H:40,
  brief:"The ship has dropped a tether into Carrow gorge, a living cable pumping energy up into it. Cut the four clamps holding it down. It will fight back: when a red band lights up across the gorge, get out of it.",
  outro:"",
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
    B.start(4,35); B.check(64,35); B.crack(25,4,false); B.hat(25,3); B.crack(45,4,false); B.hat(45,3);
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
  act:4, name:'Storm Front', place:'Kestrel coast line · 21:00', theme:'storm', W:300, H:30,
  wind:{period:7,warn:1.3,dur:2.6,force:230},
  brief:"The ship ran, but it's coming back for one last push, riding a storm front in over the coast. The gusts out there can knock a rigger clean off a girder. One thing in your favour: the shock cell you salvaged from the tether. Press PULSE and everything around you gets thrown back.",
  outro:"The line held through the storm. Down the coast, the relay array is powering up.",
  build(B){
    const g=26;
    B.rock(1,20,g,29); B.rock(26,50,g,29); B.rock(88,120,g,29); B.rock(136,170,g,29); B.rock(191,220,g,29); B.rock(247,298,g,29);
    M.girderGap(B,21,g);                    // pit 21..25
    M.anchorRun(B,46,g,4);                  // girder hops, pit 51..87
    B.crumble(121,135,g);                   // crumbling bridge over pit 121..135
    B.platform(171,g,187,g,4);              // ferry over pit 171..190
    M.ceilingRun(B,216,g,26);               // chain swings, pit 221..246
    M.cableHazard(B,272,g);                 // sparks 279..281
    B.start(2,25); B.check(27,25); B.check(90,25); B.check(137,25); B.check(192,25); B.check(249,25);
    [[10,25],[28,18],[65,13],[128,25],[180,25],[258,25],[277,18],[286,25]].forEach(r=>B.relay(...r));
    B.drone(30,40,25); B.enemy('skitter',100,25); B.enemy('seeker',110,18); B.enemy('spitter',164,25);
    B.enemy('skitter',205,25); B.enemy('seeker',236,17); B.enemy('hunter',290,20);
    B.terminal(262,25,{time:16,waves:[[0.08,'hunter','hunter'],[0.35,'leech','seeker'],[0.6,'skitter','skitter','leech'],[0.85,'seeker','seeker']]});
    B.goal(294,25); B.steel(10,12,20,21); B.crack(11,21,false); B.hat(11,20); B.steel(150,152,20,21); B.crack(151,21,false); B.hat(151,20);
    B.prop('cabin',{x:3,row:25}); B.prop('sign',{x:19,row:25}); B.prop('fence',{x0:89,x1:110,row:25}); B.prop('cone',{x:120.4,row:25}); B.prop('cone',{x:136.4,row:25});
    B.prop('drum',{x:150,row:25}); B.prop('crates',{x:198,row:25}); B.prop('chains',{x:226,row:15,len:30}); B.prop('chains',{x:240,row:15,len:44}); B.prop('antenna',{x:255,row:25});
  },
  hints:[
    [0,  "Storm Front. You now carry a shock cell: <b>PULSE</b> knocks back everything near you and burns up plasma, then recharges. Watch for the GUST warning: the wind shoves you sideways."],
    [44, "Girder hops in a gale. Time your swings between gusts."],
    [118,"This bridge crumbles behind you. Don't stop, and don't get blown back."],
    [166,"Stand still on the ferry: you can brace against gusts on moving platforms."],
    [214,"A long ceiling over the last gap. Chain your swings."]
  ]
},
// ------------------------------------------------------------------ 17 (top-down)
{
  act:4, mode:'top', name:'Relay Array', place:'Coastal relay array · 23:15', theme:'station',
  brief:"The coast's relay array is the one weapon we have: aim it at the ship and it can knock out the shields. The aliens got here first and rigged the array rooms with security beams. Get both control terminals online.",
  outro:"The array is locked on. The ship's shields are flickering.",
  map:[
    "########1########################3###3######",
    "####.......R.#......#...R...####...T.......#",
    "##$#.........#..C...#.......##$#.......a...#",
    "##%#.........#......#.......##%#...........#",
    "#............2..............#..............#",
    "#............#......#.......#..............#",
    "#.P.................#......................#",
    "#............#.K....#.......#.K............#",
    "#............#......#.......#.............R#",
    "###################################E########",
    "#............#......T.......#..............#",
    "#.........K..#..........K...#...........K..#",
    "#..X.........#..............6..............#",
    "#............#....S.........#..............#",
    "#............#................<<<<<<<<<<<<<#",
    "#............#..............7..............#",
    "#.R..........F.R........S...#............R.#",
    "#............#..............#..............#",
    "###############################5#4##########"
  ],
  key:{ '1':{t:'beam',dir:'down',on:1.6,off:1.6}, '2':{t:'beam',dir:'right'}, '3':{t:'beam',dir:'down',g:1}, a:{t:'lever',g:1}, E:{t:'door',g:'term0'},
        '4':{t:'beam',dir:'up',on:1.2,off:1.8}, '5':{t:'beam',dir:'up',on:1.2,off:1.8,ph:1.5}, '6':{t:'beam',dir:'left',on:2,off:2}, '7':{t:'beam',dir:'left',on:2,off:2,ph:2}, F:{t:'door',g:'term1'} },
  terms:[{time:15,waves:[[0.1,'skitter','hunter'],[0.45,'leech','leech'],[0.75,'skitter','skitter','seeker']]},
         {time:16,waves:[[0.08,'seeker','seeker'],[0.35,'leech','skitter'],[0.6,'skitter','skitter','leech'],[0.85,'hunter','hunter']]}],
  hints:[
    [4,6,  "Security beams. This one pulses: cross while it's off."],
    [15,5, "This beam never switches off. Push the crate into it: crates block beams."],
    [30,5, "Two beams guard the terminal, both run from the lever. The cable goes straight through beams, so grapple the lever."],
    [38,12,"Two pulsing beams across the belt. Pick your moment."],
    [24,12,"Terminal 2. The beams sweep the room while you work."],
    [8,13, "The exit is just ahead."]
  ]
},
// ------------------------------------------------------------------ 18
{
  act:4, name:'Skyhook', place:'Above the Kestrel hills · 02:45', theme:'sky', W:300, H:50,
  wind:{period:10,warn:1.3,dur:2,force:140},
  brief:"The array knocked the ship's shields out for a few minutes and it dropped low, trailing its own cable lines over the hills. Ride those lines up into the sky and get onto the hull before it recovers.",
  outro:"You're on the hull. There's a hatch, and it isn't locked.",
  build(B){
    B.steel(1,12,20,49);                                  // launch tower
    B.zip(12,16,40,29);                                   // zip line 1
    B.steel(40,52,32,33); B.steel(45,47,34,49);
    B.platform(53,32,53,14,4,{speed:34});                 // lift up
    B.steel(57,70,14,15); B.steel(62,64,16,49);
    B.zip(70,11,108,25);                                  // zip line 2
    B.steel(108,125,28,29); B.steel(114,116,30,49);
    B.crumble(126,140,28);                                // crumbling span
    B.steel(141,160,28,29); B.steel(148,150,30,49);
    M.anchorRun(B,156,28,4);                              // girder hops, pit 161..197
    B.steel(198,212,28,29); B.steel(203,205,30,49);
    B.zip(205,22,250,40);                                 // zip line 3, down to the landing deck
    B.steel(250,298,42,45);
    B.start(3,19); B.check(42,31); B.check(58,13); B.check(110,27); B.check(143,27); B.check(199,27); B.check(252,41);
    [[26,22],[60,13],[90,18],[133,27],[175,15],[228,32],[280,41]].forEach(r=>B.relay(...r));
    B.enemy('seeker',30,24); B.enemy('seeker',90,10); B.enemy('skitter',120,27); B.enemy('seeker',130,20); B.enemy('seeker',180,12); B.enemy('seeker',230,30); B.enemy('skitter',270,41);
    B.terminal(152,27,{time:16,waves:[[0.08,'seeker','hunter'],[0.35,'leech','leech','seeker'],[0.6,'hunter','hunter','skitter'],[0.85,'leech','seeker','seeker']]});
    B.goal(295,41); B.steel(270,272,36,37); B.crack(271,37,false); B.hat(271,36); B.steel(118,120,22,23); B.crack(119,23,false); B.hat(119,22);
    B.prop('antenna',{x:5,row:19}); B.prop('dish',{x:66,row:13}); B.prop('vent',{x:118,row:27}); B.prop('antenna',{x:158,row:27}); B.prop('dish',{x:210,row:27}); B.prop('vent',{x:262,row:41});
  },
  hints:[
    [0,  "Skyhook. Zip lines: fire your cable at the line, hold GRAB, and slide. Let go to fly off, or ride it to the end."],
    [50, "Ride the lift up to the next line."],
    [124,"This span crumbles. Keep moving."],
    [154,"Girder hops, high up. Watch the gusts."],
    [200,"The last line takes you down to the hull deck."]
  ]
},
// ------------------------------------------------------------------ 19 (top-down)
{
  act:4, mode:'top', name:'Hull Breach', place:'Inside the mothership · 03:30', theme:'ship',
  brief:"You're inside. The ship's rooms are sealed and connected only by teleport pads, and most of the lights are out. Reroute the ship's own relays to broadcast our signal, and the core will be wide open.",
  outro:"The ship's own relays are broadcasting our signal. The core is exposed.",
  map:[
    "############################################",
    "#..R.........#...........R..#......T......R#",
    "#..........S.#.u............#..............#",
    "#............#..............#.K............#",
    "#.P..........#..............B..............#",
    "#............#...K..........#..............1",
    "#.....C...u..#..............#..............#",
    "#............#.......S....b.#...Q..........#",
    "#............#..............#............w.#",
    "############################################",
    "#............#......T.......#.. ...........#",
    "#............#.........K..y.#.. .......K.w.#",
    "#.........K..#...S..........#.. ...........#",
    "#...X........#..............#.. <<<<<<<<C..#",
    "#............#..............2.. ...........#",
    "#............F..............#.. ...........#",
    "#.R..........#........S.....#.y ....Z......#",
    "#............#.R............#.. ..........R#",
    "############################################"
  ],
  key:{ u:{t:'tele',id:1}, w:{t:'tele',id:2}, y:{t:'tele',id:3}, b:{t:'plate',g:1}, B:{t:'door',g:1},
        '1':{t:'beam',dir:'left',on:1.5,off:2}, '2':{t:'beam',dir:'left',on:1.6,off:1.8}, F:{t:'door',g:'term1'} },
  terms:[{time:15,waves:[[0.1,'skitter','seeker'],[0.4,'leech','leech'],[0.7,'skitter','skitter','seeker']]},
         {time:17,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech','skitter'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','hunter','hunter']]}],
  hints:[
    [4,4,  "Teleport pads link sealed rooms. Crates travel through them too."],
    [16,4, "The plate needs a crate on it. Send the crate through the pad first."],
    [33,4, "Cross the beam between pulses."],
    [38,12,"Feed the crate onto the belt to fill the pit."],
    [23,12,"The last relay. Hold it."],
    [8,13, "Out through the hatch, and on to the core."]
  ]
},
// ------------------------------------------------------------------ 20 (final boss)
{
  act:4, name:'Heart of the Ship', place:'The mothership core', theme:'core', W:72, H:44,
  brief:"The core. Four generators keep its shield up: destroy them, then destroy it. When a red band lights up, it can come across the chamber or straight down it. Move.",
  outro:"",
  actEnd:{title:'SIGNAL CLEAR',text:"The core burst and the mothership fell out of the sky into the sea off Kestrel Ridge. Every tower you climbed is still standing, and every channel on the coast is carrying the same message: it's over. Thanks for playing Relay Rigger."},
  build(B){
    B.steel(1,70,40,43); B.steel(6,66,2,3);
    B.girder(6,14,34); B.girder(57,65,34); B.girder(2,7,26); B.girder(64,69,26); B.girder(18,24,30); B.girder(47,53,30); B.girder(14,22,21); B.girder(49,57,21); B.girder(31,41,28);
    B.girder(8,26,12); B.girder(46,64,12);
    B.platform(27,40,27,12,4,{speed:40}); B.platform(42,40,42,12,4,{speed:40,phase:1});
    B.core(36,19,[[10,33],[61,33],[18,20],[53,20]]);
    B.start(4,39); B.check(68,39); B.steel(10,12,28,29); B.crack(11,29,false); B.hat(11,28); B.steel(60,62,28,29); B.crack(61,29,false); B.hat(61,28);
    [[7,33],[64,33],[20,20],[51,20],[36,27],[15,11]].forEach(r=>B.relay(...r));
  },
  hints:[
    [0,  "The core. Its shield holds while any generator stands: punch the four generators on the girders. When the hunters crowd you, <b>PULSE</b>."],
    [30, "Climb from the low girders to the high ones, or ride the lifts. Red bands can come down the chamber too."]
  ]
}
];

window.RR_LEVELS = LEVELS;
window.RR_ACTS = ['Lights Out','Interference','Undertow','Signal'];
})();
