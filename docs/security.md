# 安全指南

## 目录

- [CSP 配置推荐](#csp-配置推荐)
- [XSS 防护说明](#xss-防护说明)
- [安全最佳实践](#安全最佳实践)
- [危险属性和 API 列表](#危险属性和-api-列表)

---

## CSP 配置推荐

Content-Security-Policy (CSP) 是一种重要的安全层，可以帮助检测和缓解某些类型的攻击，包括 XSS 和数据注入攻击。

### 基础 CSP 配置

对于大多数使用场景，推荐以下 CSP 配置：

```http
Content-Security-Policy: default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'self';
  base-uri 'self';
  form-action 'self';
```

### 说明

- **default-src 'self'**：默认只允许加载同源资源
- **script-src 'self'**：只允许加载同源脚本
- **style-src 'self' 'unsafe-inline'**：允许内联样式（框架需要内联样式来设置卡片位置和样式）
- **img-src 'self' data: https:**：允许加载同源、data URI 和 HTTPS 图片
- **font-src 'self' data:**：允许加载同源和 data URI 字体
- **connect-src 'self'**：AJAX 请求只允许同源
- **frame-ancestors 'self'**：只允许同源页面嵌入
- **base-uri 'self'**：限制 base 标签
- **form-action 'self'**：限制表单提交目标

### 更严格的配置（生产环境推荐）

如果你的应用不使用某些功能，可以使用更严格的配置：

```http
Content-Security-Policy: default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  worker-src 'none';
```

### 使用 nonce 替代 unsafe-inline

对于更高的安全性，可以使用 nonce 来允许特定的内联样式：

```html
<!-- 服务端生成随机 nonce -->
<meta http-equiv="Content-Security-Policy" 
      content="style-src 'self' 'nonce-随机值'">

<!-- 使用 nonce 的内联样式 -->
<style nonce="随机值">
  /* 你的样式 */
</style>
```

### CSP 报告模式

在部署严格 CSP 之前，建议先使用报告模式（Report-Only）进行测试：

```http
Content-Security-Policy-Report-Only: default-src 'self'; ...; report-uri /csp-report-endpoint
```

---

## XSS 防护说明

CardFrame 内置了多层 XSS 防护机制：

### 1. HTML 清理 (sanitizeHtml)

对于 `type: 'html'` 的属性，框架会自动进行 HTML 清理：

- 移除危险标签（如 `<script>`, `<iframe>`, `<object>` 等）
- 移除内联事件处理器（如 `onclick`, `onload` 等）
- 过滤危险的 URL 协议（如 `javascript:`, `vbscript:`）
- 清理 style 属性中的危险 CSS

### 2. URL 安全检查 (sanitizeUrl)

对于 `type: 'url'` 的属性，框架会自动验证 URL 协议：

- 允许的协议：`http:`, `https:`, `ftp:`, `ftps:`, `mailto:`, `tel:`
- 允许相对路径和锚点：`/`, `./`, `../`, `#`
- 危险协议会被过滤，返回空字符串

### 3. Style 安全过滤 (sanitizeStyle)

框架会自动过滤 style 属性和 `card.style` 中的危险 CSS：

- 移除 `expression()` 表达式
- 移除 `behavior` 和 `-moz-binding`
- 移除 `javascript:` 和 `data:` URL
- 移除危险的 `@import`

### 4. 模板渲染自动转义

使用 `{{属性名}}` 语法渲染模板时，属性值会自动进行 HTML 转义。

---

## 安全最佳实践

### 1. 使用安全的属性类型

```javascript
// 推荐：使用特定类型，框架会自动安全处理
{
  name: 'avatar',
  type: 'url',  // 自动 sanitizeUrl
  label: '头像'
},
{
  name: 'description',
  type: 'html',  // 自动 sanitizeHtml
  label: '描述'
}
```

### 2. 插件安全

- 只安装来自可信来源的插件
- 插件注册的卡片类型模板会自动进行安全审查
- 如确认插件安全，可设置 `unsafeSkipTemplateCheck: true` 跳过检查（不推荐）

```javascript
CardFrame.installPlugin({
  name: 'my-plugin',
  unsafeSkipTemplateCheck: true,  // 仅在确认安全时使用
  cardTypes: [...]
});
```

### 3. 用户输入处理

- 不要直接将用户输入插入到 innerHTML 中
- 使用框架提供的模板系统，它会自动转义
- 如需使用 HTML，使用 `type: 'html'` 的属性

### 4. 卡片样式安全

- 优先使用 CSS 类而不是内联样式
- 通过 `card.style` 设置的样式会自动安全过滤
- 避免在样式中使用用户可控的数据

### 5. 定期更新

- 保持框架版本为最新
- 关注安全更新和公告

---

## 危险属性和 API 列表

### 危险 HTML 属性

以下属性存在 XSS 风险，使用时需特别小心：

| 属性 | 风险 | 处理方式 |
|------|------|----------|
| `onclick`, `onload`, `onerror` 等 on* 事件 | 高 | 框架自动移除 |
| `href`, `src`, `action`, `formaction` | 中 | 框架检查 URL 协议 |
| `style` | 中 | 框架过滤危险 CSS |
| `data-*` | 低 | 需根据具体用途评估 |

### 危险 HTML 标签

| 标签 | 风险 | 处理方式 |
|------|------|----------|
| `<script>` | 高 | 框架自动移除 |
| `<iframe>` | 高 | 框架自动移除 |
| `<object>`, `<embed>`, `<applet>` | 高 | 框架自动移除 |
| `<form>` | 中 | 需谨慎使用 |
| `<base>` | 高 | 框架自动移除 |

### 危险 CSS 特性

| CSS 特性 | 风险 | 处理方式 |
|----------|------|----------|
| `expression()` | 高 | 框架自动移除 |
| `behavior`, `-moz-binding` | 高 | 框架自动移除 |
| `url(javascript:...)` | 高 | 框架自动移除 |
| `url(data:...)` | 中 | 框架自动移除 |
| `@import` | 中 | 框架检查并过滤 |

### 危险 JavaScript API

在自定义插件或扩展中，避免使用以下 API 处理用户输入：

| API | 风险 | 替代方案 |
|-----|------|----------|
| `eval()` | 高 | 使用 `JSON.parse()` 或安全的解析方式 |
| `new Function()` | 高 | 避免动态创建函数 |
| `innerHTML` | 高 | 使用 `textContent` 或框架 sanitizeHtml |
| `document.write()` | 高 | 使用 DOM 操作方法 |
| `setTimeout(string)` / `setInterval(string)` | 高 | 使用函数而非字符串 |

### 危险 URL 协议

| 协议 | 风险 | 处理方式 |
|------|------|----------|
| `javascript:` | 高 | 框架自动过滤 |
| `vbscript:` | 高 | 框架自动过滤 |
| `data:text/html` | 高 | 框架自动过滤 |
| `data:` (其他) | 中 | 根据上下文评估 |

---

## 安全事件和监控

### 安全相关事件

框架会触发以下安全相关事件：

- `cardValidationError` - 卡片验证失败（包括安全验证）
- `circuitBreakerOpened` - 熔断触发（可能由安全问题导致）
- `fullCheckFailed` - 全量检查发现安全问题

### 监控建议

1. 监听 `cardValidationError` 事件，记录安全验证失败
2. 定期运行全量检查 (`realTimeValidator.fullCheck()`)
3. 配置 CSP 报告端点，收集 CSP 违规报告
4. 监控异常渲染错误，可能是攻击尝试

---

## 更多资源

- [MDN - Content Security Policy](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CSP)
- [OWASP - XSS 防护备忘单](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP - CSP 备忘单](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
