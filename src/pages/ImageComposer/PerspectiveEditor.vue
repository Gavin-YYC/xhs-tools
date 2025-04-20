<template>
  <div class="perspective-editor-container">
    <div class="canvas-container" ref="canvasContainer">
      <!-- Three.js渲染组件 -->
      <ThreeRenderer
        ref="threeRenderer"
        :canvasWidth="canvasWidth"
        :canvasHeight="canvasHeight"
        :backgroundImage="backgroundImg"
        :foregroundImage="foregroundImg"
        :controlPoints="controlPoints"
        @rendered="onRendered"
      />

      <!-- 控制点组件 -->
      <ControlPoints
        v-if="showControlPoints"
        :controlPoints="controlPoints"
        :activePointIndex="activePointIndex"
        @dragPointStart="startDragPoint"
        @dragForegroundStart="startDragForeground"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useImageStore } from '@/stores/imageStore'
import { loadImage, calculateImageDimensions } from '@/utils/imageUtils'
import ThreeRenderer from '@/pages/ImageComposer/perspective/ThreeRenderer.vue'
import ControlPoints from '@/pages/ImageComposer/perspective/ControlPoints.vue'

const imageStore = useImageStore()

// DOM引用
const canvasContainer = ref<HTMLDivElement | null>(null)
const threeRenderer = ref<InstanceType<typeof ThreeRenderer> | null>(null)

// 图像对象
const backgroundImg = ref<HTMLImageElement | null>(null)
const foregroundImg = ref<HTMLImageElement | null>(null)

// 控制点
const controlPoints = ref<{ x: number; y: number }[]>([
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 },
])

// 拖拽状态
const showControlPoints = ref(false)
const activePointIndex = ref(-1)
const isDragging = ref(false)
const isDraggingForeground = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 画布尺寸
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// 防抖变量
let resizeTimeout: number | null = null
let canvasRect: DOMRect | null = null
let isMouseMovePending = false

// 初始化组件
onMounted(() => {
  if (canvasContainer.value) {
    // 确保容器有明确的宽度
    if (canvasContainer.value.style.width === '') {
      canvasContainer.value.style.width = '100%'
    }

    // 首次调整画布大小
    resizeCanvas()

    // 监听窗口大小变化
    window.addEventListener('resize', debouncedResize)

    // 监听浏览器缩放级别变化
    window.matchMedia('(resolution: 1dppx)').addListener(debouncedResize)

    // 添加鼠标和触摸事件处理
    document.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseup', onMouseUp, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onMouseUp, { passive: true })
    document.addEventListener('touchcancel', onMouseUp, { passive: true })
  }
})

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

// 窗口大小调整的防抖实现
function debouncedResize() {
  if (resizeTimeout) {
    window.clearTimeout(resizeTimeout)
  }

  // 立即调整大小
  resizeCanvas()
}

// 调整画布大小
function resizeCanvas() {
  if (!canvasContainer.value) return

  try {
    // 获取容器尺寸
    const containerRect = canvasContainer.value.getBoundingClientRect()
    const containerWidth = containerRect.width
    const containerClientWidth = canvasContainer.value.clientWidth

    // 检测浏览器缩放级别
    const zoomLevel = containerWidth / containerClientWidth || 1
    console.log(
      `容器实际宽度: ${containerWidth}px, 客户端宽度: ${containerClientWidth}px, 缩放级别: ${zoomLevel.toFixed(2)}`
    )

    // 使用不受缩放影响的clientWidth
    canvasWidth.value = containerClientWidth

    // 如果有背景图，按照背景图的比例计算画布高度
    if (backgroundImg.value) {
      const aspectRatio = backgroundImg.value.height / backgroundImg.value.width
      canvasHeight.value = Math.round(canvasWidth.value * aspectRatio)

      console.log(`背景图比例: ${aspectRatio.toFixed(4)}, 计算画布高度: ${canvasHeight.value}px`)
    } else {
      // 默认宽高比4:3
      canvasHeight.value = Math.round(canvasWidth.value * 0.75)
    }

    // 设置容器高度
    canvasContainer.value.style.height = `${canvasHeight.value}px`

    console.log(`画布尺寸设置为: ${canvasWidth.value}x${canvasHeight.value}px`)

    // 更新控制点位置
    updateControlPoints()

    // 重置缓存的矩形
    canvasRect = null
  } catch (error) {
    console.error('Error resizing canvas:', error)
  }
}

// 渲染完成回调
function onRendered() {
  // 可以添加渲染完成后的逻辑
}

// 加载背景图
async function loadBackgroundImage(image: File) {
  try {
    const img = await loadImage(image)

    // 打印原始图片尺寸，用于调试
    console.log(`加载背景图: 原始尺寸 ${img.width}x${img.height}, 比例: ${img.height / img.width}`)

    backgroundImg.value = img

    // 调整画布大小以适应背景图
    resizeCanvas()
  } catch (error) {
    console.error('背景图片加载失败', error)
  }
}

// 加载前景图
async function loadForegroundImage(image: File) {
  try {
    const img = await loadImage(image)
    foregroundImg.value = img

    // 显示控制点
    showControlPoints.value = true

    // 更新控制点位置
    updateControlPoints()
  } catch (error) {
    console.error('前景图片加载失败', error)
  }
}

// 更新控制点位置
function updateControlPoints() {
  if (!canvasContainer.value) return

  const width = canvasWidth.value
  const height = canvasHeight.value

  if (foregroundImg.value) {
    // 如果有前景图，根据前景图计算控制点位置
    const { width: imgWidth, height: imgHeight } = calculateImageDimensions(
      foregroundImg.value.width,
      foregroundImg.value.height,
      width,
      height,
      0.8
    )

    // 居中放置
    const offsetX = (width - imgWidth) / 2
    const offsetY = (height - imgHeight) / 2

    // 更新控制点 - 四个角落的位置
    controlPoints.value = [
      { x: offsetX, y: offsetY }, // 左上
      { x: offsetX + imgWidth, y: offsetY }, // 右上
      { x: offsetX + imgWidth, y: offsetY + imgHeight }, // 右下
      { x: offsetX, y: offsetY + imgHeight }, // 左下
    ]

    console.log('控制点位置更新:', JSON.stringify(controlPoints.value))
  } else {
    // 如果没有前景图，设置默认控制点
    const defaultWidth = width * 0.8
    const defaultHeight = defaultWidth * 0.75

    // 居中放置
    const offsetX = (width - defaultWidth) / 2
    const offsetY = (height - defaultHeight) / 2

    // 更新控制点
    controlPoints.value = [
      { x: offsetX, y: offsetY },
      { x: offsetX + defaultWidth, y: offsetY },
      { x: offsetX + defaultWidth, y: offsetY + defaultHeight },
      { x: offsetX, y: offsetY + defaultHeight },
    ]
  }
}

// 缓存画布矩形，避免频繁获取DOM信息
function getCanvasRect(): DOMRect {
  if (!canvasRect && canvasContainer.value) {
    canvasRect = canvasContainer.value.getBoundingClientRect()
  }
  return canvasRect || new DOMRect(0, 0, 0, 0)
}

// 控制点拖拽开始
function startDragPoint(index: number) {
  activePointIndex.value = index
  isDragging.value = true

  // 重置缓存的矩形以确保准确性
  canvasRect = null
}

// 开始拖拽前景图
function startDragForeground(event: MouseEvent | TouchEvent) {
  isDraggingForeground.value = true

  // 记录起始点
  if (event instanceof MouseEvent) {
    dragStartPos.value = { x: event.clientX, y: event.clientY }
  } else if (event.touches.length > 0) {
    dragStartPos.value = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }

  // 重置缓存的矩形以确保准确性
  canvasRect = null
}

// 修改onMouseMove函数以支持前景图拖拽
function onMouseMove(event: MouseEvent) {
  // 处理前景图拖拽
  if (isDraggingForeground.value && !isDragging.value && canvasContainer.value) {
    // 使用requestAnimationFrame节流处理拖拽
    if (!isMouseMovePending) {
      isMouseMovePending = true

      requestAnimationFrame(() => {
        const deltaX = event.clientX - dragStartPos.value.x
        const deltaY = event.clientY - dragStartPos.value.y

        // 更新所有控制点位置
        moveAllControlPoints(deltaX, deltaY)

        // 更新拖拽起始位置
        dragStartPos.value = { x: event.clientX, y: event.clientY }

        isMouseMovePending = false
      })
    }
    return
  }

  // 处理控制点拖拽
  if (!isDragging.value || activePointIndex.value === -1 || !canvasContainer.value) return

  // 使用requestAnimationFrame节流处理鼠标移动
  if (!isMouseMovePending) {
    isMouseMovePending = true

    requestAnimationFrame(() => {
      updatePointPosition(event.clientX, event.clientY)
      isMouseMovePending = false
    })
  }
}

// 修改onTouchMove函数以支持前景图拖拽
function onTouchMove(event: TouchEvent) {
  // 处理前景图拖拽
  if (
    isDraggingForeground.value &&
    !isDragging.value &&
    canvasContainer.value &&
    event.touches.length > 0
  ) {
    if (event.cancelable) {
      event.preventDefault()
    }

    const touch = event.touches[0]
    const deltaX = touch.clientX - dragStartPos.value.x
    const deltaY = touch.clientY - dragStartPos.value.y

    // 更新所有控制点位置
    moveAllControlPoints(deltaX, deltaY)

    // 更新拖拽起始位置
    dragStartPos.value = { x: touch.clientX, y: touch.clientY }
    return
  }

  // 处理控制点拖拽
  if (!isDragging.value || activePointIndex.value === -1 || !canvasContainer.value) return

  if (event.cancelable) {
    event.preventDefault()
  }

  if (event.touches.length > 0) {
    const touch = event.touches[0]
    updatePointPosition(touch.clientX, touch.clientY)
  }
}

// 更新所有控制点位置
function moveAllControlPoints(deltaX: number, deltaY: number) {
  // 移动所有控制点
  for (let i = 0; i < controlPoints.value.length; i++) {
    controlPoints.value[i].x += deltaX
    controlPoints.value[i].y += deltaY
  }
}

// 更新点位置的统一方法
function updatePointPosition(clientX: number, clientY: number) {
  const rect = getCanvasRect()
  const x = clientX - rect.left
  const y = clientY - rect.top

  // 更新控制点位置
  controlPoints.value[activePointIndex.value] = { x, y }
}

// 鼠标释放处理
function onMouseUp() {
  if (isDragging.value) {
    isDragging.value = false
    activePointIndex.value = -1
  }

  if (isDraggingForeground.value) {
    isDraggingForeground.value = false
  }
}

// 获取画布数据（合成后的图像）
function getCanvasData(): string | null {
  if (!threeRenderer.value) return null
  return threeRenderer.value.getCanvasData()
}

// 使用指定的前景图进行合成
async function composeWithForeground(foregroundFile: File): Promise<string | null> {
  try {
    // 保存当前状态
    const currentForegroundImg = foregroundImg.value

    // 加载新的前景图
    const newImg = await loadImage(foregroundFile)

    // 临时替换前景图
    foregroundImg.value = newImg

    // 使用当前的控制点进行合成

    // 获取合成结果
    const result = getCanvasData()

    // 恢复原来的前景图和控制点
    foregroundImg.value = currentForegroundImg

    return result
  } catch (error) {
    console.error('Error in composeWithForeground:', error)
    return null
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  // 清理Three.js资源
  if (threeRenderer.value) {
    threeRenderer.value.dispose()
  }

  // 清理事件监听器
  window.removeEventListener('resize', debouncedResize)
  window.matchMedia('(resolution: 1dppx)').removeListener(debouncedResize)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('touchmove', onTouchMove)
  document.removeEventListener('touchend', onMouseUp)
  document.removeEventListener('touchcancel', onMouseUp)

  // 清理timeout
  if (resizeTimeout) {
    window.clearTimeout(resizeTimeout)
    resizeTimeout = null
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
</style>
