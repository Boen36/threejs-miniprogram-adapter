/**
 * GLTF 加载器示例
 * 展示如何在小程序中加载和显示 GLTF 模型
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  LoaderPlugins,
  adaptForMiniProgram,
  waitForCanvas
} from 'threejs-miniprogram-adapter';
import {
  configureRendererSize,
  disposeObject3D,
  disposeRenderingPage,
  pauseRendering,
  resumeRendering
} from '../shared/runtime.js';

Page({
  data: {
    isReady: false,
    loadingProgress: 0,
    modelUrl: '' // 可以从 data 传入或使用默认模型
  },

  async onReady() {
    this._disposed = false;
    this._loadToken = 0;
    try {
      // 获取 canvas
      const canvas = await waitForCanvas('#webgl', this);

      // 适配
      const adapter = adaptForMiniProgram(canvas);
      const { canvas: adaptedCanvas } = adapter;
      this._adapter = adapter;
      this._nativeCanvas = canvas;

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
      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;
      configureRendererSize(adapter, renderer, camera, canvas);
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
        if (this._disposed) return;
        this._animationFrame = canvas.requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      this._animate = animate;

      animate();

    } catch (error) {
      disposeRenderingPage(this);
      console.error('初始化失败:', error);
      wx.showToast({ title: '加载失败: ' + error.message, icon: 'none' });
    }
  },

  loadModel(scene, url, camera) {
    const loader = new GLTFLoader();
    const loadToken = ++this._loadToken;
    this.setData({ isReady: false, loadingProgress: 0 });

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        if (this._disposed || loadToken !== this._loadToken) {
          disposeObject3D(model);
          return;
        }

        if (this._model) {
          scene.remove(this._model);
          disposeObject3D(this._model);
        }
        this._model = model;

        // 计算包围盒以居中模型
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // 调整相机位置
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = 45;
        const cameraZ = Math.abs(maxDim / 2 / Math.tan((fov * Math.PI / 180) / 2));
        // 居中模型
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;
        camera.position.set(0, 0, Math.max(cameraZ * 2, 1));
        camera.lookAt(0, 0, 0);

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
        if (loadToken !== this._loadToken || this._disposed) return;
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total) * 100;
          this.setData({ loadingProgress: Math.round(percent) });
        }
      },
      (error) => {
        if (loadToken !== this._loadToken || this._disposed) return;
        console.error('模型加载失败:', error);
        wx.showToast({ title: '模型加载失败', icon: 'none' });
      }
    );
  },

  // 从本地文件加载（单个 GLB 可自包含 buffer 与纹理）
  loadFromLocal() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['glb'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        this.setData({ modelUrl: tempFilePath });
        if (this._scene && this._camera) {
          this.loadModel(this._scene, tempFilePath, this._camera);
        }
      }
    });
  },

  // 显式 helper 可把图片创建固定到当前 adapter，适合并存页面或多 Canvas。
  loadTextureFromLocal() {
    wx.chooseMessageFile({
      count: 1,
      type: 'image',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].path;
        LoaderPlugins.loadTextureFromFile(
          THREE,
          tempFilePath,
          (texture) => {
            if (this._disposed || !this._scene) {
              texture.dispose();
              return;
            }

            if (this._texturePreview) {
              this._scene.remove(this._texturePreview);
              disposeObject3D(this._texturePreview);
            }

            const preview = new THREE.Mesh(
              new THREE.PlaneGeometry(1.2, 1.2),
              new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
            );
            preview.position.set(1.5, 0, 0);
            this._texturePreview = preview;
            this._scene.add(preview);
          },
          (error) => {
            if (this._disposed) return;
            console.error('纹理加载失败:', error);
            wx.showToast({ title: '纹理加载失败', icon: 'none' });
          },
          { document: this._adapter.document }
        );
      }
    });
  },

  onUnload() {
    this._loadToken++;
    this._model = null;
    this._texturePreview = null;
    disposeRenderingPage(this);
  },

  onHide() {
    pauseRendering(this);
  },

  onShow() {
    resumeRendering(this);
  }
});
