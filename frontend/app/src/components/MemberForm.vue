<template>
  <el-dialog 
    v-model="isDialogVisible" 
    :title="isEditMode ? '编辑会员' : '新增会员'" 
    width="500px" 
    @closed="onDialogClosed"
  >
    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px">
      <el-form-item label="姓名" prop="name">
        <el-input v-model="formData.name" placeholder="请输入会员姓名" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="formData.phone" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item label="性别" prop="gender">
         <el-radio-group v-model="formData.gender">
          <el-radio value="MALE">男</el-radio>
          <el-radio value="FEMALE">女</el-radio>
          <el-radio value="UNKNOWN">未知</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="生日" prop="birthday">
        <el-date-picker v-model="formData.birthday" type="date" placeholder="选择生日" style="width: 100%;"/>
      </el-form-item>
      
      <el-form-item v-if="isEditMode" label="账户状态" prop="status">
        <el-select v-model="formData.status" placeholder="请选择状态" style="width: 100%;">
          <el-option label="正常" value="ACTIVE" />
          <el-option label="停用" value="INACTIVE" />
          <el-option label="冻结" value="FROZEN" />
        </el-select>
      </el-form-item>

      <el-form-item label="备注" prop="notes">
        <el-input v-model="formData.notes" type="textarea" placeholder="请输入备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-popconfirm
          v-if="isEditMode && initialStatus === 'INACTIVE'"
          title="确定要彻底删除这位会员吗？所有关联数据将丢失！"
          @confirm="handleDelete"
          width="220"
        >
          <template #reference>
            <el-button type="danger" link :loading="isDeleteLoading">删除会员</el-button>
          </template>
        </el-popconfirm>
        
        <div v-else></div>

        <div>
          <el-button @click="isDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="isSubmitLoading">确定</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { addMember, updateMember, deleteMember } from '@/api/member.js';
import { ElMessage } from 'element-plus';

// --- 状态管理 ---
const isDialogVisible = ref(false);
const isSubmitLoading = ref(false);
const isDeleteLoading = ref(false);
const formRef = ref(null);
const initialStatus = ref('');

// 定义表单的初始状态生成函数
const getInitialFormData = () => ({
  id: null,
  name: '',
  phone: '',
  gender: 'UNKNOWN',
  birthday: null,
  status: 'ACTIVE',
  notes: ''
});

// 使用函数初始化响应式表单数据
const formData = reactive(getInitialFormData());

// 判断当前是否为编辑模式
const isEditMode = computed(() => !!formData.id);

// --- 表单校验规则 ---
const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
};

// --- 事件定义 ---
const emit = defineEmits(['success']);

// --- 方法定义 ---

// 打开对话框 (供父组件调用)
const open = (memberData = null) => {
  if (memberData) { // 编辑模式
    Object.assign(formData, memberData);
    initialStatus.value = memberData.status;
  }
  isDialogVisible.value = true;
};

// 对话框完全关闭后的回调
const onDialogClosed = () => {
  // 彻底重置表单数据
  Object.assign(formData, getInitialFormData());
  // 清除校验状态
  formRef.value.clearValidate();
  // 重置其他状态
  initialStatus.value = '';
};

// 提交表单 (新增或更新)
const handleSubmit = async () => {
  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    isSubmitLoading.value = true;
    try {
      const apiCall = isEditMode.value 
        ? updateMember(formData.id, formData) 
        : addMember(formData);
      
      await apiCall;
      ElMessage.success(`${isEditMode.value ? '更新' : '新增'}会员成功`);
      isDialogVisible.value = false;
      emit('success');
    } finally {
      isSubmitLoading.value = false;
    }
  });
};

// 删除会员
const handleDelete = async () => {
  if (!isEditMode.value) return;

  isDeleteLoading.value = true;
  try {
    await deleteMember(formData.id);
    ElMessage.success('删除成功');
    isDialogVisible.value = false;
    emit('success');
  } finally {
    isDeleteLoading.value = false;
  }
};

// 暴露 open 方法给父组件
defineExpose({ open });
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* --- 核心改动：使用更高优先级的选择器强制覆盖 --- */
@media (max-width: 767px) {
  /* 
    使用 :global 包裹 :deep() 是一种在某些Vue版本和场景下
    确保深度选择器生效的 hacky 但有效的方法。
    我们直接针对 .el-dialog 这个类进行修改。
  */
  :global(.el-dialog) {
    width: 90% !important;
  }
}
</style>