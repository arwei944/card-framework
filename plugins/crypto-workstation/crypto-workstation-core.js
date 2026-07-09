/**
 * Crypto Workstation Core Plugin for CardFrame
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const CryptoWorkstationCore = {
    name: 'crypto-workstation-core',
    version: '1.0.0',
    dependencies: ['tailwind-integration'],

    install(frame, options = {}) {
      this._frame = frame;
      this._page = options.page || 'trading';
      this._registerTypes(frame);
    },

    _registerTypes(frame) {
      const registry = frame.typeRegistry;

      // Trading page cards
      registry.registerType('trade-panel', {
        name: 'trade-panel', label: '交易面板', icon: '💱',
        extends: 'shared-base',
        propsSchema: [
          { name: 'pair', type: 'string', defaultValue: 'BTC/USDT' },
          { name: 'price', type: 'number', defaultValue: 0 },
          { name: 'change', type: 'number', defaultValue: 0 },
          { name: 'orders', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-trade-panel">
            <div class="cw-pair">${Utils.escapeHtml(c.props.pair)}</div>
            <div class="cw-price" style="color:${c.props.change >= 0 ? '#10b981' : '#ef4444'}">${c.props.price}</div>
            <div class="cw-change">${c.props.change >= 0 ? '+' : ''}${c.props.change}%</div>
            <div class="cw-actions">
              <button class="cw-btn-buy">买入</button>
              <button class="cw-btn-sell">卖出</button>
            </div>
          </div>`
      });

      registry.registerType('order-book', {
        name: 'order-book', label: '订单簿', icon: '📖',
        extends: 'shared-base',
        propsSchema: [
          { name: 'bids', type: 'array', defaultValue: [] },
          { name: 'asks', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-order-book">
            <div class="cw-asks">${(c.props.asks || []).slice(0,5).map(a => `<div class="cw-ask-row"><span>${a.price}</span><span>${a.amount}</span></div>`).join('')}</div>
            <div class="cw-spread">Spread</div>
            <div class="cw-bids">${(c.props.bids || []).slice(0,5).map(b => `<div class="cw-bid-row"><span>${b.price}</span><span>${b.amount}</span></div>`).join('')}</div>
          </div>`
      });

      // 持仓列表卡片
      registry.registerType('position-list', {
        name: 'position-list', label: '持仓列表', icon: '📊',
        extends: 'shared-base',
        propsSchema: [
          { name: 'positions', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-position-list">
            <div class="cw-position-header">
              <span>币种</span>
              <span>数量</span>
              <span>开仓价</span>
              <span>当前价</span>
              <span>盈亏</span>
              <span>盈亏%</span>
            </div>
            <div class="cw-position-body">
              ${(c.props.positions || []).map(p => {
                const pnlColor = p.pnl >= 0 ? '#10b981' : '#ef4444';
                return `
                  <div class="cw-position-row">
                    <span>${Utils.escapeHtml(p.symbol)}</span>
                    <span>${p.size}</span>
                    <span>${p.entryPrice}</span>
                    <span>${p.currentPrice}</span>
                    <span style="color:${pnlColor}">${p.pnl >= 0 ? '+' : ''}${p.pnl}</span>
                    <span style="color:${pnlColor}">${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent}%</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>`
      });

      // 历史交易表卡片
      registry.registerType('history-table', {
        name: 'history-table', label: '历史交易', icon: '📜',
        extends: 'shared-base',
        propsSchema: [
          { name: 'trades', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-history-table">
            <div class="cw-history-header">
              <span>时间</span>
              <span>交易对</span>
              <span>方向</span>
              <span>价格</span>
              <span>数量</span>
              <span>盈亏</span>
            </div>
            <div class="cw-history-body">
              ${(c.props.trades || []).map(t => {
                const sideColor = t.side === 'buy' ? '#10b981' : '#ef4444';
                const pnlColor = t.pnl >= 0 ? '#10b981' : '#ef4444';
                return `
                  <div class="cw-history-row">
                    <span>${Utils.escapeHtml(t.time)}</span>
                    <span>${Utils.escapeHtml(t.pair)}</span>
                    <span style="color:${sideColor}">${t.side === 'buy' ? '买入' : '卖出'}</span>
                    <span>${t.price}</span>
                    <span>${t.amount}</span>
                    <span style="color:${pnlColor}">${t.pnl >= 0 ? '+' : ''}${t.pnl}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>`
      });

      // Analysis page cards
      registry.registerType('chart-panel', {
        name: 'chart-panel', label: '图表', icon: '📈',
        extends: 'shared-base',
        propsSchema: [
          { name: 'symbol', type: 'string', defaultValue: 'BTC' },
          { name: 'timeframe', type: 'string', defaultValue: '1H' }
        ],
        renderTemplate: (c) => `
          <div class="cw-chart-panel">
            <div class="cw-chart-header">${Utils.escapeHtml(c.props.symbol)} - ${c.props.timeframe}</div>
            <div class="cw-chart-placeholder">
              <svg viewBox="0 0 400 150" style="width:100%;height:150px">
                <polyline points="0,120 50,100 100,110 150,80 200,90 250,60 300,70 350,40 400,50" fill="none" stroke="var(--cf-primary,#6366f1)" stroke-width="2"/>
              </svg>
            </div>
          </div>`
      });

      // 指标列表卡片
      registry.registerType('indicator-list', {
        name: 'indicator-list', label: '指标列表', icon: '📏',
        extends: 'shared-base',
        propsSchema: [
          { name: 'indicators', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-indicator-list">
            ${(c.props.indicators || []).map(ind => {
              let signalColor = '#6b7280';
              let signalText = '中性';
              if (ind.signal === 'buy') {
                signalColor = '#10b981';
                signalText = '买入';
              } else if (ind.signal === 'sell') {
                signalColor = '#ef4444';
                signalText = '卖出';
              }
              return `
                <div class="cw-indicator-row">
                  <span class="cw-indicator-name">${Utils.escapeHtml(ind.name)}</span>
                  <span class="cw-indicator-value">${ind.value}</span>
                  <span class="cw-indicator-signal" style="color:${signalColor}">${signalText}</span>
                </div>
              `;
            }).join('')}
          </div>`
      });

      // Strategy page cards
      registry.registerType('strategy-config', {
        name: 'strategy-config', label: '策略配置', icon: '⚙️',
        extends: 'shared-base',
        propsSchema: [
          { name: 'strategyName', type: 'string', defaultValue: 'MA Cross' },
          { name: 'params', type: 'array', defaultValue: [] },
          { name: 'isActive', type: 'boolean', defaultValue: false }
        ],
        renderTemplate: (c) => `
          <div class="cw-strategy-config">
            <div class="cw-strat-name">${Utils.escapeHtml(c.props.strategyName)}</div>
            <div class="cw-strat-status ${c.props.isActive ? 'active' : ''}">${c.props.isActive ? '运行中' : '已停止'}</div>
            <div class="cw-strat-params">${(c.props.params || []).map(p => `<div class="cw-param"><span>${p.name}</span><span>${p.value}</span></div>`).join('')}</div>
          </div>`
      });

      // 回测结果卡片
      registry.registerType('backtest-result', {
        name: 'backtest-result', label: '回测结果', icon: '📉',
        extends: 'shared-base',
        propsSchema: [
          { name: 'totalReturn', type: 'number', defaultValue: 0 },
          { name: 'winRate', type: 'number', defaultValue: 0 },
          { name: 'maxDrawdown', type: 'number', defaultValue: 0 },
          { name: 'sharpeRatio', type: 'number', defaultValue: 0 },
          { name: 'totalTrades', type: 'number', defaultValue: 0 }
        ],
        renderTemplate: (c) => {
          const returnColor = c.props.totalReturn >= 0 ? '#10b981' : '#ef4444';
          const curvePoints = '0,120 40,110 80,115 120,90 160,100 200,70 240,80 280,50 320,60 360,30 400,40';
          return `
            <div class="cw-backtest-result">
              <div class="cw-backtest-stats">
                <div class="cw-stat-card">
                  <div class="cw-stat-label">总收益</div>
                  <div class="cw-stat-value" style="color:${returnColor}">${c.props.totalReturn >= 0 ? '+' : ''}${c.props.totalReturn}%</div>
                </div>
                <div class="cw-stat-card">
                  <div class="cw-stat-label">胜率</div>
                  <div class="cw-stat-value">${c.props.winRate}%</div>
                </div>
                <div class="cw-stat-card">
                  <div class="cw-stat-label">最大回撤</div>
                  <div class="cw-stat-value" style="color:#ef4444">-${c.props.maxDrawdown}%</div>
                </div>
                <div class="cw-stat-card">
                  <div class="cw-stat-label">夏普比率</div>
                  <div class="cw-stat-value">${c.props.sharpeRatio}</div>
                </div>
              </div>
              <div class="cw-backtest-chart">
                <div class="cw-backtest-trades">交易次数: ${c.props.totalTrades}</div>
                <svg viewBox="0 0 400 130" style="width:100%;height:130px">
                  <defs>
                    <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style="stop-color:var(--cf-primary,#6366f1);stop-opacity:0.3"/>
                      <stop offset="100%" style="stop-color:var(--cf-primary,#6366f1);stop-opacity:0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,130 L${curvePoints} L400,130 Z" fill="url(#curveGradient)"/>
                  <polyline points="${curvePoints}" fill="none" stroke="var(--cf-primary,#6366f1)" stroke-width="2"/>
                </svg>
              </div>
            </div>`;
        }
      });

      // 参数编辑器卡片
      registry.registerType('param-editor', {
        name: 'param-editor', label: '参数编辑器', icon: '🎛️',
        extends: 'shared-base',
        propsSchema: [
          { name: 'params', type: 'array', defaultValue: [] }
        ],
        renderTemplate: (c) => `
          <div class="cw-param-editor">
            ${(c.props.params || []).map(p => {
              const isRange = p.type === 'range' || p.type === 'number';
              return `
                <div class="cw-param-editor-row">
                  <span class="cw-param-name">${Utils.escapeHtml(p.name)}</span>
                  ${isRange && p.min !== undefined && p.max !== undefined ? `
                    <input type="range" class="cw-param-slider" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${p.value}" disabled/>
                  ` : ''}
                  <input type="${p.type || 'text'}" class="cw-param-input" value="${p.value}" ${p.min !== undefined ? `min="${p.min}"` : ''} ${p.max !== undefined ? `max="${p.max}"` : ''} ${p.step !== undefined ? `step="${p.step}"` : ''} disabled/>
                </div>
              `;
            }).join('')}
          </div>`
      });

      // Discovery page cards
      registry.registerType('asset-card', {
        name: 'asset-card', label: '资产', icon: '🪙',
        extends: 'shared-base',
        propsSchema: [
          { name: 'symbol', type: 'string', defaultValue: 'BTC' },
          { name: 'name', type: 'string', defaultValue: 'Bitcoin' },
          { name: 'price', type: 'number', defaultValue: 0 },
          { name: 'change24h', type: 'number', defaultValue: 0 }
        ],
        renderTemplate: (c) => `
          <div class="cw-asset-card">
            <div class="cw-asset-icon">${Utils.escapeHtml(c.props.symbol[0])}</div>
            <div class="cw-asset-info">
              <div class="cw-asset-name">${Utils.escapeHtml(c.props.name)}</div>
              <div class="cw-asset-symbol">${Utils.escapeHtml(c.props.symbol)}</div>
            </div>
            <div class="cw-asset-price">
              <div>$${c.props.price}</div>
              <div style="color:${c.props.change24h >= 0 ? '#10b981' : '#ef4444'}">${c.props.change24h >= 0 ? '+' : ''}${c.props.change24h}%</div>
            </div>
          </div>`
      });

      // 筛选面板卡片
      registry.registerType('filter-panel', {
        name: 'filter-panel', label: '筛选面板', icon: '🔍',
        extends: 'shared-base',
        propsSchema: [
          { name: 'categories', type: 'array', defaultValue: [] },
          { name: 'sortBy', type: 'string', defaultValue: 'marketCap' },
          { name: 'priceRange', type: 'object', defaultValue: { min: 0, max: 100000 } }
        ],
        renderTemplate: (c) => {
          const allCategories = ['DeFi', 'NFT', 'Layer1', 'Layer2', 'Meme', 'Gaming', 'AI'];
          return `
            <div class="cw-filter-panel">
              <div class="cw-filter-section">
                <div class="cw-filter-label">类别筛选</div>
                <div class="cw-filter-categories">
                  ${allCategories.map(cat => {
                    const isSelected = (c.props.categories || []).includes(cat);
                    return `
                      <span class="cw-filter-tag ${isSelected ? 'active' : ''}">${Utils.escapeHtml(cat)}</span>
                    `;
                  }).join('')}
                </div>
              </div>
              <div class="cw-filter-section">
                <div class="cw-filter-label">排序方式</div>
                <select class="cw-filter-select" disabled>
                  <option value="marketCap" ${c.props.sortBy === 'marketCap' ? 'selected' : ''}>市值</option>
                  <option value="price" ${c.props.sortBy === 'price' ? 'selected' : ''}>价格</option>
                  <option value="change24h" ${c.props.sortBy === 'change24h' ? 'selected' : ''}>24h涨幅</option>
                  <option value="volume" ${c.props.sortBy === 'volume' ? 'selected' : ''}>成交量</option>
                </select>
              </div>
              <div class="cw-filter-section">
                <div class="cw-filter-label">价格范围</div>
                <div class="cw-filter-price-range">
                  <input type="number" class="cw-filter-price-input" placeholder="最低" value="${c.props.priceRange?.min || 0}" disabled/>
                  <span class="cw-filter-price-sep">-</span>
                  <input type="number" class="cw-filter-price-input" placeholder="最高" value="${c.props.priceRange?.max || 100000}" disabled/>
                </div>
              </div>
            </div>`;
        }
      });

      // 资产详情卡片
      registry.registerType('asset-detail', {
        name: 'asset-detail', label: '资产详情', icon: '📋',
        extends: 'shared-base',
        propsSchema: [
          { name: 'symbol', type: 'string', defaultValue: 'BTC' },
          { name: 'name', type: 'string', defaultValue: 'Bitcoin' },
          { name: 'price', type: 'number', defaultValue: 0 },
          { name: 'change24h', type: 'number', defaultValue: 0 },
          { name: 'volume', type: 'number', defaultValue: 0 },
          { name: 'marketCap', type: 'number', defaultValue: 0 },
          { name: 'description', type: 'string', defaultValue: '' }
        ],
        renderTemplate: (c) => {
          const changeColor = c.props.change24h >= 0 ? '#10b981' : '#ef4444';
          return `
            <div class="cw-asset-detail">
              <div class="cw-asset-detail-header">
                <div class="cw-asset-detail-icon">${Utils.escapeHtml(c.props.symbol[0])}</div>
                <div class="cw-asset-detail-info">
                  <div class="cw-asset-detail-name">${Utils.escapeHtml(c.props.name)}</div>
                  <div class="cw-asset-detail-symbol">${Utils.escapeHtml(c.props.symbol)}</div>
                </div>
              </div>
              <div class="cw-asset-detail-price">
                <span class="cw-detail-price">$${c.props.price}</span>
                <span class="cw-detail-change" style="color:${changeColor}">${c.props.change24h >= 0 ? '+' : ''}${c.props.change24h}%</span>
              </div>
              <div class="cw-asset-detail-stats">
                <div class="cw-detail-stat">
                  <div class="cw-detail-stat-label">24h成交量</div>
                  <div class="cw-detail-stat-value">$${c.props.volume}</div>
                </div>
                <div class="cw-detail-stat">
                  <div class="cw-detail-stat-label">市值</div>
                  <div class="cw-detail-stat-value">$${c.props.marketCap}</div>
                </div>
              </div>
              <div class="cw-asset-detail-desc">
                <div class="cw-detail-desc-label">简介</div>
                <div class="cw-detail-desc-content">${Utils.escapeHtml(c.props.description)}</div>
              </div>
            </div>`;
        }
      });

      // Management page cards
      registry.registerType('account-summary', {
        name: 'account-summary', label: '账户概览', icon: '👤',
        extends: 'shared-base',
        propsSchema: [
          { name: 'totalBalance', type: 'number', defaultValue: 0 },
          { name: 'available', type: 'number', defaultValue: 0 },
          { name: 'inOrder', type: 'number', defaultValue: 0 }
        ],
        renderTemplate: (c) => `
          <div class="cw-account-summary">
            <div class="cw-balance-row"><span>总资产</span><span>$${c.props.totalBalance}</span></div>
            <div class="cw-balance-row"><span>可用</span><span>$${c.props.available}</span></div>
            <div class="cw-balance-row"><span>冻结</span><span>$${c.props.inOrder}</span></div>
          </div>`
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CryptoWorkstationCore;
  global.CardFrameCryptoWorkstationCore = CryptoWorkstationCore;

})(typeof window !== 'undefined' ? window : this);
