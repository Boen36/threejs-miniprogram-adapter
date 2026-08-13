/**
 * DRACO 加载器示例
 * 展示如何用 MiniProgramDRACOLoader 加载 KHR_draco_mesh_compression 压缩的 GLB
 *
 * decoder 资源（draco_wasm_wrapper.js + draco_decoder.wasm）已随代码包放在
 * libs/draco/ 下；模型在 assets/cube-draco.glb（由 gltf-pipeline 压缩生成）。
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MiniProgramDRACOLoader, adaptForMiniProgram, waitForCanvas } from 'threejs-miniprogram-adapter';

// 代码包内的 decoder 工厂：CommonJS require
const DracoDecoderModule = require('../libs/draco/draco_wasm_wrapper.js');

Page({
  data: {
    isReady: false,
    status: '初始化中…'
  },

  async onReady() {
    try {
      const canvas = await waitForCanvas('#webgl', this);
      const adapter = adaptForMiniProgram(canvas);
      this._adapter = adapter;
      this._nativeCanvas = canvas;

      // 场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222222);

      const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000);
      camera.position.set(0.8, 0.8, 2.5);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        canvas: adapter.canvas,
        antialias: true
      });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(wx.getSystemInfoSync().pixelRatio);

      // 光照
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(2, 4, 3);
      scene.add(directionalLight);

      // DRACO decoder：WASM 二进制从代码包读取
      this.setData({ status: '加载 decoder…' });
      const wasmBinary = wx.getFileSystemManager().readFileSync('libs/draco/draco_decoder.wasm');
      const dracoLoader = new MiniProgramDRACOLoader()
        .setDecoderModule(DracoDecoderModule)
        .setDecoderBinary(wasmBinary);

      // 模型：代码包内的 draco 压缩 GLB
      this.setData({ status: '解码模型…' });
      const glbBinary = wx.getFileSystemManager().readFileSync('assets/cube-draco.glb');

      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);
      const gltf = await gltfLoader.parseAsync(glbBinary, '');
      scene.add(gltf.scene);

      this.setData({ isReady: true, status: '' });

      // 动画循环
      const animate = () => {
        this._animationFrame = canvas.requestAnimationFrame(animate);
        gltf.scene.rotation.y += 0.01;
        renderer.render(scene, camera);
      };
      this._animate = animate;
      animate();

      this._renderer = renderer;
      this._dracoLoader = dracoLoader;
    } catch (error) {
      console.error('初始化失败:', error);
      wx.showToast({ title: '加载失败: ' + error.message, icon: 'none' });
    }
  },

  onUnload() {
    if (this._animationFrame && this._nativeCanvas?.cancelAnimationFrame) {
      this._nativeCanvas.cancelAnimationFrame(this._animationFrame);
    }
    if (this._renderer) {
      this._renderer.dispose();
    }
    this._dracoLoader?.dispose();
    this._adapter?.dispose();
  },

  onHide() {
    if (this._animationFrame && this._nativeCanvas?.cancelAnimationFrame) {
      this._nativeCanvas.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  },

  onShow() {
    if (!this._adapter) return;
    this._adapter.canvas.recoverContext();
    if (!this._animationFrame && this._animate) {
      this._animate();
    }
  }
});
