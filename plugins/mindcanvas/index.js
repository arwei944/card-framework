(function(window) {
  'use strict';

  const MindCanvasPlugin = {
    name: 'mindcanvas',
    version: '1.0.0',
    description: '思维导图插件，提供节点卡片和思维导图布局',
    author: 'CardFrame Team',

    install(frame) {
      const pluginInstance = {
        frame: frame,

        _levelColors: [
          '#3b82f6',
          '#22c55e',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#ec4899',
          '#06b6d4',
          '#f97316'
        ],

        _getLevelColor(level) {
          const colors = this._levelColors;
          return colors[level % colors.length];
        },

        createMindMap(rootTitle) {
          const rootNode = frame.createCard('mind-node', {
            title: rootTitle,
            content: '',
            level: 0,
            expanded: true,
            color: this._getLevelColor(0),
            tags: '[]'
          });
          return rootNode;
        },

        addChildNode(parentId, title) {
          const parent = frame.store.getCard(parentId);
          if (!parent || parent.type !== 'mind-node') {
            return null;
          }

          const childLevel = (parent.props.level || 0) + 1;
          const child = frame.createCard('mind-node', {
            title: title,
            content: '',
            level: childLevel,
            expanded: true,
            color: this._getLevelColor(childLevel),
            tags: '[]'
          });

          frame.store.addRelationship({
            sourceId: parentId,
            targetId: child.id,
            type: 'parent'
          });

          return child;
        },

        addSiblingNode(nodeId, title) {
          const node = frame.store.getCard(nodeId);
          if (!node || node.type !== 'mind-node') {
            return null;
          }

          const parentRel = this._getParentRelationship(nodeId);
          if (!parentRel) {
            return null;
          }

          return this.addChildNode(parentRel.sourceId, title);
        },

        removeNode(nodeId) {
          const descendants = this.getAllDescendants(nodeId);
          const idsToRemove = [nodeId, ...descendants.map(d => d.id)];

          idsToRemove.forEach(id => {
            frame.store.removeCard(id);
          });

          return idsToRemove.length;
        },

        getNodeChildren(nodeId) {
          const allRels = frame.store.getAllRelationships();
          const childRels = allRels.filter(
            rel => rel.sourceId === nodeId && rel.type === 'parent'
          );

          const children = [];
          childRels.forEach(rel => {
            const child = frame.store.getCard(rel.targetId);
            if (child && child.type === 'mind-node') {
              children.push(child);
            }
          });

          return children;
        },

        getAllDescendants(nodeId) {
          const descendants = [];
          const queue = [nodeId];
          const visited = new Set();

          while (queue.length > 0) {
            const currentId = queue.shift();
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const children = this.getNodeChildren(currentId);
            children.forEach(child => {
              descendants.push(child);
              queue.push(child.id);
            });
          }

          return descendants;
        },

        getMindMapRoots() {
          const allNodes = frame.store.getCardsByType('mind-node');
          const roots = [];

          allNodes.forEach(node => {
            const parentRel = this._getParentRelationship(node.id);
            if (!parentRel) {
              roots.push(node);
            }
          });

          return roots;
        },

        _getParentRelationship(nodeId) {
          const allRels = frame.store.getAllRelationships();
          return allRels.find(
            rel => rel.targetId === nodeId && rel.type === 'parent'
          );
        },

        layoutMindMap(rootId, options = {}) {
          const settings = {
            nodeWidth: options.nodeWidth || 180,
            nodeHeight: options.nodeHeight || 100,
            hSpacing: options.hSpacing || 60,
            vSpacing: options.vSpacing || 30,
            startX: options.startX || 100,
            startY: options.startY || 100
          };

          const root = frame.store.getCard(rootId);
          if (!root || root.type !== 'mind-node') {
            return null;
          }

          const subtreeHeights = new Map();
          this._calculateSubtreeHeights(rootId, subtreeHeights, settings);

          const positions = new Map();
          this._layoutSubtree(rootId, settings.startX, settings.startY, positions, subtreeHeights, settings);

          positions.forEach((pos, nodeId) => {
            const card = frame.store.getCard(nodeId);
            if (card) {
              card.position = { x: pos.x, y: pos.y };
              frame.store.updateCard(card);
            }
          });

          return {
            positions: Object.fromEntries(positions),
            nodeCount: positions.size
          };
        },

        _calculateSubtreeHeights(nodeId, subtreeHeights, settings) {
          const children = this.getNodeChildren(nodeId);
          const expanded = this._isNodeExpanded(nodeId);

          if (children.length === 0 || !expanded) {
            subtreeHeights.set(nodeId, settings.nodeHeight);
            return settings.nodeHeight;
          }

          let totalHeight = 0;
          children.forEach((child, index) => {
            const childHeight = this._calculateSubtreeHeights(child.id, subtreeHeights, settings);
            totalHeight += childHeight;
            if (index > 0) {
              totalHeight += settings.vSpacing;
            }
          });

          subtreeHeights.set(nodeId, Math.max(settings.nodeHeight, totalHeight));
          return subtreeHeights.get(nodeId);
        },

        _layoutSubtree(nodeId, x, y, positions, subtreeHeights, settings) {
          positions.set(nodeId, { x, y });

          const children = this.getNodeChildren(nodeId);
          const expanded = this._isNodeExpanded(nodeId);

          if (children.length === 0 || !expanded) {
            return;
          }

          const subtreeHeight = subtreeHeights.get(nodeId) || settings.nodeHeight;
          let currentY = y + (subtreeHeight - settings.nodeHeight) / 2;

          children.forEach(child => {
            const childHeight = subtreeHeights.get(child.id) || settings.nodeHeight;
            const childX = x + settings.nodeWidth + settings.hSpacing;
            const childY = currentY + (childHeight - settings.nodeHeight) / 2;

            this._layoutSubtree(child.id, childX, childY, positions, subtreeHeights, settings);
            currentY += childHeight + settings.vSpacing;
          });
        },

        _isNodeExpanded(nodeId) {
          const node = frame.store.getCard(nodeId);
          if (!node) return true;
          return node.props.expanded !== false;
        },

        expandAll(rootId) {
          const descendants = this.getAllDescendants(rootId);
          const allNodes = [frame.store.getCard(rootId), ...descendants].filter(Boolean);

          let count = 0;
          allNodes.forEach(node => {
            if (node.props.expanded !== true) {
              node.props.expanded = true;
              frame.store.updateCard(node);
              count++;
            }
          });

          return count;
        },

        collapseAll(rootId) {
          const descendants = this.getAllDescendants(rootId);
          const allNodes = [frame.store.getCard(rootId), ...descendants].filter(Boolean);

          let count = 0;
          allNodes.forEach(node => {
            if (node.props.expanded !== false) {
              node.props.expanded = false;
              frame.store.updateCard(node);
              count++;
            }
          });

          return count;
        },

        getMindMapStats(rootId) {
          const root = frame.store.getCard(rootId);
          if (!root || root.type !== 'mind-node') {
            return null;
          }

          const allDescendants = this.getAllDescendants(rootId);
          const allNodes = [root, ...allDescendants];

          let maxLevel = 0;
          let leafCount = 0;

          allNodes.forEach(node => {
            const level = node.props.level || 0;
            if (level > maxLevel) {
              maxLevel = level;
            }

            const children = this.getNodeChildren(node.id);
            if (children.length === 0) {
              leafCount++;
            }
          });

          return {
            totalNodes: allNodes.length,
            maxLevel: maxLevel + 1,
            leafNodes: leafCount,
            rootTitle: root.props.title
          };
        }
      };

      return pluginInstance;
    },

    cardTypes: [
      {
        type: 'mind-node',
        label: '思维导图节点',
        icon: '🧠',
        description: '思维导图节点卡片，支持层级结构和展开折叠',
        extends: 'base',
        propsSchema: [
          { name: 'content', type: 'string', required: false, label: '节点内容', defaultValue: '' },
          { name: 'level', type: 'number', required: false, label: '节点层级', defaultValue: 0 },
          { name: 'expanded', type: 'boolean', required: false, label: '是否展开', defaultValue: true },
          { name: 'color', type: 'string', required: false, label: '节点颜色', defaultValue: '#3b82f6' },
          { name: 'tags', type: 'array', required: false, label: '标签', defaultValue: '[]' }
        ],
        renderTemplate: `
          <div class="card card-mind-node" style="border-left: 4px solid {{color}};">
            <div class="card-header">
              <span class="card-icon">{{icon}}</span>
              <h3 class="card-title">{{title}}</h3>
              <span class="card-level-badge" style="background: {{color}};">L{{level}}</span>
            </div>
            <div class="card-body">
              <p class="card-content" style="display: {{content ? 'block' : 'none'}}; font-size: 13px; color: #666;">{{content}}</p>
              <div class="card-tags" style="display: none; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
              </div>
            </div>
            <div class="card-footer" style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn btn-secondary" data-action="toggleExpand">{{expanded ? '折叠' : '展开'}}</button>
              <button class="btn btn-secondary" data-action="addChild">加子节点</button>
              <button class="btn btn-secondary" data-action="addSibling">加兄弟</button>
              <button class="btn btn-secondary" data-action="setColor">改颜色</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'toggleExpand',
            label: '切换展开',
            handler: (card) => {
              card.props.expanded = card.props.expanded !== true;
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          },
          {
            name: 'addChild',
            label: '添加子节点',
            handler: (card) => {
              const title = prompt('输入子节点标题：');
              if (!title) return;

              const mindCanvas = CardFrame._globalMindCanvas;
              if (mindCanvas) {
                mindCanvas.addChildNode(card.id, title);
              }
            }
          },
          {
            name: 'addSibling',
            label: '添加兄弟节点',
            handler: (card) => {
              const title = prompt('输入兄弟节点标题：');
              if (!title) return;

              const mindCanvas = CardFrame._globalMindCanvas;
              if (mindCanvas) {
                mindCanvas.addSiblingNode(card.id, title);
              }
            }
          },
          {
            name: 'setColor',
            label: '设置颜色',
            handler: (card) => {
              const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
              const currentIndex = colors.indexOf(card.props.color);
              const nextIndex = (currentIndex + 1) % colors.length;
              card.props.color = colors[nextIndex];
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          }
        ],
        defaultStyle: {}
      }
    ],

    hooks: {
      beforeCardRemove(cardId, frame) {
        const card = frame.store.getCard(cardId);
        if (!card || card.type !== 'mind-node') {
          return cardId;
        }

        const mindCanvas = frame.pluginManager.get('mindcanvas');
        if (mindCanvas) {
          const descendants = mindCanvas.getAllDescendants(cardId);
          descendants.forEach(desc => {
            frame.store.removeCard(desc.id);
          });
        }

        return cardId;
      },

      beforeRelationshipAdd(rel, frame) {
        if (rel.type !== 'parent') {
          return rel;
        }

        const sourceCard = frame.store.getCard(rel.sourceId);
        const targetCard = frame.store.getCard(rel.targetId);

        if (!sourceCard || !targetCard) {
          return rel;
        }

        if (sourceCard.type !== 'mind-node' || targetCard.type !== 'mind-node') {
          return rel;
        }

        const mindCanvas = frame.pluginManager.get('mindcanvas');
        if (mindCanvas) {
          const descendants = mindCanvas.getAllDescendants(rel.targetId);
          const isDescendant = descendants.some(d => d.id === rel.sourceId);
          if (isDescendant) {
            console.warn('[MindCanvas] 不能创建循环父子关系');
            return null;
          }
        }

        const existingParent = frame.store.getAllRelationships().find(
          r => r.targetId === rel.targetId && r.type === 'parent'
        );
        if (existingParent && existingParent.sourceId !== rel.sourceId) {
          console.warn('[MindCanvas] 节点已有父节点，将移除旧关系');
          frame.store.removeRelationship(existingParent.id);
        }

        return rel;
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
  window.CardFramePlugins.MindCanvas = MindCanvasPlugin;
  window.CardFramePlugins['mindcanvas'] = MindCanvasPlugin;

})(window);
