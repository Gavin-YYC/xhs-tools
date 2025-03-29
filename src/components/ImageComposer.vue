<template>
  <div class="image-composer">
    <div class="left-panel">
      <div class="operation-area">
        <h2>操作区</h2>
        <div class="operation-buttons">
          <el-button type="primary" @click="importBackground">导入背景图</el-button>
          <el-button type="primary" @click="importForegrounds">批量导入前景图</el-button>
          <el-button type="success" @click="composeImages" :disabled="!canCompose">合成</el-button>
          <el-button type="warning" @click="downloadImages" :disabled="!hasComposedImages">下载</el-button>
        </div>

        <div class="image-info" v-if="hasBackground || hasForeground">
          <div v-if="hasBackground" class="info-item">
            <div class="label">背景图:</div>
            <div class="value">{{ backgroundFileName }}</div>
          </div>
          <div v-if="hasForeground" class="info-item">
            <div class="label">前景图:</div>
            <div class="value">{{ foregroundCount }}张</div>
          </div>
        </div>
      </div>
    </div>

    <div class="right-panel">
      <div class="preview-container">
        <div class="preview-area">
          <h2>预览区</h2>
          <p v-if="!hasBackground && !hasForeground" class="empty-message">请导入背景图和前景图</p>
          <image-editor v-if="hasBackground || hasForeground" ref="imageEditorRef" />
        </div>
      </div>

      <div class="result-area" v-if="hasComposedImages">
        <h2>合成结果</h2>
        <div class="result-images">
          <div v-for="(image, index) in composedImages" :key="index" class="result-image">
            <div class="image-container">
              <el-image
                :src="image"
                fit="contain"
                :preview-src-list="composedImages"
                :initial-index="index"
                :hide-on-click-modal="false"
                alt="合成结果">
                <template #error>
                  <div class="image-error">
                    <el-icon><icon-picture /></el-icon>
                    <span>加载失败</span>
                  </div>
                </template>
              </el-image>
              <div class="image-overlay">
                <el-button
                  type="primary"
                  size="small"
                  circle
                  @click.stop="downloadSingleImage(image, index)"
                  title="下载此图片">
                  <el-icon><download /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件选择器 -->
    <input
      type="file"
      ref="backgroundInputRef"
      accept="image/*"
      style="display: none"
      @change="onBackgroundSelected"
    />
    <input
      type="file"
      ref="foregroundInputRef"
      accept="image/*"
      multiple
      style="display: none"
      @change="onForegroundsSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { ElMessage } from 'element-plus'
import { Picture as IconPicture, Download } from '@element-plus/icons-vue'
import ImageEditor from './ImageEditor.vue'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const imageStore = useImageStore()

// 引用DOM元素
const backgroundInputRef = ref<HTMLInputElement | null>(null)
const foregroundInputRef = ref<HTMLInputElement | null>(null)
const imageEditorRef = ref<InstanceType<typeof ImageEditor> | null>(null)

// 计算属性
const hasBackground = computed(() => !!imageStore.backgroundImage)
const hasForeground = computed(() => imageStore.foregroundImages.length > 0)
const canCompose = computed(() => hasBackground.value && hasForeground.value)
const hasComposedImages = computed(() => imageStore.composedImages.length > 0)
const composedImages = computed(() => imageStore.composedImages)
const backgroundFileName = computed(() =>
  imageStore.backgroundImage ? imageStore.backgroundImage.name : ''
)
const foregroundCount = computed(() => imageStore.foregroundImages.length)

// 导入背景图
function importBackground() {
  backgroundInputRef.value?.click()
}

// 批量导入前景图
function importForegrounds() {
  foregroundInputRef.value?.click()
}

// 背景图选择处理
async function onBackgroundSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (files && files.length > 0) {
    const image = files[0]

    // 验证文件是否为图片
    if (!image.type.startsWith('image/')) {
      ElMessage.error('请选择图片文件')
      return
    }

    console.log('设置背景图:', image.name)
    imageStore.setBackgroundImage(image)

    // 确保DOM更新后再进行操作
    await nextTick()
  }

  // 重置input，以便可以再次选择相同的文件
  input.value = ''
}

// 前景图选择处理
async function onForegroundsSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (files && files.length > 0) {
    const images: File[] = []

    // 验证所有文件是否为图片
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        images.push(file)
      }
    }

    if (images.length > 0) {
      console.log(`设置${images.length}张前景图`)
      imageStore.setForegroundImages(images)

      // 确保DOM更新后再进行操作
      await nextTick()
    } else {
      ElMessage.error('请选择图片文件')
    }
  }

  // 重置input，以便可以再次选择相同的文件
  input.value = ''
}

// 合成图片
async function composeImages() {
  if (!canCompose.value || !imageEditorRef.value) {
    ElMessage.warning('请先导入背景图和前景图')
    return
  }

  try {
    // 显示加载提示
    const loadingInstance = ElMessage.info({
      message: '正在合成图片，请稍候...',
      duration: 0
    })

    const composedImagesList: string[] = []

    // 获取第一张前景图与背景图的合成结果
    const firstComposed = imageEditorRef.value.getCanvasData()
    if (!firstComposed) {
      ElMessage.error('获取画布数据失败')
      loadingInstance.close()
      return
    }

    // 添加第一张合成图
    composedImagesList.push(firstComposed)

    // 如果有多张前景图，为每张前景图分别与背景图合成
    if (imageStore.foregroundImages.length > 1) {
      // 从索引1开始（跳过第一张已经处理过的）
      for (let i = 1; i < imageStore.foregroundImages.length; i++) {
        const foregroundFile = imageStore.foregroundImages[i]
        // 使用每张前景图单独合成
        const composedImage = await imageEditorRef.value.composeWithForeground(foregroundFile)

        if (composedImage) {
          composedImagesList.push(composedImage)
        }
      }
    }

    // 保存合成结果
    imageStore.setComposedImages(composedImagesList)

    // 关闭加载提示
    loadingInstance.close()
    ElMessage.success(`成功合成${composedImagesList.length}张图片`)
  } catch (error) {
    console.error('合成图片失败', error)
    ElMessage.error('合成图片失败')
  }
}

// 下载合成图片（打包成zip）
async function downloadImages() {
  if (!hasComposedImages.value) {
    ElMessage.warning('没有可下载的图片')
    return
  }

  try {
    // 显示加载提示
    const loadingInstance = ElMessage.info({
      message: '正在打包图片，请稍候...',
      duration: 0
    })

    // 创建一个新的JSZip实例
    const zip = new JSZip()

    // 添加图片到zip
    const promises = imageStore.composedImages.map(async (dataUrl, index) => {
      // 将dataURL转换为Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      // 添加到zip，使用递增的文件名
      zip.file(`合成图片_${index + 1}.png`, blob)
    })

    // 等待所有图片添加完成
    await Promise.all(promises)

    // 生成zip文件
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // 压缩级别，1-9
      }
    })

    // 下载zip文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    saveAs(content, `合成图片_${timestamp}.zip`)

    // 关闭加载提示
    loadingInstance.close()
    ElMessage.success('下载完成')
  } catch (error) {
    console.error('打包下载图片失败', error)
    ElMessage.error('下载失败，请重试')
  }
}

// 下载单张合成图片
function downloadSingleImage(dataUrl: string, index: number) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `合成图片_${index + 1}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success(`图片${index + 1}下载成功`)
}
</script>

<style scoped>
.image-composer {
  display: flex;
  width: 100%;
  min-height: 80vh;
  gap: 20px;
}

.left-panel {
  width: 250px;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.operation-area {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.operation-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.operation-buttons .el-button {
  margin-left: 0;
}

.image-info {
  margin-top: 20px;
  border-top: 1px solid #ddd;
  padding-top: 15px;
}

.info-item {
  margin-bottom: 10px;
  font-size: 14px;
}

.label {
  color: #666;
  margin-bottom: 5px;
}

.value {
  font-weight: bold;
  color: #333;
  word-break: break-all;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 880px;
}

.preview-area {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  min-height: 460px;
}

.empty-message {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  color: #999;
  font-size: 16px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.result-area {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 18px;
  color: #333;
}

.result-images {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.result-image {
  width: 200px;
  height: 150px;
  overflow: hidden;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
}

.image-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.image-container :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.image-overlay {
  position: absolute;
  bottom: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1;
}

.image-container:hover .image-overlay {
  opacity: 1;
}

.image-error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #f5f7fa;
  color: #909399;
}

.image-error .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}
</style> 