import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useImageStore = defineStore('image', () => {
  // 前景图（可能有多张，但预览时只显示第一张）
  const foregroundImages = ref<File[]>([])
  // 当前选择的背景图
  const backgroundImage = ref<File | null>(null)
  // 合成后的图片URL列表
  const composedImages = ref<string[]>([])
  // 前景图的变换信息（位置、缩放、旋转等）
  const transformInfo = ref({
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    left: 0,
    top: 0
  })

  // 设置前景图
  function setForegroundImages(images: File[]) {
    foregroundImages.value = images
  }

  // 设置背景图
  function setBackgroundImage(image: File) {
    backgroundImage.value = image
  }

  // 更新变换信息
  function updateTransformInfo(info: any) {
    transformInfo.value = { ...transformInfo.value, ...info }
  }

  // 设置合成后的图片
  function setComposedImages(images: string[]) {
    composedImages.value = images
  }

  // 清空所有图片
  function clearAll() {
    foregroundImages.value = []
    backgroundImage.value = null
    composedImages.value = []
    transformInfo.value = {
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      left: 0,
      top: 0
    }
  }

  return {
    foregroundImages,
    backgroundImage,
    composedImages,
    transformInfo,
    setForegroundImages,
    setBackgroundImage,
    updateTransformInfo,
    setComposedImages,
    clearAll
  }
}) 