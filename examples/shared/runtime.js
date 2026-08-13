/**
 * 四个示例共用的渲染尺寸与页面生命周期工具。
 * updateSize() 只返回建议值，因此由示例负责应用到 renderer/camera。
 */

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function configureRendererSize(adapter, renderer, camera, nativeCanvas) {
  const suggested = adapter?.updateSize?.() || {};
  const width = positiveNumber(
    suggested.width,
    positiveNumber(nativeCanvas?.width, positiveNumber(adapter?.canvas?.clientWidth, 1))
  );
  const height = positiveNumber(
    suggested.height,
    positiveNumber(nativeCanvas?.height, positiveNumber(adapter?.canvas?.clientHeight, 1))
  );
  const pixelRatio = positiveNumber(suggested.pixelRatio, 1);

  renderer?.setPixelRatio?.(pixelRatio);
  renderer?.setSize?.(width, height, false);
  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix?.();
  }

  return { width, height, pixelRatio };
}

function pauseRendering(page) {
  if (!page || page._animationFrame === null || page._animationFrame === undefined) {
    return false;
  }
  page._nativeCanvas?.cancelAnimationFrame?.(page._animationFrame);
  page._animationFrame = null;
  return true;
}

function resumeRendering(page) {
  if (!page?._adapter) return false;
  const recovered = page._adapter.canvas?.recoverContext?.();
  if (recovered === false) return false;

  if (page._renderer && page._camera) {
    configureRendererSize(page._adapter, page._renderer, page._camera, page._nativeCanvas);
  }
  if ((page._animationFrame === null || page._animationFrame === undefined) && page._animate) {
    page._animate();
  }
  return true;
}

function disposeObject3D(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  const collectTexture = (value) => {
    if (value?.isTexture && typeof value.dispose === 'function') textures.add(value);
  };
  const collectMaterial = (material) => {
    if (!material || materials.has(material)) return;
    materials.add(material);
    for (const value of Object.values(material)) collectTexture(value);
  };
  const visit = (object) => {
    if (object?.geometry?.dispose) geometries.add(object.geometry);
    collectTexture(object?.skeleton?.boneTexture);
    const objectMaterials = Array.isArray(object?.material) ? object.material : [object?.material];
    for (const material of objectMaterials) collectMaterial(material);
  };

  if (typeof root.traverse === 'function') root.traverse(visit);
  else visit(root);
  collectTexture(root.background);
  collectTexture(root.environment);

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose?.();
  for (const geometry of geometries) geometry.dispose();
}

function disposeRenderingPage(page) {
  if (!page) return;
  page._disposed = true;
  pauseRendering(page);
  disposeObject3D(page._scene);
  page._renderer?.dispose?.();
  page._adapter?.dispose?.();
  page._animate = null;
  page._renderer = null;
  page._scene = null;
  page._camera = null;
  page._adapter = null;
  page._nativeCanvas = null;
}

export {
  configureRendererSize,
  disposeObject3D,
  disposeRenderingPage,
  pauseRendering,
  resumeRendering
};
