(function(window) {
  'use strict';

  const DashboardPlugin = {
    name: 'dashboard',
    version: '1.0.0',
    description: '仪表盘插件，提供统计卡片和图表卡片，支持数据汇总展示',
    author: 'CardFrame Team',
    dependencies: [],

    install(frame) {
      const pluginInstance = {
        frame: frame,

        getDashboardData() {
          const allCards = frame.store.getAllCards();
          const data = {
            totalCards: allCards.length,
            byType: {},
            taskStats: null,
            knowledgeStats: null
          };

          allCards.forEach(card => {
            if (!data.byType[card.type]) {
              data.byType[card.type] = 0;
            }
            data.byType[card.type]++;
          });

          const taskManager = frame.pluginManager.get('task-manager');
          if (taskManager) {
            data.taskStats = taskManager.getTaskStats();
          }

          const knowledgeBase = frame.pluginManager.get('knowledge-base');
          if (knowledgeBase) {
            data.knowledgeStats = knowledgeBase.getCategoryStats();
          }

          return data;
        },

        refreshStats() {
          const allCards = frame.store.getAllCards();
          const statCards = allCards.filter(c => c.type === 'stat-card');

          statCards.forEach(card => {
            const statType = card.props.statType;
            let value = 0;

            switch (statType) {
              case 'totalTasks':
                const taskManager = frame.pluginManager.get('task-manager');
                if (taskManager) {
                  const stats = taskManager.getTaskStats();
                  value = stats.total;
                }
                break;
              case 'completedTasks':
                const taskMgr = frame.pluginManager.get('task-manager');
                if (taskMgr) {
                  const s = taskMgr.getTaskStats();
                  value = s.completed;
                }
                break;
              case 'highPriorityTasks':
                const tm = frame.pluginManager.get('task-manager');
                if (tm) {
                  const st = tm.getTaskStats();
                  value = st.highPriority;
                }
                break;
              case 'totalNotes':
                const kb = frame.pluginManager.get('knowledge-base');
                if (kb) {
                  const notes = frame.store.getCardsByType('note');
                  const articles = frame.store.getCardsByType('article');
                  value = notes.length + articles.length;
                } else {
                  const notes = frame.store.getCardsByType('note');
                  const articles = frame.store.getCardsByType('article');
                  value = notes.length + articles.length;
                }
                break;
              default:
                value = card.props.value || 0;
            }

            card.props.value = value;
            frame.store.updateCard(card);
          });

          return true;
        }
      };

      return pluginInstance;
    },

    cardTypes: [
      {
        type: 'stat-card',
        label: '统计卡片',
        icon: '📊',
        description: '用于展示统计数据的卡片',
        extends: 'base',
        propsSchema: [
          { name: 'value', type: 'number', required: false, label: '数值', defaultValue: 0 },
          { name: 'trend', type: 'string', required: false, label: '趋势', allowedValues: ['up', 'down', 'neutral'], defaultValue: 'neutral' },
          { name: 'changePercent', type: 'string', required: false, label: '变化百分比', defaultValue: '' },
          { name: 'statType', type: 'string', required: false, label: '统计类型', defaultValue: '' }
        ],
        renderTemplate: `
          <div class="card card-stat card-trend-{{trend}}">
            <div class="card-header">
              <span class="card-icon">{{icon}}</span>
              <h3 class="card-title">{{title}}</h3>
            </div>
            <div class="card-body">
              <div class="stat-value" style="font-size: 36px; font-weight: bold; margin: 10px 0;">{{value}}</div>
              <div class="stat-trend" style="display: {{changePercent ? 'flex' : 'none'}}; align-items: center; gap: 8px; font-size: 14px;">
                <span class="trend-icon">{{trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️'}}</span>
                <span class="trend-percent">{{changePercent}}</span>
              </div>
            </div>
            <div class="card-footer">
              <button class="btn btn-secondary" data-action="refresh">刷新</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'refresh',
            label: '刷新',
            handler: (card) => {
              const dashboard = CardFrame._globalDashboard;
              if (dashboard) {
                dashboard.refreshStats();
              }
            }
          }
        ],
        defaultStyle: {}
      },
      {
        type: 'chart-card',
        label: '图表卡片',
        icon: '📈',
        description: '用于展示简单柱状图或折线图的卡片',
        extends: 'base',
        propsSchema: [
          { name: 'data', type: 'string', required: false, label: '数据', defaultValue: '[]' },
          { name: 'chartType', type: 'string', required: false, label: '图表类型', allowedValues: ['bar', 'line'], defaultValue: 'bar' }
        ],
        renderTemplate: `
          <div class="card card-chart">
            <div class="card-header">
              <span class="card-icon">{{icon}}</span>
              <h3 class="card-title">{{title}}</h3>
            </div>
            <div class="card-body">
              <div class="chart-container" style="display: flex; align-items: flex-end; height: 150px; gap: 8px; padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
              </div>
              <div class="chart-type-label" style="font-size: 12px; color: #999; margin-top: 8px;">
                图表类型: {{chartType}}
              </div>
            </div>
            <div class="card-footer">
              <button class="btn btn-secondary" data-action="toggleChartType">切换类型</button>
            </div>
          </div>
        `,
        actions: [
          {
            name: 'toggleChartType',
            label: '切换类型',
            handler: (card) => {
              card.props.chartType = card.props.chartType === 'bar' ? 'line' : 'bar';
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
  window.CardFramePlugins['dashboard'] = DashboardPlugin;

})(window);
