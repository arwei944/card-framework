// CardFrame v1.0 TypeScript Type Definitions
// https://github.com/cardframe/card-framework
//
// 注：CardFrame 实例拥有自己的子系统（EventBus / Store / TypeRegistry / Renderer 等），
// 不存在全局单例。使用 `new CardFrame(container)` 创建实例。

export as namespace CardFrameNamespace;

export = CardFrame;

// ============================================================
// 核心数据模型
// ============================================================

/** 卡片状态 */
export type CardStatus = 'active' | 'completed' | 'archived';

/** 关系类型 */
export type RelationshipType =
  | 'reference'
  | 'parent'
  | 'child'
  | 'dependency'
  | 'related'
  | string;

/** 布局模式：'stream' 流式布局 / 'canvas' 画布布局 */
export type LayoutMode = 'stream' | 'canvas';

/** 位置坐标 */
export interface Position {
  x: number;
  y: number;
}

/** 卡片数据接口 */
export interface Card {
  id: string;
  type: string;
  props: Record<string, any>;
  position?: Position;
  status?: CardStatus;
  createdAt: number;
  updatedAt: number;
  parentId?: string;
  tags?: string[];
  style?: string;
}

/** 关系数据接口 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  data?: Record<string, any>;
  createdAt: number;
  updatedAt?: number;
}

/** 属性类型定义 */
export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'date'
  | 'url'
  | 'html'
  | 'color';

/** 属性定义 */
export interface PropDefinition {
  name: string;
  type: PropType;
  required?: boolean;
  defaultValue?: any;
  label?: string;
  description?: string;
  options?: any[];
  validator?: (value: any) => boolean | string;
  min?: number;
  max?: number;
  safe?: boolean;
  allowHtml?: boolean;
}

/** 卡片动作定义 */
export interface CardAction {
  name: string;
  label: string;
  handler: (card: Card, store: Store, event: Event) => void;
}

/** 卡片类型定义 */
export interface CardTypeDefinition {
  type: string;
  label: string;
  icon?: string;
  description?: string;
  extends?: string;
  propsSchema?: PropDefinition[];
  renderTemplate?: string;
  actions?: CardAction[];
  defaultStyle?: Record<string, string>;
}

// ============================================================
// 事件系统
// ============================================================

export interface CardFrameEventMap {
  cardAdded: { card: Card };
  cardUpdated: { card: Card; changes?: Record<string, any> };
  cardRemoved: { cardId: string };
  relationshipAdded: { relationship: Relationship };
  relationshipRemoved: { relationshipId: string };
  cardValidationError: { card: Card; errors: ValidationError[] };
  cardAutoFixed: { card: Card; fixes: any[] };
  layoutChanged: { mode: LayoutMode };
  frameworkError: { type: string; message: string; error: Error; context?: any; timestamp: number };
  domSynchronized: { cardIds: string[] };
  pluginInstalled: { pluginName: string };
  pluginUninstalled: { pluginName: string };
  pluginEnabled: { pluginName: string };
  pluginDisabled: { pluginName: string };
  themeChanged: { theme: string };
  languageChanged: { locale: string };
  circuitBreakerOpened: { cardId?: string };
  circuitBreakerClosed: { cardId?: string };
  evolutionOccurred: any;
  evolutionRequestError: { error: string };
  [key: string]: any;
}

export type EventName = keyof CardFrameEventMap | string;
export type EventListener<T = any> = (data: T) => void;

// ============================================================
// 验证
// ============================================================

export interface ValidationError {
  type: string;
  prop?: string;
  message: string;
  expected?: any;
  actual?: any;
}

export interface ValidationWarning {
  type: string;
  prop?: string;
  message: string;
  originalValue?: any;
  sanitizedValue?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedProps?: Record<string, any>;
}

export interface FullCheckResult {
  cardErrors: any[];
  domStoreMismatch: any[];
  relationshipErrors: any[];
  securityIssues: Array<{ type: string; severity: string; message: string }>;
  timestamp: number;
}

// ============================================================
// 反馈级别
// ============================================================

export type FeedbackLevel = 'silent' | 'info' | 'warn' | 'error';

export interface FeedbackMessage {
  level: FeedbackLevel;
  type: string;
  message: string;
  suggestion?: string;
  example?: string;
  fix?: string;
  correctExample?: string;
  recover?: string;
  docLink?: string;
  changes?: string;
  timestamp: number;
}

// ============================================================
// 核心模块
// ============================================================

export interface UtilsStatic {
  generateId(prefix?: string): string;
  escapeHtml(str: any): string;
  escapeAttr(str: any): string;
  sanitizeHtml(html: string, options?: any): string;
  sanitizeUrl(url: string): string;
  sanitizeStyle(style: string | Record<string, string>): string;
  isSafeUrl(url: string): boolean;
  debounce<T extends (...args: any[]) => any>(func: T, wait: number): T;
  throttle<T extends (...args: any[]) => any>(func: T, limit: number): T;
  formatTime(timestamp: number): string;
  deepClone<T>(obj: T): T;
  validateType(value: any, type: PropType): boolean;
  parseValue(value: string): any;
}

export interface Store {
  addCard(card: Card): Card;
  updateCard(card: Card): Card | null;
  updateCardProps(cardId: string, props: Record<string, any>): Card | null;
  removeCard(cardId: string): boolean;
  getCard(cardId: string): Card | undefined;
  getAllCards(): Card[];
  getCardsByType(type: string): Card[];
  getCardsByTag(tag: string): Card[];
  getCardsByStatus(status: CardStatus): Card[];
  queryCards(criteria: Record<string, any>): Card[];
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Relationship;
  updateRelationship(rel: Relationship): Relationship | null;
  removeRelationship(relationshipId: string): boolean;
  getRelationship(relationshipId: string): Relationship | undefined;
  getAllRelationships(): Relationship[];
  getRelationshipsByType(type: RelationshipType): Relationship[];
  getRelationshipsByCard(cardId: string): Relationship[];
  subscribe(listener: EventListener): () => void;
  unsubscribe(listener: EventListener): void;
  getSubscriberCount(): number;
  notify(): void;
  notifyDebounced(): void;
  getIndex(): QueryIndex;
  setPool(pool: any): void;
  toJSON(): { cards: Card[]; relationships: Relationship[] };
  fromJSON(data: { cards?: Card[]; relationships?: Relationship[] }): void;
}

export interface TypeRegistry {
  register(typeDef: CardTypeDefinition): void;
  unregister(typeName: string): void;
  get(typeName: string): CardTypeDefinition | undefined;
  getAll(): CardTypeDefinition[];
  has(typeName: string): boolean;
  validate(card: Card | Record<string, any>): ValidationResult;
  sanitizeCard(card: Card): Card;
  getPropSchema(typeName: string, propName: string): PropDefinition | null;
  getDefaultValue(typeName: string, propName: string): any;
  resolveInheritance(typeName: string): CardTypeDefinition | null;
  getBaseType(): CardTypeDefinition;
  validatePropValue(propName: string, propDef: PropDefinition, value: any): ValidationResult;
}

export interface Renderer {
  renderCards(cards: Card[]): void;
  renderCard(card: Card): HTMLElement;
  renderError(card: Card, error: Error): HTMLElement;
  updateCardElement(card: Card): void;
  cleanupCardElement(cardId: string): void;
  forceFullRender(): void;
  renderTemplate(template: string, props: Record<string, any>): string;
}

export interface LayoutEngine {
  setMode(mode: LayoutMode): void;
  getMode(): LayoutMode;
  applyLayout(): void;
  computeCardLayout(card: Card): any;
  computeLayouts(cards: Card[]): any;
  invalidateLayout(cardId: string): void;
  invalidateAll(): void;
  syncPositions(): void;
  getLayoutCache(): LayoutCache;
  setZoom(scale: number): void;
  resetView(): void;
  pan: { x: number; y: number };
  zoom: number;
  mode: LayoutMode;
}

export interface EventBus {
  on<T = any>(eventName: EventName, listener: EventListener<T>): () => void;
  once<T = any>(eventName: EventName, listener: EventListener<T>): void;
  off<T = any>(eventName: EventName, listener: EventListener<T>): void;
  emit<T = any>(eventName: EventName, data?: T): void;
  removeAllByContext(context: any): void;
  listenerCount(eventName: EventName): number;
  clear(): void;
}

export interface FeedbackSystemStatic {
  info(type: string, message: string, options?: { suggestion?: string; example?: string }): void;
  warn(type: string, message: string, options?: { fix?: string; correctExample?: string }): void;
  error(type: string, message: string, options?: { recover?: string; docLink?: string }): void;
  fix(type: string, message: string, options?: { changes?: string }): void;
  setLevel(level: FeedbackLevel): void;
  getLevel(): FeedbackLevel;
  getHistory(): FeedbackMessage[];
}

export interface AutoFixer {
  setContainer(container: HTMLElement): void;
  setEnabled(enabled: boolean): void;
  fixCard(card: Card, validation: ValidationResult): Card | null;
  fixStructure(card: Card): boolean;
  fixDomStoreSync(): number;
  fixRelationships(): number;
  fixAll(): { cardFixed: number; domSyncFixed: number; relationshipFixed: number };
  getStats(): { totalFixes: number; [k: string]: any };
  resetStats(): void;
}

export interface RealTimeValidator {
  setEnabled(enabled: boolean): void;
  setCheckInterval(ms: number): void;
  start(): void;
  stop(): void;
  handleMutations(mutations: MutationRecord[]): void;
  fullCheck(): FullCheckResult;
  validateAll(): ValidationResult;
  syncFromDOM(): void;
  pause(): void;
  resume(): void;
  getLastCheckTime(): number;
}

export interface SecurityStatic {
  escapeHtml(str: any): string;
  escapeAttr(str: any): string;
  sanitizeHtml(html: string, options?: any): string;
  sanitizeScriptContent(content: string): string;
  sanitizeUrl(url: string): string;
  sanitizeStyle(style: string | Record<string, string>): string;
  sanitizeStyleObject(obj: Record<string, string>): Record<string, string>;
  isSafeUrl(url: string): boolean;
  checkCSPCompatibility(): {
    compatible: boolean;
    issues: Array<{ type: string; severity: string; message: string }>;
    notes: string[];
    recommendations: string[];
  };
  validatePropValue(value: any, propSchema: PropDefinition): { valid: boolean; value: any; sanitized?: boolean; warning?: string };
  checkTemplateSecurity(template: string): { safe: boolean; issues: string[] };
}

export interface PerfStatic {
  mark(name: string): void;
  measure(name: string, startMark: string, endMark?: string): number;
  recordRender(duration: number): void;
  getStats(): { renders: number; avgTime: number; totalTime: number; marks: Record<string, number> };
  reset(): void;
}

export interface VirtualScroller {
  enable(options?: { overscan?: number }): void;
  disable(): void;
  isEnabled(): boolean;
  setOverscan(n: number): void;
  getPoolSize(): number;
  getVisibleCardCount(): number;
  getVisibleRange(): { start: number; end: number };
  refresh(): void;
  destroy(): void;
}

// ============================================================
// 关系引擎
// ============================================================

export interface RelationshipEngine {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  refresh(): void;
  enableInteraction(): void;
  disableInteraction(): void;
  isInteractionEnabled(): boolean;
  setDefaultRelationType(type: RelationshipType): void;
}

// ============================================================
// 主题与国际化
// ============================================================

export interface Theme {
  name: string;
  variables: Record<string, string>;
  extends?: string;
}

export interface ThemeManager {
  setContainer(container: HTMLElement): void;
  registerTheme(theme: Theme): void;
  getTheme(name: string): Theme | null;
  removeTheme(name: string): boolean;
  getAllThemes(): Theme[];
  applyTheme(name: string): void;
  getCurrentTheme(): string;
  toggleTheme(): string;
  followSystemTheme(enable?: boolean): void;
  isFollowingSystem(): boolean;
  setAnimationDuration(ms: number): void;
  getAnimationDuration(): number;
}

export interface Locale {
  code: string;
  label?: string;
  name?: string;
  translations: Record<string, string>;
  rtl?: boolean;
  messages?: Record<string, string>;
}

export interface I18nManager {
  setContainer(container: HTMLElement): void;
  registerLocale(locale: Locale): void;
  setLocale(code: string): void;
  getLocale(code: string): Locale | null;
  getAllLocales(): Array<{ locale: string; label: string; rtl: boolean }>;
  getCurrentLocale(): string;
  setFallbackLocale(locale: string): void;
  t(key: string, params?: Record<string, any>): string;
  detectBrowserLocale(): string;
  isRTL(locale?: string): boolean;
}

// ============================================================
// 熔断器
// ============================================================

export interface CircuitBreakerOptions {
  cardFailureThreshold?: number;
  globalFailureThreshold?: number;
  windowMs?: number;
  resetTimeoutMs?: number;
}

export interface CircuitBreakerStats {
  totalCards: number;
  openCards: number;
  globalState: 'closed' | 'open' | 'half-open';
  safeMode: boolean;
  totalFailures: number;
}

export interface CircuitBreaker {
  recordSuccess(cardId?: string): void;
  recordFailure(cardId?: string): void;
  canExecute(cardId?: string): boolean;
  execute<T>(fn: () => T, cardId?: string): T | null;
  getCardState(cardId: string): 'closed' | 'open' | 'half-open';
  getGlobalState(): 'closed' | 'open' | 'half-open';
  isSafeMode(): boolean;
  getStats(): CircuitBreakerStats;
  reset(): void;
}

// ============================================================
// 插件
// ============================================================

export interface PluginDefinition {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
  priority?: number;
  cardTypes?: CardTypeDefinition[];
  install?: (context: PluginSandboxContext) => void | Promise<void>;
  uninstall?: (context: PluginSandboxContext) => void | Promise<void>;
  enable?: (context: PluginSandboxContext) => void | Promise<void>;
  disable?: (context: PluginSandboxContext) => void | Promise<void>;
  hooks?: {
    beforeCardAdd?: (card: Card) => void | boolean;
    afterCardAdd?: (card: Card) => void;
    beforeCardUpdate?: (card: Card, changes: Record<string, any>) => void | boolean;
    afterCardUpdate?: (card: Card) => void;
    beforeCardRemove?: (card: Card) => void | boolean;
    afterCardRemove?: (cardId: string) => void;
    beforeRelationshipAdd?: (rel: Relationship) => void | boolean;
    afterRelationshipAdd?: (rel: Relationship) => void;
    unsafeSkipTemplateCheck?: boolean;
  };
}

/** 插件沙箱上下文（受限 API 表面，按权限裁剪） */
export interface PluginSandboxContext {
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
  addEventListener(target: EventTarget, type: string, listener: EventListener, options?: any): void;
  store?: {
    getCard(id: string): Card | undefined;
    getAllCards(): Card[];
    getCardsByType(type: string): Card[];
    getRelationship(id: string): Relationship | undefined;
    getAllRelationships(): Relationship[];
  };
  storeWrite?: {
    addCard(card: Card): Card;
    updateCard(card: Card): Card | null;
    removeCard(id: string): boolean;
  };
  eventBus?: {
    on<T = any>(eventName: EventName, listener: EventListener<T>): () => void;
    off<T = any>(eventName: EventName, listener: EventListener<T>): void;
    emit?<T = any>(eventName: EventName, data?: T): void;
  };
  typeRegistry?: {
    register(typeDef: CardTypeDefinition): void;
    get(typeName: string): CardTypeDefinition | undefined;
  };
  theme?: {
    getCurrentTheme(): string;
    registerTheme?(theme: Theme): void;
  };
  i18n?: {
    t(key: string, params?: Record<string, any>): string;
    getLocale(): string;
  };
  feedback: {
    info(type: string, message: string): void;
    warn(type: string, message: string): void;
    error(type: string, message: string): void;
  };
  utils?: {
    generateId(prefix?: string): string;
    escapeHtml(str: any): string;
    deepClone<T>(obj: T): T;
  };
}

export interface PluginSandbox {
  can(permission: string): boolean;
  createContext(): PluginSandboxContext;
  destroy(): void;
  trackType(typeName: string): void;
  trackTheme(themeName: string): void;
}

export interface PluginInfo {
  name: string;
  version: string;
  enabled: boolean;
  installedAt: number;
}

export interface PluginManager {
  install(pluginDef: PluginDefinition): void;
  uninstall(pluginName: string): void;
  enable(pluginName: string): void;
  disable(pluginName: string): void;
  get(pluginName: string): PluginInfo | undefined;
  getAll(): PluginInfo[];
  isInstalled(pluginName: string): boolean;
  isEnabled(pluginName: string): boolean;
  registerPermissions(pluginName: string, permissions: string[]): void;
  hasPermission(pluginName: string, permission: string): boolean;
  checkRateLimit(pluginName: string): boolean;
  createSandbox(pluginName: string, permissions: string[], rateLimiter?: (name: string) => boolean): PluginSandbox;
  getSandboxContext(pluginName: string): PluginSandboxContext | undefined;
  registerHook(hookName: string, handler: (data: any) => void, pluginName?: string, priority?: number): () => void;
  triggerHook(hookName: string, data?: any): void;
  hasAction(actionName: string): boolean;
  executeAction(actionName: string, card?: Card, event?: Event): any;
}

// ============================================================
// 性能模块
// ============================================================

export interface CardObjectPool {
  acquire(type: string): Card | null;
  release(card: Card): void;
  clear(): void;
  getStats(): { poolSize: number; [k: string]: any };
  setMaxPerType(max: number): void;
}

export interface LayoutCache {
  markDirty(cardId: string): void;
  markDirtyBatch(cardIds: string[]): void;
  markAllDirty(): void;
  get(cardId: string): any | null;
  set(cardId: string, layout: any): void;
  remove(cardId: string): void;
  removeBatch(cardIds: string[]): void;
  clear(): void;
  getDirtyCards(): string[];
  isDirty(cardId: string): boolean;
  getStats(): { size: number; dirtyCount: number; hitRate: number };
}

export interface QueryIndex {
  add(card: Card): void;
  remove(cardId: string): void;
  update(oldCard: Card, newCard: Card): void;
  queryByType(type: string): Set<string>;
  queryByTag(tag: string): Set<string>;
  queryByStatus(status: CardStatus): Set<string>;
  query(criteria: Record<string, any>): Set<string>;
  clear(): void;
  getStats(): { totalIndexed: number; [k: string]: any };
}

// ============================================================
// 进化子系统（实验性）
// ============================================================

export interface ActionLogger {
  record(type: string, payload: any): void;
  undo(store: Store): boolean;
  redo(store: Store): boolean;
  rollback(steps: number, store: Store): boolean;
  getHistory(): any[];
  clear(): void;
  pause(): void;
  resume(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: EventListener): () => void;
  getStatus(): { currentPosition: number; totalCount: number; maxHistory: number };
}

export interface MetricsSnapshot {
  timestamp: number;
  performance: {
    renderCount: number;
    avgRenderTime: number;
    maxRenderTime: number;
    fps: number;
    domNodes: number;
    memoryUsage?: number;
  };
  architecture: {
    cardCount: number;
    typeCount: number;
    relationshipCount: number;
    poolUtilization: number;
    cacheHitRate: number;
  };
  interaction: {
    clicks: number;
    drags: number;
    scrolls: number;
    avgResponseTime: number;
  };
}

export interface MetricsCollector {
  start(): void;
  stop(): void;
  getSnapshot(): MetricsSnapshot;
}

export interface RuleResult {
  ruleId: string;
  action: {
    type: 'param-tune' | 'code-evolve';
    target?: string;
    param?: string;
    value?: any;
    reason?: string;
  };
}

export interface RuleEngine {
  evaluate(metrics: MetricsSnapshot): RuleResult[];
  addRule(rule: any): void;
  removeRule(ruleId: string): void;
}

export interface EvolutionRecord {
  type: 'param-tune' | 'code-evolve';
  target?: string;
  param?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  ruleId?: string;
  sessionId?: string;
  commit?: string;
  method?: string;
  timestamp: number;
}

export interface EvolutionEngine {
  start(): void;
  stop(): void;
  getEvolutionHistory(): EvolutionRecord[];
  getMetrics(): MetricsSnapshot | null;
}

export interface GuardrailViolation {
  rule: 'R1' | 'R2' | 'R3' | 'R4';
  severity: 'error' | 'warn' | 'info';
  message: string;
  element: string;
  suggestion: string;
  timestamp: number;
}

export interface GuardrailStats {
  total: number;
  byRule: Record<string, number>;
  bySeverity: Record<string, number>;
  enabled: boolean;
  level: 'error' | 'warn' | 'info';
}

export interface GuardrailOptions {
  enabled?: boolean;
  level?: 'error' | 'warn' | 'info';
  onViolation?: (violation: GuardrailViolation) => void;
  excludedFrameworks?: string[];
  testMode?: boolean;
}

export interface Guardrail {
  scan(): void;
  observe(): void;
  disconnect(): void;
  destroy(): void;
  getStats(): GuardrailStats;
}

export interface PerfPanel {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  updateDOMStats(cards: Card[], rels: Relationship[]): void;
}

export interface GlobalErrorHandler {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  getErrorStats(): { total: number; byType: Record<string, number>; recent: any[] };
  clear(): void;
}

export interface ShadowCardRegistry {
  registerStyle(type: string, css: string): void;
  registerTemplate(type: string, template: string): void;
  getStyle(type: string): string | null;
  getTemplate(type: string): string | null;
  hasType(type: string): boolean;
  clear(): void;
}

// ============================================================
// 配置
// ============================================================

export interface CardFrameOptions {
  layoutMode?: LayoutMode;
  theme?: string;
  locale?: string;
  autoValidate?: boolean;
  virtualScroll?: boolean;
  overscan?: number;
  circuitBreaker?: CircuitBreakerOptions;
  csp?: string;
  actionLogger?: { maxHistory?: number; enabled?: boolean };
  cardPool?: { maxPerType?: number };
  evolution?: boolean | Record<string, any>;
  guardrail?: false | GuardrailOptions;
  plugins?: PluginDefinition[];
  allowedPluginPermissions?: string[];
}

export interface CardFrameStats {
  cards: { total: number; byType: Record<string, number> };
  relationships: { total: number };
  plugins: { total: number; enabled: number };
  layout: { mode: LayoutMode; zoom: number };
  circuitBreaker?: CircuitBreakerStats;
  autoFixer?: { totalFixes: number; [k: string]: any };
  performance?: ReturnType<PerfStatic['getStats']>;
}

// ============================================================
// 主类
// ============================================================

export interface BatchResult {
  success: Card[];
  errors: Array<{ index: number; error: string; cardData?: any }>;
}

export interface CardFrameInstance {
  // 卡片操作
  createCard(type: string, props?: Record<string, any>): Card | null;
  updateCard(card: Card): Card | null;
  removeCard(cardId: string): boolean;
  getCard(cardId: string): Card | undefined;
  getAllCards(): Card[];
  getCardsByType(type: string): Card[];

  // 批量操作
  batchCreateCards(cards: Array<{ type: string; props?: Record<string, any> }>): BatchResult;
  batchUpdateCards(updates: Array<{ id: string; props?: Record<string, any> }>): BatchResult;
  batchRemoveCards(cardIds: string[]): BatchResult;

  // 关系操作
  createRelationship(sourceId: string, targetId: string, type?: RelationshipType, data?: Record<string, any>): Relationship;
  removeRelationship(relationshipId: string): boolean;
  getRelationship(relationshipId: string): Relationship | undefined;
  getAllRelationships(): Relationship[];
  getRelationshipsByCard(cardId: string): Relationship[];
  getRelationshipsByType(type: RelationshipType): Relationship[];

  // 操作历史与撤销/重做
  undo(): boolean;
  redo(): boolean;
  rollback(steps?: number): boolean;
  getActionHistory(): any[];
  clearActionHistory(): void;

  // 布局
  setLayoutMode(mode: LayoutMode): void;
  getLayoutMode(): LayoutMode;

  // 事件
  on<T = any>(eventName: EventName, listener: EventListener<T>): () => void;
  once<T = any>(eventName: EventName, listener: EventListener<T>): void;
  off<T = any>(eventName: EventName, listener: EventListener<T>): void;

  // 导入导出
  exportData(): { version: string; exportedAt: number; cards: Card[]; relationships: Relationship[]; layoutMode: LayoutMode; metadata: any };
  exportJSON(): string;
  importData(data: { version?: string; cards?: Card[]; relationships?: Relationship[]; layoutMode?: LayoutMode } | string,
    options?: { mode?: 'merge' | 'replace'; clearBeforeImport?: boolean; preserveLayout?: boolean; migrate?: (data: any, fromMajor: number, toMajor: number) => any }):
    { importedCards: number; importedRelationships: number; mode: string; totalCards: number; totalRelationships: number };
  toJSON(): { cards: Card[]; relationships: Relationship[] };

  // 验证与修复
  validateAll(): ValidationResult;
  fullCheck(): FullCheckResult;
  fixAll(): { cardFixed: number; domSyncFixed: number; relationshipFixed: number };

  // 统计与性能
  getStats(): CardFrameStats;
  getPerfStats(): ReturnType<PerfStatic['getStats']>;
  enableVirtualScroll(options?: { overscan?: number }): void;
  disableVirtualScroll(): void;
  isVirtualScrollEnabled(): boolean;

  // 自进化（实验性）
  getEvolutionHistory(): EvolutionRecord[];
  getMetricsSnapshot(): MetricsSnapshot | null;
  evolveNow(): void;

  // 性能与错误
  enablePerfPanel(): void;
  disablePerfPanel(): void;
  enableGlobalErrorHandler(): void;
  disableGlobalErrorHandler(): void;
  getGlobalErrorStats(): { total: number; byType: Record<string, number>; recent: any[] };

  // 插件
  installPlugin(pluginDef: PluginDefinition): void;
  uninstallPlugin(pluginName: string): void;
  enablePlugin(pluginName: string): void;
  disablePlugin(pluginName: string): void;
  getPlugin(pluginName: string): PluginInfo | undefined;
  getAllPlugins(): PluginInfo[];
  executeAction(actionName: string, card?: Card, event?: Event): any;

  // 销毁
  destroy(): void;

  // 子模块引用
  store: Store;
  typeRegistry: TypeRegistry;
  renderer: Renderer;
  layoutEngine: LayoutEngine;
  realTimeValidator: RealTimeValidator;
  autoFixer: AutoFixer;
  themeManager: ThemeManager;
  i18n: I18nManager;
  i18nManager: I18nManager;
  relationshipEngine: RelationshipEngine;
  circuitBreaker: CircuitBreaker;
  eventBus: EventBus;
  pluginManager: PluginManager;
  cardObjectPool: CardObjectPool;
  virtualScroller: VirtualScroller;
  security: SecurityStatic;
  actionLogger: ActionLogger;
  evolutionEngine: EvolutionEngine | null;
  perfPanel: PerfPanel;
  globalErrorHandler: GlobalErrorHandler;
  shadowCardRegistry: ShadowCardRegistry;
  guardrail: Guardrail | null;
}

// ============================================================
// 默认配置常量
// ============================================================

export interface DefaultConfig {
  DEBOUNCE_RENDER_MS: number;
  RENDER_RAF_MS: number;
  VALIDATION_DEBOUNCE_MS: number;
  FULL_CHECK_INTERVAL_MS: number;
  VIRTUAL_SCROLL_OVERSCAN: number;
  DEFAULT_CARD_WIDTH: number;
  DEFAULT_CARD_HEIGHT: number;
  LAYOUT_CACHE_MAX_SIZE: number;
  CIRCUIT_BREAKER: {
    CARD_FAILURE_THRESHOLD: number;
    GLOBAL_FAILURE_THRESHOLD: number;
    WINDOW_MS: number;
    RESET_TIMEOUT_MS: number;
  };
  ZOOM: {
    MIN: number;
    MAX: number;
    STEP: number;
  };
  FEEDBACK_LEVEL: FeedbackLevel;
}

// ============================================================
// 业务数据后端同步 (BackendSync)
// ============================================================

export interface BackendSyncOptions {
  endpoint?: string;
  mode?: 'full' | 'incremental';
  debounceMs?: number;
  pullOnStart?: boolean;
  autoPush?: boolean;
  authToken?: string | (() => string);
  headers?: Record<string, string>;
  concurrency?: 'none' | 'etag';
  offlineQueue?: boolean;
  onError?: (err: Error, ctx: { phase: string; [k: string]: any }) => void;
  onConflict?: (serverSnapshot: any) => void;
  fetchImpl?: (url: string, init: any) => Promise<any>;
}

export class BackendSync {
  constructor(frame: CardFrameInstance, options?: BackendSyncOptions);
  start(): this;
  stop(): this;
  destroy(): void;
  pull(): Promise<any>;
  pushNow(): Promise<boolean>;
  _queueIsEmpty(): boolean;
}

// ============================================================
// 可观测性 (Monitor)
// ============================================================

export interface MonitorOptions {
  endpoint?: string;
  token?: string | (() => string);
  batchSize?: number;
  flushMs?: number;
  fetchImpl?: (url: string, init: any) => Promise<any>;
  onError?: (err: Error) => void;
}

export interface MonitorStatic {
  init(options?: MonitorOptions): void;
  report(error: Error | { type: string; message: string; context?: any }): void;
  flush(): void;
  destroy(): void;
}

// ============================================================
// 全局 CardFrame 命名空间
// ============================================================

declare const CardFrame: {
  new (containerOrSelector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;

  // 静态工厂方法
  from(selector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;
  fromJSON(data: any, options?: CardFrameOptions): CardFrameInstance;
  getPerfStats(): ReturnType<PerfStatic['getStats']>;
  applyCSP(policy: string): void;
  defineShadowCard(): void;

  // 子模块类引用
  Utils: UtilsStatic;
  Store: { new (eventBus?: EventBus): Store };
  TypeRegistry: { new (): TypeRegistry };
  Renderer: { new (container: HTMLElement, typeRegistry: TypeRegistry, store: Store, eventBus: EventBus): Renderer };
  LayoutEngine: { new (container: HTMLElement, store: Store, renderer: Renderer, eventBus: EventBus): LayoutEngine };
  EventBus: { new (): EventBus };
  AutoFixer: { new (...args: any[]): AutoFixer };
  RealTimeValidator: { new (...args: any[]): RealTimeValidator };
  FeedbackSystem: FeedbackSystemStatic;
  Security: SecurityStatic;
  Perf: PerfStatic;
  VirtualScroller: { new (...args: any[]): VirtualScroller };
  RelationshipEngine: { new (...args: any[]): RelationshipEngine };
  ThemeManager: { new (...args: any[]): ThemeManager };
  I18nManager: { new (...args: any[]): I18nManager };
  CircuitBreaker: { new (options?: CircuitBreakerOptions, eventBus?: EventBus): CircuitBreaker };
  PluginManager: { new (...args: any[]): PluginManager };
  PluginSandbox: { new (pluginName: string, frame: CardFrameInstance, permissions?: string[], rateLimiter?: (name: string) => boolean): PluginSandbox };
  BackendSync: typeof BackendSync;
  Monitor: MonitorStatic;
  ActionLogger: { new (...args: any[]): ActionLogger };
  MetricsCollector: { new (...args: any[]): MetricsCollector };
  RuleEngine: { new (eventBus?: EventBus): RuleEngine };
  EvolutionEngine: { new (frame: CardFrameInstance, options?: Record<string, any>, eventBus?: EventBus): EvolutionEngine };
  Guardrail: { new (frame: CardFrameInstance, options?: GuardrailOptions): Guardrail };
  PerfPanel: { new (...args: any[]): PerfPanel };
  GlobalErrorHandler: { new (...args: any[]): GlobalErrorHandler };
  CardObjectPool: { new (...args: any[]): CardObjectPool };
  LayoutCache: { new (options?: { maxSize?: number }): LayoutCache };
  QueryIndex: { new (): QueryIndex };
  ShadowCardRegistry: { new (): ShadowCardRegistry };

  // 常量
  EVENT_TYPES: Record<keyof CardFrameEventMap, string> & Record<string, string>;
  DEFAULT_CONFIG: DefaultConfig;
  CARD_STATUS: Record<'ACTIVE' | 'COMPLETED' | 'ARCHIVED', CardStatus>;
  RELATIONSHIP_TYPES: Record<string, RelationshipType>;

  // 版本
  readonly VERSION: string;
};

// 浏览器全局
declare global {
  interface Window {
    CardFrame: typeof CardFrame;
  }

  interface HTMLElementTagNameMap {
    'card-frame': HTMLElement & { __cardFrame?: CardFrameInstance };
    'cf-card': HTMLElement & { _frame?: CardFrameInstance; dataset: DOMStringMap };
  }
}
