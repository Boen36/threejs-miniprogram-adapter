/**
 * OrbitControls 示例
 * 展示如何在小程序中使用触摸控制相机
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { adaptForMiniProgram, waitForCanvas } from 'threejs-miniprogram-adapter';
import {
  configureRendererSize,
  disposeRenderingPage,
  pauseRendering,
  resumeRendering
} from '../shared/runtime.js';

Page({
  data: {
    isReady: false,
    fps: 0
  },

  async onReady() {
    this._disposed = false;
    try {
      // 获取 canvas
      const canvas = await waitForCanvas('#webgl', this);

      // 适配
      const adapter = adaptForMiniProgram(canvas, {
        bindTouchEvents: true,
        debug: false
      });
      const { canvas: adaptedCanvas } = adapter;
      this._adapter = adapter;
      this._nativeCanvas = canvas;

      // 场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      // 相机
      const camera = new THREE.PerspectiveCamera(
        60,
        canvas.width / canvas.height,
        0.1,
        1000
      );
      camera.position.set(0, 5, 10);
      camera.lookAt(0, 0, 0);

      // 渲染器
      const renderer = new THREE.WebGLRenderer({
        canvas: adaptedCanvas,
        antialias: true
      });
      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;
      configureRendererSize(adapter, renderer, camera, canvas);
      renderer.shadowMap.enabled = true;

      // 控制器 - 自动支持触摸事件
      const controls = new OrbitControls(camera, adaptedCanvas);
      this._controls = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 2;
      controls.maxDistance = 50;
      controls.maxPolarAngle = Math.PI / 2; // 防止移动到地平线以下

      // 地面
      const planeGeometry = new THREE.PlaneGeometry(50, 50);
      const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x16213e,
        roughness: 0.8
      });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      plane.receiveShadow = true;
      scene.add(plane);

      // 网格
      const gridHelper = new THREE.GridHelper(50, 50, 0x0f3460, 0x0f3460);
      scene.add(gridHelper);

      // 随机立方体
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
      for (let i = 0; i < 20; i++) {
        const boxMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);

        box.position.x = (Math.random() - 0.5) * 30;
        box.position.z = (Math.random() - 0.5) * 30;
        box.position.y = 0.5;

        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
      }

      // 光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      directionalLight.shadow.camera.near = 0.1;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -25;
      directionalLight.shadow.camera.right = 25;
      directionalLight.shadow.camera.top = 25;
      directionalLight.shadow.camera.bottom = -25;
      scene.add(directionalLight);

      // FPS 计算
      let lastTime = performance.now();
      let frameCount = 0;

      // 动画循环
      const animate = () => {
        if (this._disposed) return;
        this._animationFrame = canvas.requestAnimationFrame(animate);

        // 更新 FPS
        frameCount++;
        const currentTime = performance.now();
        if (currentTime - lastTime >= 1000) {
          this.setData({ fps: frameCount });
          frameCount = 0;
          lastTime = currentTime;
        }

        // 更新控制器
        controls.update();

        renderer.render(scene, camera);
      };
      this._animate = animate;

      animate();

      this.setData({ isReady: true });

    } catch (error) {
      this._controls?.dispose();
      disposeRenderingPage(this);
      console.error('初始化失败:', error);
      wx.showModal({
        title: '错误',
        content: error.message,
        showCancel: false
      });
    }
  },

  // 重置相机位置
  resetCamera() {
    if (this._controls) {
      this._controls.reset();
    }
  },

  onTouchStart(event) {
    this._adapter?.touchEventHandlers.touchstart(event);
  },

  onTouchMove(event) {
    this._adapter?.touchEventHandlers.touchmove(event);
  },

  onTouchEnd(event) {
    this._adapter?.touchEventHandlers.touchend(event);
  },

  onTouchCancel(event) {
    this._adapter?.touchEventHandlers.touchcancel(event);
  },

  onUnload() {
    this._controls?.dispose();
    this._controls = null;
    disposeRenderingPage(this);
  },

  onHide() {
    pauseRendering(this);
  },

  onShow() {
    resumeRendering(this);
  }
});
