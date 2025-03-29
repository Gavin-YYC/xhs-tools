<template>
  <div class="image-editor-container">
    <div class="image-editor" ref="fabricContainer">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { Canvas, FabricImage } from 'fabric'
import type { TOptions, ImageProps, TOriginX, TOriginY } from 'fabric'

const imageStore = useImageStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const fabricContainer = ref<HTMLDivElement | null>(null)
let fabricCanvas: Canvas | null = null
let foregroundObj: FabricImage | null = null
let backgroundObj: FabricImage | null = null

// 初始化画布
onMounted(async () => {
  if (canvas.value) {
    try {
      fabricCanvas = new Canvas(canvas.value, {
        width: fabricContainer.value?.offsetWidth,
        height: fabricContainer.value?.offsetHeight,
        backgroundColor: '#f5f5f5',
        preserveObjectStacking: true,
      })

      // 监听对象变更事件
      fabricCanvas.on('object:modified', updateTransformInfo)
      fabricCanvas.on('object:moving', updateTransformInfo)
      fabricCanvas.on('object:scaling', updateTransformInfo)
      fabricCanvas.on('object:rotating', updateTransformInfo)

      // 如果已有图片数据，加载它们
      if (imageStore.backgroundImage) {
        loadBackgroundImage(imageStore.backgroundImage)
      }
      if (imageStore.foregroundImages.length > 0) {
        loadForegroundImage(imageStore.foregroundImages[0])
      }
    } catch (error) {
      console.error('Canvas初始化错误:', error)
    }
  } else {
    console.error('找不到canvas元素')
  }
})

// 更新变换信息到store
function updateTransformInfo() {
  if (foregroundObj) {
    imageStore.updateTransformInfo({
      scaleX: foregroundObj.scaleX || 1,
      scaleY: foregroundObj.scaleY || 1,
      angle: foregroundObj.angle || 0,
      left: foregroundObj.left || 0,
      top: foregroundObj.top || 0
    })
  }
}

// 监听背景图变化
watch(() => imageStore.backgroundImage, (newImage) => {
  console.log('背景图变化被监听到:', newImage ? '有图片' : '无图片')
  if (!newImage || !fabricCanvas) return
  loadBackgroundImage(newImage)
}, { immediate: true })

// 加载背景图
function loadBackgroundImage(image: File) {
  if (!fabricCanvas) {
    console.error('无法加载背景图：Canvas未初始化')
    return
  }

  const url = URL.createObjectURL(image)
  const img = new window.Image()

  img.onload = function() {
    try {
      if (!canvas.value || !fabricCanvas) {
        return;
      }

      if (backgroundObj) {
        fabricCanvas.remove(backgroundObj)
      }

      // 根据背景图计算画布高度，保持宽度固定
      const aspectRatio = img.height / img.width
      const canvasWidth = fabricCanvas.getWidth()
      const canvasHeight = canvasWidth * aspectRatio
      fabricCanvas.setHeight(canvasHeight)

      // 创建背景图对象并适应画布大小
      const fabricImage = new FabricImage(img, {
        scaleX: canvasWidth / img.width,
        scaleY: canvasHeight / img.height,
        selectable: false,
        evented: false,
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center'
      })

      fabricCanvas.add(fabricImage)
      backgroundObj = fabricImage

      if (imageStore.foregroundImages.length > 0) {
        loadForegroundImage(imageStore.foregroundImages[0])
      }
    } catch (error) {
      console.error('创建背景Fabric图像失败:', error)
    } finally {
      // 释放URL以避免内存泄漏
      URL.revokeObjectURL(url)
    }
  }

  img.onerror = function() {
    console.error('背景图片加载失败')
    URL.revokeObjectURL(url)
  }

  // 设置图片源并开始加载
  img.src = url
}

// 监听前景图变化
watch(() => imageStore.foregroundImages, (newImages) => {
  console.log('前景图变化被监听到:', newImages ? newImages.length : 0)
  if (!newImages || newImages.length === 0 || !fabricCanvas) return
  loadForegroundImage(newImages[0])
}, { immediate: true })

// 创建前景图对象的公共方法
function createForegroundObject(img: HTMLImageElement, useTransformInfo = true) {
  if (!canvas.value || !fabricCanvas) {
    return null;
  }

  // 计算前景图初始大小，目标是画布宽度的1/4
  const targetWidth = canvas.value.width / 4
  const scale = targetWidth / (img.width || 1)
  const canvasWidth = fabricCanvas.getWidth()
  const canvasHeight = fabricCanvas.getHeight()

  // 默认配置
  const commonConfig: TOptions<ImageProps> = {
    originX: 'center' as TOriginX,
    originY: 'center' as TOriginY,
    selectable: true,
    hasControls: true,
    hasBorders: false,
    lockScalingX: false,  // 允许水平缩放
    lockScalingY: false,  // 允许垂直缩放
    lockRotation: false,  // 允许旋转
    cornerColor: '#2196F3',       // 控制点颜色
    cornerStrokeColor: '#0D47A1', // 控制点边框颜色
    cornerSize: 10,               // 控制点大小
    transparentCorners: false,    // 不透明控制点
    borderColor: '#2196F3',       // 选中边框颜色
    borderScaleFactor: 2,         // 边框宽度比例
    borderOpacityWhenMoving: 0.8, // 移动时边框透明度
  }

  // 位置和缩放信息
  const positionConfig: TOptions<ImageProps> = useTransformInfo && imageStore.transformInfo.left ? {
    scaleX: imageStore.transformInfo.scaleX,
    scaleY: imageStore.transformInfo.scaleY,
    angle: imageStore.transformInfo.angle,
    left: imageStore.transformInfo.left,
    top: imageStore.transformInfo.top
  } : {
    left: canvasWidth / 2,
    top: canvasHeight / 2,
    scaleX: scale,
    scaleY: scale
  }

  // 创建前景图对象
  return new FabricImage(img, {
    ...commonConfig,
    ...positionConfig
  })
}

// 加载前景图
function loadForegroundImage(image: File) {
  if (!fabricCanvas) {
    return
  }

  const url = URL.createObjectURL(image)
  const img = new window.Image()
  img.onload = function() {
    try {
      if (!canvas.value || !fabricCanvas) {
        return;
      }

      if (foregroundObj) {
        fabricCanvas.remove(foregroundObj)
        foregroundObj = null
      }

      const fabricImage = createForegroundObject(img, foregroundObj !== null)
      if (fabricImage) {
        fabricCanvas.add(fabricImage)
        fabricCanvas.setActiveObject(fabricImage)
        fabricCanvas.bringObjectToFront(fabricImage)
        console.log('bringObjectToFront', fabricImage)
        foregroundObj = fabricImage
        console.log('前景图加载到Canvas成功')
      }
    } catch (error) {
      console.error('创建前景Fabric图像失败:', error)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  img.onerror = function() {
    console.error('前景图片加载失败')
    URL.revokeObjectURL(url)
  }

  // 设置图片源并开始加载
  img.src = url
}

// 获取画布数据
function getCanvasData() {
  if (!fabricCanvas) return null
  return fabricCanvas.toDataURL({
    format: 'png',
    multiplier: 1
  })
}

// 使用指定的前景图进行合成
async function composeWithForeground(foregroundFile: File) {
  if (!fabricCanvas || !backgroundObj) return null

  // 临时保存当前前景图对象
  const currentForeground = foregroundObj

  // 加载新的前景图
  await new Promise<void>((resolve) => {
    const url = URL.createObjectURL(foregroundFile)
    const img = new window.Image()

    img.onload = function() {
      try {
        if (!canvas.value || !fabricCanvas) {
          resolve()
          return
        }

        // 暂时移除当前前景图
        if (foregroundObj) {
          fabricCanvas.remove(foregroundObj)
        }

        // 使用公共方法创建前景图对象，并应用变换信息
        const fabricImage = createForegroundObject(img, true)
        if (fabricImage) {
          fabricCanvas.add(fabricImage)
          foregroundObj = fabricImage
        }
        resolve()
      } catch (error) {
        console.error('创建前景Fabric图像失败:', error)
        resolve()
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    img.onerror = function() {
      console.error('前景图片加载失败')
      URL.revokeObjectURL(url)
      resolve()
    }

    img.src = url
  })

  // 获取合成后的画布数据
  const composedData = fabricCanvas.toDataURL({
    format: 'png',
    multiplier: 1
  })

  // 恢复原来的前景图
  if (currentForeground) {
    if (foregroundObj !== currentForeground) {
      if (foregroundObj) {
        fabricCanvas.remove(foregroundObj)
      }
      fabricCanvas.add(currentForeground)
      foregroundObj = currentForeground
      fabricCanvas.setActiveObject(currentForeground)
      fabricCanvas.renderAll()
    }
  }

  return composedData
}

// 清理事件监听
onBeforeUnmount(() => {
  if (fabricCanvas) {
    fabricCanvas.off('object:modified', updateTransformInfo)
    fabricCanvas.off('object:moving', updateTransformInfo)
    fabricCanvas.off('object:scaling', updateTransformInfo)
    fabricCanvas.off('object:rotating', updateTransformInfo)
    fabricCanvas.dispose()
  }
})

// 暴露方法给父组件
defineExpose({
  getCanvasData,
  composeWithForeground
})
</script>

<style scoped>
.image-editor-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  padding: 20px;
}

.image-editor {
  width: 800px;
  height: auto; /* 改为自适应高度 */
  position: relative;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

canvas {
  border: 1px solid #e5e7eb;
  display: block;
  width: 100%;
  height: 100%;
}
</style>