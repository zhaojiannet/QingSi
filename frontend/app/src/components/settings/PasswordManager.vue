<template>
  <div class="password-manager-container">
    <el-form 
      ref="formRef" 
      :model="form" 
      :rules="rules" 
      label-width="100px"
      style="max-width: 500px"
      @keyup.enter="handleSubmit"
    >
      <el-form-item label="旧密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前使用的密码" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password placeholder="请输入6位以上的新密码" />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          确认修改
        </el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { updateUserPassword } from '@/api/user.js';
import { useUserStore } from '@/stores/user';
import { ElMessage } from 'element-plus';

const formRef = ref(null);
const loading = ref(false);
const userStore = useUserStore();

const getInitialForm = () => ({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const form = reactive(getInitialForm());

const validateConfirmPassword = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入新密码'));
  } else if (value !== form.newPassword) {
    callback(new Error("两次输入的密码不一致!"));
  } else {
    callback();
  }
};

const rules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
      { required: true, message: '请输入新密码', trigger: 'blur' },
      { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
};

const handleReset = () => {
    if (formRef.value) {
        formRef.value.resetFields();
    }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    
    loading.value = true;
    try {
      const response = await updateUserPassword({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });

      // 使用 ElMessage 进行成功的轻量提示
      ElMessage.success(response.message || '密码修改成功，即将退出');
      
      // 延迟 1.5 秒后执行登出，让用户能看到提示信息
      setTimeout(() => {
        userStore.logout();
      }, 1500);

    } catch {
      // 失败的错误提示已由 src/api/index.js 中的拦截器统一处理
      // 这里无需再做任何操作
    } finally {
      loading.value = false;
    }
  });
};
</script>

<style scoped>
.password-manager-container {
    padding-top: 20px;
}
</style>