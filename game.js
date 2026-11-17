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
  swipeHint:$("swipeHint"),ready:$("readyScreen"),
  soundButton:$("soundButton"),chantButton:$("chantButton"),volumeSlider:$("volumeSlider"),volumeValue:$("volumeValue")
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
let masterVolume = clamp(Number(localStorage.getItem("chaat-rush-volume") ?? 90) / 100,0,1);
let chantEnabled = localStorage.getItem("chaat-rush-chant") !== "off";
let chantSession = 0;
let audioContext = null;
let masterGainNode = null;
let audioReady = false;
let introPlayed = false;
let game = null;
let previousTime = 0;
let scenerySpeed = 22;
let swipeStart = null;
let lastTap = 0;
let qualityScale = 1;
let perfTime = 0, perfTotal = 0, perfFrames = 0;
let scene, camera, renderer, world, playerRig, chaserRig;
let roadMarkers = [], buildings = [], lamps = [], entities = [], speedStreaks = [];
let streaksGroup;
let resizeObserver;
const RUNNER_FACE_DATA_URL = "data:image/webp;base64,UklGRpQRAABXRUJQVlA4WAoAAAAQAAAAfwAAfwAAQUxQSB0FAAABoAVJtmnb6rFxbdu2bdu2bdt4tm3btm1e2/dYe5/Rz2uutef8ex8RMQHwLuh7hErrZt9bB4KAhlZl2oipDzRFMAWlHqHSxvGXu4YggWj3k52U+smIvBD/IAvT7PT3X+YUhu+CIndSaWnlsXWlA9DkC3tRef6yChC/ply0GJVJC8L+CArcoEqL5/L1mhB/ar1HqymT5obgz/BTdqPyxSoQc4K8l8Std2acP1Veo9Luqg+WgfjQ+5D9eHyED4hszLYeVe8uDjEkKPcsldbjvp4+dPzVAWT82sIQM5DF6S5Q/tLNkCD/9VS6MHZJPoiZ4o+4Qfl8OVMVXnbF+zVN1frQFd80NdX8e1f83sFUlwOuON7P1JDTrrgwztSUZFekzzcDLMl0Rc5agUFBeFvcDaReGoWYyHctHam8raCZovdTXfFoCTPlnnfHKxXN1P3EHR/VNtP1gDu+b25marI79nc2gcj2uDtODjIgKHY/la5Immyk5vsOSZ5ipNM+hxztY2TSRYd818wAwltiDnm7qjdBkXuodMbDxU1Ue9sd1CvymGj/mzOU2asEngVjzzvk4kSIJ4TW5zjkUA9vgmL3U+mMb5qYaPKlS96obGLSeZfcV9STIP+1SnfqpVEDNd+hukKZtQyeBUNPuOTcGIgHQXR7jM5UHuhqoOLzVId83sBAjwNOeaK0J4RWZDqEubujXgSlHqbSlcqkqRB4af2DU/Z19iYzk53yZjUvgvC2uFNuLegFgjmp7lBmLhd4FfQ84pITAyHe6n7ski8amSj+sEueKGUisjNOdYMyvivqDYIpSe5ImgKBgc773PFbBzPV33HHG1XMFLnHHbcUNAGEN+RQXaDMWiEwKRh+yhXH+kPMVH3BFS9XNQPI7ItU+ynTV4RhVlDjFTd83RJiBggtSKZaj7nXFTImqP2m/ZRHBkFgPLwkhWq9J8r5IKj3ju2UKXNFYF4iK9KolvukMXxBg/ctx9jefL4A0TXpVIsp9/WEwE9B44+tRt5f0icguiGDai3l+anwW9D8M6u9XRviE5B3QzrVUsq0VVH4Lmjwjr30yRoQ3yDhOeepVlJ+2wOCAKDCo3ZSnpmXRxBEwbDDVBtlX1cSQSl2Q0zVOspXG0IQTEGHb2gd5a8DRRCYfJvSqXZRXlyZD4GBoN4b1ondWQ6C4EpoxjmqTZTvtYQgSKjwiNpEeXBMSBBowaADVGsoU7cUROCKXBtTtYRq7iNVIAi4oN0XtAY/7QRB8KNjv6PaQJn73oAIEjI66DNq4imzn24vSEhBaODn1ERTpt5eH4kqCPd6R6kJpTyzpxIkUf7e5R0m+IHlJSBIZOn8cpyaQN9MLABBYqHF87nUxFDmvt0vAkGCC1o9k01NBGXWk20FgoQXNHgwhxo8ZfItdWFHQf2HsqgaMOXpnRUgdoCg9m3ppGqAlNy/tDgEthRU2/xpGqkaECX1iwn5IbCnIF+zVW9eIKkBUDL2681dohDYVIBInZlPniCp6osqGf/l6u7FAIFdRQBUHHX3vhipakyVzPnuyh6FAYGFBUDJXld+m0WqGlEls76/rGNBQAR2FgEKttv6QTJJ/ef/oEpmf7WjQ0FABPYWAfI2WPTSWf67/iuZ/vmuNvkAEdhdBAhVm3rj429/s/90ao7yXzM/29g8PyAC+4sAKFi6erNuw+dsuvrBVz/95XjShfc3tMgLiMCRgn8N5y9RuUH7gdMmN4oCInCo/DP+qwicLP8R/+cIAFZQOCBQDAAAED0AnQEqgACAAD45FolDIiEhGrnfOCADhLGAYuAHaEpV16bvIgrt8/gdO/zAP1T6mfmO/YT9O+y96AH6jdY/6AH8A/sXpyfrl8FX7VftD8An8P/ov/E/P/QXfPl4w/ovxZ87fJ78n9yuS7FB+YfmHIezr2w3qWf1T/Veyd/h/9D7jPfx+Wf6L/n+4N/Iv59/qfzo/xXIN/rKxCvn/vodUro/us2F0brAg/ecyNfnAGR6w/2D8OloVs3Y++1yF3Q+79l5CgvAXxw/nmRgu3ApFwsiz5oAOByJInFK9KjUmnt4sHQrhjnNf6mdQ9bpMDFQA8U0oP9ylNQLBr4u+2O8hGgbFWEXJAOcitwHhKt9AjHxjKwGfdsH0ziyh6NlpwAxS0yrnnEFRPpqF6KXo46bYFxTKv4zIKK0LO/zghAfXGSgaYn/uYS6WDkWuOvEDw51ldz/CGXDxItVrVmYNS8YtIH/IdfnY/FPETBXxwnqMG0zY9DlCTJ/vxzMkLQC+o17L+7bCTK6Vd3tDJPgDTjVqDOtgOGE6qHUIPo/RQWp25VaN7Ud8lfZu1T8Z2f6QVacmaDvDGPRdoFciNPJ8wEZKathQNVKXEbSqkAPAjg1+5gn6jLeHOppJCx2Bg+epQ6Azz+atFiOof/xp6wQsUy3uAAA/v/ycVbwU5IPlfgKF+ZtO+qe+c9pen/X2dnchR5FlEGTX9JK9LdrUt5bT3w8c/UyQ5WhEWTokq9z6GSN2Pz4824RwLEv0G/io8P4WMYI7CjsC4rEPgPIV1+oOOrMBbRFS/5Pw/sCyD9GPEFk1EUCktP9pMyNdTuRzkLtLRcidV6ZiokyGH+2UgbtxFeiO7Oes0jTYZY8dRE9dRqABXB+cwjCcMtpCe0N4M/vGDm9dLqinvC5yNu6jJzVsEvx2BAt1pVDQwuz3GlTFj4O+kv38mAw7Ddzd7SdXylTDg/LzzPZ1Ili+2jtccfcEYfeACSh8XC4yvJlFe+Lz2jE3bDkkHmKh2KVsAXFHo6+xTDiC3CR+bhbxNCbjtOibahPC7MKIgQWESyvmWlPxyB6XQpf4RvfxbmUMQGA4Ea1oWxWWke9SqPwmUsmMuJTfm8Ue1Fvn/SuVsReVv/xBolx8le3VX06NApsqA0yrgx42iv/rrW/+oipPsUi5Xu1Kt0pKLKfYJPwoa0Q5vNw8zqrVMt4n/LyoclQR/9vY9/nIa1nEn2+uM9xGFmp/j+kREEYsq+FlaRA06NkS2OYP9eOD7LLWHRb9QiTg+bWRynRbkavUYtI+ESZm81BMeQDBGKoM88Y9lN3W+gvuc6bcGEsxlxr2qwwg5FTcYamnlUaARX+V4wN4VaTzA6z4f6NgnEglBx5R/YKsBUWHfaqYSX4xSjR1wtCucx7Y/vXCRk7Iw9AI9oDOatdx0YZYQO4MRfglLe0w1x1VjhW1dKO0vFXlG+X0LenY4PY6Up9yTOkWnP+fT6c8aC8TkN1QBoMRLouABi7zsOJvMZGRuO7/Nk9P8U46XdSo5gW/tq+LlCj0oRm+XqrVDoPRNSoI4/CzihvZFmT5SRMCUnpzXInlbAUnIYXi9Vmza/CZXBFnHUteZzcTYsbU5p8xVHVm5KcU3iA8aymDHW+9nyYSqafMGZxdU/vSfbBp4GMuOpk2w5vddBMVvbaJZmxooKnm9U+c9mg5q9h6qba6qA5xK8RyN4xpGnO2oWGj9gmUWlclSVFKKUtT/juYLonitRxCiqP2+LVer+1w2QkACWCVcZwTGxIAQcjH+60Pewo+yQu/5lRt4t1C+DQ+aBdXJapNm6Cwf9QWuRN8vADfA1UENU6o4oG4kpY4psGU5U/iW0qdu2WB2Qbcl0d41MAKraI+dzLeyL0yzzFKBwtpEgRc62Tth4CvwjfYq/HoZncHVkz3/GFen3UvqDStKF4d6LPnt0rhLGwvN6yfwdI0IR21zHM7uIh7j4cVZvz2YUGKaDttr1JN6VkMIzUOcIM2TRIes0BL4Cf1OPRlVEffyBfVgYvo6MBGycYbWHGV2nrzEZ0/076CB7kK6SWfAGw/Itz/Qy/+j/yvo+o1y0qRMSPf5+dsT09ijpGT0z8cWrUvBXw+4ZXqNYjWLIRastUiKabWouYQVYPktNRi0jt8WDtSLawR2Oa+zI1pErVaST2k4pZLN+KC4aFSMCH4JNY/prtDqS/Tlbih6gpdzpW+VDY3jal4rPt9v9Zi9kJ7+h1nu2/D6IFAyCJj6HHC7khUVu60tD8PLAhSU+T4DvmisN7idVAlWsxYlES45LnoEtmiykmjWEfVkKPCp5s18cVXowjRqmFTQH2B3KendZQdR+ra7jbqpHGlkPagXbPmoWf/HC5uIcLitPq/mM5I93+yu3JxzPj7WuH1nQ6pyu6qM5HIvthAUUfVSverL8xYrBgKKeBBy1rzoJe8rwQoa+KOIrlM1ajCgzkQZG99biUtyOD1flOkTrUdOctRGTmYi7+g7TKCmKsQTNoQxHN4Fc4lXWjBqH5EjwnZ+gXg7jQm5q05KE2Or91OHhOQoWbXNvqf+2P/z7Ayp3LH+O7/pNBuepdVe4H6ZT+oMVyxYr7yv5NmfXGW4ZpUIL0Q59rqaGxk9OhZ7WEC5M4E3brb28cXGapSy1j3XBWodyByGulbSOzTjC/s4O2F7rw536PxoeWmd4u/PDh0t4FG9wgKuUPXIqt6RMaXFrDH5yGiaMFHCbNDWJCbb92maGr7O1rzK7uFV3q+DzdhBpyL14OkVjSkRFBdusJxEtH62KYsaod0+3+q9Y0d9n1W8Zd4AcYEl34pvtGGDMmQjGB5qtDQ9Tm3pJPVOounHAafe2uFGhTAjn97b1vANFaMMXwjbNvkwYYoVx36B9+w3+1IiXtfGJmEZGPvCQpDxcy08IhRdi77e0dqKyZDE05z0YM5Sd8sso9pgSWVQk9BAdHLYAsycG/AWDMLbP/+0KFDtKHSD1BhvzgUb+XcVX3iQteg7Gyv98T5X9B/VLqev52PogcSIHiSV0kGThGh8wef3UoLoDeElfXQFPn/xtTX9KrDvgT/3VK2hfuKAw/E0ZC/a4K4DRAp2hy28JJzp3zjYfe1v4fk3Vzo11TDNxILGGkFe/TQcVZ/TXjmg5PqBCFkCPwo2hMyoyOjRFD4ECj6CuKNfh/AAUhmh6l1aymIDoQEV81+TQZaBalPu/hTj1QsymFVzOr80bvUGDb4kNJNuuWSLoMkOWVS2p94/+mFjgkRDGhQOUeCw3NaTwwjyeCXXm8IP1jM1Zr7cPT69uPWnMu+BHtdQo4Aktw9UxhHW1ZcMkbUK8BUdfa81SgX7qWaTdK3+qd97nzIPS53L3WGgJsljX3Tto8skVLqtlQnn0H3LOn3r+qwap6rWMTsrUfAGdyf7u7F6t9SZpQsn5j3S2IQ5w7Ees68M7fhdX9zz7jcxmRRnK7FELgL/iZYmsRf28n/lG+582fdLFjnjJSJwphhdG77WI6aExCAzJOrMqQ4GSKf9p2DJCSFvBzlL1BOoZAh/WXGOwelOlrHVv6wzGMgL1794htPfs224mnf5KTjaJvisgzqGzxdWPADdhGUI2EVafxBSCyLyfzYgG8G+qjAiPEKsf1sFi5k+WUe14EyQeMbBIkP6HmkF9WRMOwWvGxUAVxal7kzfgOKPXN9U70/Qy5ymWUlPeV9uL5ngoDIEUJ9Auvm2lmM90KlehLlYKjtaOKmmruVOfoKZdvckaI6T05e6MXJnfUCvnbaBjIVIQGtsSLN6JJJ2rIXM92P6GlHapZ4YOmB9dTOjGgdq8xnvY/j/VVArCReH0GAWMydeVLDbfsbER6vhQafWnnGs8KTEA/R4p6Al0KDQFJ+F1JJPvEFaSs0KpNVF41+xQGxA9S8ZoENuGncp8DRyIAAr1fRwiIJgdFH7s04Ekl7QhNfWBrN8iKzPt5sidJbgXd7w8596h/S47kvxWK3KwHGPJYFwtIlD8RQzK4BocOP38QbLnpnXVf4whw2KHyklLCDDDGOn0MFjRin3vpg22NsuSjcnh4xsjYbVh9Hcit/+FfTruqsmbem8XGfykIZSj0qLHRVqJlZOTHzDpg9fwXC++nfpH4JOCEopRPJblP8VjbDo2ZXTEN30vUG+2bpNdctijpXvZp+/V6gBpMWfxfdD/THAgB+2IrhcbpikRGG70FuJGx7+wDCM8AAAAAAAA=";

const canvas = $("gameCanvas");
const rendererOptions = {canvas,antialias:true,alpha:false,powerPreference:"high-performance",stencil:false,depth:true};
try {
  renderer = new THREE.WebGLRenderer(rendererOptions);
} catch (error) {
  $("loadingScreen").innerHTML = "<div class='dialog-card'><p class='eyebrow'>3D GRAPHICS UNAVAILABLE</p><h2>CAN'T START THE RUN</h2><p>This browser could not start WebGL. Try updating the browser or enabling hardware acceleration.</p></div>";
  throw error;
}
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
  playerBlack:new THREE.MeshStandardMaterial({color:0x17191f,roughness:.88}),
  orange:new THREE.MeshStandardMaterial({color:0xf1a05d,roughness:.72}),
  skinTeen:new THREE.MeshStandardMaterial({color:0x593522,roughness:.82}),
  skinAdult:new THREE.MeshStandardMaterial({color:0x68402f,roughness:.84}),
  eyeWhite:new THREE.MeshStandardMaterial({color:0xf3eee3,roughness:.38}),
  faceDetail:new THREE.MeshStandardMaterial({color:0x241a19,roughness:.78}),
  shirtGold:new THREE.MeshStandardMaterial({color:0xffcf78,metalness:.16,roughness:.48}),
  shoeSole:new THREE.MeshStandardMaterial({color:0x17232d,roughness:.88}),
  hair:new THREE.MeshStandardMaterial({color:0x09090c,roughness:.95}),
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
function buildSpeedStreaks() {
  const geometry=new THREE.PlaneGeometry(.025,1.7);
  const material=new THREE.MeshBasicMaterial({
    color:0xc9fff1,transparent:true,opacity:.3,depthWrite:false,
    blending:THREE.AdditiveBlending,side:THREE.DoubleSide
  });
  for(let i=0;i<28;i++) {
    const streak=new THREE.Mesh(geometry,material);
    streak.position.set(pick([-5.3,-4.8,-4.2,4.2,4.8,5.3]),random(.8,4.6),random(-96,8));
    streak.scale.y=random(.65,2.4);
    streak.rotation.z=random(-.12,.12);
    streaksGroup.add(streak);
    speedStreaks.push(streak);
  }
}
function updateSpeedStreaks(dt) {
  const velocity=(game?.speed||22)*1.7*dt;
  for(const streak of speedStreaks) {
    streak.position.z+=velocity;
    if(streak.position.z>8) {
      streak.position.z=random(-105,-78);
      streak.position.x=pick([-5.3,-4.8,-4.2,4.2,4.8,5.3]);
      streak.position.y=random(.8,4.6);
      streak.scale.y=random(.65,2.4);
    }
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
  const shirt=options.skin==="adult"?mats.chaserShirt:mats.playerBlack;
  const legMat=mats.jeans;
  const build=options.build||"slim";
  const torso=addMesh(root,new THREE.SphereGeometry(1,32,24),shirt,[0,1.15,.015],
    build==="stocky"?[.82,.78,.55]:[.46,.72,.33]);
  rig.torso=torso;
  if(build==="stocky") addMesh(root,new THREE.SphereGeometry(1,32,24),shirt,[0,.96,.085],[.78,.47,.55]);
  addMesh(root,new THREE.SphereGeometry(1,12,8),options.skin==="adult"?mats.chaserTrim:mats.tealDark,[0,1.73,.01],
    build==="stocky"?[.52,.2,.37]:[.37,.18,.3]);
  const head=addMesh(root,new THREE.SphereGeometry(1,24,16),skin,[0,2.05,0],[.34,.39,.33]);
  rig.head=head;
  // Expressive face details are placed on the camera-facing side of the head.
  for(const side of [-1,1]) {
    addMesh(root,new THREE.SphereGeometry(.052,10,8),mats.eyeWhite,[side*.12,2.105,.298],[.9,1,.36]);
    addMesh(root,new THREE.SphereGeometry(.025,8,6),mats.faceDetail,[side*.12,2.105,.319],[.85,1,.42]);
    const brow=makeBox(root,.105,.027,.025,mats.hair,side*.12,2.205,.296);
    brow.rotation.z=side*.1;
    addMesh(root,new THREE.SphereGeometry(.075,10,8),skin,[side*.337,2.045,.005],[.42,.7,.55]);
  }
  addMesh(root,new THREE.SphereGeometry(.052,10,8),skin,[0,2.005,.326],[.72,.9,.8]);
  makeBox(root,.105,.018,.018,mats.faceDetail,0,1.925,.309);
  const frontZ=build==="stocky"?.625:.326;
  makeBox(root,.34,.19,.045,mats.shirtGold,0,1.34,frontZ);
  makeBox(root,.23,.035,.05,mats.tealDark,0,1.34,frontZ+.028);
  makeBox(root,.045,.14,.025,mats.shoe,0,1.34,frontZ+.055);
  // Close-cropped black hair for the runner; the chaser keeps longer locks.
  addMesh(root,new THREE.SphereGeometry(1,24,16),mats.hair,[0,2.27,.035],[.365,.16,.36]);
  if(options.skin==="adult") {
    for(const side of [-1,1]) {
      const lock=addMesh(root,new THREE.CapsuleGeometry(.075,.43,3,6),mats.hair,[side*.29,1.91,.1]);
      lock.rotation.z=side*.14;
    }
    addMesh(root,new THREE.SphereGeometry(.12,8,6),mats.hair,[0,1.86,.29],[1,1,.65]);
  }
  // Neck
  makeCylinder(root,.13,.15,.2,skin,0,1.78,0,9);
  // Arms rotate at the shoulder to make an alternating running motion.
  for(const side of [-1,1]) {
    const armPivot=new THREE.Group();
    armPivot.position.set(side*(build==="stocky"?.61:.4),1.55,0);
    root.add(armPivot);
    const armRadius=build==="stocky"?.18:.13;
    const upper=makeCylinder(armPivot,armRadius,armRadius+.03,.43,skin,0,-.22,0,10);
    upper.rotation.z=side*-.13;
    addMesh(armPivot,new THREE.SphereGeometry(build==="stocky"?.15:.115,12,10),skin,[0,-.47,-.03]);
    makeCylinder(armPivot,.145,.145,.065,mats.shirtGold,0,-.39,.005,10);
    rig.arms.push({pivot:armPivot,side});
  }
  // Legs are separate pivots so the feet alternate naturally.
  for(const side of [-1,1]) {
    const legPivot=new THREE.Group();
    legPivot.position.set(side*(build==="stocky"?.27:.17),.78,0);
    root.add(legPivot);
    makeCylinder(legPivot,.145,.18,.48,legMat,0,-.24,0,9);
    makeBox(legPivot,.31,.15,.48,mats.shoe,0,-.5,-.09);
    makeBox(legPivot,.315,.045,.49,mats.shoeSole,0,-.585,-.085);
    rig.legs.push({pivot:legPivot,side});
  }
  // Small backpack gives the player a clear silhouette from the chase camera.
  if(options.skin!=="adult") {
    makeBox(root,.47,.48,.22,mats.orange,0,1.22,-.35);
    makeBox(root,.15,.1,.03,mats.shoe,0,1.26,-.48);
  } else {
    makeBox(root,.16,.2,.05,mats.chaserTrim,0,1.45,.3);
  }
  // A soft contact shadow grounds the character against the road without costly shadow maps.
  const contactShadow=addMesh(root,new THREE.CircleGeometry(.72,24),new THREE.MeshBasicMaterial({color:0x07101a,transparent:true,opacity:.24,depthWrite:false}),[0,.016,.02]);
  contactShadow.rotation.x=-Math.PI/2;
  contactShadow.scale.set(1.18,.72,1);
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
  const faceTexture=new THREE.TextureLoader().load(RUNNER_FACE_DATA_URL);
  faceTexture.colorSpace=THREE.SRGBColorSpace;
  const faceDecal=new THREE.Mesh(
    new THREE.PlaneGeometry(.625,.65),
    new THREE.MeshBasicMaterial({map:faceTexture,transparent:true,alphaTest:.025,side:THREE.DoubleSide,depthWrite:false})
  );
  faceDecal.position.set(0,2.055,.337);
  faceDecal.renderOrder=2;
  playerRig.root.add(faceDecal);
  playerRig.faceDecal=faceDecal;
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
  entity.group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
  });
}

function clearEntities() {
  for(const entity of entities) removeEntity(entity);
  entities=[];
}

function ensureAudio() {
  if(!soundOn) return;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx) return;
  if(!audioContext) {
    audioContext=new AudioCtx();
    masterGainNode=audioContext.createGain();
    masterGainNode.gain.value=masterVolume;
    masterGainNode.connect(audioContext.destination);
  }
  if(audioContext.state==="suspended") audioContext.resume().catch(()=>{});
  audioReady=true;
}
function setMasterVolume(value) {
  masterVolume=clamp(Number(value)/100,0,1);
  localStorage.setItem("chaat-rush-volume",String(Math.round(masterVolume*100)));
  if(masterGainNode&&audioContext) masterGainNode.gain.setTargetAtTime(masterVolume,audioContext.currentTime,.025);
  if(ui.volumeValue) ui.volumeValue.textContent=Math.round(masterVolume*100)+"%";
}
function stopChant() {
  chantSession++;
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
}
function queueChant(session) {
  if(session!==chantSession||!soundOn||!chantEnabled||state!=="running"||!("speechSynthesis" in window)) return;
  const speech=window.speechSynthesis;
  const utterance=new SpeechSynthesisUtterance("Abbas Bhai ki Chaat Lo!");
  const voices=speech.getVoices();
  const voice=voices.find(item=>/^ur(-|$)/i.test(item.lang))
    ||voices.find(item=>/^hi(-|$)/i.test(item.lang))
    ||voices.find(item=>/en-IN/i.test(item.lang));
  if(voice) {utterance.voice=voice;utterance.lang=voice.lang;}
  else utterance.lang="en-IN";
  utterance.rate=.94;
  utterance.pitch=1.04;
  utterance.volume=Math.min(1,masterVolume*1.35);
  utterance.onend=()=>{
    if(session===chantSession&&state==="running"&&soundOn&&chantEnabled) queueChant(session);
  };
  speech.speak(utterance);
}
function speakChant() {
  if(!soundOn||!chantEnabled||state!=="running"||!("speechSynthesis" in window)) return;
  const session=++chantSession;
  window.speechSynthesis.cancel();
  queueChant(session);
}
function playSweep(from,to,duration=.2,volume=.035,type="sawtooth") {
  if(!soundOn||!audioReady||!audioContext) return;
  const start=audioContext.currentTime;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type;osc.frequency.setValueAtTime(from,start);
  osc.frequency.exponentialRampToValueAtTime(to,start+duration);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain);gain.connect(masterGainNode||audioContext.destination);
  osc.start(start);osc.stop(start+duration+.02);
}
function playRunBeat(step) {
  if(!soundOn||!audioReady) return;
  if(step%4===0) note(92,.12,"sine",.045);
  else note(164,.075,"triangle",.018);
  if(step%2===1) note(1380,.035,"square",.006);
}
function note(freq,duration=.16,type="triangle",volume=.035,delay=0) {
  if(!soundOn||!audioContext||!audioReady) return;
  const start=audioContext.currentTime+delay;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,start);
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start+.015);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain);gain.connect(masterGainNode||audioContext.destination);
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
  if(kind==="slide") playSweep(720,180,.24,.03,"sawtooth");
  if(kind==="land") {note(105,.11,"sine",.055);note(72,.14,"triangle",.018,.035);}
  if(kind==="start") {note(392,.12,"triangle",.035);note(587,.15,"triangle",.035,.11);note(784,.2,"sine",.04,.22);}
}
window.addEventListener("pointerdown",ensureAudio,{once:true,passive:true});

function resetGame() {
  clearEntities();
  game={
    lane:1,targetX:0,visualX:0,jumpRemaining:0,jumpDuration:.78,jumpVelocity:0,jumpHeight:0,
    slideRemaining:0,spawnTimer:.8,speed:22,distance:0,score:0,coins:0,
    magnetTime:0,multiplierTime:0,shield:false,boardCharges:1,boardTime:0,
    boardActive:false,runTime:0,shake:0,hitFlash:0,pattern:0,musicTimer:.18,musicStep:0
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
  stopChant();
  state="menu";
  ui.menu.classList.remove("hidden");ui.pause.classList.add("hidden");
  ui.over.classList.add("hidden");ui.intro.classList.add("hidden");ui.ready.classList.add("hidden");
  ui.hud.classList.remove("visible");ui.power.textContent="";
  ui.menuBest.textContent=best.toLocaleString();
  ui.swipeHint.classList.add("hidden");
  document.body.classList.remove("is-running");
}
function startGame() {
  ensureAudio();playIntroMusic();resetGame();
  state="ready";
  ui.menu.classList.add("hidden");ui.pause.classList.add("hidden");ui.over.classList.add("hidden");
  ui.intro.classList.add("hidden");ui.ready.classList.remove("hidden");
  ui.hud.classList.add("visible");ui.swipeHint.classList.add("hidden");
  document.body.classList.add("is-running");
}
function beginRun() {
  if(state!=="ready") return;
  ensureAudio();
  state="running";ui.ready.classList.add("hidden");
  updateHud();
  previousTime=performance.now();
  game.musicTimer=.08;
  soundEffect("start");
  speakChant();
}
function pauseGame() {
  if(state!=="running") return;
  stopChant();
  state="paused";ui.pause.classList.remove("hidden");ui.swipeHint.classList.add("hidden");
}
function resumeGame() {
  if(state!=="paused") return;
  ensureAudio();
  state="running";ui.pause.classList.add("hidden");previousTime=performance.now();
  speakChant();
}
function finishGame() {
  if(state!=="running") return;
  stopChant();
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
  if(next!==game.lane){
    game.lane=next;game.targetX=LANES[next];
    // Apply the lane change immediately; the renderer only smooths the final few pixels.
    soundEffect("move");
  }
}
function jump() {
  if(state!=="running") return;
  if(game.slideRemaining>0) game.slideRemaining=0;
  if(game.jumpRemaining>0) return;
  game.jumpRemaining=game.jumpDuration;
  game.jumpVelocity=9.8;
  game.jumpHeight=.08;
  playerRig.root.position.y=game.jumpHeight;
  soundEffect("jump");
}
function slide() {
  if(state!=="running") return;
  if(game.jumpRemaining>0) {
    game.jumpRemaining=0;game.jumpVelocity=0;game.jumpHeight=0;
    playerRig.root.position.y=0;
  }
  game.slideRemaining=.76;
  playerRig.root.scale.y=.62;
  soundEffect("slide");
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
  if(state==="ready"&&(key==="enter"||key===" ")){beginRun();return;}
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
const SWIPE_THRESHOLD=11;
canvas.addEventListener("pointerdown",(event)=>{
  if(state!=="running")return;
  swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId,triggered:false,startedAt:performance.now()};
  try{canvas.setPointerCapture(event.pointerId);}catch{}
});
canvas.addEventListener("pointermove",(event)=>{
  if(!swipeStart||state!=="running"||swipeStart.triggered)return;
  const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_THRESHOLD)return;
  swipeStart.triggered=true;
  if(Math.abs(dx)>Math.abs(dy))input(dx>0?"right":"left");
  else input(dy<0?"up":"down");
});
canvas.addEventListener("pointerup",(event)=>{
  if(!swipeStart||state!=="running"){swipeStart=null;return;}
  const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;
  const distance=Math.max(Math.abs(dx),Math.abs(dy));
  if(!swipeStart.triggered&&distance>=SWIPE_THRESHOLD){
    if(Math.abs(dx)>Math.abs(dy))input(dx>0?"right":"left");
    else input(dy<0?"up":"down");
    lastTap=0;
  } else if(!swipeStart.triggered&&distance<SWIPE_THRESHOLD){
    const now=performance.now();
    if(lastTap&&now-lastTap<285){useBoard();lastTap=0;}
    else lastTap=now;
  }
  swipeStart=null;
});
canvas.addEventListener("pointercancel",()=>{swipeStart=null;});
$("startButton").addEventListener("click",startGame);
$("tapToPlayButton").addEventListener("click",(event)=>{event.stopPropagation();beginRun();});
ui.ready.addEventListener("click",(event)=>{
  if(event.target.closest("#tapToPlayButton"))return;
  beginRun();
});
$("retryButton").addEventListener("click",startGame);
$("restartButton").addEventListener("click",startGame);
$("resumeButton").addEventListener("click",resumeGame);
$("pauseButton").addEventListener("click",pauseGame);
$("homeButton").addEventListener("click",showMenu);
ui.volumeSlider.value=String(Math.round(masterVolume*100));
ui.volumeValue.textContent=Math.round(masterVolume*100)+"%";
ui.soundButton.textContent=soundOn?"♫":"♪";
ui.soundButton.setAttribute("aria-pressed",String(soundOn));
ui.chantButton.textContent=chantEnabled?"Aa":"A̸a";
ui.chantButton.setAttribute("aria-pressed",String(chantEnabled));
ui.chantButton.setAttribute("aria-label",chantEnabled?"Mute Abbas Bhai chant":"Enable Abbas Bhai chant");
ui.volumeSlider.addEventListener("input",(event)=>setMasterVolume(event.target.value));
ui.soundButton.addEventListener("click",()=>{
  soundOn=!soundOn;localStorage.setItem("chaat-rush-sound",soundOn?"on":"off");
  ui.soundButton.textContent=soundOn?"♫":"♪";
  ui.soundButton.setAttribute("aria-pressed",String(soundOn));
  if(!soundOn)stopChant();
  else {ensureAudio();note(660,.12,"triangle",.04);if(state==="running")speakChant();}
});
ui.chantButton.addEventListener("click",()=>{
  chantEnabled=!chantEnabled;localStorage.setItem("chaat-rush-chant",chantEnabled?"on":"off");
  ui.chantButton.textContent=chantEnabled?"Aa":"A̸a";
  ui.chantButton.setAttribute("aria-pressed",String(chantEnabled));
  ui.chantButton.setAttribute("aria-label",chantEnabled?"Mute Abbas Bhai chant":"Enable Abbas Bhai chant");
  if(!chantEnabled)stopChant();
  else if(state==="running")speakChant();
});
$("fullscreenButton").addEventListener("click",async()=>{
  try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.();}
  catch{/* Fullscreen is optional in some browsers. */}
});
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopChant();if(state==="running")pauseGame();}});
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
  updateSpeedStreaks(dt);
}
function updateGame(dt) {
  if(state!=="running"||!game)return;
  game.runTime+=dt;
  game.musicTimer-=dt;
  if(game.musicTimer<=0){playRunBeat(game.musicStep++);game.musicTimer=.48;}
  game.speed=Math.min(35,22+game.runTime*.22);
  scenerySpeed=game.speed;
  game.distance+=game.speed*dt*.42;
  game.spawnTimer-=dt;
  if(game.spawnTimer<=0)spawnPattern();
  game.visualX=smooth(game.visualX,game.targetX,1-Math.exp(-dt*42));
  playerRig.root.position.x=game.visualX;
  if(game.jumpRemaining>0){
    game.jumpHeight+=game.jumpVelocity*dt;
    game.jumpVelocity-=25*dt;
    game.jumpRemaining=Math.max(0,game.jumpRemaining-dt);
    if(game.jumpHeight<=0&&game.jumpVelocity<0){
      game.jumpHeight=0;game.jumpVelocity=0;game.jumpRemaining=0;
      soundEffect("land");
    }
  } else {game.jumpHeight=0;game.jumpVelocity=0;}
  playerRig.root.position.y=game.jumpHeight;
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
  const rawDt=Math.max(0,(time-(previousTime||time))/1000);
  const dt=Math.min(.04,rawDt);
  previousTime=time;
  if(rawDt>0){perfTotal+=rawDt*1000;perfFrames++;}
  if(time-perfTime>2200&&perfFrames>25){
    const average=perfTotal/perfFrames;
    const oldQuality=qualityScale;
    if(average>22)qualityScale=Math.max(.72,qualityScale-.10);
    else if(average<16)qualityScale=Math.min(1,qualityScale+.05);
    if(Math.abs(qualityScale-oldQuality)>.001)resize();
    perfTime=time;perfTotal=0;perfFrames=0;
  }
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,ratio*qualityScale));
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
  addLights();buildRoad();buildScenery();
  streaksGroup=new THREE.Group();world.add(streaksGroup);buildSpeedStreaks();
  buildPlayer();
  camera.position.set(0,5.5,10.5);camera.lookAt(0,1,-15);
}
function boot() {
  initialize();
  ui.menuBest.textContent=best.toLocaleString();
  const started=performance.now();
  const minimumVisibleMs=1550;
  function drawLoading(now){
    const progress=Math.min(100,((now-started)/minimumVisibleMs)*100);
    ui.progress.style.width=progress+"%";
    ui.percent.textContent=Math.floor(progress)+"%";
    if(progress<100)requestAnimationFrame(drawLoading);
    else setTimeout(()=>{ui.loading.classList.add("done");showMenu();},350);
  }
  requestAnimationFrame(drawLoading);
}
if("serviceWorker" in navigator&&location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
boot();
requestAnimationFrame(render);
