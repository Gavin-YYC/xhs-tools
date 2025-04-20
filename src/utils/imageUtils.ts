// 将图像缩放到指定尺寸并返回 Canvas
export function scaleImageToCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: 'low' | 'medium' | 'high' = 'high'
): HTMLCanvasElement {
  // 创建临时画布进行图像缩放
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = targetWidth
  tempCanvas.height = targetHeight
  const tempCtx = tempCanvas.getContext('2d', { colorSpace: 'srgb' })

  if (tempCtx) {
    // 设置图像渲染质量
    tempCtx.imageSmoothingEnabled = true
    tempCtx.imageSmoothingQuality = quality

    // 在临时画布上绘制缩放后的图像
    tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight)
  }

  return tempCanvas
}

// 从文件加载图像
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image loading failed'))
    }

    img.src = url
  })
}

// 计算图像尺寸
export function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  containerWidth: number,
  containerHeight: number,
  scaleFactor: number = 0.8
): { width: number; height: number } {
  const imgAspect = originalHeight / originalWidth
  let imgWidth, imgHeight

  if (containerWidth > containerHeight) {
    // 宽屏：以宽度的一定比例作为基准
    imgWidth = containerWidth * scaleFactor
    imgHeight = imgWidth * imgAspect
  } else {
    // 高屏：以高度的一定比例作为基准
    imgHeight = containerHeight * scaleFactor
    imgWidth = imgHeight / imgAspect
  }

  return { width: imgWidth, height: imgHeight }
}

// 获取高分辨率的图像数据
export function getHighResolutionCanvasData(
  canvas: HTMLCanvasElement,
  format: string = 'image/png',
  quality: number = 1.0
): string {
  return canvas.toDataURL(format, quality)
}
