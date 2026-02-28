/**
 * GLTF 加载器示例
 * 展示如何在小程序中加载和显示 GLTF 模型
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { adaptForMiniProgram, waitForCanvas, LoaderPlugins } from 'threejs-miniprogram';

Page({
  data: {
    isReady: false,
    loadingProgress: 0,
    modelUrl: '' // 可以从 data 传入或使用默认模型
  },

  async onReady() {
    try {
      // 获取 canvas
      const canvas = await waitForCanvas('#webgl', this);

      // 适配
      const { canvas: adaptedCanvas } = adaptForMiniProgram(canvas);

      // 增强所有 Loader（处理小程序路径）
      LoaderPlugins.enhanceAllLoaders(THREE);

      // 场景设置
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222222);

      // 相机
      const camera = new THREE.PerspectiveCamera(
        45,
        canvas.width / canvas.height,
        0.1,
        1000
      );
      camera.position.set(0, 2, 5);

      // 渲染器
      const renderer = new THREE.WebGLRenderer({
        canvas: adaptedCanvas,
        antialias: true
      });
      renderer.setSize(canvas.width, canvas.height);
      renderer.setPixelRatio(wx.getSystemInfoSync().pixelRatio);
      renderer.shadowMap.enabled = true;

      // 光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      // 加载模型
      const modelUrl = this.data.modelUrl || 'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf';

      this.loadModel(scene, modelUrl, camera);

      // 动画循环
      const animate = () => {
        canvas.requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };

      animate();

      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;

    } catch (error) {
      console.error('初始化失败:', error);
      wx.showToast({ title: '加载失败: ' + error.message, icon: 'none' });
    }
  },

  loadModel(scene, url, camera) {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // 计算包围盒以居中模型
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // 调整相机位置
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = 45;
        const cameraZ = Math.abs(maxDim / 2 / Math.tan((fov * Math.PI / 180) / 2));
        camera.position.z = cameraZ * 2;
        camera.position.y = center.y;
        camera.lookAt(center);

        // 居中模型
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        // 启用阴影
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        scene.add(model);

        this.setData({ isReady: true });

        wx.showToast({ title: '模型加载完成', icon: 'success' });
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        this.setData({ loadingProgress: Math.round(percent) });
      },
      (error) => {
        console.error('模型加载失败:', error);
        wx.showToast({ title: '模型加载失败', icon: 'none' });
      }
    );
  },

  // 从本地文件加载
  loadFromLocal() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['gltf', 'glb'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        this.setData({ modelUrl: tempFilePath });
        this.onReady(); // 重新加载
      }
    });
  },

  onUnload() {
    if (this._renderer) {
      this._renderer.dispose();
    }
  }
});
