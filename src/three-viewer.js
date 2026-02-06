import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class ThreeViewer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas element with id "${canvasId}" not found`);
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.mixer = null;
    this.animationAction = null;
    this.animationClips = [];
    this.clock = new THREE.Clock(true);
    this.isModelLoaded = false;
    this.errorMessage = null;
    this.shadowPlane = null;
    this.headBone = null;
    this.headLookEnabled = false;
    this.mouse = new THREE.Vector2();
    this.mouseTarget = new THREE.Vector3();
    this.smoothedMouseTarget = new THREE.Vector3();
    this.headLookLerpFactor = 0.04;
    this.headRotationLerpFactor = 0.06;
    this.smoothedHeadWorldQuat = new THREE.Quaternion();
    this.headRotationInitialized = false;
    this._headLookHelper = new THREE.Object3D();
    this._headWorldPos = new THREE.Vector3();
    this._parentWorldQuat = new THREE.Quaternion();
    this.planeZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), -5);
    this.raycaster = new THREE.Raycaster();

    this.init();
  }

  init() {
    try {
      this.scene = new THREE.Scene();
      this.scene.background = null;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspect = width / height;
      this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
      this.camera.position.set(0, 1.7, 2.5);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        logarithmicDepthBuffer: true
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      this.renderer.setClearColor(0x000000, 0);
      
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.setupShadowPlane();
      this.setupLighting();
      this.setupResizeHandler();
      this.setupMouseTracking();
      this.loadModel();
      this.animate();
    } catch (error) {
      console.error('Error initializing Three.js viewer:', error);
      this.showError('Failed to initialize 3D viewer');
    }
  }

  setupShadowPlane() {
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
    this.shadowPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0;
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2.5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
  }

  setupResizeHandler() {
    const handleResize = () => {
      if (!this.canvas || !this.camera || !this.renderer) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);
  }

  setupMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  updateMouseTarget() {
    if (!this.camera) return;
    this.raycaster.setFromCamera(new THREE.Vector2(-this.mouse.x, -this.mouse.y), this.camera);
    this.raycaster.ray.intersectPlane(this.planeZ, this.mouseTarget);
  }

  loadModel() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      import.meta.env.BASE_URL + 'draco/'
    );

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    const modelPath = import.meta.env.BASE_URL + 'models/character.glb';

    loader.load(
      modelPath,
      (gltf) => {
        console.log('Model loaded successfully');
        this.model = gltf.scene;
        
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.frustumCulled = false;
            child.castShadow = true;
            child.receiveShadow = true;
          }
          if (child.name === 'Head') {
            this.headBone = child;
          }
        });
        
        this.scene.add(this.model);
        this.model.position.set(0, 0, 0);

        this.pointCameraAtModel();
        this.setupAnimations(gltf);

        this.isModelLoaded = true;
        this.hideError();
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading model: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error('Error loading model:', error);
        this.showError('Model file not found. Please ensure /models/character.glb exists.');
      }
    );
  }

  

  pointCameraAtModel() {
    if (!this.model || !this.camera) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0));
    
    this.camera.lookAt(center);
    
  }


  setupAnimations(gltf) {
    if (!gltf.animations || gltf.animations.length === 0) {
      console.warn('No animations found in model');
      return;
    }

    this.animationClips = gltf.animations;
    this.mixer = new THREE.AnimationMixer(this.model);


    const ironmanClip = gltf.animations.find((a) => a.name.toLowerCase() === 'ironman') || gltf.animations[12];
    const walkClip = gltf.animations.find((a) => a.name.toLowerCase() === 'walk') || gltf.animations[8];

    if (!ironmanClip || !walkClip) {
      console.warn('ironman or walk clip missing. Count:', gltf.animations.length, 'Clips:', gltf.animations.map((a, i) => `${i}. ${a.name}`));
      if (gltf.animations.length > 0) {
        this.animationAction = this.mixer.clipAction(gltf.animations[0]);
        this.animationAction.setLoop(THREE.LoopRepeat);
        this.animationAction.play();
        this.animationAction.paused = false;
      }
      return;
    }


    const ironmanAction = this.mixer.clipAction(ironmanClip);
    ironmanAction.setLoop(THREE.LoopOnce);
    ironmanAction.clampWhenFinished = true;
    ironmanAction.setEffectiveWeight(1);
    ironmanAction.enabled = true;
    ironmanAction.reset().play();
    this.animationAction = ironmanAction;

    const transitionToWalk = () => {
      if (this.animationAction !== ironmanAction) return;
      this.mixer.removeEventListener('finished', transitionToWalk);
      const walkAction = this.mixer.clipAction(walkClip);
      walkAction.setLoop(THREE.LoopRepeat);
      ironmanAction.fadeOut(0.5);
      walkAction.reset().fadeIn(0.5).play();
      this.animationAction = walkAction;
      this.headLookEnabled = true;
      console.log('Switched to walk (loop), head look enabled');
    };

    this.mixer.addEventListener('finished', transitionToWalk);
    console.log('Started ironman, will transition to walk on finish', {
      ironman: ironmanClip.name,
      ironmanDuration: ironmanClip.duration,
      walk: walkClip.name
    });
  }

  playAnimation(clipName, transitionDuration = 0.5) {
    if (!this.mixer || !this.animationClips || this.animationClips.length === 0) return;

    const clip = this.animationClips.find(
      (c) => c.name === clipName || c.name.toLowerCase().includes(clipName.toLowerCase().replace(/_/g, ' '))
    );
    if (!clip) {
      console.warn(`Animation "${clipName}" not found. Available:`, this.animationClips.map((c) => c.name));
      return;
    }

    const newAction = this.mixer.clipAction(clip);
    newAction.setLoop(THREE.LoopRepeat);

    if (this.animationAction) {
      this.animationAction.fadeOut(transitionDuration);
    }
    newAction.reset().fadeIn(transitionDuration).play();
    this.animationAction = newAction;
  }

  showError(message) {
    this.errorMessage = message;
    this.isModelLoaded = false;

    const errorDiv = document.createElement('div');
    errorDiv.id = 'model-error-placeholder';
    errorDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #999;
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      z-index: 10;
      max-width: 300px;
    `;
    errorDiv.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
      <div style="font-weight: 500; margin-bottom: 5px;">Model Not Found</div>
      <div style="font-size: 12px;">${message}</div>
    `;

    const existing = document.getElementById('model-error-placeholder');
    if (existing) existing.remove();

    const container = this.canvas.parentElement;
    if (container) {
      container.style.position = 'relative';
      container.appendChild(errorDiv);
    }
  }

  hideError() {
    const errorDiv = document.getElementById('model-error-placeholder');
    if (errorDiv) {
      errorDiv.remove();
    }
    this.errorMessage = null;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.renderer || !this.scene || !this.camera) return;

    const delta = this.clock.getDelta();
    
    this.updateMouseTarget();
    this.smoothedMouseTarget.lerp(this.mouseTarget, this.headLookLerpFactor);

    if (this.mixer) {
      this.mixer.update(delta);
    }
    if (this.headLookEnabled && this.headBone && this.smoothedMouseTarget) {
      const head = this.headBone;
      const helper = this._headLookHelper;
      const desiredQuat = helper.quaternion;
      head.getWorldPosition(this._headWorldPos);
      helper.position.copy(this._headWorldPos);
      helper.lookAt(this.smoothedMouseTarget);
      helper.rotateY(Math.PI);
      if (!this.headRotationInitialized) {
        head.getWorldQuaternion(this.smoothedHeadWorldQuat);
        this.headRotationInitialized = true;
      }
      this.smoothedHeadWorldQuat.slerp(desiredQuat, this.headRotationLerpFactor);
      if (head.parent) {
        head.parent.getWorldQuaternion(this._parentWorldQuat);
        head.quaternion.copy(this.smoothedHeadWorldQuat).premultiply(this._parentWorldQuat.clone().invert());
      } else {
        head.quaternion.copy(this.smoothedHeadWorldQuat);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.animationAction) {
      this.animationAction = null;
    }

    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.model = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
