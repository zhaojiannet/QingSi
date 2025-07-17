<template>
<div>
<div class="action-bar">
<el-button type="primary" :icon="Plus" @click="handleAdd">新增员工</el-button>
</div>
<el-table :data="staffList" stripe v-loading="loading">
<el-table-column prop="name" label="姓名" width="150" />
<el-table-column prop="position" label="职位" width="150" />
<el-table-column prop="phone" label="联系电话" width="180" />
<el-table-column label="是否计提" width="100" align="center">
<template #default="{ row }">
<el-tag :type="row.countsCommission ? 'success' : 'info'" size="small">
{{ row.countsCommission ? '是' : '否' }}
</el-tag>
</template>
</el-table-column>
<el-table-column label="状态" width="100" align="center">
<template #default="{ row }">
<el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
{{ row.status === 'ACTIVE' ? '在职' : '离职' }}
</el-tag>
</template>
</el-table-column>
<el-table-column label="入职日期" prop="hireDate">
<template #default="{ row }">
{{ new Date(row.hireDate).toLocaleDateString() }}
</template>
</el-table-column>
<el-table-column label="操作" width="120" align="center" fixed="right">
<template #default="{ row }">
<el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
</template>
</el-table-column>
</el-table>
<!-- 新增/编辑表单弹窗 -->
<el-dialog v-model="dialogVisible" :title="form.id ? '编辑员工' : '新增员工'" width="500px">
  <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
    <el-form-item label="员工姓名" prop="name">
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item label="职位" prop="position">
      <el-input v-model="form.position" />
    </el-form-item>
    <el-form-item label="联系电话" prop="phone">
      <el-input v-model="form.phone" />
    </el-form-item>
    <el-form-item label="是否计提" prop="countsCommission">
      <el-switch v-model="form.countsCommission" />
    </el-form-item>
    <el-form-item label="在职状态" prop="status">
      <el-radio-group v-model="form.status">
        <el-radio value="ACTIVE">在职</el-radio>
        <el-radio value="INACTIVE">离职</el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
  <template #footer>
    <div class="dialog-footer">
      <div>
        <!-- 核心修改：v-if 判断的是 initialStatus -->
        <el-popconfirm
          v-if="form.id && initialStatus === 'INACTIVE'"
          title="确定要删除该员工吗？此操作不可恢复。"
          @confirm="handleDelete(form.id)"
        >
          <template #reference>
            <el-button type="danger" link>删除员工</el-button>
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
import { getStaffList, createStaff, updateStaff, deleteStaff } from '@/api/staff.js';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

const staffList = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isSubmitting = ref(false);
const formRef = ref(null);
// 核心修改：新增 ref 记录初始状态
const initialStatus = ref('');

const getInitialForm = () => ({
id: null,
name: '',
position: '发型师',
phone: '',
countsCommission: true,
status: 'ACTIVE',
});
const form = reactive(getInitialForm());

const rules = {
name: [{ required: true, message: '请输入员工姓名', trigger: 'blur' }],
position: [{ required: true, message: '请输入职位', trigger: 'blur' }],
};

const fetchStaff = async () => {
loading.value = true;
try {
staffList.value = await getStaffList();
} finally {
loading.value = false;
}
};

onMounted(fetchStaff);

const handleAdd = () => {
Object.assign(form, getInitialForm());
initialStatus.value = '';
dialogVisible.value = true;
};

const handleEdit = (row) => {
Object.assign(form, row);
// 核心修改：记录打开弹窗时的状态
initialStatus.value = row.status;
dialogVisible.value = true;
};

const handleSubmit = async () => {
if (!formRef.value) return;
await formRef.value.validate(async (valid) => {
if (!valid) return;
isSubmitting.value = true;
try {
if (form.id) {
await updateStaff(form.id, form);
ElMessage.success('更新成功');
} else {
await createStaff(form);
ElMessage.success('新增成功');
}
dialogVisible.value = false;
await fetchStaff();
} finally {
isSubmitting.value = false;
}
});
};

const handleDelete = async (id) => {
  try {
    await deleteStaff(id);
    ElMessage.success('删除成功');
    dialogVisible.value = false;
    await fetchStaff();
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