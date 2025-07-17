<template>
  <div>
    <div class="action-bar">
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增服务</el-button>
    </div>
    <el-table :data="services" stripe v-loading="loading">
      <el-table-column prop="name" label="服务名称" />
      <el-table-column prop="standardPrice" label="标准价格" width="120" align="right">
        <template #default="{ row }">¥{{ row.standardPrice.toFixed(2) }}</template>
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { getServiceList, createService, updateService } from '@/api/service.js'; // 假设API已创建
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

const services = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const formRef = ref(null);

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
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  Object.assign(form, row);
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (form.id) {
        await updateService(form.id, form); // 假设API已创建
        ElMessage.success('更新成功');
      } else {
        await createService(form); // 假设API已创建
        ElMessage.success('新增成功');
      }
      dialogVisible.value = false;
      fetchServices();
    } catch {
      // API层已处理
    }
  });
};
</script>

<style scoped>
.action-bar {
  margin-bottom: 20px;
}
</style>