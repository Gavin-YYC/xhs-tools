<template>
  <div class="three-container" ref="threeContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, defineProps, defineEmits, defineExpose, shallowRef } from 'vue'
import * as THREE from 'three'
import {
  createScene,
  createOrthographicCamera,
  createRenderer,
  adjustCameraViewport,
  screenToNDC,
  createHighQualityTexture,
  disposeThreeObjects,
} from '@/utils/threeUtils'
import { scaleImageToCanvas } from '@/utils/imageUtils'

// 属性定义
const props = defineProps<{
  canvasWidth: number
  canvasHeight: number
  backgroundImage: HTMLImageElement | null
  foregroundImage: HTMLImageElement | null
  controlPoints: { x: number; y: number }[]
}>()

// 事件定义
const emit = defineEmits<{
  (e: 'rendered'): void
}>()

// DOM引用
const threeContainer = ref<HTMLDivElement | null>(null)

// Three.js对象 - 使用shallowRef避免Vue深度响应式处理
const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.OrthographicCamera | null>(null)
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const bgMesh = shallowRef<THREE.Mesh | null>(null)
const fgMesh = shallowRef<THREE.Mesh | null>(null)
const raycaster = shallowRef<THREE.Raycaster | null>(null)

// 动画帧请求ID
let animationFrameId: number | null = null

// 初始化Three.js
onMounted(() => {
  if (!threeContainer.value) return

  // 初始化Three.js场景
  initThreeJS()

  // 创建射线检测器用于3D交互
  raycaster.value = new THREE.Raycaster()

  // 开始渲染循环
  startRenderLoop()
})

// 初始化Three.js场景
function initThreeJS() {
  try {
    // 创建场景、相机和渲染器
    scene.value = createScene()
    camera.value = createOrthographicCamera()
    renderer.value = createRenderer()

    // 添加渲染器DOM到容器
    if (threeContainer.value && renderer.value) {
      threeContainer.value.appendChild(renderer.value.domElement)

      // 确保渲染器的canvas样式使用绝对尺寸，不受浏览器缩放影响
      renderer.value.domElement.style.width = '100%'
      renderer.value.domElement.style.height = '100%'

      // 设置渲染器大小
      updateRendererSize()
    }
  } catch (error) {
    console.error('Error initializing Three.js:', error)
  }
}

// 监听画布尺寸变化
watch(
  () => [props.canvasWidth, props.canvasHeight],
  () => {
    updateRendererSize()
  }
)

// 更新渲染器尺寸
function updateRendererSize() {
  if (!renderer.value || !camera.value) return

  try {
    // 设置渲染器大小
    renderer.value.setSize(props.canvasWidth, props.canvasHeight, false)

    // 调整相机视口
    adjustCameraViewport(camera.value, props.canvasWidth, props.canvasHeight)

    // 重新渲染
    render()
  } catch (error) {
    console.error('Error updating renderer size:', error)
  }
}

// 监听背景图变化
watch(
  () => props.backgroundImage,
  newImage => {
    if (newImage) {
      createBackgroundMesh(newImage)
    }
  }
)

// 监听前景图变化
watch(
  () => props.foregroundImage,
  newImage => {
    if (newImage) {
      createForegroundMesh(newImage)
    }
  }
)

// 监听控制点变化
watch(
  () => props.controlPoints,
  () => {
    updatePerspective()
  },
  { deep: true }
)

// 创建背景网格
function createBackgroundMesh(img: HTMLImageElement) {
  if (!scene.value || !renderer.value) return

  try {
    // 如果已有背景网格，先移除
    if (bgMesh.value) {
      disposeThreeObjects(scene.value, bgMesh.value)
      bgMesh.value = null
    }

    // 为了保证清晰度，使用2倍于显示尺寸的分辨率
    const scaleFactor = 2
    const scaledWidth = props.canvasWidth * scaleFactor
    const scaledHeight = Math.round(scaledWidth * (img.height / img.width))

    // 创建缩放后的图像画布
    const tempCanvas = scaleImageToCanvas(img, scaledWidth, scaledHeight, 'high')

    // 创建纹理
    const texture = createHighQualityTexture(tempCanvas, renderer.value)

    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      depthTest: false,
    })

    // 计算合适的平面尺寸
    const aspectRatio = props.canvasWidth / props.canvasHeight
    let planeWidth, planeHeight

    if (aspectRatio >= 1) {
      // 宽屏
      planeWidth = 2 // 宽度为2个单位，刚好填满相机宽度
      planeHeight = 2 / aspectRatio // 高度需要按比例缩放
    } else {
      // 高屏
      planeWidth = 2 * aspectRatio // 宽度需要按比例缩放
      planeHeight = 2 // 高度为2个单位，刚好填满相机高度
    }

    // 创建平面几何体
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight)

    // 创建网格
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = -2 // 放在场景最后面

    // 设置网格
    bgMesh.value = mesh

    // 添加到场景
    scene.value.add(mesh)

    // 渲染场景
    render()
  } catch (error) {
    console.error('Error creating background mesh:', error)
  }
}

// 创建前景网格
function createForegroundMesh(img: HTMLImageElement) {
  if (!scene.value || !renderer.value) return

  try {
    // 如果已有前景网格，先移除
    if (fgMesh.value) {
      disposeThreeObjects(scene.value, fgMesh.value)
      fgMesh.value = null
    }

    // 使用高分辨率提高清晰度
    const scaleFactor = 2
    const scaledWidth = props.canvasWidth * 0.8 * scaleFactor
    const scaledHeight = Math.round(scaledWidth * (img.height / img.width))

    // 创建缩放后的图像画布
    const tempCanvas = scaleImageToCanvas(img, scaledWidth, scaledHeight, 'high')

    // 创建纹理
    const texture = createHighQualityTexture(tempCanvas, renderer.value)

    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    })

    // 前景图尺寸计算
    const imgAspect = scaledHeight / scaledWidth
    const canvasAspect = props.canvasHeight / props.canvasWidth
    const scaleFactor2 = 0.8 // 占据视图的80%

    // 计算几何体尺寸，根据屏幕方向不同采用不同策略
    let meshWidth, meshHeight

    if (canvasAspect >= 1) {
      // 高屏
      meshHeight = scaleFactor2 * 2
      meshWidth = (meshHeight / imgAspect) * canvasAspect
    } else {
      // 宽屏
      meshWidth = scaleFactor2 * 2
      meshHeight = (meshWidth * imgAspect) / canvasAspect
    }

    // 创建几何体
    const geometry = new THREE.PlaneGeometry(meshWidth, meshHeight, 1, 1)

    // 创建网格
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = -1 // 放在背景图前面

    // 设置网格
    fgMesh.value = mesh

    // 添加到场景
    scene.value.add(mesh)

    // 渲染场景
    render()
  } catch (error) {
    console.error('Error creating foreground mesh:', error)
  }
}

// 更新透视变形
function updatePerspective() {
  if (!fgMesh.value) return

  try {
    // 将屏幕坐标转换为归一化设备坐标 (NDC)
    const tl = screenToNDC(
      props.controlPoints[0].x,
      props.controlPoints[0].y,
      props.canvasWidth,
      props.canvasHeight
    )
    const tr = screenToNDC(
      props.controlPoints[1].x,
      props.controlPoints[1].y,
      props.canvasWidth,
      props.canvasHeight
    )
    const br = screenToNDC(
      props.controlPoints[2].x,
      props.controlPoints[2].y,
      props.canvasWidth,
      props.canvasHeight
    )
    const bl = screenToNDC(
      props.controlPoints[3].x,
      props.controlPoints[3].y,
      props.canvasWidth,
      props.canvasHeight
    )

    // 获取几何体顶点
    const geometry = fgMesh.value.geometry as THREE.PlaneGeometry
    const positions = geometry.attributes.position as THREE.BufferAttribute

    // 确定哪个顶点对应哪个角 (根据THREE.js的PlaneGeometry创建规则)
    const cornerIndices = [0, 1, 3, 2] // 左上, 右上, 右下, 左下

    // 更新四个角的位置
    positions.setXY(cornerIndices[0], tl.x, tl.y) // 左上
    positions.setXY(cornerIndices[1], tr.x, tr.y) // 右上
    positions.setXY(cornerIndices[2], br.x, br.y) // 右下
    positions.setXY(cornerIndices[3], bl.x, bl.y) // 左下

    // 标记几何体需要更新
    positions.needsUpdate = true
    geometry.computeVertexNormals()

    // 渲染场景
    render()
  } catch (error) {
    console.error('Error updating perspective:', error)
  }
}

// 开始渲染循环
function startRenderLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    if (renderer.value && scene.value && camera.value) {
      render()
    }
  }

  animate()
}

// 渲染场景
function render() {
  try {
    if (!scene.value || !camera.value || !renderer.value) return
    renderer.value.render(scene.value, camera.value)
    emit('rendered')
  } catch (error) {
    console.error('Error rendering scene:', error)
  }
}

// 获取画布数据（合成后的图像）
function getCanvasData(): string | null {
  if (!renderer.value) return null

  try {
    // 临时提高渲染器像素比以获得更高质量的输出
    const originalPixelRatio = renderer.value.getPixelRatio()
    const exportPixelRatio = Math.max(window.devicePixelRatio, 2)
    renderer.value.setPixelRatio(exportPixelRatio)

    // 确保场景更新
    render()

    // 获取渲染器的画布
    const canvas = renderer.value.domElement

    // 返回合成后的图像数据，使用最高质量设置
    const imageData = canvas.toDataURL('image/png', 1.0)

    // 恢复原始像素比
    renderer.value.setPixelRatio(originalPixelRatio)

    return imageData
  } catch (error) {
    console.error('Error getting canvas data:', error)
    return null
  }
}

// 射线检测对象交互
function checkRaycastIntersection(x: number, y: number): boolean {
  if (!scene.value || !camera.value || !raycaster.value || !fgMesh.value) return false

  // 转换为归一化设备坐标
  const ndcX = (x / props.canvasWidth) * 2 - 1
  const ndcY = -((y / props.canvasHeight) * 2 - 1)
  const mousePos = new THREE.Vector2(ndcX, ndcY)

  // 设置射线
  raycaster.value.setFromCamera(mousePos, camera.value)

  // 检测射线与前景网格的交点
  const intersects = raycaster.value.intersectObject(fgMesh.value)

  return intersects.length > 0
}

// 组件卸载时清理
function dispose() {
  // 停止渲染循环
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  // 清理Three.js资源
  if (scene.value) {
    if (bgMesh.value) {
      disposeThreeObjects(scene.value, bgMesh.value)
    }

    if (fgMesh.value) {
      disposeThreeObjects(scene.value, fgMesh.value)
    }
  }

  if (renderer.value) {
    renderer.value.dispose()
  }

  // 清理射线检测器
  raycaster.value = null
}

// 暴露组件方法
defineExpose({
  getCanvasData,
  checkRaycastIntersection,
  dispose,
})
</script>

<style scoped>
.three-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: move; /* 提示用户可以拖动 */
}
</style>
