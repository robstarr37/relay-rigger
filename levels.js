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
};

const LEVELS = [
// ------------------------------------------------------------------ 1
{
  name:'Kestrel Ridge', place:'Transmitter KRX-7 · 02:40', theme:'ridge', W:140, H:26,
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
    B.goal(132,2);
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
  name:'Harrow Quarry', place:'Relay HQ-2 · 21:15', theme:'quarry', W:170, H:26,
  brief:"Relay HQ-2 in the old quarry went dark at the same minute as Kestrel. The night crew radioed about “something” moving on the quarry floor, then stopped answering.",
  outro:"Those weren't animals. Head office says keep it quiet. Head office is wrong.",
  build(B){
    const g=22;
    B.rock(1,12,g,25); B.rock(18,45,g,25); B.rock(58,125,g,25); B.rock(131,168,g,25);
    M.girderGap(B,13,g);          // pit 13..17
    M.ceilingSwing(B,41,g);       // pit 46..57
    M.climbOver(B,75,g);          // pillar 87..91
    M.girderGap(B,126,g);         // pit 126..130
    M.cableHazard(B,140,g);       // sparks 147..149
    B.start(2,21); B.check(40,21); B.check(60,21); B.check(94,21); B.check(133,21);
    [[9,21],[29,21],[52,23],[77,17],[112,21],[145,14],[160,21]].forEach(r=>B.relay(...r));
    B.drone(24,32,21); B.enemy('skitter',37,21); B.enemy('seeker',70,16);
    B.enemy('skitter',137,21); B.drone(154,162,21);
    B.terminal(108,21,{time:14,waves:[[0.1,'hunter','hunter'],[0.4,'skitter','hunter'],[0.75,'skitter','skitter','seeker']]});
    B.goal(164,21);
    B.prop('cabin',{x:3,row:21}); B.prop('cone',{x:12.4,row:21}); B.prop('cone',{x:45.2,row:21});
    B.prop('drum',{x:28,row:21}); B.prop('sign',{x:61,row:21}); B.prop('crates',{x:98,row:21});
    B.prop('fence',{x0:58.3,x1:74,row:21}); B.prop('sign',{x:138.5,row:21}); B.prop('cone',{x:130.6,row:21});
    B.prop('chains',{x:48,row:11,len:30}); B.prop('chains',{x:55,row:11,len:44}); B.prop('chains',{x:62,row:11,len:20});
    B.prop('dish',{x:118,row:21}); B.prop('fence',{x0:150.2,x1:160,row:21});
  },
  hints:[
    [0,  "Harrow Quarry. Same drill: hook the girder, swing the gap, let go at the top."],
    [26, "Something is walking the quarry floor. Skitters take <b>two</b> punches: <b>▼ + GRAB</b>."],
    [46, "Swing low under the slab and let go at the top of the arc."],
    [60, "Purple drones hunt you. Punch them before they close in."],
    [75, "Climb the girders to get over the pillar."],
    [124,"Swing the gap, then climb over the live cable."],
    [152,"The mast is just ahead."]
  ]
},
// ------------------------------------------------------------------ 3
{
  name:'Blackwater Dam', place:'Emergency antenna BW-1 · 23:50', theme:'dam', W:155, H:30,
  brief:"The dam antenna carries every emergency channel in the valley. Something is feeding on its terminal from the inside. Get up there and take it back.",
  outro:"Emergency channels restored. There were lights over the mountains all night, and they're moving toward the city.",
  build(B){
    const g=26;
    B.rock(1,39,g,29); B.rock(52,66,g,29); B.rock(79,153,g,29);
    M.cableHazard(B,11,g);        // sparks 18..20
    M.ceilingSwing(B,35,g);       // pit 40..51
    M.ceilingSwing(B,62,g);       // pit 67..78
    M.towerClimb(B,90,g,150);     // deck row 7
    B.start(2,25); B.check(38,25); B.check(55,25); B.check(82,25); B.check(100,6);
    [[6,25],[16,18],[46,27],[73,27],[100,15],[92,10],[140,6]].forEach(r=>B.relay(...r));
    B.enemy('spitter',24,25); B.enemy('seeker',58,17); B.drone(81,88,25);
    B.enemy('skitter',109,6); B.enemy('spitter',138,6);
    B.terminal(118,6,{time:16,waves:[[0.08,'seeker','hunter'],[0.3,'leech','leech'],[0.55,'skitter','skitter','seeker'],[0.8,'leech','leech','hunter']]});
    B.goal(147,6);
    B.prop('cabin',{x:3,row:25}); B.prop('sign',{x:9,row:25}); B.prop('cone',{x:39.4,row:25});
    B.prop('drum',{x:26,row:25}); B.prop('crates',{x:58,row:25}); B.prop('cone',{x:66.4,row:25});
    B.prop('tower',{x0:89.4,x1:103.6,top:7,row:25}); B.prop('pylon',{x:120,top:8,row:25}); B.prop('pylon',{x:136,top:8,row:25});
    B.prop('chains',{x:43,row:15,len:30}); B.prop('chains',{x:49,row:15,len:18}); B.prop('chains',{x:70,row:15,len:36}); B.prop('chains',{x:76,row:15,len:24});
    B.prop('dish',{x:128,row:6}); B.prop('fence',{x0:106,x1:148,row:25});
  },
  hints:[
    [0,  "Blackwater Dam. Climb the girder over the live cable."],
    [24, "A spitter pod. Punch its plasma out of the air, or punch the pod twice."],
    [36, "Two long swings over the spillway. Let go at the top of each arc."],
    [86, "Up the dam tower: fire up, reel in, step over."]
  ]
},
// ------------------------------------------------------------------ 4
{
  name:'Meridian Rooftops', place:'City relay grid · 01:05', theme:'city', W:190, H:30,
  brief:"There's a ship over Meridian City. The rooftop relay grid is the only way left to get a warning out, and they're tearing it down block by block. Two terminals to reroute.",
  outro:"Meridian's grid is ours again. One link is left: the Skyline Uplink can reach the whole coast.",
  build(B){
    const g=26;
    B.steel(1,14,g,29); B.steel(20,49,g,29); B.steel(62,125,g,29); B.steel(131,188,g,29);
    M.girderGap(B,15,g);          // pit 15..19
    M.ceilingSwing(B,45,g);       // billboard slab, pit 50..61
    M.climbOver(B,101,g);         // stairwell block 113..117
    M.girderGap(B,126,g);         // pit 126..130
    M.towerClimb(B,146,g,188);    // deck row 7
    B.start(2,25); B.check(21,25); B.check(64,25); B.check(119,25); B.check(131,25); B.check(156,6);
    [[10,25],[34,25],[56,27],[103,21],[140,25],[156,15],[180,6]].forEach(r=>B.relay(...r));
    B.enemy('skitter',30,25); B.drone(36,44,25); B.enemy('spitter',68,15);
    B.enemy('seeker',95,19); B.enemy('spitter',144,25); B.enemy('skitter',165,6); B.enemy('seeker',176,3);
    B.terminal(84,25,{time:14,waves:[[0.1,'hunter','hunter'],[0.4,'skitter','skitter'],[0.7,'leech','leech','seeker']]});
    B.terminal(170,6,{time:16,waves:[[0.08,'seeker','seeker'],[0.4,'leech','leech','skitter'],[0.7,'hunter','hunter','skitter']]});
    B.goal(184,6);
    B.prop('vent',{x:5,row:25}); B.prop('antenna',{x:11,row:25}); B.prop('tank',{x:26,row:25});
    B.prop('vent',{x:41,row:25}); B.prop('antenna',{x:66,row:25}); B.prop('dish',{x:75,row:25});
    B.prop('vent',{x:92,row:25}); B.prop('tank',{x:122,row:25}); B.prop('antenna',{x:135,row:25});
    B.prop('tower',{x0:145.4,x1:159.6,top:7,row:25}); B.prop('pylon',{x:172,top:8,row:25});
  },
  hints:[
    [0,  "Meridian City. Rooftop to rooftop — don't look down."],
    [40, "A spitter hangs under the billboard. Punch it before you swing, or swing fast."],
    [62, "Two terminals on this route. Reroute this one first."],
    [100,"Climb over the stairwell block."],
    [140,"Up the broadcast tower to the second terminal."]
  ]
},
// ------------------------------------------------------------------ 5
{
  name:'Skyline Uplink', place:'Coastal uplink SK-1 · 03:33', theme:'uplink', W:130, H:46,
  brief:"This is it. Reroute both uplink terminals and the warning goes out to every radio, phone and screen on the coast. They know it too. Expect everything.",
  outro:"",
  build(B){
    const g=42;
    B.steel(1,33,g,45); B.steel(39,54,g,45); B.steel(67,128,g,45);
    M.girderGap(B,34,g);          // pit 34..38
    M.ceilingSwing(B,50,g);       // gantry, pit 55..66
    M.towerClimb(B,80,g,125);     // deck row 23
    M.towerClimb(B,110,23,128);   // second tower from that deck, top deck row 4
    B.girder(104,115,4);          // widen the top deck so the final fight has room
    B.start(3,41); B.check(40,41); B.check(68,41); B.check(90,22); B.check(117,3);
    [[9,41],[25,41],[61,43],[90,31],[82,26],[113,17],[117,7]].forEach(r=>B.relay(...r));
    B.drone(12,22,41); B.enemy('skitter',28,41); B.enemy('skitter',46,41); B.enemy('seeker',48,36);
    B.enemy('spitter',58,31); B.enemy('spitter',83,41); B.enemy('skitter',95,22);
    B.terminal(100,22,{time:15,waves:[[0.08,'seeker','hunter','hunter'],[0.35,'leech','leech','skitter'],[0.6,'skitter','skitter','seeker'],[0.85,'leech','leech','leech']]});
    B.terminal(121,3,{time:18,waves:[[0.05,'seeker','seeker'],[0.25,'leech','leech','skitter'],[0.5,'hunter','hunter','seeker','seeker'],[0.7,'leech','leech','skitter','skitter'],[0.9,'seeker','seeker','leech']]});
    B.goal(126,3);
    B.prop('antenna',{x:6,row:41}); B.prop('vent',{x:18,row:41}); B.prop('tank',{x:44,row:41});
    B.prop('dish',{x:71,row:41}); B.prop('tower',{x0:79.4,x1:93.6,top:23,row:41});
    B.prop('tower',{x0:109.4,x1:123.6,top:4,row:22}); B.prop('pylon',{x:104,top:24,row:41}); B.prop('pylon',{x:118,top:24,row:41});
  },
  hints:[
    [0,  "Skyline Uplink. The last transmitter that can reach the whole coast."],
    [45, "Swing the gap under the gantry."],
    [78, "Two terminals, two towers. Everything they have is coming."],
    [108,"One more climb."]
  ]
}
];

LEVELS[4].ending="Every radio, phone and screen on the coast just heard the warning. The roads are filling, the shelters are opening, and the ship over Meridian has stopped moving. You kept the lines open.";
window.RR_LEVELS = LEVELS;
})();
