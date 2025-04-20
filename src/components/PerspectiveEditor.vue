<template>
  <div class="perspective-editor-container">
    <div class="canvas-container" ref="canvasContainer">
      <canvas ref="backgroundCanvas" class="background-canvas"></canvas>
      <canvas ref="foregroundCanvas" class="foreground-canvas"></canvas>
      <div v-if="showControlPoints" class="control-points">
        <div
          v-for="(point, index) in controlPoints"
          :key="index"
          class="control-point"
          :class="{ active: activePointIndex === index }"
          :style="{
            left: `${point.x}px`,
            top: `${point.y}px`,
          }"
          @mousedown="startDragPoint($event, index)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'
import PerspectiveTransform from 'perspectivets'

const imageStore = useImageStore()

// DOM引用
const canvasContainer = ref<HTMLDivElement | null>(null)
const backgroundCanvas = ref<HTMLCanvasElement | null>(null)
const foregroundCanvas = ref<HTMLCanvasElement | null>(null)

// 画布上下文
const bgCtx = ref<CanvasRenderingContext2D | null>(null)
const fgCtx = ref<CanvasRenderingContext2D | null>(null)

// 图像对象
const backgroundImg = ref<HTMLImageElement | null>(null)
const foregroundImg = ref<HTMLImageElement | null>(null)
// 离屏画布，用于缓存前景图，避免重复创建
const offscreenCanvas = ref<HTMLCanvasElement | null>(null)

// 控制点
const controlPoints = ref<{ x: number; y: number }[]>([
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 },
])

const showControlPoints = ref(false)
const activePointIndex = ref(-1)
const isDragging = ref(false)
// 添加节流变量
const isRenderPending = ref(false)

// 初始化画布
onMounted(() => {
  if (backgroundCanvas.value && foregroundCanvas.value && canvasContainer.value) {
    // 获取画布上下文
    bgCtx.value = backgroundCanvas.value.getContext('2d', { alpha: false })
    fgCtx.value = foregroundCanvas.value.getContext('2d', { alpha: true })

    if (bgCtx.value && fgCtx.value) {
      // 设置图像渲染质量
      bgCtx.value.imageSmoothingEnabled = true
      bgCtx.value.imageSmoothingQuality = 'high'
      fgCtx.value.imageSmoothingEnabled = true
      fgCtx.value.imageSmoothingQuality = 'high'
    }

    // 创建离屏画布
    offscreenCanvas.value = document.createElement('canvas')

    // 设置画布大小
    resizeCanvas()

    // 监听窗口大小变化
    window.addEventListener('resize', resizeCanvas)

    // 加载图像
    if (imageStore.backgroundImage) {
      loadBackgroundImage(imageStore.backgroundImage)
    }

    if (imageStore.foregroundImages.length > 0) {
      loadForegroundImage(imageStore.foregroundImages[0])
    }

    // 添加鼠标事件处理
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
})

// 调整画布大小
function resizeCanvas() {
  if (!canvasContainer.value || !backgroundCanvas.value || !foregroundCanvas.value) return

  // 如果有背景图，按照背景图的比例调整
  if (backgroundImg.value) {
    adjustCanvasToBackground(backgroundImg.value)
  } else {
    // 没有背景图时，使用默认尺寸
    const containerWidth = canvasContainer.value.clientWidth
    const containerHeight = Math.round(containerWidth * 0.75) // 默认宽高比4:3

    backgroundCanvas.value.width = containerWidth
    backgroundCanvas.value.height = containerHeight
    foregroundCanvas.value.width = containerWidth
    foregroundCanvas.value.height = containerHeight

    // 设置容器高度为默认高度
    canvasContainer.value.style.height = `${containerHeight}px`

    // 更新控制点位置
    updateControlPoints()
  }

  // 如果有已加载的图像，重新绘制
  renderCanvas()
}

// 监听背景图变化
watch(
  () => imageStore.backgroundImage,
  newImage => {
    if (newImage) {
      loadBackgroundImage(newImage)
    }
  },
  { immediate: true }
)

// 监听前景图变化
watch(
  () => imageStore.foregroundImages,
  newImages => {
    if (newImages && newImages.length > 0) {
      loadForegroundImage(newImages[0])
    }
  },
  { immediate: true }
)

// 加载背景图
function loadBackgroundImage(image: File) {
  const url = URL.createObjectURL(image)
  const img = new Image()

  img.onload = () => {
    backgroundImg.value = img

    // 调整画布大小以适应背景图
    adjustCanvasToBackground(img)

    // 渲染画布
    renderCanvas()
    URL.revokeObjectURL(url)
  }

  img.onerror = () => {
    console.error('背景图片加载失败')
    URL.revokeObjectURL(url)
  }

  img.src = url
}

// 调整画布大小以适应背景图
function adjustCanvasToBackground(img: HTMLImageElement) {
  if (!canvasContainer.value || !backgroundCanvas.value || !foregroundCanvas.value) return

  // 获取容器宽度
  const containerWidth = canvasContainer.value.clientWidth

  // 计算背景图的高度，保持宽度与容器一致
  const aspectRatio = img.height / img.width
  const containerHeight = Math.round(containerWidth * aspectRatio)

  // 设置画布尺寸
  backgroundCanvas.value.width = containerWidth
  backgroundCanvas.value.height = containerHeight
  foregroundCanvas.value.width = containerWidth
  foregroundCanvas.value.height = containerHeight

  // 设置容器高度与图片高度一致
  canvasContainer.value.style.height = `${containerHeight}px`

  console.log(`调整画布尺寸：${containerWidth}x${containerHeight}`)

  // 更新控制点位置
  updateControlPoints()
}

// 更新控制点位置
function updateControlPoints() {
  if (!backgroundCanvas.value) return

  const canvasWidth = backgroundCanvas.value.width
  const canvasHeight = backgroundCanvas.value.height

  if (foregroundImg.value) {
    // 如果有前景图，根据前景图计算控制点位置
    const scale = Math.min(
      (canvasWidth * 0.5) / foregroundImg.value.width,
      (canvasHeight * 0.5) / foregroundImg.value.height
    )

    const width = foregroundImg.value.width * scale
    const height = foregroundImg.value.height * scale

    // 居中放置
    const offsetX = (canvasWidth - width) / 2
    const offsetY = (canvasHeight - height) / 2

    // 更新控制点
    controlPoints.value = [
      { x: offsetX, y: offsetY },
      { x: offsetX + width, y: offsetY },
      { x: offsetX + width, y: offsetY + height },
      { x: offsetX, y: offsetY + height },
    ]
  } else {
    // 如果没有前景图，设置默认控制点
    const width = canvasWidth * 0.5
    const height = width * 0.75

    // 居中放置
    const offsetX = (canvasWidth - width) / 2
    const offsetY = (canvasHeight - height) / 2

    // 更新控制点
    controlPoints.value = [
      { x: offsetX, y: offsetY },
      { x: offsetX + width, y: offsetY },
      { x: offsetX + width, y: offsetY + height },
      { x: offsetX, y: offsetY + height },
    ]
  }
}

// 加载前景图
function loadForegroundImage(image: File) {
  const url = URL.createObjectURL(image)
  const img = new Image()

  img.onload = () => {
    foregroundImg.value = img

    // 显示控制点
    showControlPoints.value = true

    // 准备离屏画布
    prepareOffscreenCanvas(img)

    // 更新控制点位置
    updateControlPoints()

    // 渲染画布
    renderCanvas()

    URL.revokeObjectURL(url)
  }

  img.onerror = () => {
    console.error('前景图片加载失败')
    URL.revokeObjectURL(url)
  }

  img.src = url
}

// 准备离屏画布，将前景图预先绘制到离屏画布上
function prepareOffscreenCanvas(img: HTMLImageElement) {
  if (!offscreenCanvas.value) return

  // 设置离屏画布大小为原始图像大小，保持高分辨率
  offscreenCanvas.value.width = img.width
  offscreenCanvas.value.height = img.height

  // 获取上下文
  const offscreenCtx = offscreenCanvas.value.getContext('2d', { alpha: true })
  if (!offscreenCtx) return

  // 设置图像平滑选项，提高锐度
  offscreenCtx.imageSmoothingEnabled = true
  offscreenCtx.imageSmoothingQuality = 'high'

  // 清空画布
  offscreenCtx.clearRect(0, 0, offscreenCanvas.value.width, offscreenCanvas.value.height)

  // 绘制前景图到离屏画布
  offscreenCtx.drawImage(img, 0, 0)
}

// 渲染画布，使用requestAnimationFrame优化
function renderCanvas() {
  if (isRenderPending.value) return

  isRenderPending.value = true
  requestAnimationFrame(() => {
    if (!bgCtx.value || !fgCtx.value) {
      isRenderPending.value = false
      return
    }

    // 清空前景画布
    fgCtx.value.clearRect(0, 0, fgCtx.value.canvas.width, fgCtx.value.canvas.height)

    // 绘制背景图（只在必要时重绘背景）
    if (backgroundImg.value) {
      drawImageFitCanvas(bgCtx.value, backgroundImg.value)
    }

    // 绘制前景图（应用透视变换）
    if (foregroundImg.value && offscreenCanvas.value) {
      applyPerspectiveTransform()
    }

    isRenderPending.value = false
  })
}

// 适配画布绘制图像
function drawImageFitCanvas(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const canvas = ctx.canvas
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // 清空画布
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // 设置图像平滑选项，提高渲染质量
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 绘制图像 - 确保图像宽度与画布宽度一致
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
}

// 应用透视变换
function applyPerspectiveTransform() {
  if (!fgCtx.value || !offscreenCanvas.value) return

  // 清空前景画布
  fgCtx.value.clearRect(0, 0, fgCtx.value.canvas.width, fgCtx.value.canvas.height)

  // 设置图像渲染质量
  fgCtx.value.imageSmoothingEnabled = true
  fgCtx.value.imageSmoothingQuality = 'high'

  try {
    // 创建透视变换实例
    // 注意 PerspectiveTransform 接受 HTMLImageElement 或 HTMLCanvasElement
    const perspective = new PerspectiveTransform(
      fgCtx.value,
      offscreenCanvas.value as unknown as HTMLImageElement
    )

    // 应用透视变换
    perspective.draw({
      topLeftX: controlPoints.value[0].x,
      topLeftY: controlPoints.value[0].y,
      topRightX: controlPoints.value[1].x,
      topRightY: controlPoints.value[1].y,
      bottomRightX: controlPoints.value[2].x,
      bottomRightY: controlPoints.value[2].y,
      bottomLeftX: controlPoints.value[3].x,
      bottomLeftY: controlPoints.value[3].y,
    })
  } catch (err) {
    console.error('透视变换出错:', err)
  }
}

// 控制点拖拽开始
function startDragPoint(event: MouseEvent, index: number) {
  activePointIndex.value = index
  isDragging.value = true
  event.preventDefault()
}

// 防抖函数，优化鼠标移动时的频繁渲染
let animationFrameId = 0
function debounce(callback: Function, delay = 5) {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  animationFrameId = window.requestAnimationFrame(() => {
    callback()
  })
}

// 鼠标移动处理 - 使用防抖优化
function onMouseMove(event: MouseEvent) {
  if (!isDragging.value || activePointIndex.value === -1 || !canvasContainer.value) return

  debounce(() => {
    // 获取画布容器的位置
    const rect = canvasContainer.value!.getBoundingClientRect()

    // 计算鼠标相对于画布的位置
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // 更新控制点位置
    controlPoints.value[activePointIndex.value] = { x, y }

    // 只重绘前景图，不重绘背景图
    renderForegroundOnly()
  })
}

// 只重绘前景图（透视变换）
function renderForegroundOnly() {
  if (!fgCtx.value || !offscreenCanvas.value) return

  if (isRenderPending.value) return

  isRenderPending.value = true
  requestAnimationFrame(() => {
    // 应用透视变换
    applyPerspectiveTransform()
    isRenderPending.value = false
  })
}

// 鼠标释放处理
function onMouseUp() {
  isDragging.value = false
  activePointIndex.value = -1
}

// 获取画布数据（合成后的图像）
function getCanvasData(): string | null {
  if (!backgroundCanvas.value || !foregroundCanvas.value) return null

  // 创建临时画布用于合成
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = backgroundCanvas.value.width
  tempCanvas.height = backgroundCanvas.value.height
  const tempCtx = tempCanvas.getContext('2d', { alpha: true })

  if (!tempCtx) return null

  // 设置图像渲染质量
  tempCtx.imageSmoothingEnabled = true
  tempCtx.imageSmoothingQuality = 'high'

  // 绘制背景
  tempCtx.drawImage(backgroundCanvas.value, 0, 0)

  // 绘制变换后的前景
  tempCtx.drawImage(foregroundCanvas.value, 0, 0)

  // 返回合成后的图像数据，使用更高的质量设置
  return tempCanvas.toDataURL('image/png', 1.0)
}

// 使用指定的前景图进行合成
async function composeWithForeground(foregroundFile: File): Promise<string | null> {
  // 保存当前控制点位置
  const currentControlPoints = [...controlPoints.value]

  // 加载新的前景图
  return new Promise(resolve => {
    const url = URL.createObjectURL(foregroundFile)
    const img = new Image()

    img.onload = () => {
      if (!bgCtx.value || !fgCtx.value) {
        resolve(null)
        return
      }

      // 临时替换前景图
      const oldForegroundImg = foregroundImg.value
      foregroundImg.value = img

      // 创建临时离屏画布
      const tempOffscreenCanvas = document.createElement('canvas')
      tempOffscreenCanvas.width = img.width
      tempOffscreenCanvas.height = img.height
      const tempOffscreenCtx = tempOffscreenCanvas.getContext('2d')

      if (tempOffscreenCtx) {
        // 绘制前景图到临时离屏画布
        tempOffscreenCtx.drawImage(img, 0, 0)

        // 临时保存当前离屏画布
        const originalOffscreenCanvas = offscreenCanvas.value

        // 使用临时离屏画布
        offscreenCanvas.value = tempOffscreenCanvas

        // 使用保存的控制点位置
        controlPoints.value = currentControlPoints

        // 重新渲染
        renderCanvas()

        // 获取合成结果
        const result = getCanvasData()

        // 恢复原来的前景图和离屏画布
        foregroundImg.value = oldForegroundImg
        offscreenCanvas.value = originalOffscreenCanvas
        renderCanvas()

        URL.revokeObjectURL(url)
        resolve(result)
      } else {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    }

    img.onerror = () => {
      console.error('前景图片加载失败')
      URL.revokeObjectURL(url)
      resolve(null)
    }

    img.src = url
  })
}

// 组件卸载时清理事件监听
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})

// 暴露组件方法，供父组件调用
defineExpose({
  getCanvasData,
  composeWithForeground,
})
</script>

<style scoped>
.perspective-editor-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  padding: 20px;
}

.canvas-container {
  width: 800px;
  position: relative;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.background-canvas,
.foreground-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.foreground-canvas {
  pointer-events: none;
}

.control-points {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.control-point {
  position: absolute;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  margin-top: -8px;
  background-color: rgba(33, 150, 243, 0.8);
  border: 2px solid white;
  border-radius: 50%;
  cursor: move;
  pointer-events: auto;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

.control-point.active {
  background-color: rgba(255, 87, 34, 0.8);
  transform: scale(1.2);
}
</style>
