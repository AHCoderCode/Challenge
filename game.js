let THREE;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js");
} catch (error) {
  const loading = document.querySelector("#loadingScreen");
  loading.innerHTML = "<div class='dialog-card'><p class='eyebrow'>GRAPHICS ENGINE</p><h2>3D ENGINE DID NOT LOAD</h2><p>Please check your connection and reload the page.</p><button class='primary-button' onclick='location.reload()'>RELOAD <span>↻</span></button></div>";
  throw error;
}

const $ = (id) => document.getElementById(id);
const ui = {
  loading:$("loadingScreen"),progress:$("loadingProgress"),percent:$("loadingPercent"),
  menu:$("menuScreen"),intro:$("introScreen"),pause:$("pauseScreen"),over:$("overScreen"),
  hud:$("hud"),score:$("scoreValue"),coins:$("coinValue"),distance:$("distanceValue"),
  menuBest:$("menuBest"),finalScore:$("finalScore"),finalCoins:$("finalCoins"),
  finalDistance:$("finalDistance"),finalBest:$("finalBest"),power:$("powerStatus"),
  swipeHint:$("swipeHint")
};

const LANES = [-3.2, 0, 3.2];
const PLAYER_Z = 0;
const SPAWN_Z = -64;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const random = (min,max) => min + Math.random()*(max-min);
const pick = (items) => items[Math.floor(Math.random()*items.length)];
const smooth = (current,target,amount) => current + (target-current)*amount;

let state = "loading";
let best = Number(localStorage.getItem("chaat-rush-best") || 0);
let soundOn = localStorage.getItem("chaat-rush-sound") !== "off";
let audioContext = null;
let audioReady = false;
let introPlayed = false;
let game = null;
let previousTime = 0;
let scenerySpeed = 22;
let swipeStart = null;
let lastTap = 0;
let scene, camera, renderer, world, playerRig, chaserRig;
let roadMarkers = [], buildings = [], lamps = [], entities = [];
let resizeObserver;

const canvas = $("gameCanvas");
const rendererOptions = {canvas,antialias:true,alpha:false,powerPreference:"high-performance",stencil:false,depth:true};
renderer = new THREE.WebGLRenderer(rendererOptions);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia("(max-width: 700px)").matches ? 1.25 : 1.65));
renderer.setSize(window.innerWidth,window.innerHeight,false);
renderer.shadowMap.enabled = false;
renderer.setClearColor(0x91c8cf,1);
canvas.addEventListener("contextmenu",(event) => event.preventDefault());

scene = new THREE.Scene();
scene.background = new THREE.Color(0x83b8c2);
scene.fog = new THREE.Fog(0x83b8c2,38,155);
camera = new THREE.PerspectiveCamera(59,window.innerWidth/window.innerHeight,.1,260);
camera.position.set(0,5.5,10.5);
camera.lookAt(0,1,-15);
world = new THREE.Group();
scene.add(world);

const mats = {
  road:new THREE.MeshStandardMaterial({color:0x303d49,roughness:.96}),
  roadLine:new THREE.MeshStandardMaterial({color:0xe6f2e5,roughness:.75}),
  sidewalk:new THREE.MeshStandardMaterial({color:0xb18d70,roughness:1}),
  curb:new THREE.MeshStandardMaterial({color:0xf2c58a,roughness:.85}),
  metal:new THREE.MeshStandardMaterial({color:0x42566a,metalness:.52,roughness:.4}),
  crate:new THREE.MeshStandardMaterial({color:0xa9683e,roughness:.88}),
  crateEdge:new THREE.MeshStandardMaterial({color:0xe3b477,roughness:.78}),
  barrier:new THREE.MeshStandardMaterial({color:0xe0b74e,roughness:.72}),
  red:new THREE.MeshStandardMaterial({color:0xc9574d,roughness:.75}),
  train:new THREE.MeshStandardMaterial({color:0x537f8a,metalness:.2,roughness:.62}),
  window:new THREE.MeshStandardMaterial({color:0xbbe6e7,emissive:0x35596a,emissiveIntensity:.18,metalness:.15,roughness:.28}),
  buildingA:new THREE.MeshStandardMaterial({color:0x465d68,roughness:.92}),
  buildingB:new THREE.MeshStandardMaterial({color:0x6d7775,roughness:.95}),
  buildingC:new THREE.MeshStandardMaterial({color:0x8c6959,roughness:.95}),
  leaf:new THREE.MeshStandardMaterial({color:0x537f68,roughness:1}),
  trunk:new THREE.MeshStandardMaterial({color:0x604c3d,roughness:1}),
  lamp:new THREE.MeshStandardMaterial({color:0xffe5ab,emissive:0xffd68a,emissiveIntensity:.7}),
  coin:new THREE.MeshStandardMaterial({color:0xffce55,metalness:.7,roughness:.25,emissive:0xa76b18,emissiveIntensity:.16}),
  teal:new THREE.MeshStandardMaterial({color:0x19b8aa,roughness:.73}),
  tealDark:new THREE.MeshStandardMaterial({color:0x0e7775,roughness:.8}),
  orange:new THREE.MeshStandardMaterial({color:0xf1a05d,roughness:.72}),
  skinTeen:new THREE.MeshStandardMaterial({color:0x9b644b,roughness:.92}),
  skinAdult:new THREE.MeshStandardMaterial({color:0x87543e,roughness:.92}),
  hair:new THREE.MeshStandardMaterial({color:0x211b20,roughness:.95}),
  jeans:new THREE.MeshStandardMaterial({color:0x273d56,roughness:.92}),
  shoe:new THREE.MeshStandardMaterial({color:0xf0e7d4,roughness:.72}),
  chaserShirt:new THREE.MeshStandardMaterial({color:0x385f82,roughness:.86}),
  chaserTrim:new THREE.MeshStandardMaterial({color:0xe2c18a,roughness:.65}),
  powerBlue:new THREE.MeshStandardMaterial({color:0x63e6f5,emissive:0x1597ad,emissiveIntensity:.45,metalness:.3,roughness:.28}),
  powerGold:new THREE.MeshStandardMaterial({color:0xffd46c,emissive:0xa36b18,emissiveIntensity:.4,metalness:.4,roughness:.3}),
  powerGreen:new THREE.MeshStandardMaterial({color:0xa8ffd1,emissive:0x2b9f70,emissiveIntensity:.35,metalness:.22,roughness:.28}),
  powerPink:new THREE.MeshStandardMaterial({color:0xff9f82,emissive:0xa7364e,emissiveIntensity:.35,metalness:.2,roughness:.3})
};
function material(color,roughness=.8,metalness=0) {
  return new THREE.MeshStandardMaterial({color,roughness,metalness});
}
function addMesh(parent,geometry,mat,position=[0,0,0],scale=null) {
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(position[0],position[1],position[2]);
  if(scale) mesh.scale.set(scale[0],scale[1],scale[2]);
  parent.add(mesh);
  return mesh;
}
function makeBox(parent,w,h,d,mat,x=0,y=0,z=0) {
  return addMesh(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
}
function makeCylinder(parent,rTop,rBottom,h,mat,x=0,y=0,z=0,segments=8) {
  return addMesh(parent,new THREE.CylinderGeometry(rTop,rBottom,h,segments),mat,[x,y,z]);
}
function addLights() {
  scene.add(new THREE.HemisphereLight(0xdaf5f4,0x52605a,2.0));
  const sun=new THREE.DirectionalLight(0xffe4ba,2.25);
  sun.position.set(-8,18,8);
  scene.add(sun);
  const fill=new THREE.DirectionalLight(0x93d8f0,.65);
  fill.position.set(8,9,-15);
  scene.add(fill);
  const sunBall=addMesh(scene,new THREE.SphereGeometry(4,16,12),new THREE.MeshBasicMaterial({color:0xffe3ad}),[31,29,-100]);
  sunBall.name="sun";
}
function buildRoad() {
  const road=addMesh(world,new THREE.PlaneGeometry(10.5,230),mats.road,[0,-.08,-95]);
  road.rotation.x=-Math.PI/2;
  for(const side of [-1,1]) {
    const sidewalk=addMesh(world,new THREE.PlaneGeometry(5.2,230),mats.sidewalk,[side*7.8,-.11,-95]);
    sidewalk.rotation.x=-Math.PI/2;
    makeBox(world,.22,.16,230,mats.curb,side*5.28,-.02,-95);
  }
  const stripeGeo=new THREE.BoxGeometry(.055,.025,3.2);
  for(const laneX of [-1.175,1.175]) {
    for(let i=0;i<26;i++) {
      const stripe=addMesh(world,stripeGeo,mats.roadLine,[laneX,-.045,-198+i*8]);
      roadMarkers.push(stripe);
    }
  }
  // Side road reflectors create a sense of speed without heavy post-processing.
  const reflectorGeo=new THREE.BoxGeometry(.1,.035,.7);
  for(const x of [-5.13,5.13]) {
    for(let i=0;i<22;i++) addMesh(world,reflectorGeo,mats.lamp,[x,-.005,-188+i*9]);
  }
}
function buildBuilding(x,z,seed) {
  const group=new THREE.Group();
  group.position.set(x,0,z);
  const height=9+(seed%5)*1.9;
  const width=3.8+(seed%3)*.7;
  const depth=4.6+(seed%2)*.8;
  const buildingMat=[mats.buildingA,mats.buildingB,mats.buildingC][seed%3];
  makeBox(group,width,height,depth,buildingMat,0,height/2,0);
  const rows=Math.floor(height/2.2),cols=3;
  const windowWidth=.42,windowHeight=.62;
  for(let row=0;row<rows;row++) {
    for(let col=0;col<cols;col++) {
      const wx=(col-(cols-1)/2)*(width*.28);
      makeBox(group,windowWidth,windowHeight,.035,mats.window,wx,1.45+row*2.15,depth/2+.025);
    }
  }
  makeBox(group,width*.38,.7,.06,mats.crateEdge,0,.38,depth/2+.055);
  world.add(group);
  buildings.push({group,resetZ:z,depth});
}
function buildLamp(x,z) {
  const group=new THREE.Group();
  group.position.set(x,0,z);
  makeCylinder(group,.065,.09,4.7,mats.metal,0,2.35,0,7);
  makeBox(group,.9,.08,.12,mats.metal,x>0?-.35:.35,4.55,0);
  const bulb=addMesh(group,new THREE.SphereGeometry(.18,8,8),mats.lamp,[x>0?-.75:.75,4.42,0]);
  bulb.material=mats.lamp;
  world.add(group); lamps.push({group,resetZ:z});
}
function buildScenery() {
  let seed=1;
  for(let side of [-1,1]) {
    for(let i=0;i<8;i++) {
      const z=-192+i*26;
      buildBuilding(side*(9.1+(i%2)*4.5),z,seed++);
    }
    for(let i=0;i<10;i++) buildLamp(side*6.5,-188+i*19);
  }
}
function limb(parent,materialValue,length,radius) {
  const pivot=new THREE.Group();
  parent.add(pivot);
  makeCylinder(pivot,radius*.9,radius,length,materialValue,0,-length/2,0,8);
  addMesh(pivot,new THREE.SphereGeometry(radius,8,6),materialValue,[0,-length,0],[1,1,1]);
  return pivot;
}
function makeCharacter(options) {
  const root=new THREE.Group();
  const rig={root,legs:[],arms:[],torso:null,head:null,options};
  const skin=options.skin==="adult"?mats.skinAdult:mats.skinTeen;
  const shirt=options.skin==="adult"?mats.chaserShirt:mats.teal;
  const legMat=mats.jeans;
  const build=options.build||"slim";
  const torso=addMesh(root,new THREE.SphereGeometry(1,16,12),shirt,[0,1.15,0],
    build==="stocky"?[.64,.69,.42]:[.46,.72,.33]);
  rig.torso=torso;
  addMesh(root,new THREE.SphereGeometry(1,12,8),options.skin==="adult"?mats.chaserTrim:mats.tealDark,[0,1.73,.01],
    build==="stocky"?[.52,.2,.37]:[.37,.18,.3]);
  const head=addMesh(root,new THREE.SphereGeometry(1,16,12),skin,[0,2.05,0],[.34,.39,.33]);
  rig.head=head;
  // Back hair cap; the chaser has loose medium-long locks at the sides and nape.
  addMesh(root,new THREE.SphereGeometry(1,14,10),mats.hair,[0,2.27,.035],[.365,.245,.36]);
  if(options.skin==="adult") {
    for(const side of [-1,1]) {
      const lock=addMesh(root,new THREE.CapsuleGeometry(.075,.43,3,6),mats.hair,[side*.29,1.91,.1]);
      lock.rotation.z=side*.14;
    }
    addMesh(root,new THREE.SphereGeometry(.12,8,6),mats.hair,[0,1.86,.29],[1,1,.65]);
  } else {
    addMesh(root,new THREE.SphereGeometry(.2,10,7),mats.hair,[0,2.3,-.12],[1,.38,.7]);
  }
  // Neck
  makeCylinder(root,.13,.15,.2,skin,0,1.78,0,9);
  // Arms rotate at the shoulder to make an alternating running motion.
  for(const side of [-1,1]) {
    const armPivot=new THREE.Group();
    armPivot.position.set(side*(build==="stocky"?.52:.4),1.55,0);
    root.add(armPivot);
    const upper=makeCylinder(armPivot,.13,.16,.43,skin,0,-.22,0,8);
    upper.rotation.z=side*-.13;
    addMesh(armPivot,new THREE.SphereGeometry(.115,8,6),skin,[0,-.47,-.03]);
    rig.arms.push({pivot:armPivot,side});
  }
  // Legs are separate pivots so the feet alternate naturally.
  for(const side of [-1,1]) {
    const legPivot=new THREE.Group();
    legPivot.position.set(side*(build==="stocky"?.22:.17),.78,0);
    root.add(legPivot);
    makeCylinder(legPivot,.145,.18,.48,legMat,0,-.24,0,9);
    makeBox(legPivot,.31,.15,.48,mats.shoe,0,-.5,-.09);
    rig.legs.push({pivot:legPivot,side});
  }
  // Small backpack gives the player a clear silhouette from the chase camera.
  if(options.skin!=="adult") {
    makeBox(root,.47,.48,.22,mats.orange,0,1.22,.35);
    makeBox(root,.15,.1,.03,mats.shoe,0,1.26,.48);
  } else {
    makeBox(root,.16,.2,.05,mats.chaserTrim,0,1.45,.3);
  }
  world.add(root);
  return rig;
}
function animateCharacter(rig,time,phase=0) {
  const swing=Math.sin(time*11+phase);
  rig.legs.forEach((leg,index) => { leg.pivot.rotation.x=swing*(index===0?1:-1)*.62; });
  rig.arms.forEach((arm,index) => { arm.pivot.rotation.x=-swing*(index===0?1:-1)*.48; });
  rig.root.rotation.z=Math.sin(time*5+phase)*.025;
}
function buildPlayer() {
  playerRig=makeCharacter({skin:"teen",build:"stocky"});
  playerRig.root.position.set(0,0,PLAYER_Z);
  chaserRig=makeCharacter({skin:"adult",build:"slim"});
  chaserRig.root.scale.setScalar(1.12);
  chaserRig.root.position.set(-1.35,0,4.2);
}
function createObstacle(type,lane,z) {
  const group=new THREE.Group();
  group.position.set(LANES[lane],0,z);
  if(type==="crate") {
    makeBox(group,1.28,1.38,.95,mats.crate,0,.69,0);
    for(const y of [.18,1.2]) makeBox(group,1.31,.07,1.0,mats.crateEdge,0,y,0);
    makeBox(group,.08,1.2,1.01,mats.crateEdge,0,.69,0);
  } else if(type==="barrier") {
    makeBox(group,1.85,.62,.6,mats.barrier,0,.31,0);
    for(let i=0;i<5;i++) makeBox(group,.16,.66,.62,mats.red,-.76+i*.38,.31,.01);
    makeBox(group,2,.08,.7,mats.metal,0,.04,0);
  } else if(type==="beam") {
    makeBox(group,.18,1.85,.18,mats.metal,-.78,.93,0);
    makeBox(group,.18,1.85,.18,mats.metal,.78,.93,0);
    makeBox(group,1.86,.27,.34,mats.red,0,1.72,0);
    makeBox(group,1.75,.055,.36,mats.barrier,0,1.72,.02);
  } else {
    makeBox(group,1.95,2.25,2.7,mats.train,0,1.12,0);
    makeBox(group,1.98,.18,2.72,mats.orange,0,1.94,0);
    for(let i=0;i<3;i++) makeBox(group,.43,.6,.06,mats.window,-.62+i*.62,1.42,1.37);
    makeBox(group,1.65,.12,.06,mats.metal,0,.55,1.39);
  }
  const under=addMesh(group,new THREE.CircleGeometry(.72,14),new THREE.MeshBasicMaterial({color:0x0a1119,transparent:true,opacity:.25}),[0,.015,0]);
  under.rotation.x=-Math.PI/2;
  world.add(group);
  const entity={kind:"obstacle",type,lane,group,previousZ:z,resolved:false};
  entities.push(entity);
}
function createCoin(lane,z) {
  const group=new THREE.Group();
  group.position.set(LANES[lane],1.25,z);
  const ring=addMesh(group,new THREE.TorusGeometry(.28,.095,8,14),mats.coin);
  ring.rotation.y=.08;
  const center=addMesh(group,new THREE.CylinderGeometry(.14,.14,.065,12),mats.powerGold);
  center.rotation.x=Math.PI/2;
  world.add(group);
  entities.push({kind:"coin",lane,group,previousZ:z,resolved:false,phase:Math.random()*Math.PI*2});
}
function createPower(type,lane,z) {
  const group=new THREE.Group();
  group.position.set(LANES[lane],1.55,z);
  const colors={magnet:mats.powerBlue,double:mats.powerGold,shield:mats.powerGreen,board:mats.powerPink};
  const gem=addMesh(group,new THREE.OctahedronGeometry(.48,1),colors[type]);
  gem.scale.set(.85,1,.85);
  const hoop=addMesh(group,new THREE.TorusGeometry(.56,.035,6,18),colors[type]);
  hoop.rotation.x=Math.PI/2;
  world.add(group);
  entities.push({kind:"power",type,lane,group,previousZ:z,resolved:false,phase:Math.random()*Math.PI*2});
}
function spawnPattern() {
  const safeLane=Math.floor(Math.random()*3);
  const blocked=[0,1,2].filter((lane)=>lane!==safeLane);
  createObstacle(pick(["crate","barrier","beam","train"]),blocked[0],SPAWN_Z);
  if(Math.random()>.48) createObstacle(pick(["crate","barrier","beam"]),blocked[1],SPAWN_Z-random(0,1.4));
  const coinLane=Math.random()<.72?safeLane:Math.floor(Math.random()*3);
  for(let i=0;i<6;i++) createCoin(coinLane,SPAWN_Z-10-i*2.25);
  if(Math.random()<.2) createPower(pick(["magnet","double","shield","board"]),safeLane,SPAWN_Z-5);
  game.spawnTimer=random(1.02,1.3)*(22/game.speed);
}
function removeEntity(entity) {
  world.remove(entity.group);
  for(const child of entity.group.children) {
    if(child.geometry && child.geometry!==null) { /* Shared primitive geometries remain cached by the browser. */ }
  }
}
function clearEntities() {
  for(const entity of entities) removeEntity(entity);
  entities=[];
}

function ensureAudio() {
  if(!soundOn) return;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx) return;
  if(!audioContext) audioContext=new AudioCtx();
  if(audioContext.state==="suspended") audioContext.resume().catch(()=>{});
  audioReady=true;
}
function note(freq,duration=.16,type="triangle",volume=.035,delay=0) {
  if(!soundOn||!audioContext||!audioReady) return;
  const start=audioContext.currentTime+delay;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start+.015);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain);gain.connect(audioContext.destination);
  osc.start(start);osc.stop(start+duration+.025);
}
function playIntroMusic() {
  if(introPlayed) return;
  introPlayed=true;
  const melody=[392,523,587,659,587,523,440,523,784,659];
  melody.forEach((freq,index)=>note(freq,.21,index%3===0?"sine":"triangle",.035,index*.14));
  [196,196,220,174].forEach((freq,index)=>note(freq,.34,"sine",.022,.08+index*.28));
}
function soundEffect(kind) {
  if(!audioReady||!soundOn) return;
  if(kind==="coin") {note(880,.09,"sine",.04);note(1320,.13,"sine",.028,.065);}
  if(kind==="jump") {note(370,.13,"triangle",.04);note(590,.18,"triangle",.03,.06);}
  if(kind==="power") [440,660,880].forEach((f,i)=>note(f,.14,"triangle",.032,i*.075));
  if(kind==="hit") {note(165,.25,"sawtooth",.04);note(82,.32,"sine",.05,.07);}
  if(kind==="move") note(300,.06,"sine",.017);
  if(kind==="board") {note(330,.17,"triangle",.04);note(520,.22,"triangle",.03,.08);}
}
window.addEventListener("pointerdown",ensureAudio,{once:true,passive:true});

function resetGame() {
  clearEntities();
  game={
    lane:1,targetX:0,visualX:0,jumpRemaining:0,jumpDuration:.86,
    slideRemaining:0,spawnTimer:.8,speed:22,distance:0,score:0,coins:0,
    magnetTime:0,multiplierTime:0,shield:false,boardCharges:1,boardTime:0,
    boardActive:false,runTime:0,shake:0,hitFlash:0,pattern:0
  };
  playerRig.root.position.set(0,0,PLAYER_Z);
  playerRig.root.scale.set(1,1,1);
  chaserRig.root.position.set(-1.35,0,4.2);
  chaserRig.root.visible=true;
  ui.score.textContent="0";ui.coins.textContent="0";ui.distance.textContent="0 m";
  updateHud();
}
function updateHud() {
  if(!game) return;
  ui.score.textContent=game.score.toLocaleString();
  ui.coins.textContent=game.coins.toLocaleString();
  ui.distance.textContent=Math.floor(game.distance)+" m";
  const powers=[];
  if(game.magnetTime>0) powers.push("MAGNET "+Math.ceil(game.magnetTime)+"s");
  if(game.multiplierTime>0) powers.push("2× SCORE "+Math.ceil(game.multiplierTime)+"s");
  if(game.shield) powers.push("SHIELD READY");
  if(game.boardActive) powers.push("HOVERBOARD "+Math.ceil(game.boardTime)+"s");
  if(game.boardCharges>0) powers.push("BOARD "+game.boardCharges);
  ui.power.textContent=powers.join("  •  ");
}
function showMenu() {
  state="menu";
  ui.menu.classList.remove("hidden");ui.pause.classList.add("hidden");
  ui.over.classList.add("hidden");ui.intro.classList.add("hidden");
  ui.hud.classList.remove("visible");ui.power.textContent="";
  ui.menuBest.textContent=best.toLocaleString();
  ui.swipeHint.classList.add("hidden");
  document.body.classList.remove("is-running");
}
function startGame() {
  ensureAudio();playIntroMusic();resetGame();
  state="intro";
  ui.menu.classList.add("hidden");ui.pause.classList.add("hidden");ui.over.classList.add("hidden");
  ui.intro.classList.remove("hidden");ui.hud.classList.add("visible");
  ui.swipeHint.classList.remove("hidden");
  document.body.classList.add("is-running");
  setTimeout(()=>{
    if(state!=="intro") return;
    state="running";ui.intro.classList.add("hidden");
    updateHud();
  },1550);
  setTimeout(()=>{if(state==="running")ui.swipeHint.classList.add("hidden");},4200);
}
function pauseGame() {
  if(state!=="running") return;
  state="paused";ui.pause.classList.remove("hidden");ui.swipeHint.classList.add("hidden");
}
function resumeGame() {
  if(state!=="paused") return;
  state="running";ui.pause.classList.add("hidden");previousTime=performance.now();
}
function finishGame() {
  if(state!=="running") return;
  state="over";soundEffect("hit");
  game.score=Math.floor(game.distance*2)+game.coins*50*(game.multiplierTime>0?2:1);
  if(game.score>best){best=game.score;localStorage.setItem("chaat-rush-best",String(best));}
  ui.finalScore.textContent=game.score.toLocaleString();
  ui.finalCoins.textContent=game.coins.toLocaleString();
  ui.finalDistance.textContent=Math.floor(game.distance).toLocaleString()+" m";
  ui.finalBest.textContent=best.toLocaleString();
  ui.over.classList.remove("hidden");ui.hud.classList.remove("visible");
  ui.swipeHint.classList.add("hidden");ui.menuBest.textContent=best.toLocaleString();
  document.body.classList.remove("is-running");
}
function moveLane(direction) {
  if(state!=="running") return;
  const next=clamp(game.lane+direction,0,2);
  if(next!==game.lane){game.lane=next;game.targetX=LANES[next];soundEffect("move");}
}
function jump() {
  if(state!=="running"||game.jumpRemaining>0||game.slideRemaining>0) return;
  game.jumpRemaining=game.jumpDuration;soundEffect("jump");
}
function slide() {
  if(state!=="running"||game.slideRemaining>0||game.jumpRemaining>0) return;
  game.slideRemaining=.76;
}
function useBoard() {
  if(state!=="running"||game.boardCharges<1||game.boardActive) return;
  game.boardCharges--;game.boardActive=true;game.boardTime=7;
  soundEffect("board");updateHud();
}
function input(action) {
  if(action==="left")moveLane(-1);
  if(action==="right")moveLane(1);
  if(action==="up")jump();
  if(action==="down")slide();
  if(action==="board")useBoard();
}
window.addEventListener("keydown",(event)=>{
  const key=event.key.toLowerCase();
  const keys=["arrowleft","arrowright","arrowup","arrowdown"," ","a","d","w","s","p","escape","shift","b","enter"];
  if(keys.includes(key))event.preventDefault();
  if(state==="menu"&&(key==="enter"||key===" ")){startGame();return;}
  if(key==="p"||key==="escape"){
    if(state==="running")pauseGame();else if(state==="paused")resumeGame();
    return;
  }
  if(key==="enter"&&state==="paused"){resumeGame();return;}
  if(key==="arrowleft"||key==="a")input("left");
  if(key==="arrowright"||key==="d")input("right");
  if(key==="arrowup"||key==="w"||key===" ")input("up");
  if(key==="arrowdown"||key==="s")input("down");
  if(key==="shift"||key==="b")input("board");
});
canvas.addEventListener("pointerdown",(event)=>{
  if(state!=="running")return;
  const now=performance.now();
  if(now-lastTap<300){swipeStart=null;useBoard();lastTap=0;return;}
  lastTap=now;
  swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId};
  try{canvas.setPointerCapture(event.pointerId);}catch{}
});
canvas.addEventListener("pointerup",(event)=>{
  if(!swipeStart||state!=="running"){swipeStart=null;return;}
  const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
  const threshold=Math.max(24,Math.min(58,Math.min(window.innerWidth,window.innerHeight)*.055));
  if(Math.max(Math.abs(dx),Math.abs(dy))>threshold){
    if(Math.abs(dx)>Math.abs(dy))input(dx>0?"right":"left");
    else input(dy<0?"up":"down");
  }
  swipeStart=null;
});
canvas.addEventListener("pointercancel",()=>{swipeStart=null;});
$("startButton").addEventListener("click",startGame);
$("retryButton").addEventListener("click",startGame);
$("restartButton").addEventListener("click",startGame);
$("resumeButton").addEventListener("click",resumeGame);
$("pauseButton").addEventListener("click",pauseGame);
$("homeButton").addEventListener("click",showMenu);
$("soundButton").textContent=soundOn?"♫":"♪";
$("soundButton").addEventListener("click",()=>{
  soundOn=!soundOn;localStorage.setItem("chaat-rush-sound",soundOn?"on":"off");
  $("soundButton").textContent=soundOn?"♫":"♪";
  $("soundButton").setAttribute("aria-label",soundOn?"Mute sound":"Enable sound");
  if(soundOn){ensureAudio();note(660,.12,"triangle",.04);}
});
$("fullscreenButton").addEventListener("click",async()=>{
  try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.();}
  catch{/* Fullscreen is optional in some browsers. */}
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="running")pauseGame();});
window.addEventListener("blur",()=>{if(state==="running")pauseGame();});

function collectCoin(entity) {
  entity.resolved=true;game.coins++;
  soundEffect("coin");
  removeEntity(entity);
}
function collectPower(entity) {
  entity.resolved=true;
  if(entity.type==="magnet")game.magnetTime=9;
  if(entity.type==="double")game.multiplierTime=10;
  if(entity.type==="shield")game.shield=true;
  if(entity.type==="board")game.boardCharges=Math.min(3,game.boardCharges+1);
  soundEffect("power");removeEntity(entity);updateHud();
}
function collide(entity) {
  if(entity.resolved)return;
  entity.resolved=true;
  if(entity.type==="barrier"&&game.jumpRemaining>.1){removeEntity(entity);return;}
  if(entity.type==="beam"&&game.slideRemaining>.1){removeEntity(entity);return;}
  if(entity.type==="crate"&&game.jumpRemaining>.36){removeEntity(entity);return;}
  if(game.shield){game.shield=false;game.hitFlash=.22;removeEntity(entity);soundEffect("power");updateHud();return;}
  if(game.boardActive){game.boardActive=false;game.boardTime=0;removeEntity(entity);soundEffect("board");updateHud();return;}
  finishGame();
}
function updateEntities(dt) {
  const speed=game.speed;
  for(let index=entities.length-1;index>=0;index--) {
    const entity=entities[index];
    const previous=entity.group.position.z;
    entity.previousZ=previous;
    entity.group.position.z+=speed*dt;
    const current=entity.group.position.z;
    if(entity.kind==="coin") {
      entity.group.rotation.y+=dt*2.4;
      entity.group.position.y=1.25+Math.sin(game.runTime*5+entity.phase)*.09;
      const crossed=(previous<=0&&current>=0)||Math.abs(current)<.5;
      const magnet=game.magnetTime>0&&Math.abs(current)<8&&Math.abs(LANES[game.lane]-entity.group.position.x)<4;
      if((crossed&&entity.lane===game.lane)||magnet)collectCoin(entity);
    } else if(entity.kind==="power") {
      entity.group.rotation.y+=dt*1.65;
      entity.group.position.y=1.55+Math.sin(game.runTime*3+entity.phase)*.12;
      if(((previous<=0&&current>=0)||Math.abs(current)<.45)&&entity.lane===game.lane)collectPower(entity);
    } else {
      if(previous<0&&current>=0&&entity.lane===game.lane)collide(entity);
    }
    if(entity.resolved||current>12){
      removeEntity(entity);entities.splice(index,1);
    }
  }
}
function updateScenery(dt) {
  const move=scenerySpeed*dt;
  for(const marker of roadMarkers) {
    marker.position.z+=move;
    if(marker.position.z>10)marker.position.z-=208;
  }
  for(const item of buildings) {
    item.group.position.z+=move*.86;
    if(item.group.position.z>25)item.group.position.z-=208;
  }
  for(const item of lamps) {
    item.group.position.z+=move;
    if(item.group.position.z>14)item.group.position.z-=205;
  }
}
function updateGame(dt) {
  if(state!=="running"||!game)return;
  game.runTime+=dt;game.speed=Math.min(35,22+game.runTime*.22);
  scenerySpeed=game.speed;
  game.distance+=game.speed*dt*.42;
  game.spawnTimer-=dt;
  if(game.spawnTimer<=0)spawnPattern();
  game.visualX=smooth(game.visualX,game.targetX,1-Math.exp(-dt*13));
  playerRig.root.position.x=game.visualX;
  const jumpProgress=game.jumpRemaining>0?1-game.jumpRemaining/game.jumpDuration:0;
  const jumpHeight=game.jumpRemaining>0?Math.sin(jumpProgress*Math.PI)*1.35:0;
  playerRig.root.position.y=jumpHeight;
  if(game.jumpRemaining>0)game.jumpRemaining=Math.max(0,game.jumpRemaining-dt);
  if(game.slideRemaining>0)game.slideRemaining=Math.max(0,game.slideRemaining-dt);
  playerRig.root.scale.y=game.slideRemaining>0?.62:1;
  playerRig.root.rotation.z=smooth(playerRig.root.rotation.z,0,dt*8);
  chaserRig.root.position.x=smooth(chaserRig.root.position.x,game.visualX+(game.lane===2?-1.35:1.35),dt*2.4);
  chaserRig.root.position.y=Math.sin(game.runTime*11)*.025;
  animateCharacter(playerRig,game.runTime,0);
  animateCharacter(chaserRig,game.runTime,1.8);
  game.magnetTime=Math.max(0,game.magnetTime-dt);
  game.multiplierTime=Math.max(0,game.multiplierTime-dt);
  game.boardTime=Math.max(0,game.boardTime-dt);
  if(game.boardActive&&game.boardTime<=0)game.boardActive=false;
  game.hitFlash=Math.max(0,game.hitFlash-dt);
  game.shake=Math.max(0,game.shake-dt);
  updateEntities(dt);
  updateScenery(dt);
  const magnetGlow=playerRig.root.getObjectByName("shieldGlow");
  if(game.shield&&!magnetGlow) {
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.25,16,12),new THREE.MeshBasicMaterial({color:0x8affc8,transparent:true,opacity:.17,side:THREE.DoubleSide}));
    glow.name="shieldGlow";glow.position.y=1;playerRig.root.add(glow);
  } else if(!game.shield&&magnetGlow)playerRig.root.remove(magnetGlow);
  game.score=Math.floor(game.distance*2)+game.coins*50*(game.multiplierTime>0?2:1);
  updateHud();
}
function updateCamera(dt) {
  if(!game)return;
  const targetX=game.visualX*.23;
  camera.position.x=smooth(camera.position.x,targetX,1-Math.exp(-dt*2.5));
  camera.position.y=smooth(camera.position.y,5.45,1-Math.exp(-dt*2));
  const target=new THREE.Vector3(game.visualX*.13,1.0,-16);
  camera.lookAt(target);
}
function render(time) {
  const dt=Math.min(.04,Math.max(0,(time-(previousTime||time))/1000));
  previousTime=time;
  if(game) {
    if(state==="running")updateGame(dt);
    else {
      animateCharacter(playerRig,time/1000,0);
      animateCharacter(chaserRig,time/1000,1.8);
    }
    updateCamera(dt||.016);
  }
  renderer.render(scene,camera);
  requestAnimationFrame(render);
}
function resize() {
  const ratio=window.matchMedia("(max-width: 700px)").matches?1.2:1.55;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratio));
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize",resize,{passive:true});
if("ResizeObserver" in window) {
  resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(document.querySelector("#app"));
}

function initialize() {
  addLights();buildRoad();buildScenery();buildPlayer();
  camera.position.set(0,5.5,10.5);camera.lookAt(0,1,-15);
}
function boot() {
  initialize();
  ui.menuBest.textContent=best.toLocaleString();
  let progress=0;
  const timer=setInterval(()=>{
    progress=Math.min(100,progress+random(8,17));
    ui.progress.style.width=progress+"%";ui.percent.textContent=Math.floor(progress)+"%";
    if(progress>=100){
      clearInterval(timer);
      setTimeout(()=>{ui.loading.classList.add("done");showMenu();},250);
    }
  },85);
}
if("serviceWorker" in navigator&&location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
boot();
requestAnimationFrame(render);
