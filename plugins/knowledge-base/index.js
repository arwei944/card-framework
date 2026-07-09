(function(window) {
  'use strict';

  const KnowledgeBasePlugin = {
    name: 'knowledge-base',
    version: '1.0.0',
    description: '知识库插件，提供笔记和文章卡片类型，支持搜索和分类统计',
    author: 'CardFrame Team',

    install(frame) {
      const pluginInstance = {
        frame: frame,

        searchNotes(keyword) {
          if (!keyword) return [];

          const allCards = frame.store.getAllCards();
          const lowerKeyword = keyword.toLowerCase();

          return allCards.filter(card => {
            if (card.type !== 'note' && card.type !== 'article') return false;

            const title = (card.props.title || '').toLowerCase();
            const content = (card.props.content || '').toLowerCase();
            const category = (card.props.category || '').toLowerCase();
            const tags = card.props.tags || [];

            if (title.includes(lowerKeyword)) return true;
            if (content.includes(lowerKeyword)) return true;
            if (category.includes(lowerKeyword)) return true;

            let tagArray = tags;
            if (typeof tags === 'string') {
              try {
                tagArray = JSON.parse(tags);
              } catch {
                tagArray = tags.split(',').map(t => t.trim());
              }
            }
            if (Array.isArray(tagArray)) {
              return tagArray.some(tag => 
              tag.toLowerCase().includes(lowerKeyword)
            );
            }

            return false;
          });
        },

        getCategoryStats() {
          const allCards = frame.store.getAllCards();
          const stats = {};

          allCards.forEach(card => {
            if (card.type !== 'note' && card.type !== 'article') return;

            const category = card.props.category || '未分类';
            if (!stats[category]) {
              stats[category] = { note: 0, article: 0, total: 0 };
            }
            stats[category].total++;
            if (card.type === 'note') {
              stats[category].note++;
            } else if (card.type === 'article') {
              stats[category].article++;
            }
          });

          return stats;
        },

        renderMarkdown(text) {
          if (!text) return '';

          let html = text;

          html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
          html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
          html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

          html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

          const lines = html.split('\n');
          let inList = false;
          let result = [];

          for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (/^[-*] (.*)$/.test(line)) {
              if (!inList) {
                result.push('<ul>');
                inList = true;
              }
              result.push('<li>' + line.replace(/^[-*] (.*)$/, '$1') + '</li>');
            } else if (/^\d+\. (.*)$/.test(line)) {
              if (!inList) {
                result.push('<ol>');
                inList = true;
              }
              result.push('<li>' + line.replace(/^\d+\. (.*)$/, '$1') + '</li>');
            } else {
              if (inList) {
                const lastTag = result[result.length - 1] === '</ul>' ? '</ul>' : '</ol>';
                result.push(lastTag);
                inList = false;
              }
              if (line.trim() !== '') {
                result.push('<p>' + line + '</p>');
              }
            }
          }

          if (inList) {
            const lastTag = result[result.length - 1] === '</ul>' ? '</ul>' : '</ol>';
            result.push(lastTag);
          }

          return result.join('\n');
        },

        incrementReadCount(cardId) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          let count = parseInt(card.props.readCount || 0);
          count = isNaN(count) ? 0 : count;
          card.props.readCount = count + 1;

          return frame.store.updateCard(card);
        },

        toggleCategory(cardId, category) {
          const card = frame.store.getCard(cardId);
          if (!card) return null;

          if (card.props.category === category) {
            card.props.category = '';
          } else {
            card.props.category = category;
          }

          return frame.store.updateCard(card);
        }
      };

      return pluginInstance;
    },

    cardTypes: [
      {
        type: 'note',
        label: '笔记',
        icon: '📝',
        description: '用于记录笔记内容',
        extends: 'text',
        propsSchema: [
          { name: 'category', type: 'string', required: false, label: '分类', defaultValue: '' },
          { name: 'tags', type: 'array', required: false, label: '标签', defaultValue: '[]' },
          { name: 'source', type: 'string', required: false, label: '来源', defaultValue: '' },
          { name: 'readCount', type: 'number', required: false, label: '阅读次数', defaultValue: 0 }
        ],
        renderTemplate: `
          <div class="card card-note">
            <div class="card-header">
              <span class="card-icon">{{icon}}</span>
              <h3 class="card-title">{{title}}</h3>
            </div>
            <div class="card-body">
              <div class="card-meta" style="font-size: 12px; color: #666; margin-bottom: 8px;">
                <span class="card-category" style="display: {{category ? 'inline' : 'none'}};">📂 {{category}}</span>
                <span class="card-read-count" style="margin-left: 10px;">👁️ {{readCount || 0}}</span>
              </div>
              <div class="card-note-content">{{content}}</div>
            </div>
            <div class="card-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary" data-action="incrementRead">增加阅读</button>
              <button class="btn btn-secondary" data-action="toggleCategory">切换分类</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'incrementRead',
            label: '增加阅读',
            handler: (card) => {
              let count = parseInt(card.props.readCount || 0);
              count = isNaN(count) ? 0 : count;
              card.props.readCount = count + 1;
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          },
          {
            name: 'toggleCategory',
            label: '切换分类',
            handler: (card) => {
              const category = prompt('输入分类名称（留空则清除分类）：');
              if (category === null) return;
              card.props.category = category;
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          }
        ],
        defaultStyle: {}
      },
      {
        type: 'article',
        label: '文章',
        icon: '📄',
        description: '用于发表文章内容',
        extends: 'note',
        propsSchema: [
          { name: 'category', type: 'string', required: false, label: '分类', defaultValue: '' },
          { name: 'tags', type: 'array', required: false, label: '标签', defaultValue: '[]' },
          { name: 'source', type: 'string', required: false, label: '来源', defaultValue: '' },
          { name: 'readCount', type: 'number', required: false, label: '阅读次数', defaultValue: 0 }
        ],
        renderTemplate: `
          <div class="card card-article">
            <div class="card-header">
              <span class="card-icon">{{icon}}</span>
              <h3 class="card-title">{{title}}</h3>
            </div>
            <div class="card-body">
              <div class="card-meta" style="font-size: 12px; color: #666; margin-bottom: 8px;">
                <span class="card-category" style="display: {{category ? 'inline' : 'none'}};">📂 {{category}}</span>
                <span class="card-source" style="display: {{source ? 'inline' : 'none'}}; margin-left: 10px;">🔗 {{source}}</span>
                <span class="card-read-count" style="margin-left: 10px;">👁️ {{readCount || 0}}</span>
              </div>
              <div class="card-article-content">{{content}}</div>
            </div>
            <div class="card-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-secondary" data-action="incrementRead">增加阅读</button>
              <button class="btn btn-secondary" data-action="toggleCategory">切换分类</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'incrementRead',
            label: '增加阅读',
            handler: (card) => {
              let count = parseInt(card.props.readCount || 0);
              count = isNaN(count) ? 0 : count;
              card.props.readCount = count + 1;
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          },
          {
            name: 'toggleCategory',
            label: '切换分类',
            handler: (card) => {
              const category = prompt('输入分类名称（留空则清除分类）：');
              if (category === null) return;
              card.props.category = category;
              const store = card.store || CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          }
        ],
        defaultStyle: {}
      }
    ],

    hooks: {},

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
  window.CardFramePlugins['knowledge-base'] = KnowledgeBasePlugin;

})(window);
