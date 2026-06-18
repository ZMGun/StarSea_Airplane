import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap, Power2 } from 'gsap';
const TweenMax = gsap;

var cameraMode = 0; // 0: tracking, 1: free, 2: 1st-person

THREE.ColorManagement.enabled = false;

// Variables for smooth movement and camera transitions
var targetPos = new THREE.Vector3(0, 100, -15);
var startQuat = new THREE.Quaternion();
var midQuat = new THREE.Quaternion();
var targetQuat = new THREE.Quaternion();
var endQuat = new THREE.Quaternion();
var slerpT = 0;
var cameraTargetPos = new THREE.Vector3();
var cameraTargetQuat = new THREE.Quaternion();


//COLORS
var Colors = {
  red: 0xf25346,
  white: 0xd8d0d1,
  brown: 0x59332e,
  brownDark: 0x23190f,
  pink: 0xF5986E,
  yellow: 0xf4ce93,
  blue: 0x68c3c0,

};

///////////////

// GAME VARIABLES
var game;
var bgm;
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();
var ennemiesPool = [];
var particlesPool = [];
var particlesInUse = [];
const BPM = 138;
const SEC_PER_BEAT = 60 / BPM; // 138BPM 기준 4분음표 1개당 약 0.4347초
var isPlaying = false;
var songStartTime = 0;
var currentAudioTime = 0;
var beatmap = [];
var audioOffset = -0.35;

function formatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function resetGame() {
  game = {
    speed: 0,
    initSpeed: .00035,
    baseSpeed: .00035,
    targetBaseSpeed: .00035,
    incrementSpeedByTime: .0000025,
    incrementSpeedByLevel: .000005,
    distanceForSpeedUpdate: 100,
    speedLastUpdate: 0,

    distance: 0,
    ratioSpeedDistance: 50,
    energy: 100,
    ratioSpeedEnergy: 3,

    level: 1,
    levelLastUpdate: 0,
    distanceForLevelUpdate: 1000,

    planeDefaultHeight: 100,
    planeAmpHeight: 80,
    planeAmpWidth: 75,
    planeMoveSensivity: 0.005,
    planeRotXSensivity: 0.0008,
    planeRotZSensivity: 0.0004,
    planeFallSpeed: .001,
    planeMinSpeed: 1.2,
    planeMaxSpeed: 1.6,
    planeSpeed: 0,
    planeCollisionDisplacementX: 0,
    planeCollisionSpeedX: 0,

    planeCollisionDisplacementY: 0,
    planeCollisionSpeedY: 0,

    seaRadius: 600,
    seaLength: 800,
    wavesMinAmp: 5,
    wavesMaxAmp: 20,
    wavesMinSpeed: 0.001,
    wavesMaxSpeed: 0.003,

    cameraFarPos: 500,
    cameraNearPos: 150,
    cameraSensivity: 0.002,

    status: "playing",
  };

  fieldLevel.innerHTML = Math.floor(game.level);
  
  if (typeof airplaneHolder !== 'undefined' && airplaneHolder) {
      airplaneHolder.position.set(targetPos.x, targetPos.y, targetPos.z);
      airplaneHolder.rotation.set(0, 0, 0);
  } else if (typeof airplane !== 'undefined' && airplane && airplane.mesh) {
      airplane.mesh.position.set(targetPos.x, targetPos.y, targetPos.z);
      airplane.mesh.rotation.set(0, 0, 0);
      airplane.mesh.quaternion.identity();
  }

  // Slerp 보간용 전역 쿼터니언 변수들 초기화
  if (typeof startQuat !== 'undefined') startQuat.identity();
  if (typeof targetQuat !== 'undefined') targetQuat.identity();
  if (typeof midQuat !== 'undefined') midQuat.identity();

  if (typeof airplaneHolder !== 'undefined' && airplaneHolder) {
      airplaneHolder.position.x = targetPos.x;
      airplaneHolder.position.y = targetPos.y;
      airplaneHolder.position.z = targetPos.z;
  }

  // BGM 재생 상태 및 오디오 컨텍스트 시간 동기화
  if (typeof bgm !== 'undefined' && bgm.buffer) {
    bgm.setVolume(0.5);
    if (isPlaying) bgm.stop();
    bgm.play();
    isPlaying = true;
    songStartTime = bgm.context.currentTime; 
  }

  // 채보 생성 및 화면에 남은 노트 객체 메모리 해제
  if (typeof generateBeatmap === 'function') {
    generateBeatmap();
  }
  
  if (typeof notesHolder !== 'undefined' && notesHolder) {
    for (let i = 0; i < notesHolder.notesInUse.length; i++) {
      notesHolder.mesh.remove(notesHolder.notesInUse[i].mesh);
    }
    notesHolder.notesInUse = [];
    notesHolder.spawnedIndex = 0;
  }

  game.energy = 100;
  game.combo = 0;

  // 재시작 시 GI 반사광 강도 초기화
  if (typeof giLightBounce !== 'undefined' && giLightBounce) {
    giLightBounce.intensity = 0;
  }
  
  if(typeof fieldDistance !== 'undefined') fieldDistance.innerHTML = "000";
  
  if(typeof energyBar !== 'undefined') {
    energyBar.style.right = "0%";
    energyBar.style.backgroundColor = "#68c3c0";
  }
}

//THREEJS RELATED VARIABLES

var scene,
  camera, fieldOfView, aspectRatio, nearPlane, farPlane,
  renderer,
  container,
  controls;

//SCREEN & MOUSE VARIABLES

var HEIGHT, WIDTH;
var keys = { w: false, a: false, s: false, d: false };

//INIT THREE JS, SCREEN AND MOUSE EVENTS

function createScene() {

  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;

  scene = new THREE.Scene();
  aspectRatio = WIDTH / HEIGHT;
  fieldOfView = 50;
  nearPlane = .1;
  farPlane = 10000;
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    nearPlane,
    farPlane
  );
  
  scene.fog = new THREE.Fog(0x000511, 100, 1500);

  var style = document.createElement('style');
  style.innerHTML = `
    body, .game-holder {
      background: #000511 !important;
      background-image: none !important;
    }
    #world {
      background: transparent !important;
    }
    h1, .header h1, .score__label, .score__content, .score__value, #distValue, #levelValue {
      color: #ffffff !important;
    }
    #distValue, .score__value {
      color: #ffffff !important;
    }
    .score__label {
      color: #a0aab0 !important;
    }
    .header h2 {
      color: #00ffcc !important;
    }
    .score__value--energy {
      background-color: rgba(255, 255, 255) !important;
      border-radius: 3px;
    }
    .message--replay {
      color: #00ffcc !important;
      text-shadow: 0 0 10px rgba(102, 51, 255, 0.6) !important;
    }
  `;
  document.head.appendChild(style);

  camera.position.x = 0;
  camera.position.z = 200;
  camera.position.y = game.planeDefaultHeight;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  renderer.shadowMap.enabled = true;

  container = document.getElementById('world');
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', handleWindowResize, false);

  scene.add(camera);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = (cameraMode === 1);

  camera.rotation.set(0, 0, 0);
}

function createLaneLabels() {
  const letters = ['D', 'F', 'J', 'K'];
  const laneZ = [-45, -15, 15, 45];
  
  for(let i = 0; i < 4; i++) {
    let canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = "rgba(0, 0, 0, 0)"; 
    ctx.fillRect(0, 0, 128, 128);
    
    ctx.fillStyle = "rgba(0, 255, 204, 0.40)";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letters[i], 64, 64);
    
    let tex = new THREE.CanvasTexture(canvas);
    let geom = new THREE.PlaneGeometry(35, 35);
    let mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    let label = new THREE.Mesh(geom, mat);
    
    var lineAngle = Math.acos(10 / 689);

    const labelRadius = 670;

    label.position.x = Math.cos(lineAngle) * labelRadius;
    label.position.y = -600 + Math.sin(lineAngle) * labelRadius;
    label.position.z = laneZ[i];
    
    label.rotation.x = -Math.PI / 2;
    label.rotation.y = 0.2;
    
    scene.add(label);
  }
}

function createAudio() {
  const listener = new THREE.AudioListener();
  camera.add(listener);

  bgm = new THREE.Audio(listener);
  const audioLoader = new THREE.AudioLoader();

  audioLoader.load('audio/bad_apple.mp3', function(buffer) {
    bgm.setBuffer(buffer);
    bgm.setLoop(false);
    bgm.setVolume(0.5);
    console.log("음악 로드 완료.");

    if (replayMessage) replayMessage.innerHTML = "CLICK TO START";
  });

  document.addEventListener('click', function() {
    if (game.status === "waitingReplay" && bgm && bgm.buffer) {
      if (bgm.context.state === 'suspended') {
        bgm.context.resume().then(function() {
          hideReplay(); 
          resetGame();
        });
      } else {
        hideReplay();
        resetGame();
      }
    }
  });
}

function triggerGameOver() {

  if (game.status === "gameover" ||
      game.status === "waitingReplay") {
    return;
  }

  game.status = "gameover";
  isPlaying = false;

  console.log("GAME OVER");

  // 음악 페이드아웃
  if (bgm && bgm.isPlaying) {

    const startVolume = bgm.getVolume();

    gsap.to(
      { volume: startVolume },
      {
        volume: 0,
        duration: 2.0,
        ease: "power2.out",

        onUpdate: function () {
          bgm.setVolume(this.targets()[0].volume);
        },

        onComplete: function () {
          if (bgm.isPlaying) {
            bgm.stop();
          }

          bgm.setVolume(0.5);
        }
      }
    );
  }
}

var rawBeatmap = "";

function loadBeatmapFile() {
  fetch('beatmap.txt')
    .then(response => response.text())
    .then(text => {
      rawBeatmap = text;
      console.log("채보 텍스트 파일 로드 완료.");
    })
    .catch(error => console.error("채보 로드 실패:", error));
}

// 채보 데이터 파싱 및 배열 생성 함수.
function generateBeatmap() {
  beatmap = [];

  if (!rawBeatmap || rawBeatmap.trim() === "") return;

  const lanes = [-45, -15, 15, 45];
  
  // 최초 시작 시 딜레이 보정.
  const startOffset = 1.0; 
  
  // 개행 문자를 기준으로 텍스트 분리.
  const lines = rawBeatmap.trim().split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.length !== 4) continue;
    
    let counts = [
      parseInt(line[0]),
      parseInt(line[1]),
      parseInt(line[2]),
      parseInt(line[3])
    ];
    
    // 해당 박자(1비트) 내 총 노트 수 산출.
    let totalNotes = counts[0] + counts[1] + counts[2] + counts[3];
    
    // 빈 박자(0000) 처리.
    if (totalNotes === 0) continue;
    
    // 노트 분할 시간 간격 계산.
    let subBeatInterval = SEC_PER_BEAT / totalNotes;
    let noteOffsetIndex = 0;
    
    // 좌측 라인부터 노트 순차 배치.
    for (let laneIdx = 0; laneIdx < 4; laneIdx++) {
      for (let n = 0; n < counts[laneIdx]; n++) {
        // 기준 시간에 오프셋 간격을 합산.
        let hitTime = startOffset + (i * SEC_PER_BEAT) + (noteOffsetIndex * subBeatInterval);
        
        beatmap.push({
          hitTime: hitTime,
          laneZ: lanes[laneIdx]
        });
        
        noteOffsetIndex++;
      }
    }
  }
}

// MOUSE AND SCREEN EVENTS

function handleWindowResize() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  renderer.setSize(WIDTH, HEIGHT);
  camera.aspect = WIDTH / HEIGHT;
  camera.updateProjectionMatrix();
}

function handleKeyDown(event) {
  if (game.status !== "playing") return;

  var k = event.key.toLowerCase();
  if (['d', 'f', 'j', 'k'].includes(k)) {
    keys[k] = true;
    if (!event.repeat) {
      startQuat.copy(airplane.mesh.quaternion);
    }
  }
}

function handleKeyUp(event) {
  var k = event.key.toLowerCase();
  if (['d', 'f', 'j', 'k'].includes(k)) {
    keys[k] = false;
  }
}

function handleTouchMove(event) {
  event.preventDefault();
  var tx = -1 + (event.touches[0].pageX / WIDTH) * 2;
  var ty = 1 - (event.touches[0].pageY / HEIGHT) * 2;
  mousePos = { x: tx, y: ty };
}

function handleMouseUp(event) {
  if (game.status == "waitingReplay" && bgm && bgm.buffer) {
    if (bgm.context && bgm.context.state === 'suspended') {
      bgm.context.resume().then(function() {
        hideReplay();
        resetGame();
      });
    } else {
      hideReplay();
      resetGame();
    }
  }
}

function handleTouchEnd(event) {
  if (game.status == "waitingReplay" && bgm && bgm.buffer) {
    if (bgm.context && bgm.context.state === 'suspended') {
      bgm.context.resume().then(function() {
        hideReplay();
        resetGame();
      });
    } else {
      hideReplay();
      resetGame();
    }
  }
}

// 타격 시 전방으로 뻗어나가는 분절된 잔상 이펙트
function createHitEffect(laneZ) {
  var tailGroup = new THREE.Group();
  var numSegments = 8;
  var step = 1.0 / numSegments;

  var geom = new THREE.BoxGeometry(1, 1, 1);
  var mat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending, 
    depthWrite: false
  });

  for (let i = 0; i < numSegments; i++) {
    let mesh = new THREE.Mesh(geom, mat);
    
    let ratio = 1.0 - (i / numSegments); 
    
    let sizeX = ratio * step * 0.6; 
    let sizeY = 2;
    let sizeZ = 23; 

    mesh.scale.set(sizeX, sizeY, sizeZ);
    mesh.position.x = step * i + sizeX / 2;
    
    tailGroup.add(mesh);
  }

  tailGroup.position.x = airplaneHolder.position.x+2;
  tailGroup.position.y = airplaneHolder.position.y-3;
  tailGroup.position.z = laneZ;

  tailGroup.scale.set(0.1, 1, 1);

  scene.add(tailGroup);

  if (typeof giLightBounce !== 'undefined' && giLightBounce) {
    giLightBounce.intensity = 45.0; 
  }

  // GSAP 애니메이션 연출 (속도감은 유지)
  gsap.to(tailGroup.scale, {
    x: 100, // 앞으로 뻗어가는 전체 길이
    duration: 0.1,
    ease: "power2.out",
    onComplete: function() {
      gsap.to(tailGroup.scale, {
        x: 0,
        y: 1, 
        z: 1,
        duration: 0.15,
        ease: "power2.in"
      });
      gsap.to(mat, {
        opacity: 0, 
        duration: 0.25,
        ease: "power2.in",
        onComplete: function() {
          scene.remove(tailGroup);
          geom.dispose();
          mat.dispose();
        }
      });
    }
  });
}

// LIGHTS

var ambientLight, hemisphereLight, shadowLight;
var giLightBounce;

function createLights() {

  hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, .2 * Math.PI)

  ambientLight = new THREE.AmbientLight(0xdc8874, .3 * Math.PI);

  shadowLight = new THREE.DirectionalLight(0xffffff, .4 * Math.PI);
  shadowLight.position.set(150, 350, 350);
  shadowLight.castShadow = true;
  shadowLight.shadow.camera.left = -400;
  shadowLight.shadow.camera.right = 400;
  shadowLight.shadow.camera.top = 400;
  shadowLight.shadow.camera.bottom = -400;
  shadowLight.shadow.camera.near = 1;
  shadowLight.shadow.camera.far = 1000;
  shadowLight.shadow.mapSize.width = 4096;
  shadowLight.shadow.mapSize.height = 4096;

  var ch = new THREE.CameraHelper(shadowLight.shadow.camera);

  //scene.add(ch);
  scene.add(hemisphereLight);
  scene.add(shadowLight);
  scene.add(ambientLight);

  // 네온 트랙 및 타격 발광이 주변 환경에 미치는 간접광(GI) 표현용 점광원 생성
  giLightBounce = new THREE.PointLight(0xffffff, 0, 1000, 1.0);
  giLightBounce.position.set(0, 130, 0); 
  scene.add(giLightBounce);
}


var Pilot = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "pilot";
  this.angleHairs = 0;

  var bodyGeom = new THREE.BoxGeometry(15, 15, 15);
  var bodyMat = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(2, -12, 0);

  this.mesh.add(body);

  var faceGeom = new THREE.BoxGeometry(10, 10, 10);
  var faceMat = new THREE.MeshLambertMaterial({ color: Colors.pink });
  var face = new THREE.Mesh(faceGeom, faceMat);
  this.mesh.add(face);

  var hairGeom = new THREE.BoxGeometry(4, 4, 4);
  var hairMat = new THREE.MeshLambertMaterial({ color: Colors.brown });
  var hair = new THREE.Mesh(hairGeom, hairMat);
  hair.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 2, 0));
  var hairs = new THREE.Object3D();

  this.hairsTop = new THREE.Object3D();

  for (var i = 0; i < 12; i++) {
    var h = hair.clone();
    var col = i % 3;
    var row = Math.floor(i / 3);
    var startPosZ = -4;
    var startPosX = -4;
    h.position.set(startPosX + row * 4, 0, startPosZ + col * 4);
    h.geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1));
    this.hairsTop.add(h);
  }
  hairs.add(this.hairsTop);

  var hairSideGeom = new THREE.BoxGeometry(12, 4, 2);
  hairSideGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(-6, 0, 0));
  var hairSideR = new THREE.Mesh(hairSideGeom, hairMat);
  var hairSideL = hairSideR.clone();
  hairSideR.position.set(8, -2, 6);
  hairSideL.position.set(8, -2, -6);
  hairs.add(hairSideR);
  hairs.add(hairSideL);

  var hairBackGeom = new THREE.BoxGeometry(2, 8, 10);
  var hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(-1, -4, 0)
  hairs.add(hairBack);
  hairs.position.set(-5, 5, 0);

  this.mesh.add(hairs);

  var glassGeom = new THREE.BoxGeometry(5, 5, 5);
  var glassMat = new THREE.MeshLambertMaterial({ color: Colors.brown });
  var glassR = new THREE.Mesh(glassGeom, glassMat);
  glassR.position.set(6, 0, 3);
  var glassL = glassR.clone();
  glassL.position.z = -glassR.position.z

  var glassAGeom = new THREE.BoxGeometry(11, 1, 11);
  var glassA = new THREE.Mesh(glassAGeom, glassMat);
  this.mesh.add(glassR);
  this.mesh.add(glassL);
  this.mesh.add(glassA);

  var earGeom = new THREE.BoxGeometry(2, 3, 2);
  var earL = new THREE.Mesh(earGeom, faceMat);
  earL.position.set(0, 0, -6);
  var earR = earL.clone();
  earR.position.set(0, 0, 6);
  this.mesh.add(earL);
  this.mesh.add(earR);
}

Pilot.prototype.updateHairs = function () {
  //*
  var hairs = this.hairsTop.children;

  var l = hairs.length;
  for (var i = 0; i < l; i++) {
    var h = hairs[i];
    h.scale.y = .75 + Math.cos(this.angleHairs + i / 3) * .25;
  }
  this.angleHairs += game.speed * deltaTime * 40;
  //*/
}

var AirPlane = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "airPlane";

  // Cabin

  var geomCabin = new THREE.BoxGeometry(80, 50, 50, 1, 1, 1);
  var matCabin = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });

  var posCabin = geomCabin.attributes.position;
  for (let i = 0; i < posCabin.count; i++) {
    let x = posCabin.getX(i);
    let y = posCabin.getY(i);
    let z = posCabin.getZ(i);
    if (x < 0) {
      y += (y < 0) ? 30 : -10;
      z += (z < 0) ? 20 : -20;
      posCabin.setY(i, y);
      posCabin.setZ(i, z);
    }
  }
  geomCabin.computeVertexNormals();

  var cabin = new THREE.Mesh(geomCabin, matCabin);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  this.mesh.add(cabin);

  // Engine

  var geomEngine = new THREE.BoxGeometry(20, 50, 50, 1, 1, 1);
  var matEngine = new THREE.MeshPhongMaterial({ color: Colors.white, flatShading: true });
  var engine = new THREE.Mesh(geomEngine, matEngine);
  engine.position.x = 50;
  engine.castShadow = true;
  engine.receiveShadow = true;
  this.mesh.add(engine);

  // Tail Plane

  var geomTailPlane = new THREE.BoxGeometry(15, 20, 5, 1, 1, 1);
  var matTailPlane = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var tailPlane = new THREE.Mesh(geomTailPlane, matTailPlane);
  tailPlane.position.set(-40, 20, 0);
  tailPlane.castShadow = true;
  tailPlane.receiveShadow = true;
  this.mesh.add(tailPlane);

  // Wings

  var geomSideWing = new THREE.BoxGeometry(30, 5, 120, 1, 1, 1);
  var matSideWing = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var sideWing = new THREE.Mesh(geomSideWing, matSideWing);
  sideWing.position.set(0, 15, 0);
  sideWing.castShadow = true;
  sideWing.receiveShadow = true;
  this.mesh.add(sideWing);

  var geomWindshield = new THREE.BoxGeometry(3, 15, 20, 1, 1, 1);
  var matWindshield = new THREE.MeshPhongMaterial({ color: Colors.white, transparent: true, opacity: .3, flatShading: true });;
  var windshield = new THREE.Mesh(geomWindshield, matWindshield);
  windshield.position.set(5, 27, 0);

  windshield.castShadow = true;
  windshield.receiveShadow = true;

  this.mesh.add(windshield);

  var geomPropeller = new THREE.BoxGeometry(20, 10, 10, 1, 1, 1);
  var posPropeller = geomPropeller.attributes.position;
  for (let i = 0; i < posPropeller.count; i++) {
    let x = posPropeller.getX(i);
    let y = posPropeller.getY(i);
    let z = posPropeller.getZ(i);
    if (x > 0) {
      y += (y < 0) ? 5 : -5;
      z += (z < 0) ? 5 : -5;
      posPropeller.setY(i, y);
      posPropeller.setZ(i, z);
    }
  }
  geomPropeller.computeVertexNormals();
  var matPropeller = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  this.propeller = new THREE.Mesh(geomPropeller, matPropeller);

  this.propeller.castShadow = true;
  this.propeller.receiveShadow = true;

  var geomBlade = new THREE.BoxGeometry(1, 80, 10, 1, 1, 1);
  var matBlade = new THREE.MeshPhongMaterial({ color: Colors.brownDark, flatShading: true });
  var blade1 = new THREE.Mesh(geomBlade, matBlade);
  blade1.position.set(8, 0, 0);

  blade1.castShadow = true;
  blade1.receiveShadow = true;

  var blade2 = blade1.clone();
  blade2.rotation.x = Math.PI / 2;

  blade2.castShadow = true;
  blade2.receiveShadow = true;

  this.propeller.add(blade1);
  this.propeller.add(blade2);
  this.propeller.position.set(60, 0, 0);
  this.mesh.add(this.propeller);

  var wheelProtecGeom = new THREE.BoxGeometry(30, 15, 10, 1, 1, 1);
  var wheelProtecMat = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var wheelProtecR = new THREE.Mesh(wheelProtecGeom, wheelProtecMat);
  wheelProtecR.position.set(25, -20, 25);
  this.mesh.add(wheelProtecR);

  var wheelTireGeom = new THREE.BoxGeometry(24, 24, 4);
  var wheelTireMat = new THREE.MeshPhongMaterial({ color: Colors.brownDark, flatShading: true });
  var wheelTireR = new THREE.Mesh(wheelTireGeom, wheelTireMat);
  wheelTireR.position.set(25, -28, 25);

  var wheelAxisGeom = new THREE.BoxGeometry(10, 10, 6);
  var wheelAxisMat = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  var wheelAxis = new THREE.Mesh(wheelAxisGeom, wheelAxisMat);
  wheelTireR.add(wheelAxis);

  this.mesh.add(wheelTireR);

  var wheelProtecL = wheelProtecR.clone();
  wheelProtecL.position.z = -wheelProtecR.position.z;
  this.mesh.add(wheelProtecL);

  var wheelTireL = wheelTireR.clone();
  wheelTireL.position.z = -wheelTireR.position.z;
  this.mesh.add(wheelTireL);

  var wheelTireB = wheelTireR.clone();
  wheelTireB.scale.set(.5, .5, .5);
  wheelTireB.position.set(-35, -5, 0);
  this.mesh.add(wheelTireB);

  var suspensionGeom = new THREE.BoxGeometry(4, 20, 4);
  suspensionGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 10, 0))
  var suspensionMat = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var suspension = new THREE.Mesh(suspensionGeom, suspensionMat);
  suspension.position.set(-35, -5, 0);
  suspension.rotation.z = -.3;
  this.mesh.add(suspension);

  this.pilot = new Pilot();
  this.pilot.mesh.position.set(-10, 27, 0);
  this.mesh.add(this.pilot.mesh);


  this.mesh.castShadow = true;
  this.mesh.receiveShadow = true;

};

var Sky = function () {
  this.mesh = new THREE.Object3D();
  this.nClouds = 20;
  this.clouds = [];
  var stepAngle = Math.PI * 2 / this.nClouds;
  for (var i = 0; i < this.nClouds; i++) {
    var c = new Cloud();
    this.clouds.push(c);
    var a = stepAngle * i;
    var h = game.seaRadius + 150 + Math.random() * 200;
    c.mesh.position.y = Math.sin(a) * h;
    c.mesh.position.x = Math.cos(a) * h;
    c.mesh.position.z = -300 - Math.random() * 500;
    c.mesh.rotation.z = a + Math.PI / 2;
    var s = 1 + Math.random() * 2;
    c.mesh.scale.set(s, s, s);
    this.mesh.add(c.mesh);
  }
}

Sky.prototype.moveClouds = function () {
  for (var i = 0; i < this.nClouds; i++) {
    var c = this.clouds[i];
    c.rotate();
  }
  this.mesh.rotation.z += game.speed * deltaTime;

}

var Sea = function () {
  var geom = new THREE.CylinderGeometry(game.seaRadius, game.seaRadius, game.seaLength, 40, 10);
  geom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  var pos = geom.attributes.position;

  var angArray = new Float32Array(pos.count);
  var ampArray = new Float32Array(pos.count);
  var speedArray = new Float32Array(pos.count);

  for (var i = 0; i < pos.count; i++) {
    angArray[i] = Math.random() * Math.PI * 2;
    ampArray[i] = game.wavesMinAmp + Math.random() * (game.wavesMaxAmp - game.wavesMinAmp);
    speedArray[i] = game.wavesMinSpeed + Math.random() * (game.wavesMaxSpeed - game.wavesMinSpeed);
  }

  geom.setAttribute('aAng', new THREE.BufferAttribute(angArray, 1));
  geom.setAttribute('aAmp', new THREE.BufferAttribute(ampArray, 1));
  geom.setAttribute('aSpeed', new THREE.BufferAttribute(speedArray, 1));

  var mat = new THREE.MeshPhongMaterial({
    color: 0x0077ff,
    emissive: 0x003366,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: .8,
    flatShading: true,
  });

  var customUniforms = {
    uTime: { value: 0 }
  };
  mat.userData.uniforms = customUniforms;

  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uTime = customUniforms.uTime;

    shader.vertexShader = `
      uniform float uTime;
      attribute float aAng;
      attribute float aAmp;
      attribute float aSpeed;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      float c_ang = aAng + (aSpeed * uTime);
      vec3 transformed = vec3(
        position.x + cos(c_ang) * aAmp,
        position.y + sin(c_ang) * aAmp,
        position.z
      );
      `
    );
  };

  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.name = "waves";
  this.mesh.receiveShadow = true;

}

Sea.prototype.moveWaves = function () {
  if (this.mesh.material.userData.uniforms) {
    this.mesh.material.userData.uniforms.uTime.value += deltaTime;
  }
}

var Cloud = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "cloud";
  var geom = new THREE.BoxGeometry(20, 20, 20);
  var mat = new THREE.MeshPhongMaterial({
    color: Colors.white,

  });

  //*
  var nBlocs = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < nBlocs; i++) {
    var m = new THREE.Mesh(geom.clone(), mat);
    m.position.x = i * 15;
    m.position.y = Math.random() * 10;
    m.position.z = Math.random() * 10;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.rotation.y = Math.random() * Math.PI * 2;
    var s = .1 + Math.random() * .9;
    m.scale.set(s, s, s);
    this.mesh.add(m);
    m.castShadow = true;
    m.receiveShadow = true;

  }
}

Cloud.prototype.rotate = function () {
  var l = this.mesh.children.length;
  for (var i = 0; i < l; i++) {
    var m = this.mesh.children[i];
    m.rotation.z += Math.random() * .005 * (i + 1);
    m.rotation.y += Math.random() * .002 * (i + 1);
  }
}

// 리듬 게임용 노트 클래스
var Note = function(hitTime, laneZ, isLong, duration) {
  var geom = new THREE.BoxGeometry(15, 2, 28); 
  var mat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,       
    emissive: 0x00ffcc,    
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.8
  });
  
  this.mesh = new THREE.Mesh(geom, mat);
  this.hitTime = hitTime;
  this.laneZ = laneZ;
  this.isLong = isLong || false; 
  this.duration = duration || 0; 
  this.angle = 0; 
}

var NotesHolder = function() {
  this.mesh = new THREE.Object3D();
  this.notesInUse = [];
  this.spawnedIndex = 0;
}

NotesHolder.prototype.updateNotes = function() {
  if (!isPlaying || !bgm) return;
  currentAudioTime = bgm.context.currentTime - songStartTime + (typeof audioOffset !== 'undefined' ? audioOffset : 0);
  
  // 곡 진행도(Time & Circle) UI 갱신.
  if (bgm.buffer) {
    let duration = bgm.buffer.duration;
    let progressRatio = currentAudioTime / duration;
    progressRatio = Math.min(1, Math.max(0, progressRatio));
    
    if(typeof levelCircle !== 'undefined' && levelCircle) {
       levelCircle.setAttribute("stroke-dashoffset", 502 - (502 * progressRatio));
    }
  }

  var angleSpeed = 1.0; 
  var spawnLeadTime = 2.0; 
  var hitZoneAngle = Math.acos(10 / 690); 
  
  // 노트 스폰 로직.
  while (this.spawnedIndex < beatmap.length) {
    var noteData = beatmap[this.spawnedIndex];
    if (currentAudioTime >= noteData.hitTime - spawnLeadTime) {
      var note = new Note(noteData.hitTime, noteData.laneZ, noteData.isLong, noteData.duration);
      this.notesInUse.push(note);
      this.mesh.add(note.mesh);
      this.spawnedIndex++;
    } else {
      break; 
    }
  }
  
  // 노트 이동 및 판정.
  for (var i = 0; i < this.notesInUse.length; i++) {
    var note = this.notesInUse[i];
    
    var timeRemaining = note.hitTime - currentAudioTime;
    note.angle = hitZoneAngle - (timeRemaining * angleSpeed);
    
    var radius = 690;
    note.mesh.position.x = Math.cos(note.angle) * radius;
    note.mesh.position.y = -600 + Math.sin(note.angle) * radius;
    note.mesh.position.z = note.laneZ;
    note.mesh.rotation.z = note.angle - Math.PI / 2;
    
    var laneDiff = Math.abs(airplaneHolder.position.z - note.laneZ);
    
    // 타격 성공 (HIT) 처리.
    if (Math.abs(timeRemaining) < 0.08) { 
      if (laneDiff < 10) { 
        this.mesh.remove(note.mesh);
        this.notesInUse.splice(i, 1);
        i--;
        
        if (typeof createHitEffect === 'function') createHitEffect(note.laneZ); 
        
        game.combo++;
        if(typeof fieldDistance !== 'undefined') {
          fieldDistance.innerHTML = String(game.combo).padStart(3, '0');
        }
        
        game.energy += 2; 
        game.energy = Math.min(100, game.energy);
        if(typeof energyBar !== 'undefined') {
          energyBar.style.right = (100 - game.energy) + "%";
          energyBar.style.backgroundColor = (game.energy < 50) ? "#f25346" : "#68c3c0";
        }
        
        continue;
      }
    }
    
    // 타격 실패 (MISS) 처리.
    if (timeRemaining < -0.15) { 
      this.mesh.remove(note.mesh);
      this.notesInUse.splice(i, 1);
      i--;
      
      game.combo = 0;
      if(typeof fieldDistance !== 'undefined') {
        fieldDistance.innerHTML = "000";
      }
      
      game.energy -= 10; 
      game.energy = Math.max(0, game.energy);
      if(typeof energyBar !== 'undefined') {
        energyBar.style.right = (100 - game.energy) + "%";
        energyBar.style.backgroundColor = (game.energy < 50) ? "#f25346" : "#68c3c0";
      }
      
      if (game.energy <= 0) {
          triggerGameOver();
      }
    }
  }
}

// 씬에 노트 매니저를 추가하는 함수
var notesHolder;
function createNotes() {
  notesHolder = new NotesHolder();
  scene.add(notesHolder.mesh);
}

var Particle = function () {
  var geom = new THREE.TetrahedronGeometry(3, 0);
  var mat = new THREE.MeshPhongMaterial({
    color: 0x009999,
    shininess: 0,
    specular: 0xffffff,
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
}

Particle.prototype.explode = function (pos, color, scale) {
  var _this = this;
  var _p = this.mesh.parent;
  this.mesh.material.color = new THREE.Color(color);
  this.mesh.material.needsUpdate = true;
  this.mesh.scale.set(scale, scale, scale);
  var targetX = pos.x + (-1 + Math.random() * 2) * 50;
  var targetY = pos.y + (-1 + Math.random() * 2) * 50;
  var speed = .6 + Math.random() * .2;
  TweenMax.to(this.mesh.rotation, speed, { x: Math.random() * 12, y: Math.random() * 12 });
  TweenMax.to(this.mesh.scale, speed, { x: .1, y: .1, z: .1 });
  TweenMax.to(this.mesh.position, speed, {
    x: targetX, y: targetY, delay: Math.random() * .1, ease: Power2.easeOut, onComplete: function () {
      if (_p) _p.remove(_this.mesh);
      _this.mesh.scale.set(1, 1, 1);
      particlesPool.unshift(_this);
    }
  });
}

var ParticlesHolder = function () {
  this.mesh = new THREE.Object3D();
  this.particlesInUse = [];
}

ParticlesHolder.prototype.spawnParticles = function (pos, density, color, scale) {

  var nPArticles = density;
  for (var i = 0; i < nPArticles; i++) {
    var particle;
    if (particlesPool.length) {
      particle = particlesPool.pop();
    } else {
      particle = new Particle();
    }
    this.mesh.add(particle.mesh);
    particle.mesh.visible = true;
    var _this = this;
    particle.mesh.position.y = pos.y;
    particle.mesh.position.x = pos.x;
    particle.explode(pos, color, scale);
  }
}

var Coin = function () {
  var geom = new THREE.TetrahedronGeometry(5, 0);
  var mat = new THREE.MeshPhongMaterial({
    color: 0x009999,
    shininess: 0,
    specular: 0xffffff,

    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

// 3D Models
var sea;
var airplane;
var airplaneHolder;
var sky;
var particlesHolder;

function createPlane() {
  airplane = new AirPlane();
  airplane.mesh.scale.set(.25, .25, .25);
  airplane.mesh.matrixAutoUpdate = false;

  airplaneHolder = new THREE.Object3D();
  airplaneHolder.position.y = game.planeDefaultHeight;
  airplaneHolder.add(airplane.mesh);

  airplane.fpsCameraTarget = new THREE.Object3D();
  airplane.fpsCameraTarget.position.set(25, 55, 0);
  airplane.fpsCameraTarget.rotation.set(0, -Math.PI / 2, 0);
  airplane.mesh.add(airplane.fpsCameraTarget);

  scene.add(airplaneHolder);
}

function createSea() {
  sea = new Sea();
  sea.mesh.position.y = -game.seaRadius;
  scene.add(sea.mesh);
}

function createLanes() {
  const laneRadius = 690; 
  
  const laneZPositions = [-60, -30, 0, 30, 60];

  laneZPositions.forEach((zPos) => {
    const isOuter = (zPos === -60 || zPos === 60);
    
    const tubeThickness = isOuter ? 1.5 : 0.5;

    const geom = new THREE.TorusGeometry(laneRadius, tubeThickness, 8, 100);
    
    const mat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffcc, 
      emissive: 0x888888,
      roughness: 0.1,
      metalness: 0.8
    }); 
    
    const ring = new THREE.Mesh(geom, mat);

    ring.position.y = -600;
    ring.position.z = zPos;
    
    scene.add(ring);
  });
}

// 시각적 판정선 생성.
function createJudgmentLine() {
  var lineAngle = Math.acos(10 / 689);

  var geom = new THREE.BoxGeometry(1, 1, 110);
  var mat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.5
  });
  var judgmentLine = new THREE.Mesh(geom, mat);
  
 judgmentLine.position.x = Math.cos(lineAngle) * 692; 
  judgmentLine.position.y = -600 + Math.sin(lineAngle) * 692; 
  judgmentLine.position.z = 0;
  judgmentLine.rotation.z = lineAngle - Math.PI / 2; 
  
  scene.add(judgmentLine);
}

function createSky() {
  sky = new Sky();
  sky.mesh.position.y = -game.seaRadius;
  scene.add(sky.mesh);
}

function createStars() {

    const geometry =
        new THREE.BufferGeometry();

    const vertices = [];

    for(let i=0;i<1000;i++){

        vertices.push(
            (Math.random()-0.5)*8000,
            Math.random()*4000,
            (Math.random()-0.5)*4000
        );
    }

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
            vertices,
            3
        )
    );

    const material =
        new THREE.PointsMaterial({
            size: 8,
            fog: false
        });

    const stars =
        new THREE.Points(
            geometry,
            material
        );

    scene.add(stars);
}

function createParticles() {
  for (var i = 0; i < 10; i++) {
    var particle = new Particle();
    particlesPool.push(particle);
  }
  particlesHolder = new ParticlesHolder();
  scene.add(particlesHolder.mesh)
}

function loop() {

  newTime = new Date().getTime();
  deltaTime = newTime - oldTime;
  oldTime = newTime;

  if (game.status == "playing") {

    if (typeof notesHolder !== 'undefined') {
      notesHolder.updateNotes();
      }


    updatePlane();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
    game.speed = game.baseSpeed * game.planeSpeed;

    // 음원 비트에 동기화된 트랙의 간접 반사광(GI) 실시간 보간 및 감쇄 연산
    if (typeof giLightBounce !== 'undefined' && giLightBounce && isPlaying) {
      var beatProgress = (currentAudioTime % SEC_PER_BEAT) / SEC_PER_BEAT;
      var pulseIntensity = Math.sin(beatProgress * Math.PI) * 5.0;
      
      // 라이트 인텐시티를 목표값으로 부드럽게 감쇄 보간
      giLightBounce.intensity += (pulseIntensity - giLightBounce.intensity) * 0.1;
    }

  } else if (game.status == "gameover") {
    game.speed *= .99;
    airplane.mesh.rotation.z += (-Math.PI / 2 - airplane.mesh.rotation.z) * .0002 * deltaTime;
    airplane.mesh.rotation.x += 0.0003 * deltaTime;
    game.planeFallSpeed *= 1.05;
    airplaneHolder.position.y -= game.planeFallSpeed * deltaTime;

    if (airplaneHolder.position.y < -200) {
      showReplay();
      game.status = "waitingReplay";

    }
  } else if (game.status == "waitingReplay") {

  }

  sea.mesh.rotation.z += game.speed * deltaTime;//*game.seaRotationSpeed;

  if (sea.mesh.rotation.z > 2 * Math.PI) sea.mesh.rotation.z -= 2 * Math.PI;

  ambientLight.intensity += (.5 - ambientLight.intensity) * deltaTime * 0.005;

  sky.moveClouds();
  sea.moveWaves();

  var rhythmCameraPos = new THREE.Vector3(-150, 300, 0);
  var rhythmCameraTarget = new THREE.Vector3(0, 200, 0);

  camera.position.lerp(rhythmCameraPos, 0.1);

  var m = new THREE.Matrix4();
  m.lookAt(camera.position, rhythmCameraTarget, new THREE.Vector3(0, 1, 0));
  var targetCameraQuat = new THREE.Quaternion().setFromRotationMatrix(m);
  camera.quaternion.slerp(targetCameraQuat, 0.1);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateDistance() {
  game.distance += game.speed * deltaTime * game.ratioSpeedDistance;
  fieldDistance.innerHTML = Math.floor(game.distance);
  var d = 502 * (1 - (game.distance % game.distanceForLevelUpdate) / game.distanceForLevelUpdate);
  levelCircle.setAttribute("stroke-dashoffset", d);

}

var blinkEnergy = false;

function updateEnergy() {
  game.energy -= game.speed * deltaTime * game.ratioSpeedEnergy;
  game.energy = Math.max(0, game.energy);
  energyBar.style.right = (100 - game.energy) + "%";
  energyBar.style.backgroundColor = (game.energy < 50) ? "#f25346" : "#68c3c0";

  if (game.energy < 30) {
    energyBar.style.animationName = "blinking";
  } else {
    energyBar.style.animationName = "none";
  }

  if (game.energy < 1) {
    triggerGameOver();
  }
}

function addEnergy() {
  game.energy += game.coinValue;
  game.energy = Math.min(game.energy, 100);
}

function removeEnergy() {
  game.energy -= game.ennemyValue;
  game.energy = Math.max(0, game.energy);
}



var planeTargetY = 100;
var planeTargetZ = -15;

function updatePlane() {
  game.planeSpeed = 1.4; 

  game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
  game.planeCollisionDisplacementY += game.planeCollisionSpeedY;

  targetPos.y = game.planeDefaultHeight; 
  const laneZ = { d: -45, f: -15, j: 15, k: 45 };

  if (keys.d) targetPos.z = laneZ.d;
  else if (keys.f) targetPos.z = laneZ.f;
  else if (keys.j) targetPos.z = laneZ.j;
  else if (keys.k) targetPos.z = laneZ.k;

  // 목표 레인 변경 감지 및 거리 비례 애니메이션 변수 초기화
  if (typeof game.lastTargetZ === 'undefined') game.lastTargetZ = targetPos.z;
  if (typeof game.bankingDist === 'undefined') game.bankingDist = 0.0;
  
  if (game.lastTargetZ !== targetPos.z) {
    startQuat.copy(airplane.mesh.quaternion);
    game.bankingDist = 30.0;
    
    let totalMoveDist = targetPos.z - airplaneHolder.position.z;
    
    let maxAngle = Math.PI / 3; 
    let rollAngle = -(totalMoveDist / 90.0) * maxAngle; 

    targetQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rollAngle);
    
    game.lastTargetZ = targetPos.z;
  }

  // 위치 선형 보간.
  var pos = airplaneHolder.position;
  var effectiveTargetPos = targetPos.clone();
  effectiveTargetPos.x += game.planeCollisionDisplacementX;
  effectiveTargetPos.y += game.planeCollisionDisplacementY;
  pos.add(effectiveTargetPos.sub(pos).multiplyScalar(0.25));

  // 이동 중인지 판단.
  var dz = targetPos.z - airplaneHolder.position.z;
  var isMoving = Math.abs(dz) > 1.0; 

  // 회전 보간 변수(t) 갱신.
  if (isMoving) {
    game.bankingDist += (15.0 - game.bankingDist) * 0.15;
  } else {
    game.bankingDist += (0.0 - game.bankingDist) * 0.15;
  }
  
  let dist = game.bankingDist;
  let t = 1.0 - dist / 30.0;
  t = Math.max(0, Math.min(1, t)); 

  // 2단계 구면 선형 보간 적용.
  const identityQuat = new THREE.Quaternion();

  if (t <= 0.5) {
    airplane.mesh.quaternion.slerpQuaternions(startQuat, targetQuat, t * 2);
    midQuat.copy(airplane.mesh.quaternion);
  } else {
    airplane.mesh.quaternion.slerpQuaternions(midQuat, identityQuat, (t - 0.5) * 2);
  }

  // 프로펠러 및 행렬 갱신.
  airplane.propeller.rotation.x += 0.3;
  airplane.mesh.matrix.compose(airplane.mesh.position, airplane.mesh.quaternion, airplane.mesh.scale); 
  
  airplane.pilot.updateHairs();
}

function showReplay() {
  replayMessage.style.display = "block";
}

function hideReplay() {
  replayMessage.style.display = "none";
}

function normalize(v, vmin, vmax, tmin, tmax) {
  var nv = Math.max(Math.min(v, vmax), vmin);
  var dv = vmax - vmin;
  var pc = (nv - vmin) / dv;
  var dt = tmax - tmin;
  var tv = tmin + (pc * dt);
  return tv;
}

var fieldDistance, energyBar, replayMessage, fieldLevel, levelCircle;

function init(event) {

  // UI

  fieldDistance = document.getElementById("distValue");
  energyBar = document.getElementById("energyBar");
  replayMessage = document.getElementById("replayMessage");
  fieldLevel = document.getElementById("levelValue");
  levelCircle = document.getElementById("levelCircleStroke");
  var distLabel = document.querySelector('#dist .score__label');
  if(distLabel) distLabel.innerHTML = "COMBO";
  var energyLabel = document.querySelector('#energy .score__label');
  if(energyLabel) energyLabel.innerHTML = "HP";
  var levelLabel = document.querySelector('#level .score__label');
  if(levelLabel) levelLabel.innerHTML = "TIME";

  resetGame();
  game.status = "waitingReplay";
  if (replayMessage) replayMessage.innerHTML = "LOADING...";
  showReplay();
  createScene();
  createStars();

  createLights();
  createPlane();
  createSea();
  createLanes();
  createJudgmentLine();
  createSky();
  createNotes();
  createParticles();
  createAudio();
  createLaneLabels();

  document.addEventListener('keydown', handleKeyDown, false);
  document.addEventListener('keyup', handleKeyUp, false);
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchend', handleTouchEnd, false);

  loadBeatmapFile();

  loop();
}

window.addEventListener('load', init, false);


