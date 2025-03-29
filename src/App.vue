<script setup lang="ts">
import ImageComposer from './components/ImageComposer.vue'
</script>

<template>
  <div class="app-container">
    <header>
      <h1>图片批量合成工具</h1>
    </header>
    <main>
      <ImageComposer />
    </main>
    <footer>
      <p>©2025 清正</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  color: #333;
  background-color: #f8f9fa;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  padding: 20px 0;
  margin-bottom: 20px;
  text-align: center;
  border-bottom: 1px solid #eaeaea;
}

header h1 {
  color: #2563eb;
  font-size: 28px;
}

main {
  flex: 1;
}

footer {
  margin-top: 40px;
  padding: 20px 0;
  text-align: center;
  color: #777;
  font-size: 14px;
  border-top: 1px solid #eaeaea;
}
</style>
