# CardFrame 插件开发指南

## 目录

- [插件系统简介](#插件系统简介)
- [插件基本结构](#插件基本结构)
- [插件生命周期](#插件生命周期)
  - [install](#install)
  - [uninstall](#uninstall)
  - [enable](#enable)
  - [disable](#disable)
- [插件能做什么](#插件能做什么)
  - [注册卡片类型](#注册卡片类型)
  - [注册动作](#注册动作)
  - [注册钩子](#注册钩子)
  - [扩展 API](#扩展-api)
- [插件依赖管理](#插件依赖管理)
- [插件示例](#插件示例)
  - [示例一：便签插件](#示例一便签插件)
  - [示例二：思维导图插件](#示例二思维导图插件)
  - [示例三：看板插件](#示例三看板插件)
- [最佳实践](#最佳实践)

---

## 插件系统简介

CardFrame 提供了一套完整的插件系统，允许开发者扩展框架的功能。插件可以注册新的卡片类型、添加自定义动作、监听钩子事件、甚至扩展 CardFrame 的 API。

插件系统的设计目标：

- **简单易用**：插件定义简洁，上手快速
- **功能强大**：支持类型注册、钩子机制、API 扩展
- **安全可靠**：完整的生命周期管理，依赖检查
- **热插拔**：支持运行时安装、卸载、启用、禁用

---

## 插件基本结构

一个最基本的插件定义如下：

```javascript
const myPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: '我的第一个插件',
  author: 'Your Name',
  autoEnable: true,

  install(frame) {
    console.log('插件已安装');
    return {
      greeting: 'Hello from My Plugin!'
    };
  },

  enable(frame, instance) {
    console.log('插件已启用');
  },

  disable(frame, instance) {
    console.log('插件已禁用');
  },

  uninstall(frame, instance) {
    console.log('插件已卸载');
  }
};
```

**插件属性说明：**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | `string` | ✅ | - | 插件唯一名称 |
| `version` | `string` | - | `'1.0.0'` | 插件版本号 |
| `description` | `string` | - | `''` | 插件描述 |
| `author` | `string` | - | `''` | 作者信息 |
| `dependencies` | `array` | - | `[]` | 依赖的插件列表 |
| `autoEnable` | `boolean` | - | `true` | 安装后是否自动启用 |
| `cardTypes` | `array` | - | `[]` | 要注册的卡片类型 |
| `actions` | `object` | - | - | 要注册的动作 |
| `hooks` | `object` | - | - | 要注册的钩子 |
| `install` | `function` | - | - | 安装钩子 |
| `uninstall` | `function` | - | - | 卸载钩子 |
| `enable` | `function` | - | - | 启用钩子 |
| `disable` | `function` | - | - | 禁用钩子 |

**安装插件：**

```javascript
frame.installPlugin(myPlugin);
```

---

## 插件生命周期

插件有四个生命周期阶段：安装 → 启用 → 禁用 → 卸载。

### install

**触发时机**：插件首次安装时调用。

**用途**：
- 初始化插件数据
- 注册卡片类型
- 注册全局事件监听
- 准备资源

**参数**：
- `frame` - CardFrame 实例

**返回值**：插件实例对象（可选）

```javascript
install(frame) {
  // 注册卡片类型
  frame.typeRegistry.register({
    type: 'note',
    label: '便签',
    icon: '📝',
    extends: 'base',
    propsSchema: [
      { name: 'content', type: 'string', label: '内容' }
    ],
    renderTemplate: `
      <div class="card card-note">
        <div class="card-header">
          <span class="card-icon">{{icon}}</span>
          <h3 class="card-title">{{title}}</h3>
        </div>
        <div class="card-body">{{content}}</div>
      </div>
    `
  });

  // 返回插件实例
  return {
    notes: [],
    addNote(content) {
      this.notes.push(content);
    }
  };
}
```

### uninstall

**触发时机**：插件被卸载时调用。

**用途**：
- 清理资源
- 移除事件监听
- 恢复修改

**参数**：
- `frame` - CardFrame 实例
- `instance` - 插件实例

```javascript
uninstall(frame, instance) {
  // 清理事件监听
  frame.off('cardAdded', instance.cardAddedHandler);
  
  // 清理数据
  instance.notes = [];
}
```

### enable

**触发时机**：插件被启用时调用（安装后默认自动启用）。

**用途**：
- 激活功能
- 绑定事件
- 启动定时器

```javascript
enable(frame, instance) {
  instance.intervalId = setInterval(() => {
    console.log('插件运行中...');
  }, 1000);
}
```

### disable

**触发时机**：插件被禁用时调用。

**用途**：
- 暂停功能
- 解绑事件
- 停止定时器

```javascript
disable(frame, instance) {
  if (instance.intervalId) {
    clearInterval(instance.intervalId);
    instance.intervalId = null;
  }
}
```

---

## 插件能做什么

### 注册卡片类型

插件可以注册新的卡片类型，扩展 CardFrame 的能力。

```javascript
const notePlugin = {
  name: 'note-plugin',
  version: '1.0.0',
  description: '便签卡片插件',

  cardTypes: [
    {
      type: 'note',
      label: '便签',
      icon: '📝',
      description: '彩色便签卡片',
      extends: 'base',
      propsSchema: [
        { name: 'content', type: 'string', label: '内容', defaultValue: '' },
        { name: 'color', type: 'string', label: '颜色', defaultValue: 'yellow', 
          allowedValues: ['yellow', 'blue', 'green', 'pink'] }
      ],
      renderTemplate: `
        <div class="card card-note card-note-{{color}}">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body card-note-content">{{content}}</div>
        </div>
      `,
      defaultStyle: {
        minHeight: '150px'
      }
    }
  ],

  install(frame) {
    console.log('便签插件已安装');
    return {};
  }
};

frame.installPlugin(notePlugin);

// 使用新类型
const noteCard = frame.createCard('note', {
  title: '我的便签',
  content: '这是一条重要的便签内容',
  color: 'yellow'
});
```

### 注册动作

插件可以为卡片类型注册自定义动作（按钮）。

```javascript
const bookmarkPlugin = {
  name: 'bookmark-plugin',
  version: '1.0.0',
  description: '收藏夹插件',

  cardTypes: [
    {
      type: 'bookmark',
      label: '书签',
      icon: '🔖',
      extends: 'base',
      propsSchema: [
        { name: 'url', type: 'string', required: true, label: '网址' },
        { name: 'favorited', type: 'boolean', defaultValue: false, label: '是否收藏' }
      ],
      renderTemplate: `
        <div class="card card-bookmark">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body">
            <a href="{{url}}" target="_blank">{{url}}</a>
          </div>
          <div class="card-footer">
            <button class="btn" data-action="toggle-favorite">
              {{favorited ? '★ 已收藏' : '☆ 收藏'}}
            </button>
            <button class="btn" data-action="open">打开</button>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'toggle-favorite',
          label: '切换收藏',
          handler: (card, e) => {
            card.props.favorited = !card.props.favorited;
            if (card.store) {
              card.store.updateCard(card);
            }
          }
        },
        {
          name: 'open',
          label: '打开',
          handler: (card, e) => {
            window.open(card.props.url, '_blank');
          }
        }
      ]
    }
  ]
};
```

### 注册钩子

插件可以注册钩子，在特定时机执行自定义逻辑。

**可用钩子：**

| 钩子名称 | 触发时机 | 数据参数 |
|----------|----------|----------|
| `beforeCardCreate` | 创建卡片前 | `{ type, props }` |
| `afterCardCreate` | 创建卡片后 | `card` |
| `beforeCardUpdate` | 更新卡片前 | `card` |
| `afterCardUpdate` | 更新卡片后 | `card` |
| `beforeCardRemove` | 删除卡片前 | `cardId` |
| `afterCardRemove` | 删除卡片后 | `cardId` |
| `beforeRender` | 渲染前 | `cards` |
| `afterRender` | 渲染后 | `cards` |

```javascript
const auditPlugin = {
  name: 'audit-plugin',
  version: '1.0.0',
  description: '审计日志插件',

  hooks: {
    afterCardCreate(card, frame) {
      console.log(`[审计] 卡片已创建: ${card.id} - ${card.props.title}`);
      return card;
    },

    beforeCardRemove(cardId, frame) {
      const card = frame.getCard(cardId);
      if (card) {
        console.log(`[审计] 即将删除卡片: ${cardId} - ${card.props.title}`);
      }
      return cardId;
    },

    afterCardUpdate(card, frame) {
      console.log(`[审计] 卡片已更新: ${card.id}`);
      return card;
    }
  },

  install(frame) {
    return {
      logs: [],
      
      getLogs() {
        return this.logs;
      }
    };
  }
};
```

**手动注册钩子：**

```javascript
// 在 install 方法中手动注册
install(frame) {
  const unsubscribe = frame.pluginManager.registerHook('afterCardCreate', (card) => {
    console.log('卡片创建了:', card.id);
    return card;
  });

  return { unsubscribe };
}
```

### 扩展 API

插件可以向 CardFrame 实例添加自定义方法和属性。

```javascript
const exportPlugin = {
  name: 'export-plugin',
  version: '1.0.0',
  description: '导出功能插件',

  install(frame) {
    // 扩展 CardFrame 实例
    frame.exportToMarkdown = function() {
      const cards = this.getAllCards();
      let md = '# 卡片导出\n\n';
      
      cards.forEach(card => {
        md += `## ${card.props.title}\n\n`;
        md += `类型: ${card.type}\n\n`;
        if (card.props.content) {
          md += `${card.props.content}\n\n`;
        }
        md += '---\n\n';
      });

      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cards.md';
      a.click();
      URL.revokeObjectURL(url);
    };

    frame.exportToCSV = function() {
      // ... CSV 导出逻辑
    };

    return {
      format: 'markdown'
    };
  }
};

frame.installPlugin(exportPlugin);

// 使用扩展的 API
frame.exportToMarkdown();
```

---

## 插件依赖管理

插件可以声明对其他插件的依赖，CardFrame 会自动检查依赖关系。

```javascript
const basePlugin = {
  name: 'base-utils',
  version: '1.0.0',
  description: '基础工具插件',

  install(frame) {
    return {
      helper(text) {
        return text.toUpperCase();
      }
    };
  }
};

const dependentPlugin = {
  name: 'advanced-feature',
  version: '1.0.0',
  description: '高级功能插件',
  
  // 声明依赖
  dependencies: ['base-utils'],

  install(frame) {
    // 获取依赖插件的实例
    const baseUtils = frame.getPlugin('base-utils');
    
    if (!baseUtils) {
      throw new Error('base-utils 插件未找到');
    }

    // 使用依赖插件的功能
    const result = baseUtils.helper('hello');
    console.log(result); // HELLO

    return {
      // ...
    };
  }
};

// 必须先安装依赖
frame.installPlugin(basePlugin);
frame.installPlugin(dependentPlugin);
```

**依赖检查规则：**

- 安装插件时，会检查所有依赖是否已安装
- 未安装的依赖会导致安装失败并抛出错误
- 卸载插件时，会检查是否有其他插件依赖它
- 有依赖的插件无法直接卸载，需要先卸载依赖它的插件

---

## 插件示例

### 示例一：便签插件

一个简单的彩色便签插件，支持多种颜色和内容编辑。

```javascript
const stickyNotePlugin = {
  name: 'sticky-note',
  version: '1.0.0',
  description: '彩色便签卡片',
  author: 'CardFrame Team',
  autoEnable: true,

  cardTypes: [
    {
      type: 'sticky-note',
      label: '便签',
      icon: '📌',
      description: '彩色便签，支持多种颜色',
      extends: 'base',
      propsSchema: [
        { 
          name: 'content', 
          type: 'string', 
          label: '内容', 
          defaultValue: '',
          allowHtml: false
        },
        { 
          name: 'color', 
          type: 'string', 
          label: '颜色', 
          defaultValue: 'yellow',
          allowedValues: ['yellow', 'blue', 'green', 'pink', 'purple']
        }
      ],
      renderTemplate: `
        <div class="card card-sticky-note note-{{color}}">
          <div class="note-pin"></div>
          <div class="card-header">
            <h3 class="card-title">{{title}}</h3>
            <span class="note-color-badge">{{color}}</span>
          </div>
          <div class="card-body note-content">
            {{content}}
          </div>
          <div class="card-footer">
            <button class="btn btn-small" data-action="edit">编辑</button>
            <button class="btn btn-small" data-action="change-color">换色</button>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'edit',
          label: '编辑',
          handler: (card, e) => {
            const newContent = prompt('编辑便签内容:', card.props.content);
            if (newContent !== null) {
              card.props.content = newContent;
              if (card.store) card.store.updateCard(card);
            }
          }
        },
        {
          name: 'change-color',
          label: '换色',
          handler: (card, e) => {
            const colors = ['yellow', 'blue', 'green', 'pink', 'purple'];
            const currentIndex = colors.indexOf(card.props.color);
            const nextIndex = (currentIndex + 1) % colors.length;
            card.props.color = colors[nextIndex];
            if (card.store) card.store.updateCard(card);
          }
        }
      ],
      defaultStyle: {
        width: '250px',
        minHeight: '200px'
      }
    }
  ],

  install(frame) {
    console.log('📌 便签插件已安装');
    return {
      createStickyNote(title, content, color = 'yellow') {
        return frame.createCard('sticky-note', { title, content, color });
      },

      getNotesByColor(color) {
        return frame.getAllCards().filter(
          c => c.type === 'sticky-note' && c.props.color === color
        );
      }
    };
  }
};

// 使用示例
frame.installPlugin(stickyNotePlugin);
const plugin = frame.getPlugin('sticky-note');
plugin.createStickyNote('重要提醒', '记得提交报告！', 'pink');
```

### 示例二：思维导图插件

一个基于画布模式的思维导图插件，支持节点创建和连接。

```javascript
const mindmapPlugin = {
  name: 'mindmap',
  version: '1.0.0',
  description: '思维导图插件',
  author: 'CardFrame Team',

  cardTypes: [
    {
      type: 'mind-node',
      label: '思维导图节点',
      icon: '🧠',
      extends: 'base',
      propsSchema: [
        { name: 'level', type: 'number', defaultValue: 1, label: '层级' },
        { name: 'expanded', type: 'boolean', defaultValue: true, label: '是否展开' }
      ],
      renderTemplate: `
        <div class="card card-mind-node level-{{level}}">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body">
            <button class="btn btn-small" data-action="add-child">+ 子节点</button>
            <button class="btn btn-small" data-action="toggle">{{expanded ? '收起' : '展开'}}</button>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'add-child',
          label: '添加子节点',
          handler: (card, e) => {
            const store = card.store;
            if (!store) return;

            const childTitle = prompt('子节点标题:');
            if (!childTitle) return;

            const child = {
              type: 'mind-node',
              props: {
                title: childTitle,
                level: (card.props.level || 1) + 1,
                expanded: true
              },
              position: {
                x: (card.position?.x || 0) + 200,
                y: (card.position?.y || 0) + 50
              }
            };

            const childCard = store.addCard(child);
            
            if (CardFrame._globalStore === store || frame) {
              const f = frame || CardFrame;
              f.createRelationship(card.id, childCard.id, 'parent');
            }
          }
        },
        {
          name: 'toggle',
          label: '展开/收起',
          handler: (card, e) => {
            card.props.expanded = !card.props.expanded;
            if (card.store) card.store.updateCard(card);
          }
        }
      ]
    }
  ],

  install(frame) {
    // 确保切换到画布模式
    frame.setLayoutMode('canvas');
    
    // 启用关系线
    frame.relationshipEngine.enable();

    return {
      createRootNode(title) {
        return frame.createCard('mind-node', {
          title,
          level: 1,
          expanded: true
        });
      },

      autoLayout(rootId) {
        // 简单的自动布局逻辑
        const root = frame.getCard(rootId);
        if (!root) return;

        const relationships = frame.getRelationshipsByCard(rootId);
        const children = relationships
          .filter(r => r.type === 'parent' && r.sourceId === rootId)
          .map(r => frame.getCard(r.targetId))
          .filter(Boolean);

        const startY = root.position.y - (children.length * 80) / 2;
        children.forEach((child, index) => {
          child.position = {
            x: root.position.x + 250,
            y: startY + index * 80
          };
          frame.updateCard(child);
        });
      }
    };
  },

  enable(frame, instance) {
    console.log('🧠 思维导图插件已启用');
  }
};

// 使用示例
frame.installPlugin(mindmapPlugin);
const mindmap = frame.getPlugin('mindmap');
const root = mindmap.createRootNode('中心主题');
mindmap.autoLayout(root.id);
```

### 示例三：看板插件

一个看板插件，支持列管理和卡片拖拽。

```javascript
const kanbanPlugin = {
  name: 'kanban',
  version: '1.0.0',
  description: '看板插件',
  author: 'CardFrame Team',

  cardTypes: [
    {
      type: 'kanban-card',
      label: '看板卡片',
      icon: '🗂️',
      extends: 'task',
      propsSchema: [
        { name: 'column', type: 'string', defaultValue: 'todo', label: '列' },
        { name: 'tags', type: 'array', defaultValue: [], label: '标签' },
        { name: 'assignee', type: 'string', label: '负责人' }
      ],
      renderTemplate: `
        <div class="card card-kanban card-priority-{{priority}}">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
            <span class="kanban-priority">{{priority}}</span>
          </div>
          <div class="card-body">
            <div class="kanban-tags">
              <span class="kanban-tag" v-for="tag in tags">{{tag}}</span>
            </div>
            <div class="kanban-assignee" v-if="assignee">
              👤 {{assignee}}
            </div>
          </div>
          <div class="card-footer">
            <button class="btn btn-small" data-action="move-prev">← 左移</button>
            <button class="btn btn-small" data-action="move-next">右移 →</button>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'move-prev',
          label: '左移一列',
          handler: (card, e) => {
            const columns = ['todo', 'in-progress', 'review', 'done'];
            const currentIndex = columns.indexOf(card.props.column);
            if (currentIndex > 0) {
              card.props.column = columns[currentIndex - 1];
              if (card.store) card.store.updateCard(card);
            }
          }
        },
        {
          name: 'move-next',
          label: '右移一列',
          handler: (card, e) => {
            const columns = ['todo', 'in-progress', 'review', 'done'];
            const currentIndex = columns.indexOf(card.props.column);
            if (currentIndex < columns.length - 1) {
              card.props.column = columns[currentIndex + 1];
              if (card.store) card.store.updateCard(card);
            }
          }
        }
      ]
    }
  ],

  install(frame) {
    return {
      columns: ['todo', 'in-progress', 'review', 'done'],
      columnLabels: {
        'todo': '待办',
        'in-progress': '进行中',
        'review': '待评审',
        'done': '已完成'
      },

      addCard(column, title, options = {}) {
        return frame.createCard('kanban-card', {
          title,
          column,
          priority: options.priority || 'medium',
          tags: options.tags || [],
          assignee: options.assignee || ''
        });
      },

      getColumnCards(column) {
        return frame.getAllCards().filter(
          c => c.type === 'kanban-card' && c.props.column === column
        );
      },

      getColumnStats() {
        const stats = {};
        this.columns.forEach(col => {
          stats[col] = this.getColumnCards(col).length;
        });
        return stats;
      },

      moveCard(cardId, targetColumn) {
        const card = frame.getCard(cardId);
        if (!card || !this.columns.includes(targetColumn)) return false;
        card.props.column = targetColumn;
        frame.updateCard(card);
        return true;
      }
    };
  },

  enable(frame, instance) {
    console.log('🗂️ 看板插件已启用');
  }
};

// 使用示例
frame.installPlugin(kanbanPlugin);
const kanban = frame.getPlugin('kanban');

kanban.addCard('todo', '设计界面', { priority: 'high', tags: ['设计', 'UI'] });
kanban.addCard('in-progress', '开发后端', { priority: 'high', assignee: '张三' });
kanban.addCard('done', '需求分析', { priority: 'medium' });

console.log(kanban.getColumnStats());
// { todo: 1, 'in-progress': 1, review: 0, done: 1 }
```

---

## 最佳实践

### 1. 命名规范

- **插件名称**：使用小写字母和连字符，如 `my-awesome-plugin`
- **卡片类型**：使用小写字母和连字符，前缀使用插件名避免冲突，如 `myplugin-cardtype`
- **事件名称**：使用 `pluginName:eventName` 格式

```javascript
// 好的命名
const plugin = {
  name: 'kanban',
  cardTypes: [
    { type: 'kanban-card', /* ... */ }
  ]
};

// 避免命名冲突
frame.emit('kanban:cardMoved', { cardId, fromColumn, toColumn });
```

### 2. 错误处理

- 插件代码应该有良好的错误处理
- 不要让插件错误影响整个框架的运行
- 使用 try-catch 包裹可能出错的代码

```javascript
install(frame) {
  try {
    // 初始化代码
    this.initializeData();
  } catch (e) {
    console.error('[my-plugin] 初始化失败:', e);
    // 优雅降级
  }
}
```

### 3. 性能优化

- 避免在频繁触发的钩子中做重型操作
- 使用防抖/节流优化频繁操作
- 及时清理定时器和事件监听

```javascript
enable(frame, instance) {
  // 使用防抖
  instance._handleScroll = Utils.debounce(() => {
    this.updatePositions();
  }, 100);

  frame.on('layoutChanged', instance._handleScroll);
}
```

### 4. 资源清理

- 在 `disable` 和 `uninstall` 中清理所有资源
- 移除事件监听
- 清除定时器
- 释放 DOM 引用

```javascript
disable(frame, instance) {
  // 移除事件监听
  if (instance._handleScroll) {
    frame.off('layoutChanged', instance._handleScroll);
  }
  
  // 清除定时器
  if (instance._intervalId) {
    clearInterval(instance._intervalId);
  }
  
  // 清理 DOM 引用
  instance._elements = null;
}
```

### 5. 数据持久化

- 插件数据应该通过卡片属性存储
- 不要依赖外部状态
- 利用框架的导入导出功能

```javascript
// 好的做法：数据存储在卡片属性中
frame.createCard('my-type', {
  title: '标题',
  myPluginData: { foo: 'bar' }
});

// 避免：使用全局变量存储
let myData = {}; // 不推荐，导入导出时会丢失
```

### 6. 可访问性

- 为按钮添加适当的 aria-label
- 支持键盘操作
- 确保颜色对比度足够

### 7. 文档化

- 为插件编写清晰的文档
- 说明插件的功能、用法和配置项
- 提供使用示例

```javascript
/**
 * 我的插件
 * 
 * 功能说明：
 * - 功能一
 * - 功能二
 * 
 * 使用方法：
 * frame.installPlugin(myPlugin);
 * const instance = frame.getPlugin('my-plugin');
 * instance.doSomething();
 */
const myPlugin = { /* ... */ };
```

---

**上一篇：[API 参考 ←](./api-reference.md)** | **下一篇：[智能体接入指南 →](./agent-guide.md)**
