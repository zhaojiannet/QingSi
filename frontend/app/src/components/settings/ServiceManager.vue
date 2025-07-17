<template>
  <div>
    <div class="action-bar">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增服务</el-button>
    </div>
    <el-table :data="services" stripe v-loading="loading">
      <el-table-column prop="name" label="服务名称" />
      <el-table-column prop="standardPrice" label="标准价格" width="120" align="right">
        <template #default="{ row }">¥{{ new Decimal(row.standardPrice).toFixed(2) }}</template>
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

    <!-- 新增/编辑表单弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑服务' : '新增服务'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="服务名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="标准价格" prop="standardPrice">
          <el-input-number v-model="form.standardPrice" :precision="2" :step="1" :min="0" />
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
              title="确定要删除该服务吗？此操作不可恢复。"
              @confirm="handleDelete(form.id)"
            >
              <template #reference>
                <el-button type="danger" link>删除服务</el-button>
              </template>
            </el-popconfirm>
          </div>
          <div>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit">确定</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getServiceList, createService, updateService, deleteService } from '@/api/service.js';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import Decimal from 'decimal.js';

const services = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);
// 核心修改：新增 ref 记录初始状态
const initialStatus = ref('');

const getInitialForm = () => ({
  id: null,
  name: '',
  standardPrice: 0,
  status: 'AVAILABLE',
});
const form = reactive(getInitialForm());

const rules = {
  name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
  standardPrice: [{ required: true, message: '请输入标准价格', trigger: 'blur' }],
};

const fetchServices = async () => {
  loading.value = true;
  try {
    services.value = await getServiceList();
  } finally {
    loading.value = false;
  }
};

onMounted(fetchServices);

const handleAdd = () => {
  Object.assign(form, getInitialForm());
  initialStatus.value = ''; // 新增模式下没有初始状态，删除按钮不会显示
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  const editData = { ...row, standardPrice: Number(row.standardPrice) };
  Object.assign(form, editData);
  // 核心修改：记录打开弹窗时的状态
  initialStatus.value = row.status;
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (form.id) {
        await updateService(form.id, form);
        ElMessage.success('更新成功');
      } else {
        await createService(form);
        ElMessage.success('新增成功');
      }
      dialogVisible.value = false;
      await fetchServices();
    } catch {
      // API层已处理
    }
  });
};

const handleDelete = async (id) => {
  try {
    await deleteService(id);
    ElMessage.success('删除成功');
    dialogVisible.value = false;
    await fetchServices();
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