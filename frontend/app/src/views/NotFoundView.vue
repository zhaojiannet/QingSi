<template>
  <div class="not-found-container">
    <el-result
      :icon="result.icon"
      :title="result.title"
      :sub-title="result.subTitle"
    >
      <template #extra>
        <el-button type="primary" @click="goHome">返回首页</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

// 优化：根据路由来源判断是404还是403
const result = computed(() => {
  // 我们可以在路由守卫中重定向到此页面时，添加一个查询参数
  if (route.query.unauthorized) {
    return {
      icon: 'warning',
      title: '403 - 禁止访问',
      subTitle: '抱歉，您的账户权限不足，无法访问此页面。'
    };
  }
  return {
    icon: 'error',
    title: '404 - 页面未找到',
    subTitle: '抱歉，您访问的页面不存在或已被移除。'
  };
});


const goHome = () => {
  router.push('/');
};
</script>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}
</style>