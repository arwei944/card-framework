/**
 * MindCanvas Core Plugin for CardFrame
 * 注册所有 MindCanvas 特定的卡片类型
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const MindCanvasCore = {
    name: 'mindcanvas-core',
    version: '1.0.0',
    dependencies: ['tailwind-integration'],

    install(frame, options = {}) {
      this._frame = frame;
      this._registerTypes(frame);
      this._registerRenderers(frame);
    },

    /**
     * 2.1.1 - 2.1.5 注册所有 MindCanvas 卡片类型
     */
    _registerTypes(frame) {
      const registry = frame.typeRegistry;

      // AI 管家卡片
      registry.registerType('ai-chat', {
        name: 'ai-chat',
        label: 'AI 管家',
        icon: '🤖',
        description: 'AI 智能助手，对话交互',
        extends: 'shared-base',
        propsSchema: [
          { name: 'status', type: 'string', required: false, label: '状态', allowedValues: ['online', 'offline'], defaultValue: 'online' },
          { name: 'messages', type: 'array', required: false, label: '消息列表', defaultValue: [] },
          { name: 'actions', type: 'array', required: false, label: '快捷操作', defaultValue: ['本周报告', '调整目标', '查看任务'] },
          { name: 'inputPlaceholder', type: 'string', required: false, label: '输入提示', defaultValue: '告诉我你需要什么帮助...' }
        ],
        renderTemplate: (card) => this._renderAIChat(card)
      });

      // 今日任务卡片
      registry.registerType('todo-list', {
        name: 'todo-list',
        label: '今日任务',
        icon: '📋',
        description: '今日学习任务列表',
        extends: 'shared-base',
        propsSchema: [
          { name: 'tasks', type: 'array', required: false, label: '任务列表', defaultValue: [] },
          { name: 'progress', type: 'number', required: false, label: '完成进度', defaultValue: 0 },
          { name: 'badge', type: 'string', required: false, label: '徽章', defaultValue: '0/0' }
        ],
        renderTemplate: (card) => this._renderTodoList(card)
      });

      // 知识库卡片
      registry.registerType('knowledge-base', {
        name: 'knowledge-base',
        label: '知识库',
        icon: '📚',
        description: '知识条目管理',
        extends: 'shared-base',
        propsSchema: [
          { name: 'stats', type: 'object', required: false, label: '统计数据', defaultValue: { principles: 0, materials: 0, connections: 0 } },
          { name: 'items', type: 'array', required: false, label: '知识列表', defaultValue: [] }
        ],
        renderTemplate: (card) => this._renderKnowledgeBase(card)
      });

      // 能力库卡片
      registry.registerType('ability-base', {
        name: 'ability-base',
        label: '能力库',
        icon: '💪',
        description: '七维能力评估',
        extends: 'shared-base',
        propsSchema: [
          { name: 'score', type: 'number', required: false, label: '综合分', defaultValue: 0 },
          { name: 'dimensions', type: 'array', required: false, label: '维度数据', defaultValue: [] }
        ],
        renderTemplate: (card) => this._renderAbilityBase(card)
      });

      // 知识地图卡片
      registry.registerType('knowledge-map', {
        name: 'knowledge-map',
        label: '知识地图',
        icon: '🗺️',
        description: '知识图谱可视化',
        extends: 'shared-base',
        propsSchema: [
          { name: 'status', type: 'string', required: false, label: '运行状态', defaultValue: 'AI 运行中' },
          { name: 'nodes', type: 'number', required: false, label: '节点数', defaultValue: 0 },
          { name: 'edges', type: 'number', required: false, label: '连接数', defaultValue: 0 },
          { name: 'svgData', type: 'string', required: false, label: 'SVG 数据', defaultValue: '' }
        ],
        renderTemplate: (card) => this._renderKnowledgeMap(card)
      });

      // 元能力卡片
      registry.registerType('meta-ability', {
        name: 'meta-ability',
        label: '元能力',
        icon: '🧠',
        description: '通用方法论',
        extends: 'shared-base',
        propsSchema: [
          { name: 'items', type: 'array', required: false, label: '方法论列表', defaultValue: [] }
        ],
        renderTemplate: (card) => this._renderMetaAbility(card)
      });

      // 专注模式卡片
      registry.registerType('focus-mode', {
        name: 'focus-mode',
        label: '专注模式',
        icon: '🎯',
        description: '番茄钟计时器',
        extends: 'shared-base',
        propsSchema: [
          { name: 'mode', type: 'string', required: false, label: '模式', allowedValues: ['work', 'break'], defaultValue: 'work' },
          { name: 'duration', type: 'number', required: false, label: '时长(秒)', defaultValue: 1500 },
          { name: 'remaining', type: 'number', required: false, label: '剩余时间', defaultValue: 1500 },
          { name: 'isRunning', type: 'boolean', required: false, label: '是否运行中', defaultValue: false }
        ],
        renderTemplate: (card) => this._renderFocusMode(card)
      });

      // 笔记卡片
      registry.registerType('notes', {
        name: 'notes',
        label: '笔记',
        icon: '📝',
        description: '文本笔记',
        extends: 'shared-base',
        propsSchema: [
          { name: 'content', type: 'string', required: false, label: '内容', defaultValue: '' },
          { name: 'lastEdited', type: 'string', required: false, label: '最后编辑', defaultValue: '' }
        ],
        renderTemplate: (card) => this._renderNotes(card)
      });

      // 日历卡片
      registry.registerType('calendar', {
        name: 'calendar',
        label: '日历',
        icon: '📅',
        description: '月历视图',
        extends: 'shared-base',
        propsSchema: [
          { name: 'currentDate', type: 'number', required: false, label: '当前日期', defaultValue: () => Date.now() },
          { name: 'events', type: 'array', required: false, label: '事件', defaultValue: [] }
        ],
        renderTemplate: (card) => this._renderCalendar(card)
      });
    },

    /**
     * 注册复合渲染器（头部 + 内容）
     */
    _registerRenderers(frame) {
      // 复用 CardFrame 的 Renderer，添加自定义渲染逻辑
      const originalRender = frame.renderer.render;
      frame.renderer.render = (card) => {
        const html = originalRender.call(frame.renderer, card);
        // 包装为完整卡片结构
        return this._wrapCard(card, html);
      };
    },

    _wrapCard(card, contentHtml) {
      const span = card.props.span || 'span-1';
      return `
        <div class="cf-card cf-tailwind-card cf-${span}" data-card-id="${card.id}" data-type="${card.type}">
          ${this._renderHeader(card)}
          <div class="cf-card-body">
            ${contentHtml}
          </div>
        </div>
      `;
    },

    _renderHeader(card) {
      const statusColor = card.props.status === 'online' ? 'var(--cf-status-online, #10b981)' : 'var(--cf-status-offline, #6b7280)';
      const badge = card.props.badge ? `<span class="cf-badge">${Utils.escapeHtml(card.props.badge)}</span>` : '';
      return `
        <div class="cf-card-header">
          <div class="cf-header-left">
            <span class="cf-status-dot" style="background:${statusColor}"></span>
            <h3 class="cf-card-title">${Utils.escapeHtml(card.props.title)}</h3>
            ${badge}
          </div>
          <div class="cf-header-actions">
            <button class="cf-btn-minimize" data-action="minimize" title="最小化">−</button>
            <button class="cf-btn-close" data-action="close" title="关闭">×</button>
          </div>
        </div>
      `;
    },

    _renderAIChat(card) {
      const messages = (card.props.messages || []).map(msg => {
        const isAI = msg.role === 'ai';
        return `
          <div class="cf-chat-message ${isAI ? 'cf-msg-ai' : 'cf-msg-user'}">
            <div class="cf-msg-avatar">${isAI ? '🤖' : '👤'}</div>
            <div class="cf-msg-content">
              <div class="cf-msg-text">${Utils.escapeHtml(msg.text)}</div>
            </div>
          </div>
        `;
      }).join('');

      const actions = (card.props.actions || []).map(a =>
        `<button class="cf-action-btn" data-action="${Utils.escapeHtml(a)}">${Utils.escapeHtml(a)}</button>`
      ).join('');

      return `
        <div class="cf-ai-chat">
          <div class="cf-chat-messages">${messages}</div>
          <div class="cf-chat-actions">${actions}</div>
          <div class="cf-chat-input-wrap">
            <input type="text" class="cf-chat-input" placeholder="${Utils.escapeHtml(card.props.inputPlaceholder || '')}">
            <button class="cf-chat-send" data-action="send">➤</button>
          </div>
        </div>
      `;
    },

    _renderTodoList(card) {
      const tasks = (card.props.tasks || []).map((task, idx) => {
        const checked = task.done ? 'checked' : '';
        const textClass = task.done ? 'cf-task-done' : '';
        return `
          <div class="cf-task-item" data-task-id="${task.id || idx}">
            <input type="checkbox" class="cf-task-check" ${checked} data-action="toggle-task">
            <span class="cf-task-text ${textClass}">${Utils.escapeHtml(task.text)}</span>
            ${task.time ? `<span class="cf-task-time">${Utils.escapeHtml(task.time)}</span>` : ''}
          </div>
        `;
      }).join('');

      const progress = card.props.progress || 0;
      const completed = (card.props.tasks || []).filter(t => t.done).length;
      const total = (card.props.tasks || []).length;

      return `
        <div class="cf-todo-list">
          ${tasks}
          <div class="cf-progress-wrap">
            <div class="cf-progress-label">
              <span>完成进度</span>
              <span>${completed}/${total}</span>
            </div>
            <div class="cf-progress-track">
              <div class="cf-progress-fill" style="width:${progress}%;background:var(--cf-green-700, #059669)"></div>
            </div>
          </div>
        </div>
      `;
    },

    _renderKnowledgeBase(card) {
      const stats = card.props.stats || { principles: 0, materials: 0, connections: 0 };
      const items = (card.props.items || []).map(item => `
        <div class="cf-kb-item">
          <span class="cf-kb-dot" style="background:var(--mc-${item.color || 'blue'}-700, #4A90E2)"></span>
          <span class="cf-kb-name">${Utils.escapeHtml(item.name)}</span>
          <span class="cf-kb-status cf-status-${item.status}">${Utils.escapeHtml(item.status)}</span>
        </div>
      `).join('');

      return `
        <div class="cf-knowledge-base">
          <div class="cf-kb-stats">
            <div class="cf-stat-item"><span class="cf-stat-num">${stats.principles}</span><span class="cf-stat-label">原则</span></div>
            <div class="cf-stat-item"><span class="cf-stat-num">${stats.materials}</span><span class="cf-stat-label">材料</span></div>
            <div class="cf-stat-item"><span class="cf-stat-num">${stats.connections}</span><span class="cf-stat-label">连接</span></div>
          </div>
          <div class="cf-kb-list">${items}</div>
        </div>
      `;
    },

    _renderAbilityBase(card) {
      const score = card.props.score || 0;
      const dimensions = (card.props.dimensions || []).map(dim => `
        <div class="cf-dimension-bar">
          <div class="cf-dim-label">
            <span>${Utils.escapeHtml(dim.name)}</span>
            <span>${dim.score}/100</span>
          </div>
          <div class="cf-dim-track">
            <div class="cf-dim-fill" style="width:${dim.score}%;background:var(--mc-${dim.color || 'blue'}-700, #4A90E2)"></div>
          </div>
        </div>
      `).join('');

      return `
        <div class="cf-ability-base">
          <div class="cf-ability-score">
            <span class="cf-score-num">${score}</span>
            <span class="cf-score-label">综合分</span>
          </div>
          <div class="cf-dimensions">${dimensions}</div>
        </div>
      `;
    },

    _renderKnowledgeMap(card) {
      return `
        <div class="cf-knowledge-map">
          <div class="cf-map-status">
            <span class="cf-status-dot" style="background:#10b981"></span>
            <span>${Utils.escapeHtml(card.props.status || 'AI 运行中')}</span>
            <span class="cf-map-meta">${card.props.nodes || 0} 节点 · ${card.props.edges || 0} 连接</span>
          </div>
          <div class="cf-map-svg">
            ${card.props.svgData || '<svg viewBox="0 0 400 200" style="width:100%;height:200px;background:var(--cf-bg-200)"><text x="50%" y="50%" text-anchor="middle" fill="var(--cf-text-tertiary)">知识图谱加载中...</text></svg>'}
          </div>
        </div>
      `;
    },

    _renderMetaAbility(card) {
      const items = (card.props.items || []).map(item => `
        <div class="cf-meta-item">
          <span class="cf-meta-icon">${item.icon || '•'}</span>
          <span class="cf-meta-name">${Utils.escapeHtml(item.name)}</span>
        </div>
      `).join('');

      return `
        <div class="cf-meta-ability">
          ${items}
        </div>
      `;
    },

    _renderFocusMode(card) {
      const mins = Math.floor((card.props.remaining || 1500) / 60);
      const secs = (card.props.remaining || 1500) % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const isRunning = card.props.isRunning;
      const btnText = isRunning ? '暂停' : '开始';
      const modeText = card.props.mode === 'work' ? '专注中' : '休息中';

      return `
        <div class="cf-focus-mode">
          <div class="cf-focus-status">${modeText}</div>
          <div class="cf-focus-timer">${timeStr}</div>
          <div class="cf-focus-actions">
            <button class="cf-focus-btn" data-action="toggle-focus">${btnText}</button>
            <button class="cf-focus-btn" data-action="reset-focus">重置</button>
          </div>
        </div>
      `;
    },

    _renderNotes(card) {
      return `
        <div class="cf-notes">
          <textarea class="cf-notes-area" placeholder="记录你的想法...">${Utils.escapeHtml(card.props.content || '')}</textarea>
          <div class="cf-notes-meta">${card.props.lastEdited ? '最后编辑: ' + Utils.escapeHtml(card.props.lastEdited) : ''}</div>
        </div>
      `;
    },

    _renderCalendar(card) {
      const now = new Date(card.props.currentDate || Date.now());
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();

      let daysHtml = '';
      for (let i = 0; i < firstDay; i++) {
        daysHtml += '<div class="cf-cal-day cf-cal-empty"></div>';
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === now.getDate();
        const cls = isToday ? 'cf-cal-today' : '';
        daysHtml += `<div class="cf-cal-day ${cls}">${d}</div>`;
      }

      return `
        <div class="cf-calendar">
          <div class="cf-cal-header">
            <span>${year}年${month + 1}月</span>
          </div>
          <div class="cf-cal-weekdays">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>
          <div class="cf-cal-days">${daysHtml}</div>
        </div>
      `;
    }
  };

  // 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MindCanvasCore;
  }
  global.CardFrameMindCanvasCore = MindCanvasCore;

})(typeof window !== 'undefined' ? window : this);
