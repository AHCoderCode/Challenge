const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const $ = (id) => document.getElementById(id);
const ui = {
  loading: $("loadingScreen"), progress: $("loadingProgress"), percent: $("loadingPercent"),
  menu: $("menuScreen"), pause: $("pauseScreen"), over: $("overScreen"), hud: $("hud"),
  score: $("scoreValue"), coins: $("coinValue"), distance: $("distanceValue"),
  menuBest: $("menuBest"), finalScore: $("finalScore"), finalCoins: $("finalCoins"),
  finalDistance: $("finalDistance"), finalBest: $("finalBest"), power: $("powerStatus"),
  controls: $("mobileControls"), boardCount: $("boardCount")
};
const MAX_Z = 92;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rand = (min, max) => min + Math.random() * (max - min);
const choose = (items) => items[Math.floor(Math.random() * items.length)];
const lerp = (a, b, t) => a + (b - a) * t;
let width = 0, height = 0, dpr = 1, lastTime = 0;
let state = "loading", best = Number(localStorage.getItem("chaat-rush-best") || 0);
let soundOn = localStorage.getItem("chaat-rush-sound") !== "off";
let audioContext = null, audioReady = false, game = null, sceneryOffset = 0, swipeStart = null, introPlayed = false;

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize, { passive: true });
resize();

function ensureAudio() {
  if (!soundOn) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  audioReady = true;
}
function tone(freq, duration = .11, type = "sine", volume = .045, delay = 0) {
  if (!soundOn || !audioContext || !audioReady) return;
  const start = audioContext.currentTime + delay;
  const osc = audioContext.createOscillator(), gain = audioContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(gain); gain.connect(audioContext.destination);
  osc.start(start); osc.stop(start + duration + .02);
}
function playIntroTune() {
  if (!soundOn || !audioContext || introPlayed) return;
  introPlayed = true;
  [523,659,784,659,880,784,659,1046].forEach((n,i) => tone(n,.19,"triangle",.035,i*.13));
  tone(262,.52,"sine",.025,.98);
}
function sfx(kind) {
  if (!audioContext || !audioReady || !soundOn) return;
  if (kind === "coin") { tone(880,.09,"sine",.035); tone(1320,.12,"sine",.025,.07); }
  if (kind === "jump") { tone(370,.13,"triangle",.04); tone(590,.16,"triangle",.03,.06); }
  if (kind === "power") [440,660,880].forEach((n,i) => tone(n,.15,"triangle",.035,i*.07));
  if (kind === "hit") { tone(180,.28,"sawtooth",.04); tone(90,.35,"sine",.045,.08); }
  if (kind === "move") tone(320,.055,"sine",.018);
  if (kind === "board") { tone(300,.17,"triangle",.04); tone(500,.22,"triangle",.03,.08); }
}
window.addEventListener("pointerdown", ensureAudio, { once: true, passive: true });

function newGame() {
  return {
    lane:1, visualLane:1, jumpTime:0, slideTime:0, entities:[], speed:25, spawn:.5,
    distance:0, score:0, coins:0, multiplier:1, multiplierTime:0, magnetTime:0,
    shield:false, boardCharges:1, boardTime:0, boardActive:false, runTime:0,
    hitFlash:0, shake:0, combo:0, lastCoinTime:0, gameOverReason:""
  };
}
function showMenu() {
  state = "menu"; ui.menu.classList.remove("hidden");
  ui.pause.classList.add("hidden"); ui.over.classList.add("hidden");
  ui.hud.classList.remove("visible"); ui.controls.classList.remove("visible");
  ui.power.textContent = ""; ui.menuBest.textContent = best.toLocaleString();
  document.body.classList.remove("is-running");
}
function startGame() {
  ensureAudio(); playIntroTune(); game = newGame(); state = "running";
  ui.menu.classList.add("hidden"); ui.pause.classList.add("hidden"); ui.over.classList.add("hidden");
  ui.hud.classList.add("visible"); ui.controls.classList.add("visible");
  document.body.classList.add("is-running"); updateHud(); sfx("power");
}
function pauseGame() {
  if (state !== "running") return;
  state = "paused"; ui.pause.classList.remove("hidden"); ui.controls.classList.remove("visible");
}
function resumeGame() {
  if (state !== "paused") return;
  state = "running"; ui.pause.classList.add("hidden"); ui.controls.classList.add("visible");
  lastTime = performance.now();
}
function finishGame(reason) {
  if (state !== "running") return;
  state = "over"; game.gameOverReason = reason || "Obstacle collision"; sfx("hit");
  game.score = Math.floor(game.distance * 2) + game.coins * 50 * (game.multiplierTime > 0 ? 2 : 1);
  if (game.score > best) { best = game.score; localStorage.setItem("chaat-rush-best", String(best)); }
  ui.finalScore.textContent = game.score.toLocaleString();
  ui.finalCoins.textContent = game.coins.toLocaleString();
  ui.finalDistance.textContent = Math.floor(game.distance).toLocaleString() + " m";
  ui.finalBest.textContent = best.toLocaleString();
  ui.over.classList.remove("hidden"); ui.controls.classList.remove("visible");
  ui.hud.classList.remove("visible"); ui.menuBest.textContent = best.toLocaleString();
  document.body.classList.remove("is-running");
}
function updateHud() {
  if (!game) return;
  ui.score.textContent = game.score.toLocaleString(); ui.coins.textContent = game.coins.toLocaleString();
  ui.distance.textContent = Math.floor(game.distance) + " m"; ui.boardCount.textContent = game.boardCharges;
  const powers = [];
  if (game.magnetTime > 0) powers.push("MAGNET " + Math.ceil(game.magnetTime) + "s");
  if (game.multiplierTime > 0) powers.push("2× SCORE " + Math.ceil(game.multiplierTime) + "s");
  if (game.shield) powers.push("SHIELD READY");
  if (game.boardActive) powers.push("HOVERBOARD " + Math.ceil(game.boardTime) + "s");
  ui.power.textContent = powers.join("  •  ");
}
function moveLane(direction) {
  if (state !== "running") return;
  const before = game.lane; game.lane = clamp(game.lane + direction,0,2);
  if (before !== game.lane) sfx("move");
}
function jump() {
  if (state !== "running" || game.jumpTime > 0 || game.slideTime > 0) return;
  game.jumpTime = .82; sfx("jump");
}
function slide() {
  if (state !== "running" || game.slideTime > 0 || game.jumpTime > 0) return;
  game.slideTime = .72;
}
function activateBoard() {
  if (state !== "running" || game.boardCharges < 1 || game.boardActive) return;
  game.boardCharges--; game.boardActive = true; game.boardTime = 7.5;
  sfx("board"); updateHud();
}
function action(name) {
  if (name === "left") moveLane(-1);
  if (name === "right") moveLane(1);
  if (name === "up") jump();
  if (name === "down") slide();
  if (name === "board") activateBoard();
}
window.addEventListener("keydown",(event) => {
  const key = event.key.toLowerCase();
  const handled = ["arrowleft","arrowright","arrowup","arrowdown"," ","a","d","w","s","p","escape","shift","enter"];
  if (handled.includes(key)) event.preventDefault();
  if (state === "menu" && (key === "enter" || key === " ")) { startGame(); return; }
  if (key === "p" || key === "escape") {
    if (state === "running") pauseGame(); else if (state === "paused") resumeGame();
    return;
  }
  if (key === "enter" && state === "paused") { resumeGame(); return; }
  if (key === "arrowleft" || key === "a") action("left");
  if (key === "arrowright" || key === "d") action("right");
  if (key === "arrowup" || key === "w" || key === " ") action("up");
  if (key === "arrowdown" || key === "s") action("down");
  if (key === "shift") action("board");
});
canvas.addEventListener("pointerdown",(event) => {
  if (state !== "running") return;
  swipeStart = {x:event.clientX,y:event.clientY};
  try { canvas.setPointerCapture(event.pointerId); } catch {}
});
canvas.addEventListener("pointerup",(event) => {
  if (!swipeStart || state !== "running") { swipeStart = null; return; }
  const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
  if (Math.max(Math.abs(dx),Math.abs(dy)) > 22) {
    if (Math.abs(dx) > Math.abs(dy)) action(dx > 0 ? "right" : "left");
    else action(dy < 0 ? "up" : "down");
  }
  swipeStart = null;
});
canvas.addEventListener("pointercancel",() => { swipeStart = null; });
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("pointerdown",(event) => {
  event.preventDefault(); action(button.dataset.action);
}));
$("boardButton").addEventListener("pointerdown",(event) => { event.preventDefault(); activateBoard(); });
$("startButton").addEventListener("click",startGame);
$("retryButton").addEventListener("click",startGame);
$("restartButton").addEventListener("click",startGame);
$("resumeButton").addEventListener("click",resumeGame);
$("pauseButton").addEventListener("click",pauseGame);
$("homeButton").addEventListener("click",showMenu);
$("soundButton").addEventListener("click",() => {
  soundOn = !soundOn; localStorage.setItem("chaat-rush-sound",soundOn ? "on" : "off");
  $("soundButton").textContent = soundOn ? "♫" : "♪";
  $("soundButton").setAttribute("aria-label",soundOn ? "Mute sound" : "Enable sound");
  if (soundOn) { ensureAudio(); tone(660,.12,"triangle",.04); }
});
$("soundButton").textContent = soundOn ? "♫" : "♪";
$("fullscreenButton").addEventListener("click",async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch { /* Fullscreen is not available in every browser. */ }
});
document.addEventListener("visibilitychange",() => { if (document.hidden && state === "running") pauseGame(); });

function spawnPattern() {
  const safeLane = Math.floor(Math.random()*3);
  const blocked = [0,1,2].filter((lane) => lane !== safeLane);
  const addSecond = Math.random() > .43;
  game.entities.push({kind:"obstacle",type:choose(["crate","barrier","beam","train"]),lane:blocked[0],z:MAX_Z,hit:false});
  if (addSecond) game.entities.push({kind:"obstacle",type:choose(["crate","barrier","beam"]),lane:blocked[1],z:MAX_Z + rand(-1,1),hit:false});
  const coinLane = Math.random() < .68 ? safeLane : Math.floor(Math.random()*3);
  for (let i=0;i<5;i++) game.entities.push({kind:"coin",lane:coinLane,z:MAX_Z-15-i*4.2,collected:false});
  if (Math.random() < .22) {
    game.entities.push({kind:"power",type:choose(["magnet","double","shield","board"]),lane:safeLane,z:MAX_Z-6,collected:false});
  }
  game.spawn = rand(1.05,1.38) * (25/game.speed);
}
function collectCoin(entity) {
  entity.collected = true; game.coins++; game.combo++; game.lastCoinTime = 1.25;
  game.score += 50 * (game.multiplierTime > 0 ? 2 : 1); sfx("coin");
}
function collectPower(entity) {
  entity.collected = true;
  if (entity.type === "magnet") game.magnetTime = 9;
  if (entity.type === "double") game.multiplierTime = 10;
  if (entity.type === "shield") game.shield = true;
  if (entity.type === "board") game.boardCharges = Math.min(3,game.boardCharges+1);
  sfx("power"); updateHud();
}
function hitObstacle(entity) {
  if (entity.hit) return;
  entity.hit = true;
  if (entity.type === "barrier" && game.jumpTime > .08) return;
  if (entity.type === "beam" && game.slideTime > .08) return;
  if (game.shield) { game.shield = false; game.hitFlash = .34; game.shake = .15; return; }
  if (game.boardActive) {
    game.boardActive = false; game.boardTime = 0; game.hitFlash = .38; game.shake = .18; sfx("board"); return;
  }
  finishGame("Obstacle collision");
}
function update(dt) {
  if (state !== "running" || !game) return;
  game.runTime += dt; game.speed = Math.min(43,25+game.runTime*.36);
  game.distance += game.speed*dt*.42;
  game.score += Math.floor(game.speed*dt*1.8) * (game.multiplierTime > 0 ? 2 : 1);
  game.spawn -= dt; if (game.spawn <= 0) spawnPattern();
  game.visualLane += (game.lane-game.visualLane)*Math.min(1,dt*15);
  game.jumpTime = Math.max(0,game.jumpTime-dt); game.slideTime = Math.max(0,game.slideTime-dt);
  game.magnetTime = Math.max(0,game.magnetTime-dt); game.multiplierTime = Math.max(0,game.multiplierTime-dt);
  game.boardTime = Math.max(0,game.boardTime-dt); if (game.boardActive && game.boardTime <= 0) game.boardActive = false;
  game.hitFlash = Math.max(0,game.hitFlash-dt); game.shake = Math.max(0,game.shake-dt);
  game.lastCoinTime = Math.max(0,game.lastCoinTime-dt);
  sceneryOffset = (sceneryOffset+game.speed*dt*.012)%1;
  for (const entity of game.entities) {
    entity.z -= game.speed*dt;
    if (entity.kind === "coin" && !entity.collected) {
      const close = entity.z < 2.8 && entity.z > -1.2;
      const magnet = game.magnetTime > 0 && entity.z < 17 && entity.z > 0 && Math.abs(entity.lane-game.lane) <= 1;
      if ((close && entity.lane === game.lane) || magnet) collectCoin(entity);
    }
    if (entity.kind === "power" && !entity.collected && entity.z < 2.8 && entity.z > -1.2 && entity.lane === game.lane) collectPower(entity);
    if (entity.kind === "obstacle" && !entity.hit && entity.z < 2.35 && entity.z > -1.4 && entity.lane === game.lane) hitObstacle(entity);
  }
  game.entities = game.entities.filter((entity) => entity.z > -8 && !entity.collected);
  game.score = Math.floor(game.distance*2) + game.coins*50*(game.multiplierTime > 0 ? 2 : 1);
  updateHud();
}
function roadMetrics(depth) {
  const roadWidth = lerp(width*.12,width*.93,depth);
  return {roadWidth,center:width/2,laneWidth:roadWidth/3};
}
function project(lane,z) {
  const depth = clamp(1-z/MAX_Z,0,1), curve = Math.pow(depth,1.42);
  const y = height*.205 + (height*.91-height*.205)*curve;
  const metrics = roadMetrics(curve);
  return {x:metrics.center+(lane-1)*metrics.laneWidth,y,scale:.16+curve*1.25,depth:curve,laneWidth:metrics.laneWidth};
}
function polygon(points,fill,stroke=null,lineWidth=1) {
  ctx.beginPath();
  points.forEach((point,index) => index ? ctx.lineTo(point[0],point[1]) : ctx.moveTo(point[0],point[1]));
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=lineWidth; ctx.stroke(); }
}
function drawBackground(time) {
  const sky = ctx.createLinearGradient(0,0,0,height);
  sky.addColorStop(0,"#193b58"); sky.addColorStop(.46,"#5e8993");
  sky.addColorStop(.72,"#f0ae79"); sky.addColorStop(1,"#f4c48a");
  ctx.fillStyle=sky; ctx.fillRect(0,0,width,height);
  const sunX=width*.77,sunY=height*.22,sunR=Math.min(width,height)*.07;
  const glow=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,sunR*2.5);
  glow.addColorStop(0,"#fff2b9aa"); glow.addColorStop(1,"#ffcc7a00");
  ctx.fillStyle=glow; ctx.fillRect(sunX-sunR*3,sunY-sunR*3,sunR*6,sunR*6);
  ctx.fillStyle="#ffe7af"; ctx.beginPath(); ctx.arc(sunX,sunY,sunR,0,Math.PI*2); ctx.fill();
  const baseY=height*.45;
  for(let i=0;i<14;i++) {
    const bw=width*(.035+(i%3)*.012),bh=height*(.12+((i*17)%11)/100);
    const x=i*width/12-((sceneryOffset*width*.06)%(width/12));
    ctx.fillStyle="#1b384b"; ctx.fillRect(x,baseY-bh,bw,bh);
    ctx.fillStyle="#e7bd8b88";
    for(let wx=0;wx<2;wx++) for(let wy=0;wy<3;wy++) ctx.fillRect(x+bw*(.2+wx*.38),baseY-bh+9+wy*13,3,5);
  }
  polygon([[0,height*.52],[width*.2,height*.42],[width*.38,height*.51],[width*.56,height*.44],[width*.79,height*.5],[width,height*.42],[width,height],[0,height]],"#b77d68");
  polygon([[0,height*.59],[width*.16,height*.48],[width*.31,height*.56],[width*.52,height*.47],[width*.72,height*.57],[width*.9,height*.49],[width,height*.55],[width,height]],"#7f8b72");
}
function drawRoad() {
  const horizon=height*.205,topWidth=width*.115,bottomWidth=width*.94;
  const topL=width/2-topWidth/2,topR=width/2+topWidth/2,bottomL=width/2-bottomWidth/2,bottomR=width/2+bottomWidth/2;
  polygon([[topL,horizon],[topR,horizon],[bottomR,height*1.02],[bottomL,height*1.02]],"#253442");
  polygon([[topL-6,horizon],[topL,horizon],[bottomL-18,height],[bottomL-52,height]],"#e6b47c");
  polygon([[topR,horizon],[topR+6,horizon],[bottomR+52,height],[bottomR+18,height]],"#e6b47c");
  ctx.strokeStyle="#d6f4e6aa"; ctx.lineWidth=Math.max(1,width*.002);
  for(let lane=1;lane<=2;lane++) {
    ctx.beginPath(); ctx.moveTo(topL+topWidth*lane/3,horizon);
    ctx.lineTo(bottomL+bottomWidth*lane/3,height); ctx.stroke();
  }
  const dashCount=16;
  for(let i=0;i<dashCount;i++) {
    const progress=(i/dashCount+sceneryOffset*.8)%1,depth=Math.pow(progress,1.7);
    const y=horizon+depth*(height-horizon),roadW=lerp(topWidth,bottomWidth,depth);
    const dashH=2+depth*18,dashW=1+depth*4;
    ctx.fillStyle="#f1f7e8";
    for(let lane=1;lane<=2;lane++) ctx.fillRect(width/2-roadW/2+roadW*lane/3-dashW/2,y,dashW,dashH);
  }
  ctx.strokeStyle="#a5ffd0aa"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(topL,horizon); ctx.lineTo(bottomL,height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(topR,horizon); ctx.lineTo(bottomR,height); ctx.stroke();
}
function drawStreetDetails() {
  for(let side=0;side<2;side++) for(let i=0;i<7;i++) {
    const z=(i*15+sceneryOffset*95)%MAX_Z,depth=1-z/MAX_Z,curve=Math.pow(depth,1.42);
    const y=height*.205+(height*.86-height*.205)*curve,roadW=roadMetrics(curve).roadWidth;
    const x=width/2+(side?1:-1)*(roadW/2+width*(.04+curve*.12)),s=.15+curve*1.2;
    ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
    ctx.fillStyle="#314a50"; ctx.fillRect(-3,-67,6,68);
    ctx.fillStyle="#f7d69a"; ctx.fillRect(-12,-70,24,7);
    ctx.fillStyle="#fff1bd"; ctx.beginPath(); ctx.arc(0,-66,8,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}
function drawCoin(entity,time) {
  const p=project(entity.lane,entity.z),r=7*p.scale+p.depth*9,bob=Math.sin(time*.008+entity.z)*r*.14;
  ctx.save(); ctx.translate(p.x,p.y-r*1.7+bob);
  ctx.shadowColor="#ffd75e"; ctx.shadowBlur=13*p.scale; ctx.fillStyle="#ffc94f";
  ctx.beginPath(); ctx.ellipse(0,0,r*.74,r,Math.sin(time*.006+entity.z)*.5,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0; ctx.strokeStyle="#fff0a5"; ctx.lineWidth=Math.max(1,r*.16); ctx.stroke();
  ctx.fillStyle="#fff4bf"; ctx.font="bold "+Math.max(5,r*1.05)+"px sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("✦",0,0); ctx.restore();
}
function drawPower(entity,time) {
  const p=project(entity.lane,entity.z),size=22*p.scale+p.depth*14;
  const colors={magnet:"#6ce7f5",double:"#ffd66d",shield:"#a7ffce",board:"#ff9e77"};
  const symbols={magnet:"M",double:"2×",shield:"◇",board:"B"};
  ctx.save(); ctx.translate(p.x,p.y-size*1.5+Math.sin(time*.006)*size*.12);
  ctx.rotate(Math.sin(time*.002+entity.z)*.09); ctx.shadowColor=colors[entity.type]; ctx.shadowBlur=size*.55;
  ctx.fillStyle="#122a3f"; ctx.beginPath(); ctx.roundRect(-size/2,-size/2,size,size,size*.28); ctx.fill();
  ctx.strokeStyle=colors[entity.type]; ctx.lineWidth=Math.max(1.2,size*.08); ctx.stroke();
  ctx.shadowBlur=0; ctx.fillStyle=colors[entity.type]; ctx.font="900 "+Math.max(8,size*.42)+"px sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(symbols[entity.type],0,1); ctx.restore();
}
function drawObstacle(x,y,s,type) {
  const w=43*s,h=48*s,d=9*s;
  if(type==="crate") {
    polygon([[x-w/2,y-h],[x+w/2,y-h],[x+w/2+d,y-h-d],[x-w/2+d,y-h-d]],"#d28d54");
    ctx.fillStyle="#9e603d"; ctx.fillRect(x-w/2,y-h,w,h);
    polygon([[x+w/2,y-h],[x+w/2+d,y-h-d],[x+w/2+d,y-d],[x+w/2,y]],"#714936");
    ctx.strokeStyle="#f1bd7d"; ctx.lineWidth=2*s; ctx.strokeRect(x-w/2+5*s,y-h+5*s,w-10*s,h-10*s);
    ctx.beginPath(); ctx.moveTo(x-w/2+5*s,y-h/2); ctx.lineTo(x+w/2-5*s,y-h/2); ctx.stroke();
  } else if(type==="barrier") {
    const bh=22*s; ctx.fillStyle="#47535b"; ctx.fillRect(x-w*.38,y-bh,w*.76,bh);
    ctx.fillStyle="#f5cf71"; ctx.fillRect(x-w*.55,y-bh-15*s,w*1.1,15*s);
    for(let i=0;i<5;i++) { ctx.fillStyle="#c65d4c"; ctx.fillRect(x-w*.5+i*w*.22,y-bh-15*s,w*.1,15*s); }
    ctx.fillStyle="#344550"; ctx.fillRect(x-w*.42,y,5*s,13*s); ctx.fillRect(x+w*.3,y,5*s,13*s);
  } else if(type==="beam") {
    ctx.fillStyle="#53636d"; ctx.fillRect(x-w*.46,y-h*1.85,w*.13,h*1.85); ctx.fillRect(x+w*.33,y-h*1.85,w*.13,h*1.85);
    ctx.fillStyle="#e46d56"; ctx.fillRect(x-w*.56,y-h*1.9,w*1.12,13*s);
    ctx.fillStyle="#ffe2ad"; ctx.font="900 "+Math.max(6,9*s)+"px sans-serif"; ctx.textAlign="center"; ctx.fillText("DUCK",x,y-h*1.9+9*s);
  } else {
    ctx.fillStyle="#b94743"; ctx.fillRect(x-w*.62,y-h*1.8,w*1.24,h*1.8);
    ctx.fillStyle="#f5c46f"; ctx.fillRect(x-w*.53,y-h*1.5,w*1.06,h*.12);
    ctx.fillStyle="#182f44"; for(let i=0;i<3;i++) ctx.fillRect(x-w*.43+i*w*.34,y-h*1.67,w*.2,h*.52);
    ctx.fillStyle="#e4e8da"; ctx.fillRect(x-w*.48,y-h*.19,w*.96,h*.11);
    ctx.fillStyle="#303d4b"; ctx.beginPath(); ctx.arc(x-w*.32,y+2*s,8*s,0,Math.PI*2); ctx.arc(x+w*.32,y+2*s,8*s,0,Math.PI*2); ctx.fill();
  }
}
function drawRunner(x,baseY,scale,time,isChaser=false,jumpHeight=0,sliding=false,board=false) {
  ctx.save(); ctx.translate(x,baseY-jumpHeight); ctx.scale(scale,scale);
  const bob=Math.sin(time*(isChaser?.012:.018)+(isChaser?1.6:0))*(isChaser?2:3);
  const swing=Math.sin(time*.018+(isChaser?1.6:0))*(sliding?.18:.72);
  const skin=isChaser?"#bd865f":"#9b6046",shirt=isChaser?"#56768d":"#1fc2ae";
  const torsoW=isChaser?27:39,torsoH=sliding?23:38;
  ctx.fillStyle="#06142355"; ctx.beginPath(); ctx.ellipse(0,1,(board?32:23),6,0,0,Math.PI*2); ctx.fill();
  if(board) {
    ctx.fillStyle="#ff9f68"; ctx.beginPath(); ctx.roundRect(-28,-3,56,7,4); ctx.fill();
    ctx.fillStyle="#fff0ce"; ctx.fillRect(-21,4,6,3); ctx.fillRect(15,4,6,3);
  }
  if(!sliding) {
    for(let i=0;i<2;i++) {
      const side=i===0?-1:1,step=swing*(i===0?1:-1),hipX=side*(isChaser?8:12);
      ctx.save(); ctx.translate(hipX,-25+Math.max(0,step)*7); ctx.rotate(step*.55);
      ctx.strokeStyle=isChaser?"#273b4c":"#153b45"; ctx.lineWidth=isChaser?7:9; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(side*3,19); ctx.lineTo(side*7+step*7,32); ctx.stroke();
      ctx.fillStyle=isChaser?"#d6ddd9":"#ffb46b"; ctx.beginPath(); ctx.roundRect(side*3+step*7-7,28,17,7,3); ctx.fill();
      ctx.restore();
    }
  } else {
    ctx.fillStyle="#153b45"; ctx.beginPath(); ctx.roundRect(-24,-16,48,12,6); ctx.fill();
    ctx.fillStyle="#ffb46b"; ctx.beginPath(); ctx.roundRect(-27,-7,17,7,3); ctx.roundRect(11,-7,17,7,3); ctx.fill();
  }
  ctx.strokeStyle=skin; ctx.lineWidth=9; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(-torsoW*.4,-48+bob); ctx.lineTo(-torsoW*.72,-33+swing*8+bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(torsoW*.4,-48+bob); ctx.lineTo(torsoW*.72,-35-swing*8+bob); ctx.stroke();
  ctx.fillStyle=shirt; ctx.beginPath(); ctx.roundRect(-torsoW/2,-58+bob,torsoW,torsoH,10); ctx.fill();
  ctx.fillStyle=isChaser?"#e0c9a5":"#0f8c87";
  if(isChaser) ctx.fillRect(-2,-54+bob,4,20); else { ctx.beginPath(); ctx.roundRect(-torsoW*.34,-30+bob,torsoW*.68,9,4); ctx.fill(); }
  ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(0,-70+bob,isChaser?13:15,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=isChaser?"#2b2830":"#211f27"; ctx.beginPath();
  if(isChaser) {
    ctx.arc(0,-75+bob,14,Math.PI,Math.PI*2); ctx.lineTo(14,-67+bob);
    ctx.quadraticCurveTo(18,-58+bob,12,-57+bob); ctx.lineTo(10,-67+bob);
    ctx.lineTo(7,-58+bob); ctx.lineTo(4,-68+bob); ctx.lineTo(0,-59+bob);
    ctx.lineTo(-5,-67+bob); ctx.lineTo(-10,-59+bob); ctx.lineTo(-13,-68+bob); ctx.closePath();
  } else {
    ctx.arc(0,-74+bob,15,Math.PI,Math.PI*2); ctx.lineTo(14,-70+bob); ctx.lineTo(7,-73+bob);
    ctx.lineTo(1,-68+bob); ctx.lineTo(-5,-72+bob); ctx.lineTo(-14,-68+bob); ctx.closePath();
  }
  ctx.fill(); ctx.fillStyle="#fff6e8"; ctx.beginPath(); ctx.arc(-5,-70+bob,2.1,0,Math.PI*2); ctx.arc(5,-70+bob,2.1,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#202c35"; ctx.beginPath(); ctx.arc(-5,-70+bob,1,0,Math.PI*2); ctx.arc(5,-70+bob,1,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#533b35"; ctx.lineWidth=1.3; ctx.beginPath(); ctx.arc(0,-64+bob,4,.15,Math.PI-.15); ctx.stroke();
  ctx.fillStyle=isChaser?"#f0d28e":"#e7fff0"; ctx.beginPath(); ctx.arc(0,isChaser?-77+bob:-48+bob,3,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawEntities(time) {
  if(!game) return;
  const sorted=[...game.entities].sort((a,b)=>b.z-a.z);
  for(const entity of sorted) {
    if(entity.collected||entity.z>MAX_Z||entity.z< -1) continue;
    if(entity.kind==="coin") drawCoin(entity,time);
    else if(entity.kind==="power") drawPower(entity,time);
    else { const p=project(entity.lane,entity.z); drawObstacle(p.x,p.y,p.scale,entity.type); }
  }
}
function drawFrame(time) {
  ctx.save();
  if(game&&game.shake>0) { const j=game.shake*18; ctx.translate(rand(-j,j),rand(-j,j)); }
  drawBackground(time); drawRoad(); drawStreetDetails(); drawEntities(time);
  const playerY=height*.875,playerLane=game?game.visualLane:1,laneSpacing=roadMetrics(.86).laneWidth;
  const playerX=width/2+(playerLane-1)*laneSpacing;
  const jumpHeight=game&&game.jumpTime>0?Math.sin((1-game.jumpTime/.82)*Math.PI)*height*.105:0;
  const sliding=Boolean(game&&game.slideTime>0),board=Boolean(game&&game.boardActive);
  const scale=clamp(height/720,.72,1.22);
  if(game&&state==="running"&&game.hitFlash>0) { ctx.fillStyle="rgba(255,255,255,"+(game.hitFlash*.3)+")"; ctx.fillRect(0,0,width,height); }
  const chaserY=height*(.955-Math.min(.045,(game?.runTime||0)*.0007));
  drawRunner(playerX,playerY,scale,time,false,jumpHeight,sliding,board);
  drawRunner(width/2+(game?(game.visualLane-1)*laneSpacing*.42:-laneSpacing*.42),chaserY,scale*.68,time+80,true,0,false,false);
  if(game&&game.boardActive) { ctx.save(); ctx.globalAlpha=.32; ctx.fillStyle="#a5ffd0"; ctx.fillRect(0,0,width,height); ctx.restore(); }
  ctx.restore();
}
function loop(time) {
  const dt=Math.min(.04,Math.max(0,(time-(lastTime||time))/1000));
  lastTime=time; update(dt); drawFrame(time); requestAnimationFrame(loop);
}
function boot() {
  ui.menuBest.textContent=best.toLocaleString(); let progress=0;
  const loadTimer=setInterval(() => {
    progress=Math.min(100,progress+rand(8,17)); ui.progress.style.width=progress+"%"; ui.percent.textContent=Math.floor(progress)+"%";
    if(progress>=100) { clearInterval(loadTimer); setTimeout(() => { ui.loading.classList.add("done"); showMenu(); },250); }
  },85);
}
if("serviceWorker" in navigator&&location.protocol.startsWith("http")) {
  window.addEventListener("load",() => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
boot(); requestAnimationFrame(loop);
