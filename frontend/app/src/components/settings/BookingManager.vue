<template>
  <div class="booking-manager-container" v-loading="loading">
    <el-alert
      title="预约功能说明"
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      生成访问码后，将预约链接分享给客户即可在线预约。重新生成访问码将使旧链接失效。
    </el-alert>

    <div class="booking-code-section">
      <div v-if="bookingCode" class="code-info">
        <div class="code-row">
          <span class="label">预约链接：</span>
          <el-input
            :model-value="bookingUrl"
            readonly
            class="url-input"
          >
            <template #append>
              <el-button @click="copyUrl">复制</el-button>
            </template>
          </el-input>
        </div>

        <div class="code-row">
          <span class="label">二维码：</span>
          <div class="qrcode-wrapper">
            <canvas ref="qrcodeCanvas"></canvas>
          </div>
        </div>

        <div class="code-row">
          <span class="label">生成时间：</span>
          <span class="value">{{ formatTime(bookingCodeUpdatedAt) }}</span>
        </div>

        <div class="action-row">
          <el-button type="danger" plain @click="handleRegenerate">
            重新生成访问码
          </el-button>
        </div>
      </div>

      <div v-else class="no-code">
        <el-empty description="尚未生成预约访问码">
          <div class="generate-form">
            <el-input
              v-model="customCodeInput"
              placeholder="自定义访问码（可选）"
              maxlength="20"
              clearable
              style="width: 200px; margin-bottom: 12px;"
            />
            <div class="generate-tip">留空则自动生成8位随机码</div>
            <el-button type="primary" @click="handleGenerate">
              生成访问码
            </el-button>
          </div>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import request from '@/api/index.js';
import QRCode from 'qrcode';

const loading = ref(false);
const bookingCode = ref('');
const bookingCodeUpdatedAt = ref(null);
const qrcodeCanvas = ref(null);

const customCodeInput = ref('');

const bookingUrl = computed(() => {
  if (!bookingCode.value) return '';
  return `${window.location.origin}/b/${bookingCode.value}`;
});

const formatTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generateQRCode = async () => {
  await nextTick();
  if (qrcodeCanvas.value && bookingUrl.value) {
    try {
      await QRCode.toCanvas(qrcodeCanvas.value, bookingUrl.value, {
        width: 160,
        margin: 2
      });
    } catch (err) {
      console.error('QRCode generation failed:', err);
    }
  }
};

const fetchBookingCode = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: '/configs/booking-code',
      method: 'get'
    });
    bookingCode.value = res.bookingCode || '';
    bookingCodeUpdatedAt.value = res.bookingCodeUpdatedAt;
    if (bookingCode.value) {
      generateQRCode();
    }
  } finally {
    loading.value = false;
  }
};

const handleGenerate = async () => {
  loading.value = true;
  try {
    const res = await request({
      url: '/configs/booking-code',
      method: 'patch',
      data: customCodeInput.value ? { customCode: customCodeInput.value } : {}
    });
    bookingCode.value = res.bookingCode;
    bookingCodeUpdatedAt.value = res.bookingCodeUpdatedAt;
    customCodeInput.value = '';
    ElMessage.success('访问码生成成功');
    generateQRCode();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '生成失败');
  } finally {
    loading.value = false;
  }
};

const handleRegenerate = async () => {
  try {
    const { value } = await ElMessageBox.prompt(
      '重新生成后，当前预约链接将立即失效。可输入自定义访问码，留空则随机生成。',
      '重新生成访问码',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '自定义访问码（可选）',
        inputPattern: /^$|^[a-zA-Z0-9_]{2,20}$/,
        inputErrorMessage: '只能包含字母、数字、下划线，长度2-20位'
      }
    );
    customCodeInput.value = value || '';
    await handleGenerate();
  } catch {
    // 用户取消
  }
};

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(bookingUrl.value);
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.error('复制失败');
  }
};

onMounted(() => {
  fetchBookingCode();
});
</script>

<style scoped>
.booking-manager-container {
  padding-top: 20px;
}

.info-alert {
  margin-bottom: 24px;
}

.booking-code-section {
  max-width: 600px;
}

.code-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.code-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.code-row .label {
  flex-shrink: 0;
  width: 80px;
  color: #606266;
  line-height: 32px;
}

.code-row .value {
  color: #303133;
  line-height: 32px;
}

.url-input {
  flex: 1;
}

.qrcode-wrapper {
  background: #fff;
  padding: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.qrcode-wrapper canvas {
  display: block;
}

.action-row {
  margin-top: 10px;
  padding-left: 92px;
}

.no-code {
  padding: 40px 0;
}

.generate-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.generate-tip {
  font-size: 12px;
  color: #909399;
}
</style>
