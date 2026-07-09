/**
 * CardFrame Shared Interactions - 公共交互行为库
 * 所有项目共享的卡片交互行为
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const SharedInteractions = {
    /**
     * 安装所有共享交互到 CardFrame 实例
     * @param {CardFrame} frame - CardFrame 实例
     */
    install(frame) {
      this._installMinimizeClose(frame);
      this._installDragReorder(frame);
      this._installSpanToggle(frame);
      this._installTaskToggle(frame);
      this._installAIChatActions(frame);
      this._installNotesEditor(frame);
    },

    /**
     * 1.4.1 最小化/关闭行为
     */
    _installMinimizeClose(frame) {
      frame.container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="minimize"], [data-action="close"]');
        if (!btn) return;

        const cardEl = btn.closest('.cf-card, cf-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId || cardEl.getAttribute('data-card-id');
        const action = btn.dataset.action;

        if (action === 'minimize') {
          cardEl.classList.toggle('cf-minimized');
          const body = cardEl.querySelector('.cf-card-body');
          if (body) {
            body.style.display = cardEl.classList.contains('cf-minimized') ? 'none' : '';
          }
          frame.eventBus.emit('card:minimized', { cardId, minimized: cardEl.classList.contains('cf-minimized') });
        }

        if (action === 'close') {
          cardEl.style.transition = 'opacity 0.2s ease';
          cardEl.style.opacity = '0';
          setTimeout(() => {
            frame.removeCard(cardId);
          }, 200);
        }
      });
    },

    /**
     * 1.4.2 拖拽排序行为
     */
    _installDragReorder(frame) {
      let dragCard = null;
      let dragOffset = { x: 0, y: 0 };
      let placeholder = null;

      frame.container.addEventListener('mousedown', (e) => {
        const header = e.target.closest('.cf-card-header');
        if (!header) return;
        const cardEl = header.closest('.cf-card, cf-card');
        if (!cardEl) return;

        // 只响应 header 拖拽，不响应按钮
        if (e.target.closest('button')) return;

        dragCard = cardEl;
        const rect = cardEl.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        cardEl.style.position = 'relative';
        cardEl.style.zIndex = '1000';
        cardEl.style.cursor = 'grabbing';
        cardEl.classList.add('cf-dragging');

        // 创建占位符
        placeholder = document.createElement('div');
        placeholder.className = 'cf-card-placeholder';
        placeholder.style.height = rect.height + 'px';
        placeholder.style.margin = getComputedStyle(cardEl).margin;
        cardEl.parentNode.insertBefore(placeholder, cardEl.nextSibling);

        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!dragCard) return;

        const container = frame.container;
        const containerRect = container.getBoundingClientRect();
        const x = e.clientX - containerRect.left - dragOffset.x;
        const y = e.clientY - containerRect.top - dragOffset.y;

        dragCard.style.transform = `translate(${x}px, ${y}px)`;

        // 找到最近的插入位置
        const cards = Array.from(container.querySelectorAll('.cf-card, cf-card'));
        let closest = null;
        let closestDist = Infinity;

        cards.forEach(c => {
          if (c === dragCard) return;
          const rect = c.getBoundingClientRect();
          const dist = Math.abs(e.clientY - (rect.top + rect.height / 2));
          if (dist < closestDist) {
            closestDist = dist;
            closest = c;
          }
        });

        if (closest && placeholder) {
          const closestRect = closest.getBoundingClientRect();
          if (e.clientY < closestRect.top + closestRect.height / 2) {
            closest.parentNode.insertBefore(placeholder, closest);
          } else {
            closest.parentNode.insertBefore(placeholder, closest.nextSibling);
          }
        }
      });

      document.addEventListener('mouseup', () => {
        if (!dragCard) return;

        if (placeholder) {
          placeholder.parentNode.insertBefore(dragCard, placeholder);
          placeholder.remove();
        }

        dragCard.style.position = '';
        dragCard.style.zIndex = '';
        dragCard.style.transform = '';
        dragCard.style.cursor = '';
        dragCard.classList.remove('cf-dragging');

        dragCard = null;
        placeholder = null;

        // 触发重排
        frame.eventBus.emit('cards:reordered', {});
      });
    },

    /**
     * 1.4.3 缩放（span-1/span-2）行为
     */
    _installSpanToggle(frame) {
      frame.container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="toggle-span"]');
        if (!btn) return;

        const cardEl = btn.closest('.cf-card, cf-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId || cardEl.getAttribute('data-card-id');
        const card = frame.store.getCard(cardId);
        if (!card) return;

        const newSpan = card.props.span === 'span-2' ? 'span-1' : 'span-2';
        frame.updateCardProps(cardId, { span: newSpan });

        cardEl.classList.remove('cf-span-1', 'cf-span-2');
        cardEl.classList.add(`cf-span-${newSpan === 'span-2' ? '2' : '1'}`);

        frame.eventBus.emit('card:spanChanged', { cardId, span: newSpan });
      });
    },

    /**
     * 2.2.1 任务勾选完成行为
     */
    _installTaskToggle(frame) {
      frame.container.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.cf-task-check');
        if (!checkbox) return;

        const cardEl = checkbox.closest('.cf-card, cf-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId || cardEl.getAttribute('data-card-id');
        const taskId = checkbox.closest('[data-task-id]')?.dataset.taskId;
        const done = checkbox.checked;

        // 更新任务状态
        const card = frame.store.getCard(cardId);
        if (card && card.props.tasks) {
          const tasks = card.props.tasks.map(t => {
            if (taskId && t.id === taskId) return { ...t, done };
            if (!taskId && t.text === checkbox.nextElementSibling?.textContent) return { ...t, done };
            return t;
          });

          // 计算进度
          const completed = tasks.filter(t => t.done).length;
          const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

          frame.updateCardProps(cardId, {
            tasks,
            progress,
            badge: `${completed}/${tasks.length}`
          });

          frame.eventBus.emit('task:toggled', { cardId, taskId, done, progress });
        }
      });
    },

    /**
     * 2.2.3 AI 管家快捷操作按钮行为
     */
    _installAIChatActions(frame) {
      frame.container.addEventListener('click', (e) => {
        const btn = e.target.closest('.cf-action-btn');
        if (!btn) return;

        const cardEl = btn.closest('.cf-card, cf-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId || cardEl.getAttribute('data-card-id');
        const card = frame.store.getCard(cardId);
        if (!card || card.type !== 'ai-chat') return;

        const action = btn.dataset.action || btn.textContent.trim();

        const aiReplies = {
          '本周报告': '正在为你生成本周学习报告，请稍候...',
          '调整目标': '好的，让我们一起来调整你的学习目标。你希望重点提升哪些方面？',
          '查看任务': '好的，正在为你跳转到今日任务列表。'
        };

        const replyText = aiReplies[action] || `好的，正在为你处理：${action}`;

        const messages = [...(card.props.messages || []), {
          role: 'ai',
          text: replyText,
          timestamp: Date.now()
        }];

        frame.updateCardProps(cardId, { messages });

        frame.eventBus.emit('ai:action', { cardId, action, replyText });

        if (action === '查看任务') {
          const todoCards = frame.store.getCardsByType('todo-list');
          if (todoCards && todoCards.length > 0) {
            const targetCard = todoCards[0];
            const targetEl = frame.container.querySelector(`[data-card-id="${targetCard.id}"]`);
            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              targetEl.classList.add('cf-highlight');
              setTimeout(() => {
                targetEl.classList.remove('cf-highlight');
              }, 2000);
              frame.eventBus.emit('card:highlighted', { cardId: targetCard.id });
            }
          }
        }
      });
    },

    /**
     * 2.2.4 笔记编辑器输入行为
     */
    _installNotesEditor(frame) {
      const debounceMap = new Map();

      frame.container.addEventListener('input', (e) => {
        const textarea = e.target.closest('.cf-notes-area');
        if (!textarea) return;

        const cardEl = textarea.closest('.cf-card, cf-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId || cardEl.getAttribute('data-card-id');
        const card = frame.store.getCard(cardId);
        if (!card || card.type !== 'notes') return;

        const content = textarea.value;
        const now = new Date();
        const lastEdited = now.toLocaleString('zh-CN');

        if (debounceMap.has(cardId)) {
          clearTimeout(debounceMap.get(cardId));
        }

        const timeoutId = setTimeout(() => {
          frame.updateCardProps(cardId, { content, lastEdited });
          frame.eventBus.emit('notes:changed', { cardId, content, lastEdited });
          debounceMap.delete(cardId);
        }, 200);

        debounceMap.set(cardId, timeoutId);
      });
    }
  };

  // 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedInteractions;
  }
  global.CardFrameSharedInteractions = SharedInteractions;

})(typeof window !== 'undefined' ? window : this);
