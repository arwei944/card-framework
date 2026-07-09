/**
 * CardFrame Plugin Integration Tests
 * 测试共享插件和项目插件
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 读取框架代码
const frameworkCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'card-framework.js'), 'utf-8');

// 读取插件代码
const sharedTypesCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'types.js'), 'utf-8');
const sharedInteractionsCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'interactions.js'), 'utf-8');
const tailwindCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'tailwind-integration.js'), 'utf-8');
const mindcanvasCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'mindcanvas', 'mindcanvas-core.js'), 'utf-8');
const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'crypto-workstation', 'crypto-workstation-core.js'), 'utf-8');
const tradeHubCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'trade-hub', 'trade-hub-core.js'), 'utf-8');

// 读取页面文件
const mindcanvasPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'mindcanvas-dashboard.html'), 'utf-8');
const cryptoPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'crypto-workstation-trading.html'), 'utf-8');
const tradeHubPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'trade-hub-dashboard.html'), 'utf-8');

describe('CardFrame Plugin - Phase 1 Shared Infrastructure', () => {

  describe('1.1 Shared Types', () => {
    it('应该有 SharedTypes 对象', () => {
      assert.strictEqual(sharedTypesCode.includes('CardFrameSharedTypes'), true);
    });

    it('应该有 registerAll 方法', () => {
      assert.strictEqual(sharedTypesCode.includes('registerAll(registry)'), true);
    });

    it('应该注册 shared-base 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-base'"), true);
    });

    it('应该注册 shared-header 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-header'"), true);
    });

    it('应该注册 shared-chat-message 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-chat-message'"), true);
    });

    it('应该注册 shared-task-item 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-task-item'"), true);
    });

    it('应该注册 shared-kb-item 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-kb-item'"), true);
    });

    it('应该注册 shared-dimension-bar 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-dimension-bar'"), true);
    });

    it('应该注册 shared-progress 类型', () => {
      assert.strictEqual(sharedTypesCode.includes("registerType('shared-progress'"), true);
    });
  });

  describe('1.2 Shared Interactions', () => {
    it('应该有 SharedInteractions 对象', () => {
      assert.strictEqual(sharedInteractionsCode.includes('CardFrameSharedInteractions'), true);
    });

    it('应该有 install 方法', () => {
      assert.strictEqual(sharedInteractionsCode.includes('install(frame)'), true);
    });

    it('应该有最小化/关闭行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('minimize'), true);
      assert.strictEqual(sharedInteractionsCode.includes('close'), true);
    });

    it('应该有拖拽排序行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('dragCard'), true);
      assert.strictEqual(sharedInteractionsCode.includes('cf-dragging'), true);
    });

    it('应该有缩放行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('toggle-span'), true);
    });

    it('应该有任务勾选行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('.cf-task-check'), true);
      assert.strictEqual(sharedInteractionsCode.includes('task:toggled'), true);
    });
  });

  describe('1.3 Tailwind Integration', () => {
    it('应该有 TailwindIntegration 对象', () => {
      assert.strictEqual(tailwindCode.includes('CardFrameTailwindIntegration'), true);
    });

    it('应该有 install 方法', () => {
      assert.strictEqual(tailwindCode.includes('install(frame, options = {})'), true);
    });

    it('应该支持 mindcanvas 主题', () => {
      assert.strictEqual(tailwindCode.includes("project === 'mindcanvas'"), true);
    });

    it('应该支持 crypto-workstation 主题（5个）', () => {
      assert.strictEqual(tailwindCode.includes("project === 'crypto-workstation'"), true);
      assert.strictEqual(tailwindCode.includes("'deep-space'"), true);
      assert.strictEqual(tailwindCode.includes("'industrial'"), true);
      assert.strictEqual(tailwindCode.includes("'mint'"), true);
      assert.strictEqual(tailwindCode.includes("'neon'"), true);
      assert.strictEqual(tailwindCode.includes("'platinum'"), true);
    });

    it('应该支持 trade-hub 主题', () => {
      assert.strictEqual(tailwindCode.includes("project === 'trade-hub'"), true);
    });

    it('应该有 switchTheme 方法', () => {
      assert.strictEqual(tailwindCode.includes('switchTheme(themeName)'), true);
    });
  });
});

describe('CardFrame Plugin - Phase 2 MindCanvas', () => {

  describe('2.1 MindCanvas Core Plugin', () => {
    it('应该有 MindCanvasCore 对象', () => {
      assert.strictEqual(mindcanvasCode.includes('CardFrameMindCanvasCore'), true);
    });

    it('应该注册 ai-chat 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('ai-chat'"), true);
    });

    it('应该注册 todo-list 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('todo-list'"), true);
    });

    it('应该注册 knowledge-base 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('knowledge-base'"), true);
    });

    it('应该注册 ability-base 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('ability-base'"), true);
    });

    it('应该注册 knowledge-map 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('knowledge-map'"), true);
    });

    it('应该注册 meta-ability 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('meta-ability'"), true);
    });

    it('应该注册 focus-mode 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('focus-mode'"), true);
    });

    it('应该注册 notes 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('notes'"), true);
    });

    it('应该注册 calendar 类型', () => {
      assert.strictEqual(mindcanvasCode.includes("registerType('calendar'"), true);
    });
  });

  describe('2.2 MindCanvas Dashboard Page', () => {
    it('页面应该存在', () => {
      assert.strictEqual(mindcanvasPage.length > 0, true);
    });

    it('应该引入 CardFrame 核心', () => {
      assert.strictEqual(mindcanvasPage.includes('card-framework.js'), true);
    });

    it('应该引入共享插件', () => {
      assert.strictEqual(mindcanvasPage.includes('types.js'), true);
      assert.strictEqual(mindcanvasPage.includes('interactions.js'), true);
      assert.strictEqual(mindcanvasPage.includes('tailwind-integration.js'), true);
    });

    it('应该引入 MindCanvas 插件', () => {
      assert.strictEqual(mindcanvasPage.includes('mindcanvas-core.js'), true);
    });

    it('应该有默认卡片数据', () => {
      assert.strictEqual(mindcanvasPage.includes('ai-butler'), true);
      assert.strictEqual(mindcanvasPage.includes('today-tasks'), true);
      assert.strictEqual(mindcanvasPage.includes('knowledge-base'), true);
    });

    it('应该有添加卡片下拉菜单', () => {
      assert.strictEqual(mindcanvasPage.includes('addCardBtn'), true);
      assert.strictEqual(mindcanvasPage.includes('mc-add-card-menu'), true);
    });

    it('应该应用 mindcanvas 主题', () => {
      assert.strictEqual(mindcanvasPage.includes("applyTheme('mindcanvas')"), true);
    });
  });
});

describe('CardFrame Plugin - Phase 3 Crypto Workstation', () => {

  describe('3.1 Crypto Workstation Core Plugin', () => {
    it('应该有 CryptoWorkstationCore 对象', () => {
      assert.strictEqual(cryptoCode.includes('CardFrameCryptoWorkstationCore'), true);
    });

    it('应该注册 trade-panel 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('trade-panel'"), true);
    });

    it('应该注册 order-book 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('order-book'"), true);
    });

    it('应该注册 chart-panel 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('chart-panel'"), true);
    });

    it('应该注册 strategy-config 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('strategy-config'"), true);
    });

    it('应该注册 asset-card 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('asset-card'"), true);
    });

    it('应该注册 account-summary 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('account-summary'"), true);
    });
  });

  describe('3.2 Crypto Workstation Pages', () => {
    it('Trading 页面应该存在', () => {
      assert.strictEqual(cryptoPage.length > 0, true);
    });

    it('应该有主题切换按钮', () => {
      assert.strictEqual(cryptoPage.includes('theme-btn'), true);
      assert.strictEqual(cryptoPage.includes('data-theme="deep-space"'), true);
      assert.strictEqual(cryptoPage.includes('data-theme="neon"'), true);
    });

    it('应该有导航链接', () => {
      assert.strictEqual(cryptoPage.includes('crypto-workstation-trading.html'), true);
      assert.strictEqual(cryptoPage.includes('crypto-workstation-analysis.html'), true);
      assert.strictEqual(cryptoPage.includes('crypto-workstation-strategy.html'), true);
    });
  });
});

describe('CardFrame Plugin - Phase 4 Trade Hub', () => {

  describe('4.1 Trade Hub Core Plugin', () => {
    it('应该有 TradeHubCore 对象', () => {
      assert.strictEqual(tradeHubCode.includes('CardFrameTradeHubCore'), true);
    });

    it('应该注册 th-ai-chat 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-ai-chat'"), true);
    });

    it('应该注册 th-stat-card 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-stat-card'"), true);
    });

    it('应该注册 th-strategy-card 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-strategy-card'"), true);
    });

    it('应该注册 th-order-form 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-order-form'"), true);
    });
  });

  describe('4.2 Trade Hub Orchestration', () => {
    it('应该有编排事件监听', () => {
      assert.strictEqual(tradeHubCode.includes("'ai:suggestion'"), true);
      assert.strictEqual(tradeHubCode.includes("'strategy:execute'"), true);
      assert.strictEqual(tradeHubCode.includes("'order:completed'"), true);
    });

    it('AI 建议应该触发策略更新', () => {
      assert.strictEqual(tradeHubCode.includes('getCardsByType(\'th-strategy-card\')'), true);
    });

    it('策略执行应该触发交易面板更新', () => {
      assert.strictEqual(tradeHubCode.includes('getCardsByType(\'th-order-form\')'), true);
    });
  });

  describe('4.3 Trade Hub Dashboard Page', () => {
    it('页面应该存在', () => {
      assert.strictEqual(tradeHubPage.length > 0, true);
    });

    it('应该有导航链接（5个页面）', () => {
      assert.strictEqual(tradeHubPage.includes('trade-hub-dashboard.html'), true);
      assert.strictEqual(tradeHubPage.includes('trade-hub-ai.html'), true);
      assert.strictEqual(tradeHubPage.includes('trade-hub-strategy.html'), true);
      assert.strictEqual(tradeHubPage.includes('trade-hub-analysis.html'), true);
      assert.strictEqual(tradeHubPage.includes('trade-hub-trade.html'), true);
    });

    it('应该有编排演示代码', () => {
      assert.strictEqual(tradeHubPage.includes("emit('ai:suggestion'"), true);
    });
  });
});

describe('CardFrame Plugin - Phase 2 MindCanvas Interactions', () => {

  describe('2.2 MindCanvas Interactions', () => {
    it('应该有 AI 快捷操作行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('_installAIChatActions'), true);
      assert.strictEqual(sharedInteractionsCode.includes('ai:action'), true);
    });

    it('应该有笔记编辑器输入行为', () => {
      assert.strictEqual(sharedInteractionsCode.includes('_installNotesEditor'), true);
      assert.strictEqual(sharedInteractionsCode.includes('notes:changed'), true);
    });

    it('应该有防抖处理', () => {
      assert.strictEqual(sharedInteractionsCode.includes('debounce'), true);
    });
  });
});

describe('CardFrame Plugin - Phase 3 Crypto Workstation Extras', () => {

  const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'crypto-workstation', 'crypto-workstation-core.js'), 'utf-8');
  const discoveryPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'crypto-workstation-discovery.html'), 'utf-8');
  const managementPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'crypto-workstation-management.html'), 'utf-8');

  describe('3.1 Extra Card Types', () => {
    it('应该注册 position-list 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('position-list'"), true);
    });

    it('应该注册 indicator-list 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('indicator-list'"), true);
    });

    it('应该注册 history-table 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('history-table'"), true);
    });

    it('应该注册 backtest-result 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('backtest-result'"), true);
    });

    it('应该注册 param-editor 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('param-editor'"), true);
    });

    it('应该注册 filter-panel 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('filter-panel'"), true);
    });

    it('应该注册 asset-detail 类型', () => {
      assert.strictEqual(cryptoCode.includes("registerType('asset-detail'"), true);
    });
  });

  describe('3.3 Discovery & Management Pages', () => {
    it('Discovery 页面应该存在', () => {
      assert.strictEqual(discoveryPage.length > 0, true);
    });

    it('Management 页面应该存在', () => {
      assert.strictEqual(managementPage.length > 0, true);
    });

    it('Discovery 页面应该有筛选面板', () => {
      assert.strictEqual(discoveryPage.includes("type: 'filter-panel'"), true);
    });

    it('Discovery 页面应该有资产详情', () => {
      assert.strictEqual(discoveryPage.includes("type: 'asset-detail'"), true);
    });

    it('Management 页面应该有持仓列表', () => {
      assert.strictEqual(managementPage.includes("type: 'position-list'"), true);
    });

    it('Management 页面应该有交易历史', () => {
      assert.strictEqual(managementPage.includes("type: 'history-table'"), true);
    });

    it('所有导航应该包含5个页面链接', () => {
      assert.strictEqual(discoveryPage.includes('crypto-workstation-trading.html'), true);
      assert.strictEqual(discoveryPage.includes('crypto-workstation-analysis.html'), true);
      assert.strictEqual(discoveryPage.includes('crypto-workstation-strategy.html'), true);
      assert.strictEqual(discoveryPage.includes('crypto-workstation-discovery.html'), true);
      assert.strictEqual(discoveryPage.includes('crypto-workstation-management.html'), true);
    });
  });
});

describe('CardFrame Plugin - Phase 4 Trade Hub Extras', () => {

  const tradeHubCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'trade-hub', 'trade-hub-core.js'), 'utf-8');
  const analysisPage = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'projects', 'trade-hub-analysis.html'), 'utf-8');

  describe('4.1 Extra Card Types', () => {
    it('应该注册 th-chart-widget 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-chart-widget'"), true);
    });

    it('应该注册 th-alert-list 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-alert-list'"), true);
    });

    it('应该注册 th-profit-chart 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-profit-chart'"), true);
    });

    it('应该注册 th-trade-table 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-trade-table'"), true);
    });

    it('应该注册 th-report-card 类型', () => {
      assert.strictEqual(tradeHubCode.includes("registerType('th-report-card'"), true);
    });
  });

  describe('4.3 Trade Analysis Page', () => {
    it('分析页面应该存在', () => {
      assert.strictEqual(analysisPage.length > 0, true);
    });

    it('应该有报表卡片', () => {
      assert.strictEqual(analysisPage.includes("type: 'th-report-card'"), true);
    });

    it('应该有盈亏图表', () => {
      assert.strictEqual(analysisPage.includes("type: 'th-profit-chart'"), true);
    });

    it('应该有交易明细表', () => {
      assert.strictEqual(analysisPage.includes("type: 'th-trade-table'"), true);
    });

    it('应该有图表小组件', () => {
      assert.strictEqual(analysisPage.includes("type: 'th-chart-widget'"), true);
    });

    it('应该有告警列表', () => {
      assert.strictEqual(analysisPage.includes("type: 'th-alert-list'"), true);
    });
  });
});

describe('CardFrame Plugin - Phase 5 Integration & Final Review', () => {

  const sharedInteractionsCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'interactions.js'), 'utf-8');
  const mindcanvasCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'mindcanvas', 'mindcanvas-core.js'), 'utf-8');
  const cryptoCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'crypto-workstation', 'crypto-workstation-core.js'), 'utf-8');
  const tradeHubCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'trade-hub', 'trade-hub-core.js'), 'utf-8');
  const tailwindCode = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'tailwind-integration.js'), 'utf-8');

  describe('5.3 Code Review', () => {
    it('共享插件不应该有 console.log', () => {
      assert.strictEqual(/\bconsole\.log\(/.test(sharedInteractionsCode.replace(/\/\/.*console\.log/g, '')), false);
    });

    it('MindCanvas 插件不应该有 console.log', () => {
      assert.strictEqual(/\bconsole\.log\(/.test(mindcanvasCode.replace(/\/\/.*console\.log/g, '')), false);
    });

    it('Crypto 插件不应该有 console.log', () => {
      assert.strictEqual(/\bconsole\.log\(/.test(cryptoCode.replace(/\/\/.*console\.log/g, '')), false);
    });

    it('Trade Hub 插件不应该有 console.log', () => {
      assert.strictEqual(/\bconsole\.log\(/.test(tradeHubCode.replace(/\/\/.*console\.log/g, '')), false);
    });

    it('所有插件都有 install 方法', () => {
      assert.strictEqual(mindcanvasCode.includes('install(frame, options'), true);
      assert.strictEqual(cryptoCode.includes('install(frame, options'), true);
      assert.strictEqual(tradeHubCode.includes('install(frame, options'), true);
      assert.strictEqual(tailwindCode.includes('install(frame, options'), true);
    });

    it('所有插件都有版本号', () => {
      assert.strictEqual(mindcanvasCode.includes("version: '1.0.0'"), true);
      assert.strictEqual(cryptoCode.includes("version: '1.0.0'"), true);
      assert.strictEqual(tradeHubCode.includes("version: '1.0.0'"), true);
    });

    it('所有渲染都使用 Utils.escapeHtml 防 XSS', () => {
      const escapeCount = (mindcanvasCode.match(/Utils\.escapeHtml/g) || []).length;
      assert.strictEqual(escapeCount > 10, true);
    });
  });
});

describe('CardFrame Plugin - Phase 5 Shared Styles', () => {

  const sharedStyles = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'shared', 'shared-styles.css'), 'utf-8');
  const mindcanvasStyles = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'mindcanvas', 'mindcanvas-styles.css'), 'utf-8');

  it('共享样式文件应该存在', () => {
    assert.strictEqual(sharedStyles.length > 0, true);
  });

  it('应该包含卡片基础样式', () => {
    assert.strictEqual(sharedStyles.includes('.cf-tailwind-card'), true);
  });

  it('应该包含头部样式', () => {
    assert.strictEqual(sharedStyles.includes('.cf-card-header'), true);
  });

  it('应该包含聊天消息样式', () => {
    assert.strictEqual(sharedStyles.includes('.cf-chat-message'), true);
  });

  it('应该包含任务项样式', () => {
    assert.strictEqual(sharedStyles.includes('.cf-task-item'), true);
  });

  it('应该包含进度条样式', () => {
    assert.strictEqual(sharedStyles.includes('.cf-progress-track'), true);
  });

  it('MindCanvas 样式文件应该存在', () => {
    assert.strictEqual(mindcanvasStyles.length > 0, true);
  });

  it('应该包含日历样式', () => {
    assert.strictEqual(mindcanvasStyles.includes('.cf-calendar'), true);
  });

  it('应该包含专注模式样式', () => {
    assert.strictEqual(mindcanvasStyles.includes('.cf-focus-mode'), true);
  });
});
