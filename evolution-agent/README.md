# CardFrame Evolution Agent 服务

CardFrame 自进化 Agent 服务是一个可选的后端组件，用于接收框架运行时发送的指标数据，并根据 AI 决策生成优化代码或配置变更。

## 架构

```
┌─────────────────┐     WebSocket       ┌─────────────────────┐
│  CardFrame      │◄────────────────────►│  Evolution Agent    │
│  (浏览器端)     │  指标数据 / 优化指令  │  (Node.js 服务)     │
└─────────────────┘                      └─────────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────────┐
                                        │  Evolution          │
                                        │  Orchestrator       │
                                        │  (执行优化代码)      │
                                        └─────────────────────┘
```

## 文件结构

```
evolution-agent/
├── src/
│   ├── index.js                 # 服务入口（WebSocket + HTTP）
│   ├── config.json              # 配置（端口、API Key、规则）
│   ├── evolution-orchestrator.js# 进化编排器（执行优化）
│   ├── version-manager.js       # 版本管理器（代码版本控制）
│   ├── test-runner.js           # 测试运行器（验证优化）
│   └── rollback-manager.js      # 回滚管理器（回退失败的优化）
└── package.json
```

## 快速开始

```bash
cd evolution-agent
npm install
npm start
```

服务默认监听 `9100` 端口。

## 配置

编辑 `src/config.json`：

```json
{
  "port": 9100,
  "apiKeys": [],
  "aiProvider": "gemini",
  "aiModel": "gemini-2.5-flash",
  "aiEndpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  "logLevel": "info"
}
```

### 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `port` | `number` | 服务监听端口 |
| `apiKeys` | `array` | 允许连接的 API Key 列表 |
| `aiProvider` | `string` | AI 提供商：`gemini` |
| `aiModel` | `string` | AI 模型名称 |
| `aiEndpoint` | `string` | AI API 端点 URL |
| `logLevel` | `string` | 日志级别：`info` / `debug` / `warn` / `error` |

## 使用流程

1. **CardFrame 端启动进化引擎**
   ```javascript
   const frame = new CardFrame(container, {
     evolution: true,
     evolutionOptions: {
       agentEndpoint: 'http://localhost:9100'
     }
   });
   frame.evolutionEngine.start();
   ```

2. **Agent 接收指标**
   - CardFrame 通过 WebSocket 每 60 秒发送一次指标快照
   - Agent 记录指标并调用 AI 进行分析

3. **AI 决策优化**
   - Agent 将指标发送给 AI 模型
   - AI 返回优化建议（如调整对象池大小、缓存策略等）

4. **执行优化**
   - Evolution Orchestrator 执行优化代码
   - Test Runner 验证优化效果
   - Version Manager 记录版本变更

5. **回滚机制**
   - 如果优化导致性能下降，Rollback Manager 自动回滚
   - 保留最近 10 个版本的代码快照

## API

### WebSocket 连接

连接地址：`ws://localhost:9100`

#### 客户端 → 服务端

**发送指标：**
```json
{
  "type": "metrics",
  "data": {
    "performance": { "renderTime": 0.5, "poolHitRate": 0.85 },
    "interaction": { "cardClicks": 100 },
    "architecture": { "typeCount": 15, "listenerCount": 200 }
  }
}
```

#### 服务端 → 客户端

**优化指令：**
```json
{
  "type": "evolution",
  "actions": [
    {
      "rule": "pool-expansion",
      "action": "tune",
      "params": {
        "target": "cardObjectPool",
        "key": "_maxPerType",
        "value": 200
      }
    }
  ]
}
```

## 安全

- WebSocket 连接需要 API Key 验证
- AI API Key 存储在服务端，不会暴露给浏览器
- 所有优化操作都有版本记录，支持回滚

## 关闭进化引擎

```javascript
frame.evolutionEngine.stop();
```

或销毁整个 CardFrame 实例：

```javascript
frame.destroy();
```
