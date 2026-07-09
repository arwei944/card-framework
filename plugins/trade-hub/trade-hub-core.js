/**
 * Trade Hub Core Plugin for CardFrame
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const TradeHubCore = {
    name: 'trade-hub-core',
    version: '1.0.0',
    dependencies: ['tailwind-integration'],

    install(frame, options = {}) {
      this._frame = frame;
      this._page = options.page || 'dashboard';
      this._registerTypes(frame);
      this._setupOrchestration(frame);
    },

    _registerTypes(frame) {
      const registry = frame.typeRegistry;

      // AI Assistant
      registry.registerType('th-ai-chat', {
        name: 'th-ai-chat', label: 'AI助手', icon: '🤖',
        extends: 'shared-base',
        propsSchema: [
          { name: 'messages', type: 'array', defaultValue: [] },
          { name: 'suggestions', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="th-ai-chat">
            <div class="th-messages">${(c.props.messages || []).map(m => `<div class="th-msg th-msg-${m.role}">${Utils.escapeHtml(m.text)}</div>`).join('')}</div>
            <div class="th-suggestions">${(c.props.suggestions || []).map(s => `<button class="th-suggestion">${Utils.escapeHtml(s)}</button>`).join('')}</div>
            <input class="th-input" placeholder="询问 AI 关于交易的问题...">
          </div>`
      });

      // Dashboard stat card
      registry.registerType('th-stat-card', {
        name: 'th-stat-card', label: '统计卡片', icon: '📊',
        extends: 'shared-base',
        propsSchema: [
          { name: 'label', type: 'string', defaultValue: '' },
          { name: 'value', type: 'string', defaultValue: '' },
          { name: 'change', type: 'string', defaultValue: '' },
          { name: 'trend', type: 'string', defaultValue: 'up' }
        ],
        renderTemplate: (c) => `
          <div class="th-stat-card">
            <div class="th-stat-label">${Utils.escapeHtml(c.props.label)}</div>
            <div class="th-stat-value">${Utils.escapeHtml(c.props.value)}</div>
            <div class="th-stat-change ${c.props.trend}">${Utils.escapeHtml(c.props.change)}</div>
          </div>`
      });

      // Strategy card
      registry.registerType('th-strategy-card', {
        name: 'th-strategy-card', label: '策略', icon: '🎯',
        extends: 'shared-base',
        propsSchema: [
          { name: 'name', type: 'string', defaultValue: '' },
          { name: 'performance', type: 'number', defaultValue: 0 },
          { name: 'status', type: 'string', defaultValue: 'idle' }
        ],
        renderTemplate: (c) => `
          <div class="th-strategy-card">
            <div class="th-strat-name">${Utils.escapeHtml(c.props.name)}</div>
            <div class="th-strat-perf">${c.props.performance}%</div>
            <div class="th-strat-status ${c.props.status}">${c.props.status}</div>
          </div>`
      });

      // Order form
      registry.registerType('th-order-form', {
        name: 'th-order-form', label: '下单', icon: '📝',
        extends: 'shared-base',
        propsSchema: [
          { name: 'side', type: 'string', defaultValue: 'buy' },
          { name: 'type', type: 'string', defaultValue: 'limit' }
        ],
        renderTemplate: (c) => `
          <div class="th-order-form">
            <div class="th-order-tabs">
              <button class="th-tab ${c.props.side === 'buy' ? 'active' : ''}" data-side="buy">买入</button>
              <button class="th-tab ${c.props.side === 'sell' ? 'active' : ''}" data-side="sell">卖出</button>
            </div>
            <div class="th-order-fields">
              <input type="number" placeholder="价格" class="th-field">
              <input type="number" placeholder="数量" class="th-field">
              <button class="th-submit-${c.props.side}">${c.props.side === 'buy' ? '买入' : '卖出'}</button>
            </div>
          </div>`
      });

      // 图表小组件
      registry.registerType('th-chart-widget', {
        name: 'th-chart-widget', label: '图表小组件', icon: '📈',
        extends: 'shared-base',
        propsSchema: [
          { name: 'title', type: 'string', defaultValue: '' },
          { name: 'data', type: 'array', defaultValue: [] },
          { name: 'trend', type: 'string', defaultValue: 'up' },
          { name: 'changePercent', type: 'number', defaultValue: 0 }
        ],
        renderTemplate: (c) => {
          const data = c.props.data || [];
          const isUp = c.props.trend === 'up' || c.props.changePercent >= 0;
          const color = isUp ? '#10b981' : '#ef4444';
          
          // 生成迷你 SVG 折线图
          let svgPath = '';
          if (data.length > 1) {
            const width = 120;
            const height = 40;
            const values = data.map(d => d.value);
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const range = maxVal - minVal || 1;
            
            const points = data.map((d, i) => {
              const x = (i / (data.length - 1)) * width;
              const y = height - ((d.value - minVal) / range) * height;
              return `${x},${y}`;
            });
            svgPath = `
              <svg width="${width}" height="${height}" class="th-mini-chart">
                <polyline fill="none" stroke="${color}" stroke-width="2" points="${points.join(' ')}" />
              </svg>
            `;
          }
          
          return `
            <div class="th-chart-widget">
              <div class="th-chart-title">${Utils.escapeHtml(c.props.title)}</div>
              <div class="th-chart-row">
                ${svgPath}
                <div class="th-chart-change ${isUp ? 'up' : 'down'}">
                  ${isUp ? '+' : ''}${c.props.changePercent}%
                </div>
              </div>
            </div>`;
        }
      });

      // 告警列表
      registry.registerType('th-alert-list', {
        name: 'th-alert-list', label: '告警列表', icon: '🔔',
        extends: 'shared-base',
        propsSchema: [
          { name: 'alerts', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => {
          const alerts = c.props.alerts || [];
          const levelIcons = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
          };
          
          const alertsHtml = alerts.map(alert => {
            const level = alert.level || 'info';
            const icon = levelIcons[level] || levelIcons.info;
            return `
              <div class="th-alert-item th-alert-${level}">
                <span class="th-alert-icon">${icon}</span>
                <div class="th-alert-content">
                  <div class="th-alert-message">${Utils.escapeHtml(alert.message)}</div>
                  <div class="th-alert-time">${Utils.escapeHtml(alert.time || '')}</div>
                </div>
                ${!alert.isRead ? '<span class="th-alert-unread"></span>' : ''}
              </div>
            `;
          }).join('');
          
          return `
            <div class="th-alert-list">
              ${alertsHtml || '<div class="th-alert-empty">暂无告警</div>'}
            </div>`;
        }
      });

      // 盈亏图表
      registry.registerType('th-profit-chart', {
        name: 'th-profit-chart', label: '盈亏图表', icon: '📊',
        extends: 'shared-base',
        propsSchema: [
          { name: 'periods', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => {
          const periods = c.props.periods || [];
          
          // 计算累计盈亏
          let cumulative = 0;
          const cumulativeData = periods.map(p => {
            cumulative += p.profit || 0;
            return { date: p.date, value: cumulative };
          });
          
          // 生成 SVG 折线图
          let svgContent = '';
          if (cumulativeData.length > 1) {
            const width = 300;
            const height = 150;
            const padding = 20;
            const chartW = width - padding * 2;
            const chartH = height - padding * 2;
            
            const values = cumulativeData.map(d => d.value);
            const minVal = Math.min(...values, 0);
            const maxVal = Math.max(...values, 0);
            const range = maxVal - minVal || 1;
            
            const points = cumulativeData.map((d, i) => {
              const x = padding + (i / (cumulativeData.length - 1)) * chartW;
              const y = padding + chartH - ((d.value - minVal) / range) * chartH;
              return `${x},${y}`;
            });
            
            const lastValue = cumulativeData[cumulativeData.length - 1].value;
            const isPositive = lastValue >= 0;
            const color = isPositive ? '#10b981' : '#ef4444';
            
            // 零线位置
            const zeroY = padding + chartH - ((0 - minVal) / range) * chartH;
            
            svgContent = `
              <svg width="${width}" height="${height}" class="th-profit-svg">
                <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4" />
                <polyline fill="none" stroke="${color}" stroke-width="2" points="${points.join(' ')}" />
              </svg>
              <div class="th-profit-total ${isPositive ? 'up' : 'down'}">
                累计盈亏: ${isPositive ? '+' : ''}$${lastValue.toFixed(2)}
              </div>
            `;
          }
          
          return `
            <div class="th-profit-chart">
              <div class="th-profit-title">盈亏走势</div>
              ${svgContent || '<div class="th-profit-empty">暂无数据</div>'}
            </div>`;
        }
      });

      // 交易明细表
      registry.registerType('th-trade-table', {
        name: 'th-trade-table', label: '交易明细', icon: '📋',
        extends: 'shared-base',
        propsSchema: [
          { name: 'trades', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => {
          const trades = c.props.trades || [];
          
          const rowsHtml = trades.map(trade => {
            const isBuy = trade.side === 'buy';
            const isProfit = (trade.pnl || 0) >= 0;
            return `
              <tr class="th-trade-row">
                <td>${Utils.escapeHtml(trade.time || '')}</td>
                <td>${Utils.escapeHtml(trade.pair || '')}</td>
                <td class="th-trade-side ${isBuy ? 'buy' : 'sell'}">${isBuy ? '买入' : '卖出'}</td>
                <td>${Utils.escapeHtml(String(trade.price || ''))}</td>
                <td>${Utils.escapeHtml(String(trade.amount || ''))}</td>
                <td>${Utils.escapeHtml(String(trade.fee || ''))}</td>
                <td class="th-trade-pnl ${isProfit ? 'up' : 'down'}">${isProfit ? '+' : ''}${Utils.escapeHtml(String(trade.pnl || 0))}</td>
              </tr>
            `;
          }).join('');
          
          return `
            <div class="th-trade-table">
              <div class="th-trade-title">交易明细</div>
              <div class="th-trade-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>交易对</th>
                      <th>方向</th>
                      <th>价格</th>
                      <th>数量</th>
                      <th>手续费</th>
                      <th>盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml || '<tr><td colspan="7" class="th-trade-empty">暂无交易记录</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>`;
        }
      });

      // 报表卡片
      registry.registerType('th-report-card', {
        name: 'th-report-card', label: '报表卡片', icon: '📑',
        extends: 'shared-base',
        propsSchema: [
          { name: 'totalProfit', type: 'number', defaultValue: 0 },
          { name: 'winRate', type: 'number', defaultValue: 0 },
          { name: 'avgWin', type: 'number', defaultValue: 0 },
          { name: 'avgLoss', type: 'number', defaultValue: 0 },
          { name: 'maxWin', type: 'number', defaultValue: 0 },
          { name: 'maxLoss', type: 'number', defaultValue: 0 },
          { name: 'totalFees', type: 'number', defaultValue: 0 }
        ],
        renderTemplate: (c) => {
          const isTotalProfitPositive = c.props.totalProfit >= 0;
          
          const items = [
            { label: '总盈亏', value: `$${c.props.totalProfit.toFixed(2)}`, highlight: true, positive: isTotalProfitPositive },
            { label: '胜率', value: `${c.props.winRate}%`, highlight: false },
            { label: '平均盈利', value: `$${c.props.avgWin.toFixed(2)}`, highlight: false, positive: true },
            { label: '平均亏损', value: `$${Math.abs(c.props.avgLoss).toFixed(2)}`, highlight: false, positive: false },
            { label: '最大盈利', value: `$${c.props.maxWin.toFixed(2)}`, highlight: false, positive: true },
            { label: '最大亏损', value: `$${Math.abs(c.props.maxLoss).toFixed(2)}`, highlight: false, positive: false },
            { label: '总手续费', value: `$${c.props.totalFees.toFixed(2)}`, highlight: false }
          ];
          
          const itemsHtml = items.map(item => `
            <div class="th-report-item ${item.highlight ? 'highlight' : ''}">
              <div class="th-report-label">${item.label}</div>
              <div class="th-report-value ${item.positive === true ? 'up' : item.positive === false ? 'down' : ''}">${item.value}</div>
            </div>
          `).join('');
          
          return `
            <div class="th-report-card">
              <div class="th-report-title">交易报表</div>
              <div class="th-report-grid">
                ${itemsHtml}
              </div>
            </div>`;
        }
      });
    },

    /**
     * 4.2.1 / 4.2.2 编排关系
     */
    _setupOrchestration(frame) {
      // AI 建议 -> 策略更新
      frame.eventBus.on('ai:suggestion', (data) => {
        const strategyCards = frame.store.getCardsByType('th-strategy-card');
        strategyCards.forEach(card => {
          frame.updateCardProps(card.id, {
            status: 'active',
            performance: data.confidence || card.props.performance
          });
        });
      });

      // 策略执行 -> 交易面板
      frame.eventBus.on('strategy:execute', (data) => {
        const orderCards = frame.store.getCardsByType('th-order-form');
        orderCards.forEach(card => {
          frame.updateCardProps(card.id, {
            side: data.side || card.props.side
          });
        });
      });

      // 交易完成 -> 更新统计
      frame.eventBus.on('order:completed', (data) => {
        const statCards = frame.store.getCardsByType('th-stat-card');
        statCards.forEach(card => {
          if (card.props.label === '今日盈亏') {
            frame.updateCardProps(card.id, {
              value: `$${data.profit || 0}`,
              change: `${data.change || 0}%`,
              trend: (data.profit || 0) >= 0 ? 'up' : 'down'
            });
          }
        });
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TradeHubCore;
  global.CardFrameTradeHubCore = TradeHubCore;

})(typeof window !== 'undefined' ? window : this);
