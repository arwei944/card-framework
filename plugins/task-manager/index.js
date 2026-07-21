/**
 * Task Manager plugin (ESM) — enhanced task types + stats helpers.
 *
 * Usage:
 *   import { taskManagerPlugin } from './plugins/task-manager/index.js';
 *   frame.installPlugin(taskManagerPlugin);
 *
 * Declares permissions for sandbox-friendly installs when
 * `allowedPluginPermissions` is configured on the frame.
 */

export const taskManagerPlugin = {
  name: 'task-manager',
  version: '1.1.0',
  description: '任务管理插件：增强任务卡片类型与任务统计（ESM + 声明权限）',
  author: 'CardFrame Team',
  permissions: ['store:read', 'store:write', 'types:register', 'events:on'],

  install(frame, context) {
    // Prefer sandbox context store when available
    const storeApi = context && context.store ? context.store : frame.store;

    const pluginInstance = {
      frame,
      context: context || null,

      getTaskStats() {
        const allCards = (storeApi.getAllCards ? storeApi.getAllCards() : frame.getAllCards());
        const taskItems = allCards.filter(c => c.type === 'task-item' || c.type === 'task');
        const total = taskItems.length;
        const completed = taskItems.filter(c => c.status === 'completed').length;
        const highPriority = taskItems.filter(
          c => c.props.priority === 'high' && c.status !== 'completed'
        ).length;
        const now = Date.now();
        const overdue = taskItems.filter(c => {
          if (c.status === 'completed' || !c.props.dueDate) return false;
          const dueTime = new Date(c.props.dueDate).getTime();
          return !isNaN(dueTime) && dueTime < now;
        }).length;
        return { total, completed, highPriority, overdue };
      },

      completeAll() {
        const allCards = frame.getAllCards();
        const taskItems = allCards.filter(
          c => (c.type === 'task-item' || c.type === 'task') && c.status !== 'completed'
        );
        taskItems.forEach(card => {
          frame.updateCard(card.id, { status: 'completed' });
        });
        return taskItems.length;
      },

      clearCompleted() {
        const allCards = frame.getAllCards();
        const completedTasks = allCards.filter(
          c => (c.type === 'task-item' || c.type === 'task') && c.status === 'completed'
        );
        completedTasks.forEach(card => frame.removeCard(card.id));
        return completedTasks.length;
      },

      togglePriority(cardId) {
        const card = frame.getCard(cardId);
        if (!card) return null;
        const priorities = ['low', 'medium', 'high'];
        const currentIndex = priorities.indexOf(card.props.priority || 'medium');
        const nextIndex = (currentIndex + 1) % priorities.length;
        return frame.updateCard(cardId, { priority: priorities[nextIndex] });
      },

      setDueDate(cardId, dueDate) {
        return frame.updateCard(cardId, { dueDate });
      }
    };

    return pluginInstance;
  },

  cardTypes: [
    {
      type: 'task-item',
      label: '任务项',
      icon: '📌',
      description: '增强型任务卡片，支持优先级、截止日期和标签',
      extends: 'task',
      propsSchema: [
        {
          name: 'priority',
          type: 'string',
          required: false,
          label: '优先级',
          allowedValues: ['high', 'medium', 'low'],
          defaultValue: 'medium'
        },
        { name: 'dueDate', type: 'date', required: false, label: '截止日期' },
        { name: 'tags', type: 'array', required: false, label: '标签', defaultValue: '[]' }
      ],
      renderTemplate: `
        <div class="card card-task-item card-priority-{{priority}}">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
            <span class="card-priority-badge">{{priority}}</span>
          </div>
          <div class="card-body">
            <p class="card-due-date">截止: {{dueDate}}</p>
          </div>
          <div class="card-footer">
            <button class="btn btn-complete" data-action="complete">完成</button>
          </div>
        </div>
      `,
      defaultStyle: {}
    }
  ],

  hooks: {
    beforeCardAdd(card) {
      if (card.type !== 'task-item' && card.type !== 'task') return card;
      if (card.props && card.props.dueDate) {
        const dueDate = new Date(card.props.dueDate);
        if (isNaN(dueDate.getTime())) {
          card.props.dueDate = '';
        }
      }
      return card;
    }
  },

  uninstall() {},
  enable() {},
  disable() {}
};

export default taskManagerPlugin;

// Browser global for non-module script tags (optional)
if (typeof window !== 'undefined') {
  window.CardFramePlugins = window.CardFramePlugins || {};
  window.CardFramePlugins.taskManager = taskManagerPlugin;
}
