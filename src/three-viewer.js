import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
    this.clock = new THREE.Clock(true);
    this.isModelLoaded = false;
    this.errorMessage = null;
    this.shadowPlane = null;

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
      this.camera.position.set(1.5, 1.7, 2.5);

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
      this.loadModel();
      this.animate();
    } catch (error) {
      console.error('Error initializing Three.js viewer:', error);
      this.showError('Failed to initialize 3D viewer');
    }
  }

  setupShadowPlane() {
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
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
    directionalLight.position.set(5, 10, 5);
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

  loadModel() {
    const loader = new GLTFLoader();
    const modelPath = '/models/character.glb';

    loader.load(
      modelPath,
      (gltf) => {
        console.log('Model loaded successfully');
        this.model = gltf.scene;
        
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        this.scene.add(this.model);
        this.model.position.set(1.5, 0, 0);

        // this.centerAndNormalizeModel();
        // this.frameModel();
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

  centerAndNormalizeModel() {
    if (!this.model) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.5 / maxDim;

    this.model.position.x = -center.x;
    this.model.position.y = -center.y;
    this.model.position.z = -center.z;

    this.model.scale.multiplyScalar(scale);

    console.log('Model centered and normalized:', {
      originalCenter: center,
      originalSize: size,
      scale: scale
    });
  }

  pointCameraAtModel() {
    if (!this.model || !this.camera) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3()).add(new THREE.Vector3(0.5, 0.4, 0));
    
    this.camera.lookAt(center);
    
  }

  frameModel() {
    if (!this.model || !this.camera) return;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const fov = this.camera.fov * (Math.PI / 180);
    const distance = Math.max(size.x, size.y, size.z) / (2 * Math.tan(fov / 2));
    
    this.camera.position.set(0, center.y + size.y * 0.3, distance * 1.2);
    this.camera.lookAt(center);

    console.log('Camera framed for model:', {
      cameraPosition: this.camera.position,
      lookAt: center
    });
  }

  setupAnimations(gltf) {
    if (!gltf.animations || gltf.animations.length === 0) {
      console.warn('No animations found in model');
      return;
    }

    this.mixer = new THREE.AnimationMixer(this.model);

    const walkAnimation = gltf.animations.find(
      (anim) => anim.name === 'Casual_Walk' || anim.name.toLowerCase().includes('walk')
    );

    if (walkAnimation) {
      this.animationAction = this.mixer.clipAction(walkAnimation);
      this.animationAction.setLoop(THREE.LoopRepeat);
      this.animationAction.play();
      this.animationAction.paused = false;
      console.log('Casual_Walk animation started', {
        name: walkAnimation.name,
        duration: walkAnimation.duration,
        action: this.animationAction
      });
    } else {
      console.warn('Casual_Walk animation not found. Available animations:', 
        gltf.animations.map(a => a.name));
      
      if (gltf.animations.length > 0) {
        this.animationAction = this.mixer.clipAction(gltf.animations[0]);
        this.animationAction.setLoop(THREE.LoopRepeat);
        this.animationAction.play();
        this.animationAction.paused = false;
        console.log(`Playing first available animation: ${gltf.animations[0].name}`, {
          duration: gltf.animations[0].duration,
          action: this.animationAction
        });
      }
    }
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
    
    if (this.mixer) {
      this.mixer.update(delta);
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
