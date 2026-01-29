<template>
  <div class="login-page-wrapper">
    <div class="login-container">
      <!-- 左侧宣传区域 -->
      <div class="login-promo">
        <div class="promo-content">
          <img :src="appConfig.logo" alt="Logo" class="promo-logo" />
          <h1 class="promo-title">{{ appConfig.brandName }}<br>{{ appConfig.industryType }}{{ appConfig.systemName }}</h1>
          <p class="promo-description">{{ appConfig.slogan }}</p>
          <img :src="appConfig.loginBgImage" alt="Promo illustration" class="promo-bg-illustration" />
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
            
            <el-form-item v-if="loginConfig.showCaptcha" prop="captchaText" label="验证码">
              <div class="captcha-wrapper">
                <el-input v-model="form.captchaText" placeholder="请输入验证码" size="large" />
                <img v-if="captchaImage" :src="captchaImage" @click="refreshCaptcha" class="captcha-image" alt="验证码" title="点击刷新" />
              </div>
            </el-form-item>

            <el-form-item>
              <el-checkbox v-model="trustDevice" label="信任此设备（7天内免登录）" size="large" />
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { getSystemConfig } from '@/api/config.js';
import appConfig from '@/config/app.js';

const loginConfig = reactive({
  showCaptcha: true,
});

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const formRef = ref(null);
const loading = ref(false);
const captchaImage = ref('');
const trustDevice = ref(false);

const form = reactive({
  username: '',
  password: '',
  captchaText: '',
});

const rules = computed(() => ({
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captchaText: loginConfig.showCaptcha 
    ? [{ required: true, message: '请输入验证码', trigger: 'blur' }]
    : []
}));

const refreshCaptcha = () => {
  captchaImage.value = `/api/auth/captcha?t=${new Date().getTime()}`;
};

onMounted(async () => {
  // 先尝试获取系统配置
  try {
    const config = await getSystemConfig();
    loginConfig.showCaptcha = config.enableLoginCaptcha;
    console.log('验证码配置:', loginConfig.showCaptcha ? '开启' : '关闭');
  } catch(e) {
    console.log('获取系统配置失败，使用默认配置');
    loginConfig.showCaptcha = true; // 默认显示验证码
  }
  
  // 如果需要显示验证码，则加载验证码图片
  if (loginConfig.showCaptcha) {
    refreshCaptcha();
  }
});

const handleLogin = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const loginPayload = {
        ...form,
        trustDevice: trustDevice.value
      };
      await userStore.login(loginPayload);

      ElMessage.success('登录成功！');
      router.replace(route.query.redirect || '/'); 
    } catch (error) {
      refreshCaptcha();
      form.captchaText = '';
    } finally {
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
  height: 480px;
  background-color: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  overflow: hidden;
}

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
  font-size: 14px;
  opacity: 0.8;
  line-height: 1.6;
  text-align: center;
  white-space: nowrap;
}
.promo-bg-illustration {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.1;
    pointer-events: none;
}

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

.captcha-wrapper {
  display: flex;
  width: 100%;
  gap: 10px;
}
.captcha-image {
  height: 40px;
  cursor: pointer;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}

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