/**
 * 基础渲染示例
 * 展示如何在小程序中使用 three.js 进行基础渲染
 */

import * as THREE from 'three';
import { adaptForMiniProgram, waitForCanvas } from 'threejs-miniprogram-adapter';

Page({
  data: {
    isReady: false
  },

  async onReady() {
    try {
      // 1. 获取 canvas
      const canvas = await waitForCanvas('#webgl', this);

      // 2. 适配 three.js
      const adapter = adaptForMiniProgram(canvas, {
        debug: true
      });
      const { canvas: adaptedCanvas, environment } = adapter;

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
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(environment.supportWebGL2 ? 2 : 1);
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
        this._animationFrame = canvas.requestAnimationFrame(animate);

        // 旋转立方体
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

        renderer.render(scene, camera);
      };
      this._animate = animate;

      animate();

      this.setData({ isReady: true });

      // 保存引用以便清理
      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;
      this._adapter = adapter;
      this._nativeCanvas = canvas;

    } catch (error) {
      console.error('初始化失败:', error);
      wx.showModal({
        title: '错误',
        content: 'WebGL 初始化失败: ' + error.message,
        showCancel: false
      });
    }
  },

  onHide() {
    // 后台暂停渲染，避免无效绘制
    if (this._animationFrame && this._nativeCanvas?.cancelAnimationFrame) {
      this._nativeCanvas.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  },

  onShow() {
    // iOS 切后台可能销毁 WebGL 上下文，回前台时尝试恢复
    if (!this._adapter) return;
    this._adapter.canvas.recoverContext();
    if (!this._animationFrame && this._animate) {
      this._animate();
    }
  },

  onUnload() {
    if (this._animationFrame && this._nativeCanvas?.cancelAnimationFrame) {
      this._nativeCanvas.cancelAnimationFrame(this._animationFrame);
    }
    // 清理资源
    if (this._renderer) {
      this._renderer.dispose();
    }
    this._adapter?.dispose();
  }
});
