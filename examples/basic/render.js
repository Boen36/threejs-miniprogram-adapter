/**
 * 基础渲染示例
 * 展示如何在小程序中使用 three.js 进行基础渲染
 */

import * as THREE from 'three';
import { adaptForMiniProgram, waitForCanvas } from 'threejs-miniprogram-adapter';
import {
  configureRendererSize,
  disposeRenderingPage,
  pauseRendering,
  resumeRendering
} from '../shared/runtime.js';

Page({
  data: {
    isReady: false
  },

  async onReady() {
    this._disposed = false;
    try {
      // 1. 获取 canvas
      const canvas = await waitForCanvas('#webgl', this);

      // 2. 适配 three.js
      const adapter = adaptForMiniProgram(canvas, {
        debug: true
      });
      const { canvas: adaptedCanvas, environment } = adapter;
      this._adapter = adapter;
      this._nativeCanvas = canvas;

      console.log('环境信息:', environment);

      // 3. 创建场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB); // 天蓝色背景

      // 4. 创建相机
      const camera = new THREE.PerspectiveCamera(
        75,
        canvas.width / canvas.height,
        0.1,
        1000
      );
      camera.position.z = 5;

      // 5. 创建渲染器
      const renderer = new THREE.WebGLRenderer({
        canvas: adaptedCanvas,
        antialias: true,
        alpha: true
      });
      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;
      configureRendererSize(adapter, renderer, camera, canvas);
      console.log('WebGL 报告:', adapter.inspectWebGL());

      // 6. 创建立方体
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshStandardMaterial({
        color: 0x4CAF50,
        roughness: 0.3,
        metalness: 0.5
      });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);

      // 7. 添加光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // 8. 动画循环
      const animate = () => {
        if (this._disposed) return;
        this._animationFrame = canvas.requestAnimationFrame(animate);

        // 旋转立方体
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

        renderer.render(scene, camera);
      };
      this._animate = animate;

      animate();

      this.setData({ isReady: true });

    } catch (error) {
      disposeRenderingPage(this);
      console.error('初始化失败:', error);
      wx.showModal({
        title: '错误',
        content: 'WebGL 初始化失败: ' + error.message,
        showCancel: false
      });
    }
  },

  onHide() {
    pauseRendering(this);
  },

  onShow() {
    resumeRendering(this);
  },

  onUnload() {
    disposeRenderingPage(this);
  }
});
