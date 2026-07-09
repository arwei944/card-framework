(function(window) {
  'use strict';

  const TaskManagerPlugin = {
    name: 'task-manager',
    version: '1.0.0',
    description: '任务管理插件，提供增强的任务卡片类型和任务统计功能',
    author: 'CardFrame Team',

    install(frame) {
      const pluginInstance = {
        frame: frame,

        getTaskStats() {
          const allCards = frame.store.getAllCards();
          const taskItems = allCards.filter(c => c.type === 'task-item' || c.type === 'task');

          const total = taskItems.length;
          const completed = taskItems.filter(c => c.status === 'completed').length;
          const highPriority = taskItems.filter(c => c.props.priority === 'high' && c.status !== 'completed').length;

          const now = Date.now();
          const overdue = taskItems.filter(c => {
            if (c.status === 'completed') return false;
            if (!c.props.dueDate) return false;
            const dueTime = new Date(c.props.dueDate).getTime();
            return !isNaN(dueTime) && dueTime < now;
          }).length;

          return { total, completed, highPriority, overdue };
        },

        completeAll() {
          const allCards = frame.store.getAllCards();
          const taskItems = allCards.filter(c => 
            (c.type === 'task-item' || c.type === 'task') && c.status !== 'completed'
          );

          taskItems.forEach(card => {
            card.status = 'completed';
            frame.store.updateCard(card);
          });

          return taskItems.length;
        },

        clearCompleted() {
          const allCards = frame.store.getAllCards();
          const completedTasks = allCards.filter(c => 
            (c.type === 'task-item' || c.type === 'task') && c.status === 'completed'
          );

          completedTasks.forEach(card => {
            frame.store.removeCard(card.id);
          });

          return completedTasks.length;
        },

        togglePriority(cardId) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          const priorities = ['low', 'medium', 'high'];
          const currentIndex = priorities.indexOf(card.props.priority || 'medium');
          const nextIndex = (currentIndex + 1) % priorities.length;
          card.props.priority = priorities[nextIndex];

          return frame.store.updateCard(card);
        },

        setDueDate(cardId, dueDate) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          card.props.dueDate = dueDate;
          return frame.store.updateCard(card);
        },

        addTag(cardId, tag) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          let tags = card.props.tags;
          if (!tags) {
            tags = [];
          } else if (typeof tags === 'string') {
            try {
              tags = JSON.parse(tags);
            } catch {
              tags = tags.split(',').map(t => t.trim());
            }
          }

          if (!Array.isArray(tags)) tags = [];

          if (!tags.includes(tag)) {
            tags.push(tag);
            card.props.tags = JSON.stringify(tags);
            return frame.store.updateCard(card);
          }

          return card;
        },

        removeTag(cardId, tag) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          let tags = card.props.tags;
          if (!tags) return card;

          if (typeof tags === 'string') {
            try {
              tags = JSON.parse(tags);
            } catch {
              tags = tags.split(',').map(t => t.trim());
            }
          }

          if (!Array.isArray(tags)) return card;

          tags = tags.filter(t => t !== tag);
          card.props.tags = JSON.stringify(tags);
          return frame.store.updateCard(card);
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
          { name: 'priority', type: 'string', required: false, label: '优先级', allowedValues: ['high', 'medium', 'low'], defaultValue: 'medium' },
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
              <p class="card-due-date" style="display: {{dueDate ? 'block' : 'none'}};">
                📅 截止: {{dueDate}}
              </p>
              <div class="card-tags" style="display: {{tags && tags.length > 0 ? 'flex' : 'none'}}; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
              </div>
            </div>
            <div class="card-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-complete" data-action="complete">完成</button>
              <button class="btn btn-secondary" data-action="togglePriority">切换优先级</button>
              <button class="btn btn-secondary" data-action="addTag">添加标签</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'complete',
            label: '完成',
            handler: (card) => {
              card.status = card.status === 'completed' ? 'active' : 'completed';
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          },
          {
            name: 'togglePriority',
            label: '切换优先级',
            handler: (card) => {
              const priorities = ['low', 'medium', 'high'];
              const currentIndex = priorities.indexOf(card.props.priority || 'medium');
              const nextIndex = (currentIndex + 1) % priorities.length;
              card.props.priority = priorities[nextIndex];
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          },
          {
            name: 'addTag',
            label: '添加标签',
            handler: (card) => {
              const tag = prompt('输入标签名称：');
              if (!tag) return;

              let tags = card.props.tags;
              if (!tags) {
                tags = [];
              } else if (typeof tags === 'string') {
                try {
                  tags = JSON.parse(tags);
                } catch {
                  tags = tags.split(',').map(t => t.trim());
                }
              }
              if (!Array.isArray(tags)) tags = [];

              if (!tags.includes(tag)) {
                tags.push(tag);
                card.props.tags = JSON.stringify(tags);
                const store = card.store || CardFrame._globalStore;
                if (store) store.updateCard(card);
              }
            }
          }
        ],
        defaultStyle: {}
      }
    ],

    hooks: {
      beforeCardAdd(card, frame) {
        if (card.type !== 'task-item' && card.type !== 'task') {
          return card;
        }

        if (card.props && card.props.dueDate) {
          const dueDate = new Date(card.props.dueDate);
          if (isNaN(dueDate.getTime())) {
            console.warn('[TaskManager] 截止日期格式无效，已清空');
            card.props.dueDate = '';
          }
        }

        return card;
      }
    },

    uninstall(frame, instance) {
    },

    enable(frame, instance) {
    },

    disable(frame, instance) {
    }
  };

  if (!window.CardFramePlugins) {
    window.CardFramePlugins = {};
  }
  window.CardFramePlugins['task-manager'] = TaskManagerPlugin;

})(window);
