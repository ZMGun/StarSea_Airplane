import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap, Power2 } from 'gsap';
const TweenMax = gsap;

var cameraMode = 0; // 0: tracking, 1: free, 2: 1st-person

// 레거시 튜토리얼 색상과 동일하게 맞추기 위해 ColorManagement 비활성화
THREE.ColorManagement.enabled = false;

// Variables for smooth movement and camera transitions
var targetPos = new THREE.Vector3(0, 100, 0);
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
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();
var ennemiesPool = [];
var particlesPool = [];
var particlesInUse = [];

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
    //seaRotationSpeed:0.006,
    wavesMinAmp: 5,
    wavesMaxAmp: 20,
    wavesMinSpeed: 0.001,
    wavesMaxSpeed: 0.003,

    cameraFarPos: 500,
    cameraNearPos: 150,
    cameraSensivity: 0.002,

    coinDistanceTolerance: 15,
    coinValue: 3,
    coinsSpeed: .5,
    coinLastSpawn: 0,
    distanceForCoinsSpawn: 100,

    ennemyDistanceTolerance: 10,
    ennemyValue: 10,
    ennemiesSpeed: .6,
    ennemyLastSpawn: 0,
    distanceForEnnemiesSpawn: 50,

    status: "playing",
  };
  fieldLevel.innerHTML = Math.floor(game.level);
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
  scene.fog = new THREE.Fog(0xf7d9aa, 100, 950);
  camera.position.x = 0;
  camera.position.z = 200;
  camera.position.y = game.planeDefaultHeight;
  //camera.lookAt(new THREE.Vector3(0, 400, 0));

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
  // OrbitControls 초기화 시 카메라가 강제로 target(0,0,0)을 바라보게 되므로 회전값을 원래대로 초기화
  camera.rotation.set(0, 0, 0);
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
  var k = event.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true;

  if (['w', 'a', 's', 'd'].includes(k)) {
    if (!event.repeat) {
      startQuat.copy(airplane.mesh.quaternion);
      game.bankingDist = 30.0; // 기울기 애니메이션 초기화
    }
  }

  if (k === 'o') {
    cameraMode = 2; // FPS
    controls.enabled = false;
  } else if (k === 'p') {
    cameraMode = 3; // Topview
    controls.enabled = false;
  } else if (k === ' ') {
    cameraMode = 0; // 기본 시점 (Tracking)
    controls.enabled = false;
  }
}
function handleKeyUp(event) {
  var k = event.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = false;
  
  // 다중 키 입력 중 하나를 떼었을 때, 남은 키의 방향으로 부드럽게 전환하기 위해 애니메이션 리셋
  if (['w', 'a', 's', 'd'].includes(k)) {
    if (keys.w || keys.a || keys.s || keys.d) {
      startQuat.copy(airplane.mesh.quaternion);
      game.bankingDist = 30.0;
    }
  }
}

function handleTouchMove(event) {
  event.preventDefault();
  var tx = -1 + (event.touches[0].pageX / WIDTH) * 2;
  var ty = 1 - (event.touches[0].pageY / HEIGHT) * 2;
  mousePos = { x: tx, y: ty };
}

function handleMouseUp(event) {
  if (game.status == "waitingReplay") {
    resetGame();
    hideReplay();
  }
}


function handleTouchEnd(event) {
  if (game.status == "waitingReplay") {
    resetGame();
    hideReplay();
  }
}

// LIGHTS

var ambientLight, hemisphereLight, shadowLight;

function createLights() {

  hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, .9 * Math.PI)

  ambientLight = new THREE.AmbientLight(0xdc8874, .5 * Math.PI);

  shadowLight = new THREE.DirectionalLight(0xffffff, .9 * Math.PI);
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
    color: Colors.blue,
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
  //*/
}

Cloud.prototype.rotate = function () {
  var l = this.mesh.children.length;
  for (var i = 0; i < l; i++) {
    var m = this.mesh.children[i];
    m.rotation.z += Math.random() * .005 * (i + 1);
    m.rotation.y += Math.random() * .002 * (i + 1);
  }
}

var Ennemy = function () {
  var geom = new THREE.TetrahedronGeometry(8, 2);
  var mat = new THREE.MeshPhongMaterial({
    color: Colors.red,
    shininess: 0,
    specular: 0xffffff,
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

var EnnemiesHolder = function () {
  this.mesh = new THREE.Object3D();
  this.ennemiesInUse = [];
}

EnnemiesHolder.prototype.spawnEnnemies = function () {
  var nEnnemies = game.level;

  for (var i = 0; i < nEnnemies; i++) {
    var ennemy;
    if (ennemiesPool.length) {
      ennemy = ennemiesPool.pop();
    } else {
      ennemy = new Ennemy();
    }

    ennemy.angle = - (i * 0.1);
    ennemy.distance = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight - 20);
    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle) * ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle) * ennemy.distance;
    ennemy.mesh.position.z = -80 + Math.random() * 160;

    this.mesh.add(ennemy.mesh);
    this.ennemiesInUse.push(ennemy);
  }
}

EnnemiesHolder.prototype.rotateEnnemies = function () {
  for (var i = 0; i < this.ennemiesInUse.length; i++) {
    var ennemy = this.ennemiesInUse[i];
    ennemy.angle += game.speed * deltaTime * game.ennemiesSpeed;

    if (ennemy.angle > Math.PI * 2) ennemy.angle -= Math.PI * 2;

    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle) * ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle) * ennemy.distance;
    ennemy.mesh.rotation.z += Math.random() * .1;
    ennemy.mesh.rotation.y += Math.random() * .1;

    //var globalEnnemyPosition =  ennemy.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplaneHolder.position.clone().sub(ennemy.mesh.position.clone());
    var d = diffPos.length();
    if (d < game.ennemyDistanceTolerance) {
      particlesHolder.spawnParticles(ennemy.mesh.position.clone(), 15, Colors.red, 3);

      ennemiesPool.unshift(this.ennemiesInUse.splice(i, 1)[0]);
      this.mesh.remove(ennemy.mesh);
      game.planeCollisionSpeedX = 100 * diffPos.x / d;
      game.planeCollisionSpeedY = 100 * diffPos.y / d;
      ambientLight.intensity = 2;

      removeEnergy();
      i--;
    } else if (ennemy.angle > Math.PI) {
      ennemiesPool.unshift(this.ennemiesInUse.splice(i, 1)[0]);
      this.mesh.remove(ennemy.mesh);
      i--;
    }
  }
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

var CoinsHolder = function (nCoins) {
  this.mesh = new THREE.Object3D();
  this.coinsInUse = [];
  this.coinsPool = [];
  for (var i = 0; i < nCoins; i++) {
    var coin = new Coin();
    this.coinsPool.push(coin);
  }
}

CoinsHolder.prototype.spawnCoins = function () {

  var nCoins = 1 + Math.floor(Math.random() * 10);
  var d = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight - 20);
  var amplitude = 10 + Math.round(Math.random() * 10);
  var zOffset = -80 + Math.random() * 160;
  for (var i = 0; i < nCoins; i++) {
    var coin;
    if (this.coinsPool.length) {
      coin = this.coinsPool.pop();
    } else {
      coin = new Coin();
    }
    this.mesh.add(coin.mesh);
    this.coinsInUse.push(coin);
    coin.angle = - (i * 0.02);
    coin.distance = d + Math.cos(i * .5) * amplitude;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle) * coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
  }
}

CoinsHolder.prototype.rotateCoins = function () {
  for (var i = 0; i < this.coinsInUse.length; i++) {
    var coin = this.coinsInUse[i];
    if (coin.exploding) continue;
    coin.angle += game.speed * deltaTime * game.coinsSpeed;
    if (coin.angle > Math.PI * 2) coin.angle -= Math.PI * 2;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle) * coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
    coin.mesh.rotation.z += Math.random() * .1;
    coin.mesh.rotation.y += Math.random() * .1;

    //var globalCoinPosition =  coin.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplaneHolder.position.clone().sub(coin.mesh.position.clone());
    var d = diffPos.length();
    if (d < game.coinDistanceTolerance) {
      this.coinsPool.unshift(this.coinsInUse.splice(i, 1)[0]);
      this.mesh.remove(coin.mesh);
      particlesHolder.spawnParticles(coin.mesh.position.clone(), 5, 0x009999, .8);
      addEnergy();
      i--;
    } else if (coin.angle > Math.PI) {
      this.coinsPool.unshift(this.coinsInUse.splice(i, 1)[0]);
      this.mesh.remove(coin.mesh);
      i--;
    }
  }
}


// 3D Models
var sea;
var airplane;
var airplaneHolder;
var sky;
var coinsHolder;
var ennemiesHolder;
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

function createSky() {
  sky = new Sky();
  sky.mesh.position.y = -game.seaRadius;
  scene.add(sky.mesh);
}

function createCoins() {

  coinsHolder = new CoinsHolder(20);
  scene.add(coinsHolder.mesh)
}

function createEnnemies() {
  for (var i = 0; i < 10; i++) {
    var ennemy = new Ennemy();
    ennemiesPool.push(ennemy);
  }
  ennemiesHolder = new EnnemiesHolder();
  //ennemiesHolder.mesh.position.y = -game.seaRadius;
  scene.add(ennemiesHolder.mesh)
}

function createParticles() {
  for (var i = 0; i < 10; i++) {
    var particle = new Particle();
    particlesPool.push(particle);
  }
  particlesHolder = new ParticlesHolder();
  //ennemiesHolder.mesh.position.y = -game.seaRadius;
  scene.add(particlesHolder.mesh)
}

function loop() {

  newTime = new Date().getTime();
  deltaTime = newTime - oldTime;
  oldTime = newTime;

  if (game.status == "playing") {

    // Add energy coins every 100m;
    if (Math.floor(game.distance) % game.distanceForCoinsSpawn == 0 && Math.floor(game.distance) > game.coinLastSpawn) {
      game.coinLastSpawn = Math.floor(game.distance);
      coinsHolder.spawnCoins();
    }

    if (Math.floor(game.distance) % game.distanceForSpeedUpdate == 0 && Math.floor(game.distance) > game.speedLastUpdate) {
      game.speedLastUpdate = Math.floor(game.distance);
      game.targetBaseSpeed += game.incrementSpeedByTime * deltaTime;
    }


    if (Math.floor(game.distance) % game.distanceForEnnemiesSpawn == 0 && Math.floor(game.distance) > game.ennemyLastSpawn) {
      game.ennemyLastSpawn = Math.floor(game.distance);
      ennemiesHolder.spawnEnnemies();
    }

    if (Math.floor(game.distance) % game.distanceForLevelUpdate == 0 && Math.floor(game.distance) > game.levelLastUpdate) {
      game.levelLastUpdate = Math.floor(game.distance);
      game.level++;
      fieldLevel.innerHTML = Math.floor(game.level);

      game.targetBaseSpeed = game.initSpeed + game.incrementSpeedByLevel * game.level
    }


    updatePlane();
    updateDistance();
    updateEnergy();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
    game.speed = game.baseSpeed * game.planeSpeed;

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

  coinsHolder.rotateCoins();
  ennemiesHolder.rotateEnnemies();

  sky.moveClouds();
  sea.moveWaves();

  if (cameraMode !== 1) {
    if (cameraMode === 0) {
      cameraTargetPos.set(0, airplaneHolder.position.y, 200);
      cameraTargetQuat.setFromEuler(new THREE.Euler(0, 0, 0));
    } else if (cameraMode === 2) {
      // airplaneHolder의 위치 이동이 반영되도록 수동으로 matrix 업데이트
      airplaneHolder.updateMatrixWorld(true);
      airplane.fpsCameraTarget.getWorldPosition(cameraTargetPos);
      airplane.fpsCameraTarget.getWorldQuaternion(cameraTargetQuat);
    } else if (cameraMode === 3) {
      cameraTargetPos.set(airplaneHolder.position.x, airplaneHolder.position.y + 200, airplaneHolder.position.z);
      cameraTargetQuat.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    }

    var lerpFactor = (cameraMode === 2) ? 0.3 : 0.05;
    camera.position.lerp(cameraTargetPos, lerpFactor);
    camera.quaternion.slerp(cameraTargetQuat, lerpFactor);
  } else {
    controls.target.copy(airplaneHolder.position);
    controls.update();
  }

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
    game.status = "gameover";
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
var planeTargetZ = 0;

function updatePlane() {

  game.planeSpeed = 1.4; // 속도 고정 (이전의 min: 1.2, max: 1.6 의 평균)

  game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
  game.planeCollisionDisplacementY += game.planeCollisionSpeedY;

  // Incremental Movement
  var moveSpeed = 0.2 * deltaTime;
  if (keys.w) targetPos.y += moveSpeed;
  if (keys.s) targetPos.y -= moveSpeed;
  if (keys.a) targetPos.z -= moveSpeed;
  if (keys.d) targetPos.z += moveSpeed;

  // Strict Clamping
  targetPos.y = Math.max(game.planeDefaultHeight - game.planeAmpHeight, Math.min(game.planeDefaultHeight + game.planeAmpHeight, targetPos.y));
  targetPos.z = Math.max(-100, Math.min(100, targetPos.z));

  // Physical Interpolation
  var pos = airplaneHolder.position;
  var effectiveTargetPos = targetPos.clone();
  effectiveTargetPos.x += game.planeCollisionDisplacementX;
  effectiveTargetPos.y += game.planeCollisionDisplacementY;

  pos.add(effectiveTargetPos.sub(pos).multiplyScalar(0.1));

  // Banking Direction
  var dy = targetPos.y - airplaneHolder.position.y;
  var dz = targetPos.z - airplaneHolder.position.z;
  var angle = Math.PI / 4;

  // 매 프레임 targetQuat를 초기화하지 않고 전역 변수를 그대로 사용하여,
  // 키를 떼었을 때 마지막 기울기 목표(targetQuat)를 기억하도록 합니다.
  
  // 대각선 이동을 지원하기 위해 피치(위/아래)와 롤(좌/우)을 각각 계산하여 합성
  let pitch = 0;
  let roll = 0;
  
  if (keys.w) pitch = angle;
  if (keys.s) pitch = -angle;
  if (keys.a) roll = angle;
  if (keys.d) roll = -angle;

  // 키 입력이 있는 동안에만 새로운 목표 회전값을 계산
  if (keys.w || keys.s || keys.a || keys.d) {
    let pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch);
    let rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll);
    targetQuat.multiplyQuaternions(pitchQuat, rollQuat);
  }

  // Skeleton-based Slerp
  let actualDist = Math.max(Math.abs(dy), Math.abs(dz));

  // 단타 및 이동 중 자연스러운 기울기(Banking) 애니메이션을 위한 보정 로직
  if (typeof game.bankingDist === 'undefined') game.bankingDist = 30.0;

  if (keys.w || keys.s || keys.a || keys.d) {
    // 키를 누르는 동안 dist를 30 -> 15로 부드럽게 감소시켜 t가 0 -> 0.5로 자연스럽게 진행되도록 함 (뱅킹)
    game.bankingDist += (15.0 - game.bankingDist) * 0.15;
  } else {
    // 키를 떼면 dist를 15 -> 0으로 부드럽게 감소시켜 t가 0.5 -> 1.0으로 자연스럽게 진행되도록 함 (수평 복귀)
    game.bankingDist += (0.0 - game.bankingDist) * 0.15;
  }

  let dist = game.bankingDist;
  let t = 1.0 - dist / 30.0;

  // Correction
  if (dist > 30.0) {
    t = 0.0;
  }
  t = Math.max(0, Math.min(1, t)); // t 클램핑

  // Two-Phase Logic
  const identityQuat = new THREE.Quaternion();

  if (t <= 0.5) {
    airplane.mesh.quaternion.slerpQuaternions(startQuat, targetQuat, t * 2);
    midQuat.copy(airplane.mesh.quaternion);
  } else {
    airplane.mesh.quaternion.slerpQuaternions(midQuat, identityQuat, (t - 0.5) * 2);
  }

  // Bonus & Polish
  airplane.propeller.rotation.x += 0.3;
  airplane.mesh.matrix.compose(airplane.mesh.position, airplane.mesh.quaternion, airplane.mesh.scale);

  game.planeCollisionSpeedX += (0 - game.planeCollisionSpeedX) * deltaTime * 0.03;
  game.planeCollisionDisplacementX += (0 - game.planeCollisionDisplacementX) * deltaTime * 0.01;
  game.planeCollisionSpeedY += (0 - game.planeCollisionSpeedY) * deltaTime * 0.03;
  game.planeCollisionDisplacementY += (0 - game.planeCollisionDisplacementY) * deltaTime * 0.01;

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

  resetGame();
  createScene();

  createLights();
  createPlane();
  createSea();
  createSky();
  createCoins();
  createEnnemies();
  createParticles();

  document.addEventListener('keydown', handleKeyDown, false);
  document.addEventListener('keyup', handleKeyUp, false);
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchend', handleTouchEnd, false);

  loop();
}

window.addEventListener('load', init, false);


