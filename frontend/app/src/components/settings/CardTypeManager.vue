<template>
  <div>
    <div class="action-bar">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增卡类型</el-button>
    </div>
    <el-table :data="cardTypes" stripe v-loading="loading">
      <el-table-column prop="name" label="卡类型名称" />
      <el-table-column prop="initialPrice" label="办卡金额" width="150" align="right">
        <template #default="{ row }">¥{{ new Decimal(row.initialPrice).toFixed(2) }}</template>
      </el-table-column>
       <el-table-column prop="discountRate" label="折扣率" width="120" align="center">
         <template #default="{ row }">{{ new Decimal(row.discountRate).times(10).toFixed(1) }} 折</template>
       </el-table-column>
       <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'AVAILABLE' ? 'success' : 'info'">
            {{ row.status === 'AVAILABLE' ? '上架' : '下架' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑卡类型' : '新增卡类型'" width="500px" @closed="onDialogClosed">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="卡类型名称" prop="name">
          <el-input v-model="form.name" placeholder="如：300元储值卡" />
        </el-form-item>
        <el-form-item label="办卡金额(元)" prop="initialPrice">
          <el-input-number v-model="form.initialPrice" :precision="2" :step="100" :min="0" />
        </el-form-item>
        <el-form-item label="折扣率" prop="discountRate">
          <el-input-number v-model="form.discountRate" :precision="2" :step="0.05" :min="0.1" :max="1" placeholder="如8折请填写0.8" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="AVAILABLE">上架</el-radio>
            <el-radio value="UNAVAILABLE">下架</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <div>
            <!-- 核心修改：v-if 判断的是 initialStatus -->
            <el-popconfirm
              v-if="form.id && initialStatus === 'UNAVAILABLE'"
              title="确定要删除该卡类型吗？此操作不可恢复。"
              @confirm="handleDelete(form.id)"
            >
              <template #reference>
                <el-button type="danger" link>删除卡类型</el-button>
              </template>
            </el-popconfirm>
          </div>
          <div>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit" :loading="isSubmitting">确定</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getCardTypeList, createCardType, updateCardType, deleteCardType } from '@/api/cardType.js';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import Decimal from 'decimal.js';

const cardTypes = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isSubmitting = ref(false);
const formRef = ref(null);
// 核心修改：新增 ref 记录初始状态
const initialStatus = ref('');

const getInitialForm = () => ({
  id: null,
  name: '',
  initialPrice: 300,
  discountRate: 0.8,
  status: 'AVAILABLE',
});
const form = reactive(getInitialForm());

const rules = {
  name: [{ required: true, message: '请输入卡类型名称', trigger: 'blur' }],
  initialPrice: [{ required: true, message: '请输入办卡金额', trigger: 'blur' }],
  discountRate: [{ required: true, message: '请输入折扣率', trigger: 'blur' }],
};

const fetchCardTypes = async () => {
  loading.value = true;
  try {
    cardTypes.value = await getCardTypeList();
  } finally {
    loading.value = false;
  }
};

onMounted(fetchCardTypes);

const handleAdd = () => {
  Object.assign(form, getInitialForm());
  initialStatus.value = '';
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  const editData = { 
    ...row, 
    initialPrice: Number(row.initialPrice),
    discountRate: Number(row.discountRate)
  };
  Object.assign(form, editData);
  // 核心修改：记录打开弹窗时的状态
  initialStatus.value = row.status;
  dialogVisible.value = true;
};

const onDialogClosed = () => {
    if(formRef.value) {
        formRef.value.clearValidate();
    }
}

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    isSubmitting.value = true;
    try {
      if (form.id) {
        await updateCardType(form.id, form);
        ElMessage.success('更新成功');
      } else {
        await createCardType(form);
        ElMessage.success('新增成功');
      }
      dialogVisible.value = false;
      await fetchCardTypes();
    } finally {
      isSubmitting.value = false;
    }
  });
};

const handleDelete = async (id) => {
  try {
    await deleteCardType(id);
    ElMessage.success('删除成功');
    dialogVisible.value = false;
    await fetchCardTypes();
  } catch {
    // API层已处理
  }
};
</script>

<style scoped>
.action-bar {
  margin-bottom: 20px;
}
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
</style>