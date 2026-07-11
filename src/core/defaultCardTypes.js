/**
 * Default card type definitions: base, text, task, image, list, progress.
 * Each type includes a render template, props schema, optional actions, and default style.
 * @module core/defaultCardTypes
 */

export const defaultCardTypes = [
  {
    type: 'base',
    label: '基础卡',
    icon: '📋',
    description: '基础卡片类型',
    abstract: true,
    propsSchema: [
      { name: 'title', type: 'string', required: true, label: '标题', defaultValue: '未命名卡片' }
    ],
    renderTemplate: `
      <div class="card card-base">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body"></div>
      </div>
    `,
    defaultStyle: {}
  },
  {
    type: 'text',
    label: '文本卡',
    icon: '📝',
    description: '用于展示文本内容',
    extends: 'base',
    propsSchema: [
      { name: 'content', type: 'string', required: false, label: '内容' }
    ],
    renderTemplate: `
      <div class="card card-text">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body card-text-content">{{content}}</div>
      </div>
    `,
    defaultStyle: {}
  },
  {
    type: 'task',
    label: '任务卡',
    icon: '✅',
    description: '用于管理待办任务',
    extends: 'base',
    propsSchema: [
      { name: 'dueDate', type: 'date', required: false, label: '截止日期' },
      { name: 'priority', type: 'string', required: false, label: '优先级', allowedValues: ['high', 'medium', 'low'], defaultValue: 'medium' }
    ],
    renderTemplate: `
      <div class="card card-task card-priority-{{priority}}">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
          <span class="card-priority-badge">{{priority}}</span>
        </div>
        <div class="card-body">
          <p class="card-due-date" style="display: {{dueDate ? 'block' : 'none'}};">截止: {{dueDate}}</p>
        </div>
        <div class="card-footer">
          <button class="btn btn-complete" data-action="complete">完成</button>
        </div>
      </div>
    `,
    actions: [
      {
        name: 'complete',
        label: '完成',
        handler: (card) => {
          card.status = card.status === 'completed' ? 'active' : 'completed';
          if (card.store) {
            card.store.updateCard(card);
          } else {
            const store = CardFrame._globalStore;
            if (store) store.updateCard(card);
          }
        }
      }
    ],
    defaultStyle: {}
  },
  {
    type: 'image',
    label: '图片卡',
    icon: '🖼️',
    description: '用于展示图片',
    extends: 'base',
    propsSchema: [
      { name: 'src', type: 'string', required: true, label: '图片地址' },
      { name: 'alt', type: 'string', required: false, label: '替代文本', defaultValue: '图片' },
      { name: 'caption', type: 'string', required: false, label: '说明文字' }
    ],
    renderTemplate: `
      <div class="card card-image">
        <div class="card-image-container">
          <img src="{{src}}" alt="{{alt}}" class="card-image-img">
        </div>
        <div class="card-header">
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body">
          <p class="card-caption">{{caption}}</p>
        </div>
      </div>
    `,
    defaultStyle: {}
  },
  {
    type: 'list',
    label: '列表卡',
    icon: '📋',
    description: '用于展示列表内容',
    extends: 'base',
    propsSchema: [
      { name: 'items', type: 'array', required: false, label: '列表项', defaultValue: '' }
    ],
    renderTemplate: `
      <div class="card card-list">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body">
          <ul class="card-list-items">
            <li class="card-list-item">列表项 1</li>
          </ul>
        </div>
      </div>
    `,
    actions: [
      {
        name: 'addItem',
        label: '添加项',
        handler: (card, store) => {
          const item = prompt('输入新列表项：');
          if (item && store) {
            const current = (card.props && Array.isArray(card.props.items)) ? card.props.items : [];
            const items = [...current, item];
            store.updateCardProps(card.id, { items });
          }
        }
      }
    ],
    defaultStyle: {}
  },
  {
    type: 'progress',
    label: '进度卡',
    icon: '📊',
    description: '用于展示进度',
    extends: 'base',
    propsSchema: [
      { name: 'value', type: 'number', required: false, label: '当前值', defaultValue: 0 },
      { name: 'max', type: 'number', required: false, label: '最大值', defaultValue: 100 },
      { name: 'unit', type: 'string', required: false, label: '单位', defaultValue: '%' }
    ],
    renderTemplate: `
      <div class="card card-progress">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: {{value}}%;"></div>
          </div>
          <p class="progress-text">{{value}} / {{max}} {{unit}}</p>
        </div>
      </div>
    `,
    defaultStyle: {}
  }
];
