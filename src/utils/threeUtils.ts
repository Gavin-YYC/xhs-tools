import * as THREE from 'three'

// 创建场景
export function createScene(): THREE.Scene {
  return new THREE.Scene()
}

// 创建正交相机
export function createOrthographicCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
  camera.position.z = 1
  return camera
}

// 创建渲染器
export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true, // 确保可以从画布中提取图像数据
  })

  // 设置像素比，使用设备的像素比或至少为2以确保高清晰度
  const pixelRatio = Math.max(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  return renderer
}

// 调整相机视口
export function adjustCameraViewport(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number
): void {
  const aspectRatio = width / height

  if (aspectRatio >= 1) {
    // 宽屏
    camera.left = -1
    camera.right = 1
    camera.top = 1 / aspectRatio
    camera.bottom = -1 / aspectRatio
  } else {
    // 高屏
    camera.left = -aspectRatio
    camera.right = aspectRatio
    camera.top = 1
    camera.bottom = -1
  }

  camera.updateProjectionMatrix()
}

// 屏幕坐标转换为NDC坐标
export function screenToNDC(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  const aspectRatio = width / height
  let ndcX, ndcY

  // 根据屏幕宽高比进行不同的计算
  if (aspectRatio >= 1) {
    // 宽屏
    ndcX = (x / width) * 2 - 1
    ndcY = -((y / height) * 2 - 1) / aspectRatio
  } else {
    // 高屏
    ndcX = ((x / width) * 2 - 1) * aspectRatio
    ndcY = -((y / height) * 2 - 1)
  }

  return { x: ndcX, y: ndcY }
}

// 创建高质量纹理
export function createHighQualityTexture(
  canvas: HTMLCanvasElement,
  renderer?: THREE.WebGLRenderer
): THREE.Texture {
  const texture = new THREE.Texture(canvas)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace

  // 设置适当的纹理参数，保证高质量
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1
  texture.generateMipmaps = true

  return texture
}

// 清理Three.js资源
export function disposeThreeObjects(scene: THREE.Scene | null, mesh: THREE.Mesh | null): void {
  if (scene && mesh) {
    const material = mesh.material as THREE.MeshBasicMaterial
    const texture = material.map
    scene.remove(mesh)
    mesh.geometry.dispose()
    material.dispose()
    if (texture) texture.dispose()
  }
}
