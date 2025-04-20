<template>
  <div class="control-points">
    <!-- 前景图拖动区域 - 在控制点之间的区域 -->
    <div
      class="foreground-drag-area"
      @mousedown="startDragForeground($event)"
      @touchstart="startDragForeground($event)"
    ></div>
    <div
      v-for="(point, index) in controlPoints"
      :key="index"
      class="control-point"
      :class="{ active: activePointIndex === index }"
      :style="{
        left: `${point.x}px`,
        top: `${point.y}px`,
        transform: `translate(-50%, -50%) ${activePointIndex === index ? 'scale(1.2)' : ''}`,
      }"
      @mousedown="startDragPoint($event, index)"
      @touchstart="startDragPoint($event, index)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

// 属性定义
defineProps<{
  controlPoints: { x: number; y: number }[]
  activePointIndex: number
}>()

// 事件定义
const emit = defineEmits<{
  (e: 'dragPointStart', index: number): void
  (e: 'dragForegroundStart', event: MouseEvent | TouchEvent): void
}>()

// 控制点拖拽处理
function startDragPoint(event: MouseEvent | TouchEvent, index: number) {
  if (event.cancelable) {
    event.preventDefault()
  }
  emit('dragPointStart', index)
}

// 前景图拖拽处理
function startDragForeground(event: MouseEvent | TouchEvent) {
  if (event.cancelable) {
    event.preventDefault()
  }
  emit('dragForegroundStart', event)
}
</script>

<style scoped>
.control-points {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.foreground-drag-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: move;
  pointer-events: auto;
  /* 启用调试时可以取消注释查看区域 */
  /* background-color: rgba(255, 0, 0, 0.1); */
  z-index: 1;
}

.control-point {
  position: absolute;
  width: 16px;
  height: 16px;
  background-color: rgba(33, 150, 243, 0.8);
  border: 2px solid white;
  border-radius: 50%;
  cursor: move;
  pointer-events: auto;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  will-change: transform, left, top;
  z-index: 2;
}

.control-point.active {
  background-color: rgba(255, 87, 34, 0.8);
}
</style>
