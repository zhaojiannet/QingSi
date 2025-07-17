<template>
  <div class="login-page-wrapper">
    <div class="login-container">
      <!-- 左侧宣传区域 -->
      <div class="login-promo">
        <div class="promo-content">
          <img src="@/assets/images/qingsi_logo.png" alt="Logo" class="promo-logo" />
          <h1 class="promo-title">青丝<br>美业综合管理系统</h1>
          <p class="promo-description">智慧管理，从每一次服务开始。高效，精准，专业。</p>
          <img src="@/assets/images/bg_image.png" alt="Promo illustration" class="promo-bg-illustration" />
        </div>
      </div>

      <!-- 右侧登录表单区域 -->
      <div class="login-form-section">
        <div class="form-wrapper">
          <h2 class="form-title">欢迎登录</h2>
          <el-form ref="formRef" :model="form" :rules="rules" @keyup.enter="handleLogin" label-position="top">
            <el-form-item prop="username" label="账号">
              <el-input v-model="form.username" placeholder="请输入账号" size="large" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="password" label="密码">
              <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password :prefix-icon="Lock" />
            </el-form-item>
            
  <!-- 核心修改：用 v-if 控制验证码区域的显示 -->
  <el-form-item v-if="loginConfig.showCaptcha" prop="captchaText" label="验证码">
    <div class="captcha-wrapper">
      <el-input v-model="form.captchaText" placeholder="请输入验证码" size="large" />
      <img v-if="captchaImage" :src="captchaImage" @click="refreshCaptcha" class="captcha-image" alt="验证码" title="点击刷新" />
    </div>
  </el-form-item>

            <el-form-item>
              <div class="form-actions">
                <el-checkbox v-model="rememberMe" label="记住密码" size="large" />
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" @click="handleLogin" :loading="loading" style="width: 100%;">
                登 录
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getSystemConfig } from '@/api/config.js'; // 引入获取配置的API

const loginConfig = reactive({
  showCaptcha: true, // 默认显示
});

const router = useRouter();
const userStore = useUserStore();
const formRef = ref(null);
const loading = ref(false);
const rememberMe = ref(false);
const captchaImage = ref('');

const form = reactive({
  username: '',
  password: '',
  captchaText: '',
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaText: [{ required: true, message: '请输入验证码', trigger: 'blur' }],
};

const refreshCaptcha = () => {
  // 通过给URL添加一个随机的时间戳，来强制浏览器请求新的图片，避免缓存
  captchaImage.value = `/api/auth/captcha?t=${new Date().getTime()}`;
};

// 在 onMounted 中增加获取配置的逻辑
onMounted(async () => {
  refreshCaptcha();
  try {
    // 在登录页加载时，获取系统配置
    const config = await getSystemConfig();
    loginConfig.showCaptcha = config.enableLoginCaptcha;
  } catch(e) {
    // 获取配置失败，保持默认显示
    console.error("Failed to get system config", e);
  }
});

const handleLogin = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await userStore.login(form);
      ElMessage.success('登录成功！');
      setTimeout(() => {
        router.push('/'); 
      }, 1000);
    } catch {
      // 登录失败时，除了api/index.js的弹窗，我们还应该刷新验证码
      refreshCaptcha();
      form.captchaText = ''; // 清空用户输入的验证码
      loading.value = false;
    } 
  });
};
</script>

<style scoped>
.login-page-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
  overflow: hidden;
}

.login-container {
  display: flex;
  width: 720px;
  height: 480px; /* 稍微增加高度以容纳验证码 */
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  overflow: hidden;
}

/* 左侧宣传区域 */
.login-promo {
  width: 40%;
  background-color: rgba(0, 0, 0, 0.3);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px;
  position: relative;
}
.promo-content {
  z-index: 1;
}
.promo-logo {
  height: 168px;
  margin-bottom: 20px;
  margin: 0 auto;
}
.promo-title {
  font-weight: 600;
  margin-bottom: 10px;
  text-align: center;
}
.promo-description {
  font-size: 16px;
  opacity: 0.8;
  line-height: 1.6;
  text-align: center;
}
.promo-bg-illustration {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    opacity: 0.1;
    pointer-events: none;
}

/* 右侧表单区域 */
.login-form-section {
  width: 60%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  background-color: #fdfdfd;

}
.form-wrapper {
  width: 100%;
  max-width: 320px;
}
.form-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  text-align: center;
  margin-bottom: 30px;
}
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.captcha-wrapper {
  display: flex;
  width: 100%;
  gap: 10px;
}
.captcha-image {
  height: 40px; /* 与 el-input large 尺寸对齐 */
  cursor: pointer;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}


/* 移动端适配 */
@media (max-width: 992px) {
  .login-container {
    width: 90%;
    max-width: 450px;
    height: auto;
    flex-direction: column;
  }
  .login-promo {
    display: none;
  }
  .login-form-section {
    width: 100%;
    padding: 30px 20px;
  }
}
</style>