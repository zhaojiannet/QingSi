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
        <el-select 
          v-model="formData.status" 
          placeholder="请选择状态" 
          style="width: 100%;"
          :disabled="formData.status === 'DELETED'"
        >
          <!-- 核心修改：更新下拉框选项文本 -->
          <el-option label="正常" value="ACTIVE" />
          <el-option label="冻结" value="INACTIVE" />
        </el-select>
      </el-form-item>

      <el-form-item label="备注" prop="notes">
        <el-input v-model="formData.notes" type="textarea" placeholder="请输入备注" />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <!-- 左侧危险操作区域 -->
        <div>
          <!-- 常规注销按钮 -->
          <el-popconfirm
            v-if="isEditMode && formData.status !== 'DELETED'"
            title="确定要注销该账户吗？"
            confirm-button-text="确认注销"
            @confirm="handleDelete"
          >
            <template #reference>
              <!-- 核心修改：更新按钮文本 -->
              <el-button type="danger" link :loading="isDeleteLoading">注销账户</el-button>
            </template>
          </el-popconfirm>

          <!-- 仅当会员已注销且当前用户是ADMIN时，才显示“彻底删除”按钮 -->
          <el-popconfirm
            v-if="isEditMode && formData.status === 'DELETED' && userStore.userRole === 'ADMIN'"
            title="警告：此操作将永久删除该会员的所有数据且不可恢复！确定吗？"
            confirm-button-text="我确定，彻底删除"
            @confirm="handlePurge"
          >
            <template #reference>
              <!-- 核心修改：更新按钮文本 -->
              <el-button type="danger" :loading="isDeleteLoading">彻底删除</el-button>
            </template>
          </el-popconfirm>
        </div>

        <!-- 右侧常规操作区域 -->
        <div>
          <el-button @click="isDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="isSubmitLoading" :disabled="formData.status === 'DELETED'">确定</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { addMember, updateMember, deleteMember, purgeMember } from '@/api/member.js';
import { useUserStore } from '@/stores/user.js';
import { ElMessage } from 'element-plus';

const userStore = useUserStore();
const isDialogVisible = ref(false);
const isSubmitLoading = ref(false);
const isDeleteLoading = ref(false);
const formRef = ref(null);

const getInitialFormData = () => ({
  id: null, name: '', phone: '', gender: 'UNKNOWN',
  birthday: null, status: 'ACTIVE', notes: ''
});

const formData = reactive(getInitialFormData());
const isEditMode = computed(() => !!formData.id);

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ]
};
const emit = defineEmits(['success']);

const open = (memberData = null) => {
  if (memberData) {
    Object.assign(formData, memberData);
  } else {
    Object.assign(formData, getInitialFormData());
  }
  isDialogVisible.value = true;
};

const onDialogClosed = () => {
  Object.assign(formData, getInitialFormData());
  if (formRef.value) formRef.value.clearValidate();
};

const handleSubmit = async () => {
  if (formData.status === 'DELETED') return;
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

// 处理逻辑删除（注销账户）
const handleDelete = async () => {
  if (!isEditMode.value) return;
  isDeleteLoading.value = true;
  try {
    await deleteMember(formData.id);
    // 核心修改：更新成功提示
    ElMessage.success('账户注销成功');
    isDialogVisible.value = false;
    emit('success');
  } finally {
    isDeleteLoading.value = false;
  }
};

// 处理物理删除（彻底删除）
const handlePurge = async () => {
  if (!isEditMode.value) return;
  isDeleteLoading.value = true;
  try {
    await purgeMember(formData.id);
    // 核心修改：更新成功提示
    ElMessage.warning('会员数据已彻底删除');
    isDialogVisible.value = false;
    emit('success');
  } finally {
    isDeleteLoading.value = false;
  }
};

defineExpose({ open });
</script>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:global(.el-dialog) {
  @media (max-width: 767px) {
    width: 90% !important;
  }
}
</style>