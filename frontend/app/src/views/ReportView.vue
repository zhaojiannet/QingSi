<template>
  <div class="page-content">
    <div class="page-header">
      <h2 class="page-title">统计报表</h2>
    </div>

    <!-- 全局日期筛选器 -->
    <div class="global-filter-container" v-show="isDateFilterRequired">
      <el-form :inline="true" class="date-filter-form" @submit.prevent>
        <el-form-item label="选择日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="quickDate" @change="handleQuickDateChange">
            <el-radio-button value="today">当日</el-radio-button>
            <el-radio-button value="this_week">当周</el-radio-button>
            <el-radio-button value="this_month">当月</el-radio-button>
            <el-radio-button value="this_quarter">当季</el-radio-button>
            <el-radio-button value="this_year">当年</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <el-tabs v-model="activeTab" class="report-tabs">
      <!-- 营业概览 -->
      <el-tab-pane label="营业概览" name="business">
        <el-row :gutter="20" v-loading="businessReport.loading" class="stats-cards">
          <el-col :span="6" :xs="12">
            <el-statistic title="总消费 (元)" :value="businessReport.data.totalRevenue" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="卡耗 (元)" :value="businessReport.data.cardConsumption" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="总客数" :value="businessReport.data.totalCustomers" />
          </el-col>
          <el-col :span="6" :xs="12">
            <el-statistic title="客单价 (元)" :value="businessReport.data.averageOrderValue" />
          </el-col>
        </el-row>
        <div class="transaction-list-container">
          <div class="transaction-header">
            <h3 class="section-title">
              消费记录
              <span v-if="memberSearch" class="filter-info">
                （筛选结果：{{ filteredTransactions.length }} 条记录）
              </span>
            </h3>
            <!-- 会员筛选搜索框 -->
            <el-form :inline="true" class="member-filter-form" @submit.prevent>
              <el-form-item label="搜索">
                <el-input
                  v-model="memberSearch"
                  :placeholder="transactionList.searchLoading ? '正在搜索...' : '输入会员姓名或手机号'"
                  clearable
                  style="width: 250px;"
                  @input="handleMemberSearchChange"
                  :loading="transactionList.searchLoading"
                >
                  <template #prefix>
                    <el-icon><Search /></el-icon>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
          </div>
          <div class="transaction-table-container">
            <el-table 
              :data="filteredTransactions" 
              v-loading="transactionList.loading" 
              stripe
              ref="transactionTableRef"
              style="width: 100%"
              :row-key="row => row.id"
            >
            <el-table-column label="姓名" width="110">
              <template #default="{ row }">
                <el-tooltip 
                  v-if="row.member && row.member.phone" 
                  :content="`会员：${row.member.name} 手机号码：${row.member.phone}`" 
                  placement="top"
                >
                  <span>{{ row.member.name }}</span>
                </el-tooltip>
                <span v-else>{{ row.member?.name || row.customerName || '非会员用户' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="会员卡" width="200">
              <template #default="{ row }">
                <!-- 多卡支付显示所有卡片 -->
                <div v-if="row.member && isMultiCardPayment(row)" class="multi-card-list">
                  <div v-for="cardInfo in getMultiCardList(row)" :key="cardInfo.name" class="card-item">
                    <el-tag type="warning" size="small" class="card-tag">{{ cardInfo.name }}</el-tag>
                  </div>
                </div>
                <!-- 单卡支付 -->
                <el-tag v-else-if="row.member && row.cardUsed" type="primary" size="small" class="card-tag">
                  {{ row.cardDisplayName || row.cardUsed.cardType?.name || '会员卡' }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="服务项目" min-width="220">
              <template #default="{ row }">
                <el-tooltip 
                  v-if="row.transactionType === 'PENDING'"
                  :content="row.summary"
                  placement="top"
                  effect="dark"
                >
                  <span class="pending-record">
                    {{ row.summary }}
                  </span>
                </el-tooltip>
                <el-tooltip 
                  v-else-if="row.transactionType === 'PENDING_CLEAR'" 
                  :content="getBatchClearTooltip(row)" 
                  placement="top"
                  :disabled="!isBatchClear(row)"
                >
                  <span class="clear-record">
                    {{ row.summary }}
                  </span>
                </el-tooltip>
                <el-tooltip
                  v-else
                  :content="formatServiceItems(row.items) || row.summary || '项目消费'"
                  placement="top"
                  effect="dark"
                >
                  <span class="service-items-text">
                    {{ formatServiceItems(row.items) || row.summary || '项目消费' }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="数量" width="55" align="center">
              <template #default="{ row }">
                <span v-if="row.items && row.items.length > 0">
                  {{ row.items.reduce((sum, item) => sum + (item.quantity || 1), 0) }}
                </span>
                <span v-else>1</span>
              </template>
            </el-table-column>
            <el-table-column label="服务员工" width="90">
              <template #default="{ row }">{{ row.staff?.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="金额" width="120" align="right">
              <template #default="{ row }">
                <div style="line-height: 1.3;">
                  <div style="color: #666; font-size: 12px;">应付：{{ formatCurrency(row.totalAmount) }}</div>
                  <div>
                    <span 
                      :class="{
                        'paid-amount': true,
                        'pending-amount': row.transactionType === 'PENDING',
                        'clear-amount': row.transactionType === 'PENDING_CLEAR'
                      }"
                    >
                      实付：{{ formatCurrency(row.actualPaidAmount) }}
                    </span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="折扣" width="160" align="left">
              <template #default="{ row }">
                <div>
                  <!-- 价格调整信息（优先显示） -->
                  <div v-if="row.manualAdjustment">
                    <el-tag type="warning" size="small">{{ getAdjustmentText(row) }}</el-tag>
                    <div class="adjustment-reason" v-if="getAdjustmentReason(row)">
                      {{ getAdjustmentReason(row) }}
                    </div>
                  </div>
                  
                  <!-- 多卡支付信息（与价格调整不互斥） -->
                  <div v-if="row.member && isMultiCardPayment(row)" class="multi-card-payment" :class="{ 'mt-2': row.manualAdjustment }">
                    <el-tag type="warning" size="small" class="multi-card-tag">
                      <el-icon><CreditCard /></el-icon>
                      多卡 {{ getAverageDiscountDisplay(row) }}折 {{ formatCurrency(row.discountAmount) }}
                    </el-tag>
                    <div class="multi-card-details">
                      {{ getMultiCardDetails(row) }}
                    </div>
                  </div>
                  
                  <!-- 单卡支付（只在非多卡且非价格调整时显示） -->
                  <div v-else-if="row.member && parseFloat(row.discountAmount) > 0 && !row.manualAdjustment && !isMultiCardPayment(row)">
                    <!-- 单卡支付：有cardUsed信息 -->
                    <div v-if="row.cardUsed">
                      <el-tag type="primary" size="small">
                        {{ getCardDiscountDisplay(row.cardUsed.cardType?.discountRate) }}折 {{ formatCurrency(row.discountAmount) }}
                      </el-tag>
                    </div>
                    <!-- 单卡支付：通过智能接口但没有cardUsed信息 -->
                    <div v-else>
                      <el-tag type="primary" size="small">
                        {{ getSingleCardDiscountDisplay(row) }}
                      </el-tag>
                    </div>
                  </div>
                  
                  <!-- 无折扣信息时显示 -->
                  <span v-if="!row.manualAdjustment && (!row.member || parseFloat(row.discountAmount) <= 0) && !isMultiCardPayment(row)">-</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="transactionTime" label="时间" width="150" align="center">
              <template #default="{ row }">
                <el-tooltip
                  :content="getTimeTooltip(row)"
                  placement="top"
                  effect="dark"
                >
                  <span :class="{ 'manual-time': isManualTime(row) }">
                    <el-icon v-if="isManualTime(row)" style="margin-right: 4px;"><Edit /></el-icon>
                    {{ formatShortDateInAppTimeZone(row.transactionTime) }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column v-if="canShowVoidButton" label="操作" width="80" align="center" fixed="right">
              <template #default="{ row }">
                <el-tooltip v-if="!canVoidTransaction(row)" content="超过7天无法撤销" placement="top">
                  <el-button class="void-btn void-btn-disabled" size="small" link disabled>撤销</el-button>
                </el-tooltip>
                <el-button v-else class="void-btn" size="small" link @click="openVoidDialog(row)">撤销</el-button>
              </template>
            </el-table-column>
            </el-table>
            
            <!-- 分页加载更多区域 -->
            <div class="pagination-section">
              <div v-if="transactionList.pagination.hasMore" class="load-more-container">
                <el-button 
                  @click="loadMore" 
                  :loading="transactionList.searchLoading"
                  type="primary"
                  size="small"
                  style="padding: 12px 24px; border-radius: 6px;"
                >
                  {{ transactionList.searchLoading ? '加载中...' : `加载更多 (已显示 ${transactionList.data.length}/${transactionList.pagination.total} 条)` }}
                </el-button>
              </div>
              <div v-else-if="transactionList.data.length > 0" class="all-loaded">
                已显示全部 {{ transactionList.pagination.total }} 条记录
              </div>
            </div>
            
          </div>
        </div>
      </el-tab-pane>

      <!-- 支付方式构成 -->
      <el-tab-pane label="支付统计" name="paymentSummary">
        <div v-loading="paymentSummary.loading" class="chart-table-layout">
          <div class="chart-container">
            <v-chart v-if="paymentSummary.chartOption" :option="paymentSummary.chartOption" autoresize />
            <el-empty v-else description="暂无数据" />
          </div>
          <div class="table-container">
            <el-table :data="paymentSummary.data" stripe>
              <el-table-column prop="name" label="支付方式" />
              <el-table-column prop="value" label="金额 (元)" align="right" />
              <el-table-column prop="count" label="笔数" align="center" />
            </el-table>
          </div>
        </div>
      </el-tab-pane>

      <!-- 会员卡销售排行 -->
      <el-tab-pane label="会员卡统计" name="cardSalesSummary">
        <div v-loading="cardSalesSummary.loading" class="chart-table-layout">
          <div class="chart-container">
            <v-chart v-if="cardSalesSummary.chartOption" :option="cardSalesSummary.chartOption" autoresize />
            <el-empty v-else description="暂无数据" />
          </div>
          <div class="table-container">
            <el-table :data="cardSalesSummary.data" stripe>
              <el-table-column prop="name" label="卡类型" />
              <el-table-column prop="value" label="销售额 (元)" align="right" sortable />
              <el-table-column prop="count" label="销售张数" align="center" sortable />
            </el-table>
          </div>
        </div>
      </el-tab-pane>
      
      <!-- 项目消费排行 -->
      <el-tab-pane label="项目消费排行" name="serviceRanking">
         <el-table :data="serviceRanking.data" v-loading="serviceRanking.loading" stripe style="width: 100%">
           <el-table-column type="index" label="排名" width="80" />
           <el-table-column prop="serviceName" label="项目名称" />
           <el-table-column prop="totalSales" label="销售总额(元)" align="right" sortable />
           <el-table-column prop="totalCount" label="销售数量" align="center" sortable />
         </el-table>
         <div class="pagination-section" v-if="serviceRanking.data.length > 0">
           <div class="load-more-container">
             <el-button 
               v-if="serviceRanking.hasMore" 
               @click="loadMoreServiceRanking" 
               :loading="serviceRanking.loadingMore"
               type="primary"
               size="small"
               style="padding: 12px 24px; border-radius: 6px;"
             >
               {{ serviceRanking.loadingMore ? '加载中...' : `加载更多 (已显示 ${serviceRanking.data.length}/${serviceRanking.total || serviceRanking.data.length} 条)` }}
             </el-button>
             <div v-else class="all-loaded">已加载全部数据</div>
           </div>
         </div>
      </el-tab-pane>

      <!-- 会员消费排行 -->
      <el-tab-pane label="会员消费排行" name="memberRanking">
        <el-table :data="memberRanking.data" v-loading="memberRanking.loading" stripe style="width: 100%">
           <el-table-column type="index" label="排名" width="80" />
           <el-table-column prop="memberName" label="会员姓名">
             <template #default="{ row }">
               <el-tooltip 
                 v-if="row.memberPhone" 
                 :content="`会员：${row.memberName} 手机号码：${row.memberPhone}`" 
                 placement="top"
               >
                 <span>{{ row.memberName }}</span>
               </el-tooltip>
               <span v-else>{{ row.memberName }}</span>
             </template>
           </el-table-column>
           <el-table-column prop="totalConsumption" label="消费总额(元)" align="right" sortable />
        </el-table>
        <div class="pagination-section" v-if="memberRanking.data.length > 0">
          <div class="load-more-container">
            <el-button 
              v-if="memberRanking.hasMore" 
              @click="loadMoreMemberRanking" 
              :loading="memberRanking.loadingMore"
              type="primary"
              size="small"
              style="padding: 12px 24px; border-radius: 6px;"
            >
              {{ memberRanking.loadingMore ? '加载中...' : `加载更多 (已显示 ${memberRanking.data.length}/${memberRanking.total || memberRanking.data.length} 条)` }}
            </el-button>
            <div v-else class="all-loaded">已加载全部数据</div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 生日提醒 -->
      <el-tab-pane name="birthdayReminders">
        <template #label>
          <el-badge 
            :value="systemStore.upcomingBirthdayCount" 
            :hidden="systemStore.upcomingBirthdayCount === 0" 
            type="warning"
          >
            生日提醒
          </el-badge>
        </template>
        <div class="tip">未来15天内过生日的会员</div>
        <el-table :data="birthdayReminders.data" v-loading="birthdayReminders.loading" stripe max-height="600">
           <el-table-column prop="name" label="姓名">
             <template #default="{ row }">
               <el-tooltip 
                 v-if="row.phone" 
                 :content="`会员：${row.name} 手机号码：${row.phone}`" 
                 placement="top"
               >
                 <span>{{ row.name }}</span>
               </el-tooltip>
               <span v-else>{{ row.name }}</span>
             </template>
           </el-table-column>
           <el-table-column prop="birthday" label="生日日期">
              <template #default="{ row }">{{ new Date(row.birthday).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) }}</template>
           </el-table-column>
           <el-table-column prop="status" label="会员状态">
             <template #default="{ row }">
                <el-tag :type="memberStatusTagType(row.status)">{{ memberStatusText(row.status) }}</el-tag>
             </template>
           </el-table-column>    
                  <!-- 核心修改：新增两列表格 -->

<el-table-column label="累计消费 (元)" align="right">
  <template #default="{ row }">
    <span>
      <strong>{{ Number(row.totalConsumption).toFixed(2) }} 元</strong>

      <div
        v-if="typeof row.rank === 'number'"
        style="color: #909399; font-size: 12px; margin-left: 6px;"
      >
        * 排行：{{ row.rank }}
      </div>

    </span>
  </template>
</el-table-column>






        </el-table>
      </el-tab-pane>

      <!-- 挂账统计 -->
      <el-tab-pane label="挂账统计" name="pendingStats">
        <div class="tip">会员挂账明细统计</div>
        <div class="pending-summary">
          <el-row :gutter="20" v-loading="pendingStats.loading" class="stats-cards">
            <el-col :span="6" :xs="12">
              <el-statistic title="总挂账金额 (元)" :value="pendingStats.summary.totalAmount" />
            </el-col>
            <el-col :span="6" :xs="12">
              <el-statistic title="挂账会员数" :value="pendingStats.summary.memberCount" />
            </el-col>
            <el-col :span="6" :xs="12">
              <el-statistic title="挂账记录数" :value="pendingStats.summary.recordCount" />
            </el-col>
            <el-col :span="6" :xs="12">
              <el-statistic title="平均挂账金额 (元)" :value="pendingStats.summary.averageAmount" />
            </el-col>
          </el-row>
        </div>
        
        <el-table :data="pendingStats.data" v-loading="pendingStats.loading" stripe style="width: 100%">
          <el-table-column prop="name" label="会员姓名" width="120">
            <template #default="{ row }">
              <el-tooltip 
                v-if="row.phone" 
                :content="`会员：${row.name} 手机号码：${row.phone}`" 
                placement="top"
              >
                <span>{{ row.name }}</span>
              </el-tooltip>
              <span v-else>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="挂账总额" width="120" align="right">
            <template #default="{ row }">
              <span class="pending-amount">{{ formatCurrency(row.totalPending) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="记录数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ row.recordCount }}条</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="200">
            <template #default="{ row }">
              <div class="notes-list">
                <div v-for="(payment, index) in row.payments.slice(0, 2)" :key="payment.id" class="note-item">
                  <span v-if="payment.description" class="note-desc">{{ payment.description }}</span>
                  <span v-else class="no-desc">-</span>
                </div>
                <div v-if="row.payments.length > 2" class="more-notes">
                  ...还有 {{ row.payments.length - 2 }} 条
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 加载更多按钮 -->
        <div v-if="pendingStats.hasMore" class="load-more-container" style="margin-top: 20px;">
          <el-button 
            @click="loadMorePendingStats" 
            :loading="pendingStats.loadingMore"
            type="primary"
            size="small"
            style="padding: 12px 24px; border-radius: 6px;"
          >
            {{ pendingStats.loadingMore ? '加载中...' : `加载更多 (已显示 ${pendingStats.data.length}/${pendingStats.total} 条)` }}
          </el-button>
        </div>
      </el-tab-pane>
        
      <!-- 沉睡会员 -->
      <el-tab-pane label="沉睡会员" name="sleepingMembers">
        <div class="tip">超过90天未产生任何消费的活跃会员</div>
        <el-table :data="sleepingMembers.data" v-loading="sleepingMembers.loading" stripe style="width: 100%">
           <el-table-column prop="name" label="姓名">
             <template #default="{ row }">
               <el-tooltip 
                 v-if="row.phone" 
                 :content="`会员：${row.name} 手机号码：${row.phone}`" 
                 placement="top"
               >
                 <span>{{ row.name }}</span>
               </el-tooltip>
               <span v-else>{{ row.name }}</span>
             </template>
           </el-table-column>
           <el-table-column prop="registrationDate" label="注册日期">
              <template #default="{ row }">{{ formatDateInAppTimeZone(row.registrationDate) }}</template>
           </el-table-column>
           <el-table-column prop="lastVisitDate" label="最后消费日期">
             <template #default="{ row }">
                <span v-if="isValidDate(row.lastVisitDate)">{{ formatDateInAppTimeZone(row.lastVisitDate) }}</span>
                <span v-else class="text-muted">无消费记录</span>
             </template>
           </el-table-column>
        </el-table>
        <div class="pagination-section" v-if="sleepingMembers.data.length > 0">
          <div class="load-more-container">
            <el-button 
              v-if="sleepingMembers.hasMore" 
              @click="loadMoreSleepingMembers" 
              :loading="sleepingMembers.loadingMore"
              type="primary"
              size="small"
              style="padding: 12px 24px; border-radius: 6px;"
            >
              {{ sleepingMembers.loadingMore ? '加载中...' : `加载更多 (已显示 ${sleepingMembers.data.length}/${sleepingMembers.total || sleepingMembers.data.length} 条)` }}
            </el-button>
            <div v-else class="all-loaded">已加载全部数据</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 撤销确认对话框 -->
    <el-dialog
      v-model="voidDialog.visible"
      title="确认撤销交易"
      width="450px"
      :close-on-click-modal="false"
    >
      <div v-if="voidDialog.transaction" class="void-info">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="交易时间">
            {{ formatShortDateInAppTimeZone(voidDialog.transaction.transactionTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="会员">
            {{ voidDialog.transaction.member?.name || voidDialog.transaction.customerName || '非会员' }}
          </el-descriptions-item>
          <el-descriptions-item label="消费项目">
            {{ voidDialog.transaction.summary || formatServiceItems(voidDialog.transaction.items) || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="支付金额">
            <span class="amount">¥{{ voidDialog.transaction.actualPaidAmount }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="voidDialog.transaction.member && voidDialog.transaction.paymentMethod === 'MEMBER_CARD'"
          type="warning"
          :closable="false"
          show-icon
          style="margin-top: 16px;"
        >
          撤销后，会员卡余额将恢复扣除金额
        </el-alert>

        <el-form :model="voidDialog" label-width="100px" style="margin-top: 16px;">
          <el-form-item label="撤销原因" required>
            <el-input
              v-model="voidDialog.reason"
              type="textarea"
              :rows="2"
              placeholder="请输入撤销原因（必填）"
              maxlength="200"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="voidDialog.visible = false">取消</el-button>
        <el-button type="danger" :loading="voidDialog.loading" @click="confirmVoid" :disabled="!voidDialog.reason?.trim()">
          确认撤销
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { Search, CreditCard, Edit } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getBusinessReport, getServiceRanking, getSleepingMembers, getMemberRanking, getBirthdayReminders, getPaymentSummary, getCardSalesSummary, getPendingStats } from '@/api/report.js';
import { getTransactionsByDateRange, voidTransaction } from '@/api/transaction.js';
import { getSystemConfig } from '@/api/config.js';
import { useSystemStore } from '@/stores/system';
import { useUserStore } from '@/stores/user';
import { formatInAppTimeZone, formatDateInAppTimeZone, formatShortDateInAppTimeZone, formatFullDateTimeInAppTimeZone } from '@/utils/date.js';
import { memberStatusText, memberStatusTagType } from '@/utils/formatters.js';
import { formatCurrency } from '@/utils/currency.js';

use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
]);

// 格式化服务项目名称，添加数量标记，使用顿号分隔
const formatServiceItems = (items) => {
  if (!items || items.length === 0) return '';
  
  return items.map(item => {
    const quantity = item.quantity || 1;
    const serviceName = item.service.name;
    // 如果数量大于1，添加*n标记
    return quantity > 1 ? `${serviceName}*${quantity}` : serviceName;
  }).join('、'); // 使用顿号分隔
};

const activeTab = ref('business');
const systemStore = useSystemStore();
const userStore = useUserStore();

const dateRange = ref([]);
const quickDate = ref('today');
const memberSearch = ref('');

// 撤销功能相关状态
const systemConfig = ref({ enableTransactionVoid: false });
const voidDialog = reactive({
  visible: false,
  loading: false,
  transaction: null,
  reason: ''
});

// 需要时间筛选的报表Tab
const dateFilterTabs = ['business', 'paymentSummary', 'cardSalesSummary', 'serviceRanking', 'memberRanking'];

// 计算属性：当前Tab是否需要时间筛选
const isDateFilterRequired = computed(() => {
  return dateFilterTabs.includes(activeTab.value);
});

// 是否可以显示撤销按钮
const canShowVoidButton = computed(() => {
  return systemConfig.value?.enableTransactionVoid &&
         ['ADMIN', 'MANAGER'].includes(userStore.userRole);
});

// 检查交易是否可撤销（7天内）
const canVoidTransaction = (transaction) => {
  if (!canShowVoidButton.value) return false;
  const txTime = new Date(transaction.transactionTime);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return txTime >= sevenDaysAgo;
};

// 打开撤销对话框
const openVoidDialog = async (transaction) => {
  try {
    await ElMessageBox.confirm(
      '交易撤销是高风险操作，撤销后将永久删除交易记录并恢复相关金额。此操作不可逆，请确认您已了解后果。',
      '危险操作警告',
      {
        confirmButtonText: '我已了解，继续操作',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        cancelButtonClass: 'el-button--primary',
        customClass: 'void-confirm-dialog',
      }
    );
    voidDialog.transaction = transaction;
    voidDialog.reason = '';
    voidDialog.visible = true;
  } catch {
    // 用户取消
  }
};

// 确认撤销
const confirmVoid = async () => {
  if (!voidDialog.transaction) return;

  voidDialog.loading = true;
  try {
    const result = await voidTransaction(voidDialog.transaction.id, voidDialog.reason || null);
    ElMessage.success('交易撤销成功' + (result.balanceRestored?.length > 0 ? '，会员卡余额已恢复' : ''));
    voidDialog.visible = false;
    // 刷新交易列表
    fetchTransactionData(true);
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '撤销失败');
  } finally {
    voidDialog.loading = false;
  }
};

// --- 报表数据状态 ---
const businessReport = reactive({
  loading: false,
  data: { totalRevenue: 0, cardConsumption: 0, totalCustomers: 0, averageOrderValue: 0 },
});
const transactionList = reactive({
  loading: false,
  data: [],
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    hasMore: true
  },
  searchLoading: false
});
const paymentSummary = reactive({
  loading: false,
  data: [],
  chartOption: null,
});
const cardSalesSummary = reactive({
  loading: false,
  data: [],
  chartOption: null,
});
const serviceRanking = reactive({ 
  loading: false, 
  loadingMore: false,
  data: [], 
  page: 1, 
  hasMore: false 
});
const memberRanking = reactive({ 
  loading: false, 
  loadingMore: false,
  data: [], 
  page: 1, 
  hasMore: false 
});
const birthdayReminders = reactive({ loading: false, data: [] });
const sleepingMembers = reactive({ 
  loading: false, 
  loadingMore: false,
  data: [], 
  page: 1, 
  hasMore: false 
});
const pendingStats = reactive({
  loading: false,
  loadingMore: false,
  data: [],
  page: 1,
  hasMore: false,
  total: 0,
  summary: {
    totalAmount: 0,
    memberCount: 0,
    recordCount: 0,
    averageAmount: 0
  }
});

// --- 会员搜索和过滤 ---
// 现在直接显示服务器端返回的数据，不需要前端过滤
const filteredTransactions = computed(() => {
  return transactionList.data;
});

// 搜索防抖
let searchTimer = null;

const handleMemberSearchChange = () => {
  if (searchTimer) clearTimeout(searchTimer);
  
  searchTimer = setTimeout(() => {
    // 搜索时重置到第一页并清空数据
    transactionList.pagination.page = 1;
    fetchTransactionData(true);
  }, 500); // 500ms防抖
};

// 搜索功能现在只在已加载的数据中进行，用户可以通过滚动加载更多数据来扩大搜索范围

// 表格引用
const transactionTableRef = ref(null);
// 滚动监听清理函数
let scrollCleanup = null;

// 加载更多交易记录
const loadMoreTransactions = async () => {
  if (transactionList.loadingMore || !transactionList.hasMore) return;
  
  console.log('开始加载第', transactionList.page + 1, '页数据');
  transactionList.page++;
  
  // 保存当前数据长度，用于后续检查
  const beforeDataLength = transactionList.data.length;
  
  await fetchBusinessData(false);
  
  const afterDataLength = transactionList.data.length;
  const newItemsCount = afterDataLength - beforeDataLength;
  
  console.log('第', transactionList.page, '页数据加载完成', {
    新增数据: newItemsCount,
    总数据量: afterDataLength,
    剩余可加载: transactionList.hasMore
  });
};

// 主容器滚动加载检测
const setupScrollListener = () => {
  // 防抖函数
  let scrollTimer = null;
  
  const handleScroll = (event) => {
    if (scrollTimer) clearTimeout(scrollTimer);
    
    scrollTimer = setTimeout(() => {
      // 只在业务概览tab时才检测
      if (activeTab.value !== 'business') return;
      
      const target = event.target;
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      
      console.log('主容器滚动检测:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceToBottom,
        hasMore: transactionList.hasMore,
        loadingMore: transactionList.loadingMore
      });
      
      // 距离底部150px时开始加载，但要确保不会无限触发
      if (distanceToBottom <= 150) {
        const now = Date.now();
        // 防止频繁触发：至少间隔1.5秒，并且必须有更多数据且不在加载中
        const timeSinceLastTrigger = now - transactionList.lastTriggerTime;
        
        if (transactionList.hasMore && !transactionList.loadingMore && timeSinceLastTrigger > 1500) {
          console.log('🚀 主容器滚动触发自动加载更多数据', {
            distanceToBottom,
            page: transactionList.page + 1,
            currentDataLength: transactionList.data.length,
            total: transactionList.total
          });
          transactionList.lastTriggerTime = now;
          loadMoreTransactions();
        } else if (transactionList.loadingMore) {
          console.log('📡 正在加载中，跳过触发');
        } else if (!transactionList.hasMore) {
          console.log('✅ 所有数据已加载完成');
        } else if (timeSinceLastTrigger <= 1500) {
          console.log('⏳ 距离上次触发时间不足1.5秒，跳过本次触发');
        }
      }
    }, 100); // 100ms防抖
  };
  
  // 查找主容器（.app-main）
  const findMainContainer = () => {
    return document.querySelector('.app-main');
  };
  
  const mainContainer = findMainContainer();
  
  if (mainContainer) {
    mainContainer.addEventListener('scroll', handleScroll);
    console.log('📜 主容器滚动监听已启动', mainContainer);
    
    // 返回清理函数
    return () => {
      mainContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      console.log('📜 主容器滚动监听已清理');
    };
  } else {
    console.warn('⚠️ 未找到主容器 .app-main，使用 window 滚动监听作为备选');
    
    // 备选方案：监听window滚动
    const handleWindowScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      
      scrollTimer = setTimeout(() => {
        if (activeTab.value !== 'business') return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const distanceToBottom = documentHeight - (scrollTop + windowHeight);
        
        console.log('Window滚动检测:', {
          scrollTop,
          windowHeight,
          documentHeight,
          distanceToBottom,
          hasMore: transactionList.hasMore,
          loadingMore: transactionList.loadingMore
        });
        
        if (distanceToBottom <= 150) {
          const now = Date.now();
          const timeSinceLastTrigger = now - transactionList.lastTriggerTime;
          
          if (transactionList.hasMore && !transactionList.loadingMore && timeSinceLastTrigger > 1500) {
            console.log('🚀 Window滚动触发自动加载更多数据');
            transactionList.lastTriggerTime = now;
            loadMoreTransactions();
          } else if (transactionList.loadingMore) {
            console.log('📡 正在加载中，跳过触发');
          } else if (timeSinceLastTrigger <= 1500) {
            console.log('⏳ 距离上次触发时间不足1.5秒，跳过本次触发');
          }
        }
      }, 100);
    };
    
    window.addEventListener('scroll', handleWindowScroll);
    
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
      console.log('📜 Window滚动监听已清理');
    };
  }
};

// --- 数据获取函数 ---
const fetchBusinessData = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
  businessReport.loading = true;
  try {
    const reportData = await getBusinessReport(params);
    businessReport.data = reportData;
  } finally {
    businessReport.loading = false;
  }
  
  // 获取第一页交易数据
  await fetchTransactionData(true);
};

// 获取交易数据（支持分页和搜索）
const fetchTransactionData = async (reset = false) => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  
  if (reset) {
    transactionList.pagination.page = 1;
    transactionList.data = [];
  }
  
  const params = {
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    page: transactionList.pagination.page,
    limit: transactionList.pagination.limit,
    search: memberSearch.value || ''
  };
  
  transactionList.loading = reset;
  transactionList.searchLoading = !reset;
  
  try {
    const response = await getTransactionsByDateRange(params);
    
    // 处理交易数据，添加手动调整检测
    const processedData = response.data.map(tx => ({
      ...tx,
      manualAdjustment: tx.notes && tx.notes.includes('价格调整：')
    }));
    
    // 调试信息
    console.log('Report fetchTransactionData debug:', {
      apiDataLength: response.data.length,
      processedDataLength: processedData.length,
      reset,
      currentDataLength: transactionList.data.length,
      memberSearch: memberSearch.value,
      params: params,
      actualApiUrl: `/transactions?startDate=${params.startDate}&endDate=${params.endDate}&search=${encodeURIComponent(params.search)}`
    });
    
    if (reset) {
      transactionList.data = processedData;
    } else {
      transactionList.data.push(...processedData);
    }
    
    console.log('After update, transactionList.data.length:', transactionList.data.length);
    
    // 更新分页信息
    transactionList.pagination = {
      ...transactionList.pagination,
      total: response.pagination.total,
      hasMore: response.pagination.hasMore
    };
    
  } finally {
    transactionList.loading = false;
    transactionList.searchLoading = false;
  }
};

// 加载更多数据
const loadMore = async () => {
  if (!transactionList.pagination.hasMore || transactionList.loading || transactionList.searchLoading) {
    return;
  }
  
  // 保存当前滚动位置，保持用户在加载按钮处
  const scrollContainer = document.querySelector('.app-main');
  const currentScrollTop = scrollContainer?.scrollTop || 0;
  
  transactionList.pagination.page++;
  await fetchTransactionData(false);
  
  // 加载完成后，保持用户在原来的滚动位置
  // 新数据会在下方增加，用户需要手动滚动才能看到
  nextTick(() => {
    if (scrollContainer) {
      scrollContainer.scrollTop = currentScrollTop;
    }
  });
};

// 获取调整差额文本
const getAdjustmentText = (row) => {
  if (!row.manualAdjustment) return '';
  
  const totalAmount = parseFloat(row.totalAmount);
  const adjustedAmount = parseFloat(row.actualPaidAmount);
  const difference = adjustedAmount - totalAmount;
  
  if (difference > 0) return `+¥ ${difference.toFixed(2)}`;
  if (difference < 0) return `¥ ${difference.toFixed(2)}`;
  return '价格调整';
};

// 获取调整原因
const getAdjustmentReason = (row) => {
  if (!row.manualAdjustment || !row.notes) return '';
  
  const match = row.notes.match(/价格调整：(.+?)(?:\s*\||$)/);
  return match ? match[1].trim() : '';
};

// 获取会员卡折扣显示
const getCardDiscountDisplay = (discountRate) => {
  if (!discountRate) return 10;
  
  // 处理Decimal对象或字符串类型的discountRate
  const rate = typeof discountRate === 'object' ? parseFloat(discountRate.toString()) : parseFloat(discountRate);
  // discountRate 0.8 表示打8折，所以直接乘以10
  const discount = rate * 10;
  
  // 处理小数点，如6.5折
  return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
};

// 检测是否为多卡支付
const isMultiCardPayment = (transaction) => {
  return transaction.notes && transaction.notes.includes('多卡联合支付:');
};

// 获取平均折扣率显示
const getAverageDiscountDisplay = (transaction) => {
  const totalAmount = parseFloat(transaction.totalAmount);
  const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
  
  // 对于自定义项目（totalAmount为0），尝试从notes中解析原价和折后价
  if (totalAmount <= 0 && transaction.notes) {
    const match = transaction.notes.match(/¥(\d+(?:\.\d+)?)\s*折后\s*¥(\d+(?:\.\d+)?)/);
    if (match) {
      const originalPrice = parseFloat(match[1]);
      const discountedPrice = parseFloat(match[2]);
      if (originalPrice > 0) {
        const discountRate = discountedPrice / originalPrice;
        const discount = discountRate * 10;
        return discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
      }
    }
    return '7.0'; // 默认7折显示
  }
  
  const avgDiscountRate = actualPaidAmount / totalAmount;
  const avgDiscount = avgDiscountRate * 10;
  
  return avgDiscount % 1 === 0 ? Math.round(avgDiscount) : avgDiscount.toFixed(1);
};

// 检查日期值是否有效（用于沉睡会员显示）
const isValidDate = (date) => {
  return date && 
         date !== null && 
         date !== '' && 
         date !== 'null' && 
         date !== 'undefined' &&
         !isNaN(new Date(date).getTime());
};

// 获取多卡支付详情
const getMultiCardDetails = (transaction) => {
  if (!transaction.notes) return '';
  
  // 从notes中提取多卡支付信息
  const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return '多卡组合支付';
};

// 获取多卡支付的卡片列表
const getMultiCardList = (transaction) => {
  if (!transaction.notes) return [];
  
  // 从notes中提取多卡支付信息：300元储值卡¥12 + 500元储值卡¥3.5
  const match = transaction.notes.match(/多卡联合支付:\s*(.+?)(?:\s*\||$)/);
  if (match && match[1]) {
    const cardsText = match[1].trim();
    // 按 + 分割，提取卡片名称
    const cardParts = cardsText.split(' + ');
    return cardParts.map(part => {
      // 提取卡片名称（去掉最后的金额部分）
      // 修复：匹配到最后一个¥符号之前的内容，而不是第一个¥
      const cardMatch = part.match(/^(.+?)¥[\d.]+$/);
      return {
        name: cardMatch ? cardMatch[1].trim() : part.trim()
      };
    });
  }
  
  return [];
};

// 获取单卡支付的折扣显示（用于智能支付接口）
const getSingleCardDiscountDisplay = (transaction) => {
  // 计算折扣率：实付金额 / 应付金额
  const totalAmount = parseFloat(transaction.totalAmount);
  const actualPaidAmount = parseFloat(transaction.actualPaidAmount);
  
  if (totalAmount > 0 && actualPaidAmount > 0) {
    const discountRate = actualPaidAmount / totalAmount;
    const discount = discountRate * 10;
    const discountDisplay = discount % 1 === 0 ? Math.round(discount) : discount.toFixed(1);
    return `${discountDisplay}折 ¥${formatCurrency(transaction.discountAmount)}`;
  }
  
  return `会员卡 ¥${formatCurrency(transaction.discountAmount)}`;
};

const generatePieOption = (title, data) => ({
  title: { text: title, left: 'center', top: '5%' },
  tooltip: { trigger: 'item', formatter: '{b} : ¥{c} ({d}%)' },
  legend: { top: 'bottom', left: 'center' },
  series: [{
    name: '金额',
    type: 'pie',
    radius: ['40%', '70%'],
    center: ['50%', '50%'],
    avoidLabelOverlap: false,
    itemStyle: {
      borderRadius: 10,
      borderColor: '#fff',
      borderWidth: 2
    },
    label: { show: false, position: 'center' },
    emphasis: {
      label: { show: true, fontSize: 20, fontWeight: 'bold' }
    },
    labelLine: { show: false },
    data: data.map(item => ({ value: item.value, name: item.name })),
  }],
});

const fetchPaymentSummary = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  paymentSummary.loading = true;
  paymentSummary.chartOption = null;
  try {
    const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
    const data = await getPaymentSummary(params);
    paymentSummary.data = data;
    if (data.length > 0) {
      paymentSummary.chartOption = generatePieOption('支付方式构成', data);
    }
  } finally {
    paymentSummary.loading = false;
  }
};

const fetchCardSalesSummary = async () => {
  if (!dateRange.value || dateRange.value.length !== 2) return;
  cardSalesSummary.loading = true;
  cardSalesSummary.chartOption = null;
  try {
    const params = { startDate: dateRange.value[0], endDate: dateRange.value[1] };
    const data = await getCardSalesSummary(params);
    cardSalesSummary.data = data;
    if (data.length > 0) {
      cardSalesSummary.chartOption = generatePieOption('会员卡销售统计', data);
    }
  } finally {
    cardSalesSummary.loading = false;
  }
};

const fetchServiceRanking = async (reset = true) => {
  if (reset) {
    serviceRanking.loading = true;
    serviceRanking.page = 1;
    serviceRanking.data = [];
  }
  
  try {
    const params = { 
      page: serviceRanking.page, 
      limit: 25,
      ...(dateRange.value && dateRange.value.length === 2 && {
        startDate: dateRange.value[0],
        endDate: dateRange.value[1]
      })
    };
    const response = await getServiceRanking(params);
    
    if (reset) {
      serviceRanking.data = response.data || [];
    } else {
      serviceRanking.data.push(...(response.data || []));
    }
    
    serviceRanking.hasMore = response.pagination?.hasMore || false;
  } finally {
    serviceRanking.loading = false;
  }
};

const fetchMemberRanking = async (reset = true) => {
  if (reset) {
    memberRanking.loading = true;
    memberRanking.page = 1;
    memberRanking.data = [];
  }
  
  try {
    const params = { 
      page: memberRanking.page, 
      limit: 25,
      ...(dateRange.value && dateRange.value.length === 2 && {
        startDate: dateRange.value[0],
        endDate: dateRange.value[1]
      })
    };
    const response = await getMemberRanking(params);
    
    if (reset) {
      memberRanking.data = response.data || [];
    } else {
      memberRanking.data.push(...(response.data || []));
    }
    
    memberRanking.hasMore = response.pagination?.hasMore || false;
  } finally {
    memberRanking.loading = false;
  }
};

const fetchBirthdayReminders = async () => {
  birthdayReminders.loading = true;
  try {
    birthdayReminders.data = await getBirthdayReminders();
  } finally {
    birthdayReminders.loading = false;
  }
};

const fetchSleepingMembers = async (reset = true) => {
  if (reset) {
    sleepingMembers.loading = true;
    sleepingMembers.page = 1;
    sleepingMembers.data = [];
  }
  
  try {
    const params = { page: sleepingMembers.page, limit: 25 };
    const response = await getSleepingMembers(params);
    
    if (reset) {
      sleepingMembers.data = response.data || [];
    } else {
      sleepingMembers.data.push(...(response.data || []));
    }
    
    sleepingMembers.hasMore = response.pagination?.hasMore || false;
  } finally {
    sleepingMembers.loading = false;
  }
};

const fetchPendingStats = async (reset = true) => {
  if (reset) {
    pendingStats.loading = true;
    pendingStats.page = 1;
    pendingStats.data = [];
  } else {
    pendingStats.loadingMore = true;
  }
  
  try {
    const params = { page: pendingStats.page, limit: 25 };
    const response = await getPendingStats(params);
    
    if (reset) {
      pendingStats.data = response.data || [];
      pendingStats.summary = response.summary || {
        totalAmount: 0,
        memberCount: 0,
        recordCount: 0,
        averageAmount: 0
      };
    } else {
      pendingStats.data.push(...(response.data || []));
    }
    
    pendingStats.total = response.total || 0;
    pendingStats.hasMore = response.hasMore || false;
  } catch (error) {
    // Error loading pending stats - handled silently
    if (reset) {
      pendingStats.data = [];
      pendingStats.summary = {
        totalAmount: 0,
        memberCount: 0,
        recordCount: 0,
        averageAmount: 0
      };
    }
  } finally {
    pendingStats.loading = false;
    pendingStats.loadingMore = false;
  }
};

const loadMorePendingStats = async () => {
  if (pendingStats.loadingMore || !pendingStats.hasMore) return;
  
  pendingStats.page++;
  await fetchPendingStats(false);
};

// --- 日期控制 ---
const handleDateChange = () => {
    quickDate.value = ''; 
    reloadCurrentTabData();
};

const handleQuickDateChange = (value) => {
  const today = new Date();
  let start, end;
  switch (value) {
    case 'today':
      start = today; end = today; break;
    case 'this_week': {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
      start = new Date(today.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'this_quarter': {
      const currentMonth = today.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      start = new Date(today.getFullYear(), quarterStartMonth, 1);
      end = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
      break;
    }
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
  }
  const formatDate = (d) => d.toISOString().split('T')[0];
  dateRange.value = [formatDate(start), formatDate(end)];
  reloadCurrentTabData();
};

const reloadCurrentTabData = () => {
  // 根据当前激活的Tab，调用对应的加载函数
  const tabLoadFunctions = {
    business: () => {
      fetchBusinessData(true);
    },
    paymentSummary: fetchPaymentSummary,
    cardSalesSummary: fetchCardSalesSummary,
    serviceRanking: () => fetchServiceRanking(true),
    memberRanking: () => fetchMemberRanking(true),
  };
  const loadFunc = tabLoadFunctions[activeTab.value];
  if (loadFunc) {
    loadFunc();
  }
};

onMounted(async () => {
  // 加载系统配置
  try {
    systemConfig.value = await getSystemConfig();
  } catch (e) {
    console.error('获取系统配置失败:', e);
  }

  handleQuickDateChange('today');
  // 设置页面滚动监听
  scrollCleanup = setupScrollListener();
});

onUnmounted(() => {
  // 清理滚动监听器
  if (scrollCleanup) {
    scrollCleanup();
  }
});

watch(activeTab, (newTab) => {
  const dataStores = {
    business: transactionList,
    paymentSummary,
    cardSalesSummary,
    serviceRanking,
    memberRanking,
    birthdayReminders,
    sleepingMembers,
    pendingStats
  };
  const dataStore = dataStores[newTab];

  // 切换Tab时，如果它依赖日期，就重新加载数据；如果它不依赖日期且未加载过，也加载数据
  if (dateFilterTabs.includes(newTab)) {
    reloadCurrentTabData();
  } else if (dataStore && (!dataStore.data || dataStore.data.length === 0)) {
    const tabLoadFunctions = {
      serviceRanking: fetchServiceRanking,
      memberRanking: fetchMemberRanking,
      birthdayReminders: fetchBirthdayReminders,
      sleepingMembers: fetchSleepingMembers,
      pendingStats: fetchPendingStats,
    };
    const loadFunc = tabLoadFunctions[newTab];
    if (loadFunc) {
      loadFunc();
    }
  }
  
  // 当切换到业务概览tab时，确保滚动监听是激活的
  if (newTab === 'business' && !scrollCleanup) {
    scrollCleanup = setupScrollListener();
  }
  // 当离开业务概览tab时，清理滚动监听避免误触发
  else if (newTab !== 'business' && scrollCleanup) {
    scrollCleanup();
    scrollCleanup = null;
  }
});

// --- 加载更多函数 ---
const loadMoreServiceRanking = async () => {
  if (serviceRanking.loadingMore || !serviceRanking.hasMore) return;
  
  serviceRanking.loadingMore = true;
  serviceRanking.page++;
  
  try {
    await fetchServiceRanking(false);
  } finally {
    serviceRanking.loadingMore = false;
  }
};

const loadMoreMemberRanking = async () => {
  if (memberRanking.loadingMore || !memberRanking.hasMore) return;
  
  memberRanking.loadingMore = true;
  memberRanking.page++;
  
  try {
    await fetchMemberRanking(false);
  } finally {
    memberRanking.loadingMore = false;
  }
};

const loadMoreSleepingMembers = async () => {
  if (sleepingMembers.loadingMore || !sleepingMembers.hasMore) return;
  
  sleepingMembers.loadingMore = true;
  sleepingMembers.page++;
  
  try {
    await fetchSleepingMembers(false);
  } finally {
    sleepingMembers.loadingMore = false;
  }
};

// --- 批量清账提示相关方法 ---
const isBatchClear = (transaction) => {
  return transaction.transactionType === 'PENDING_CLEAR' && 
         transaction.summary && 
         transaction.summary.includes('批量清账') &&
         transaction.notes;
};

const getBatchClearTooltip = (transaction) => {
  if (!isBatchClear(transaction)) return '';
  
  // 如果summary已经包含详细信息，直接显示
  if (transaction.summary && transaction.summary.includes('(¥')) {
    return transaction.summary.replace(/、/g, '\n• ').replace('批量清账：', '批量清账明细：\n• ');
  }
  
  return transaction.summary;
};

// 判断是否为手动设置的时间
const isManualTime = (row) => {
  // 通过备注中是否包含[手动设置时间]标记来判断
  return row.notes && row.notes.includes('[手动设置时间]');
};

// 获取时间tooltip内容
const getTimeTooltip = (row) => {
  const fullTime = formatFullDateTimeInAppTimeZone(row.transactionTime);
  if (isManualTime(row)) {
    return `${fullTime} (此交易时间为手动设置)`;
  }
  return fullTime;
};
</script>

<style scoped>
.page-content { display: flex; flex-direction: column; gap: 20px; }
.page-header { border-bottom: 1px solid #e4e7ed; padding-bottom: 15px; }
.page-title { font-size: 22px; margin: 0; color: #303133; }
.global-filter-container {
  padding: 15px 20px;
  background-color: #fafafa;
  border-radius: 6px;
  margin-bottom: 0px; /* 调整间距 */
}
.report-tabs { flex-grow: 1; display: flex; flex-direction: column; }
.report-tabs :deep(.el-tabs__content) { flex-grow: 1; overflow-y: auto; padding-top: 20px;}
.stats-cards { padding: 20px; background-color: #fafafa; border-radius: 6px; }
.el-statistic { text-align: center; }
.tip { color: #909399; font-size: 14px; margin-bottom: 15px; }
.date-filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.date-filter-form .el-form-item {
  display: flex;
  align-items: center;
  margin-bottom: 0;
}
.transaction-list-container {
    margin-top: 30px;
}
.transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    gap: 20px;
    flex-wrap: wrap;
    padding-bottom: 15px;
    border-bottom: 1px solid #e4e7ed;
}
.section-title {
    font-size: 18px;
    color: #303133;
    margin: 0;
    padding: 0;
    border: none;
    flex: 1;
    min-width: 200px;
}
.member-filter-form {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}
.member-filter-form .el-form-item {
    display: flex;
    align-items: center;
    margin-bottom: 0;
}
.filter-info {
    font-size: 14px;
    color: #909399;
    font-weight: normal;
    margin-left: 10px;
}

.chart-table-layout {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}
.chart-container {
  flex: 1;
  min-width: 300px;
  height: 400px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background-color: #fff;
}
.table-container {
  flex: 1;
  min-width: 300px;
}

.paid-amount { 
  font-weight: 500; 
  color: #E6A23C; 
}

.adjustment-reason {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  line-height: 1.2;
}

.pagination-section {
  padding: 20px;
  text-align: center;
  border-top: 1px solid #e4e7ed;
  background-color: #fafafa;
}

.load-more-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.all-loaded {
  color: #909399;
  font-size: 14px;
  padding: 10px 0;
}

.multi-card-payment {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mt-2 {
  margin-top: 8px;
}

.multi-card-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.multi-card-details {
  font-size: 10px;
  color: #909399;
  line-height: 1.2;
}

.multi-card-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.multi-card-list .card-item {
  display: flex;
  margin-bottom: 2px;
  width: 100%;
}

.card-tag {
  max-width: 100%;
  word-wrap: break-word;
  word-break: break-all;
  white-space: normal;
  line-height: 1.2;
  height: auto;
  padding: 2px 6px;
  display: inline-block;
  overflow: visible;
}

/* 挂账统计样式 */
.pending-summary {
  margin-bottom: 20px;
}

.pending-amount {
  font-weight: bold;
  color: #f56c6c;
}

.pending-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.2;
}

.payment-amount {
  font-weight: bold;
  color: #f56c6c;
  min-width: 60px;
}

.payment-date {
  color: #909399;
  font-size: 11px;
  min-width: 80px;
}

.payment-desc {
  color: #606266;
  font-size: 12px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-payments {
  color: #909399;
  font-size: 11px;
  font-style: italic;
  margin-top: 2px;
}

/* 备注列样式 */
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.note-item {
  font-size: 12px;
  line-height: 1.2;
}

.note-desc {
  color: #606266;
}

.no-desc {
  color: #C0C4CC;
  font-style: italic;
}

.more-notes {
  color: #909399;
  font-size: 11px;
  font-style: italic;
  margin-top: 2px;
}

/* 挂账和清账记录样式 */
.pending-record {
  color: #f56c6c;
}

.clear-record {
  color: #67c23a;
}

.clear-amount {
  color: #67c23a !important;
}

/* 服务项目文字显示样式 */
.service-items-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

/* 手动设置时间的样式 */
.manual-time {
  color: #e6a23c !important; /* 橙色，表示需要注意 */
  font-weight: 500;
  display: inline-flex;
  align-items: center;
}

/* 撤销对话框样式 */
.void-info .amount {
  font-weight: bold;
  color: #f56c6c;
}

/* 撤销按钮样式 */
.void-btn {
  color: #f56c6c !important;
  font-weight: 500;
  border: 1px solid #f56c6c !important;
  padding: 4px 10px !important;
  border-radius: 4px;
}

.void-btn:hover {
  color: #fff !important;
  background-color: #f56c6c !important;
}

.void-btn-disabled {
  color: #c0c4cc !important;
  border-color: #e4e7ed !important;
  cursor: not-allowed;
}

.void-btn-disabled:hover {
  color: #c0c4cc !important;
  background-color: transparent !important;
}

</style>