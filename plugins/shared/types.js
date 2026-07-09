/**
 * CardFrame Shared Types - 公共卡片类型定义
 * 所有项目共享的基础卡片类型
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const SharedTypes = {
    /**
     * 注册所有共享类型到 TypeRegistry
     * @param {TypeRegistry} registry - CardFrame 类型注册中心
     */
    registerAll(registry) {
      // 1.1.1 base 基础类型
      registry.registerType('shared-base', {
        name: 'shared-base',
        label: '基础卡片',
        icon: '📋',
        description: '所有卡片的共享基础类型',
        abstract: true,
        propsSchema: [
          { name: 'title', type: 'string', required: true, label: '标题', defaultValue: '未命名卡片' },
          { name: 'status', type: 'string', required: false, label: '状态', allowedValues: ['active', 'completed', 'archived', 'online', 'offline'], defaultValue: 'active' },
          { name: 'tags', type: 'array', required: false, label: '标签', defaultValue: [] },
          { name: 'createdAt', type: 'number', required: false, label: '创建时间', defaultValue: () => Date.now() },
          { name: 'updatedAt', type: 'number', required: false, label: '更新时间', defaultValue: () => Date.now() },
          { name: 'span', type: 'string', required: false, label: '宽度', allowedValues: ['span-1', 'span-2'], defaultValue: 'span-1' }
        ],
        actions: ['minimize', 'close', 'focus']
      });

      // 1.1.2 header 类型（标题栏组件）
      registry.registerType('shared-header', {
        name: 'shared-header',
        label: '卡片头部',
        icon: '🔖',
        description: '卡片标题栏，包含标题、状态、操作按钮',
        extends: 'shared-base',
        propsSchema: [
          { name: 'showStatus', type: 'boolean', required: false, label: '显示状态', defaultValue: true },
          { name: 'statusColor', type: 'string', required: false, label: '状态颜色', defaultValue: '#10b981' },
          { name: 'actions', type: 'array', required: false, label: '操作按钮', defaultValue: [] },
          { name: 'badge', type: 'string', required: false, label: '徽章', defaultValue: '' }
        ],
        renderTemplate: (card) => {
          const statusDot = card.props.showStatus
            ? `<span class="cf-status-dot" style="background:${card.props.statusColor}"></span>`
            : '';
          const badge = card.props.badge
            ? `<span class="cf-badge">${Utils.escapeHtml(card.props.badge)}</span>`
            : '';
          const actionBtns = (card.props.actions || []).map(a =>
            `<button class="cf-action-btn" data-action="${Utils.escapeHtml(a.action || a)}">${Utils.escapeHtml(a.label || a)}</button>`
          ).join('');

          return `
            <div class="cf-card-header" data-card-id="${card.id}">
              <div class="cf-header-left">
                ${statusDot}
                <h3 class="cf-card-title">${Utils.escapeHtml(card.props.title)}</h3>
                ${badge}
              </div>
              <div class="cf-header-actions">
                ${actionBtns}
                <button class="cf-btn-minimize" data-action="minimize" title="最小化">−</button>
                <button class="cf-btn-close" data-action="close" title="关闭">×</button>
              </div>
            </div>
          `;
        }
      });

      // 1.1.3 chat-message 子类型
      registry.registerType('shared-chat-message', {
        name: 'shared-chat-message',
        label: '聊天消息',
        icon: '💬',
        description: 'AI/User 对话消息组件',
        extends: 'shared-base',
        propsSchema: [
          { name: 'role', type: 'string', required: true, label: '角色', allowedValues: ['ai', 'user', 'system'], defaultValue: 'ai' },
          { name: 'text', type: 'string', required: true, label: '消息内容', defaultValue: '' },
          { name: 'timestamp', type: 'number', required: false, label: '时间戳', defaultValue: () => Date.now() },
          { name: 'avatar', type: 'string', required: false, label: '头像', defaultValue: '' }
        ],
        renderTemplate: (card) => {
          const isAI = card.props.role === 'ai';
          const roleClass = isAI ? 'cf-msg-ai' : 'cf-msg-user';
          const avatar = card.props.avatar || (isAI ? '🤖' : '👤');
          const time = card.props.timestamp
            ? new Date(card.props.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '';

          return `
            <div class="cf-chat-message ${roleClass}" data-card-id="${card.id}">
              <div class="cf-msg-avatar">${avatar}</div>
              <div class="cf-msg-content">
                <div class="cf-msg-text">${Utils.escapeHtml(card.props.text)}</div>
                <div class="cf-msg-time">${time}</div>
              </div>
            </div>
          `;
        }
      });

      // 1.1.4 task-item 子类型
      registry.registerType('shared-task-item', {
        name: 'shared-task-item',
        label: '任务项',
        icon: '☑️',
        description: '任务列表中的单个任务项',
        extends: 'shared-base',
        propsSchema: [
          { name: 'text', type: 'string', required: true, label: '任务内容', defaultValue: '' },
          { name: 'time', type: 'string', required: false, label: '预计时间', defaultValue: '' },
          { name: 'done', type: 'boolean', required: false, label: '是否完成', defaultValue: false },
          { name: 'priority', type: 'string', required: false, label: '优先级', allowedValues: ['high', 'medium', 'low'], defaultValue: 'medium' }
        ],
        renderTemplate: (card) => {
          const checked = card.props.done ? 'checked' : '';
          const textClass = card.props.done ? 'cf-task-done' : '';
          const priorityClass = `cf-priority-${card.props.priority}`;

          return `
            <div class="cf-task-item ${priorityClass}" data-card-id="${card.id}">
              <input type="checkbox" class="cf-task-check" ${checked} data-action="toggle-task">
              <span class="cf-task-text ${textClass}">${Utils.escapeHtml(card.props.text)}</span>
              ${card.props.time ? `<span class="cf-task-time">${Utils.escapeHtml(card.props.time)}</span>` : ''}
            </div>
          `;
        }
      });

      // 知识库列表项
      registry.registerType('shared-kb-item', {
        name: 'shared-kb-item',
        label: '知识库项',
        icon: '📚',
        description: '知识库列表中的单条知识',
        extends: 'shared-base',
        propsSchema: [
          { name: 'name', type: 'string', required: true, label: '知识名称', defaultValue: '' },
          { name: 'status', type: 'string', required: false, label: '审核状态', allowedValues: ['待审核', '已审核', '已驳回'], defaultValue: '待审核' },
          { name: 'color', type: 'string', required: false, label: '标签颜色', defaultValue: 'blue' },
          { name: 'category', type: 'string', required: false, label: '分类', defaultValue: '' }
        ],
        renderTemplate: (card) => {
          const statusClass = `cf-status-${card.props.status}`;
          return `
            <div class="cf-kb-item" data-card-id="${card.id}">
              <span class="cf-kb-dot" style="background:var(--mc-${card.props.color}-700, #4A90E2)"></span>
              <span class="cf-kb-name">${Utils.escapeHtml(card.props.name)}</span>
              <span class="cf-kb-status ${statusClass}">${Utils.escapeHtml(card.props.status)}</span>
            </div>
          `;
        }
      });

      // 能力维度条
      registry.registerType('shared-dimension-bar', {
        name: 'shared-dimension-bar',
        label: '能力维度',
        icon: '📊',
        description: '能力维度进度条',
        extends: 'shared-base',
        propsSchema: [
          { name: 'dimensionName', type: 'string', required: true, label: '维度名称', defaultValue: '' },
          { name: 'score', type: 'number', required: true, label: '分数', defaultValue: 0 },
          { name: 'color', type: 'string', required: false, label: '颜色', defaultValue: 'blue' },
          { name: 'maxScore', type: 'number', required: false, label: '满分', defaultValue: 100 }
        ],
        renderTemplate: (card) => {
          const pct = Math.min(100, Math.max(0, (card.props.score / card.props.maxScore) * 100));
          return `
            <div class="cf-dimension-bar" data-card-id="${card.id}">
              <div class="cf-dim-label">
                <span>${Utils.escapeHtml(card.props.dimensionName)}</span>
                <span>${card.props.score}/${card.props.maxScore}</span>
              </div>
              <div class="cf-dim-track">
                <div class="cf-dim-fill" style="width:${pct}%;background:var(--mc-${card.props.color}-700, #4A90E2)"></div>
              </div>
            </div>
          `;
        }
      });

      // 进度条组件
      registry.registerType('shared-progress', {
        name: 'shared-progress',
        label: '进度条',
        icon: '⏳',
        description: '通用进度条组件',
        extends: 'shared-base',
        propsSchema: [
          { name: 'value', type: 'number', required: false, label: '当前值', defaultValue: 0 },
          { name: 'max', type: 'number', required: false, label: '最大值', defaultValue: 100 },
          { name: 'label', type: 'string', required: false, label: '标签', defaultValue: '' },
          { name: 'color', type: 'string', required: false, label: '颜色', defaultValue: '#4A90E2' }
        ],
        renderTemplate: (card) => {
          const pct = card.props.max > 0 ? Math.min(100, (card.props.value / card.props.max) * 100) : 0;
          const label = card.props.label || `${card.props.value}/${card.props.max}`;
          return `
            <div class="cf-progress-wrap" data-card-id="${card.id}">
              <div class="cf-progress-label">${Utils.escapeHtml(label)}</div>
              <div class="cf-progress-track">
                <div class="cf-progress-fill" style="width:${pct}%;background:${card.props.color}"></div>
              </div>
            </div>
          `;
        }
      });
    }
  };

  // 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedTypes;
  }
  global.CardFrameSharedTypes = SharedTypes;

})(typeof window !== 'undefined' ? window : this);
