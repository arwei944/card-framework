// CardFrame v1.0 TypeScript Type Definitions
// https://github.com/cardframe/card-framework

export as namespace CardFrameNamespace;

export = CardFrame;

// ============================================================
// 核心数据模型
// ============================================================

/**
 * 卡片状态
 */
export type CardStatus = 'active' | 'completed' | 'archived';

/**
 * 关系类型
 */
export type RelationshipType =
  | 'reference'
  | 'parent'
  | 'child'
  | 'dependency'
  | 'related'
  | string;

/**
 * 关系方向
 */
export type LayoutMode = 'flow' | 'canvas';

/**
 * 位置坐标
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * 卡片数据接口
 */
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

/**
 * 关系数据接口
 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  data?: Record<string, any>;
  createdAt: number;
}

/**
 * 属性类型定义
 */
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

/**
 * 属性定义
 */
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
}

/**
 * 卡片动作定义
 */
export interface CardAction {
  name: string;
  label: string;
  handler: (card: Card, store: Store, event: Event) => void;
}

/**
 * 卡片类型定义
 */
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
  addCard(card: Card): void;
  updateCard(cardOrId: string | Partial<Card> & { id: string }, changes?: Record<string, any>): void;
  updateCardProps(cardId: string, props: Record<string, any>): void;
  removeCard(cardId: string): void;
  getCard(cardId: string): Card | undefined;
  getAllCards(): Card[];
  getCardsByType(type: string): Card[];
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Relationship;
  updateRelationship(relOrId: string | Partial<Relationship> & { id: string }, changes?: Record<string, any>): void;
  removeRelationship(relationshipId: string): void;
  getRelationship(relationshipId: string): Relationship | undefined;
  getAllRelationships(): Relationship[];
  getRelationshipsByType(type: RelationshipType): Relationship[];
  getRelationshipsByCard(cardId: string): Relationship[];
  subscribe(listener: EventListener): () => void;
  unsubscribe(listener: EventListener): void;
  getSubscriberCount(): number;
  toJSON(): { cards: Card[]; relationships: Relationship[] };
  fromJSON(data: { cards?: Card[]; relationships?: Relationship[] }): void;
  notify(): void;
}

export interface TypeRegistry {
  register(typeDef: CardTypeDefinition): void;
  unregister(typeName: string): void;
  get(typeName: string): CardTypeDefinition | undefined;
  getAll(): CardTypeDefinition[];
  has(typeName: string): boolean;
  validate(card: Card | Record<string, any>): ValidationResult;
  resolveInheritance(typeName: string): CardTypeDefinition | null;
  getBaseType(): CardTypeDefinition;
  validatePropValue(propName: string, propDef: PropDefinition, value: any): ValidationResult;
}

export interface Renderer {
  renderCards(cards: Card[]): void;
  renderCard(card: Card): HTMLElement;
  updateCardElement(card: Card): void;
  cleanupCardElement(cardId: string): void;
  forceFullRender(): void;
  renderTemplate(template: string, props: Record<string, any>): string;
}

export interface LayoutEngine {
  setMode(mode: LayoutMode): void;
  getMode(): LayoutMode;
  pan(dx: number, dy: number): void;
  zoom(scale: number): void;
  resetView(): void;
  getZoom(): number;
}

export interface EventBus {
  on<T = any>(eventName: EventName, listener: EventListener<T>): () => void;
  once<T = any>(eventName: EventName, listener: EventListener<T>): void;
  off<T = any>(eventName: EventName, listener: EventListener<T>): void;
  emit<T = any>(eventName: EventName, data?: T): void;
  getSubscriberCount(): void;
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
  fixCard(card: Card, validation: ValidationResult): Card | null;
  fixStructure(card: Card): boolean;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

export interface RealTimeValidator {
  start(): void;
  stop(): void;
  validateAll(): ValidationResult;
  syncFromDOM(): void;
  pause(): void;
  resume(): void;
  setCheckInterval(ms: number): void;
  fullCheck(): ValidationResult & { securityIssues: string[] };
}

export interface SecurityStatic {
  escapeHtml(str: any): string;
  escapeAttr(str: any): string;
  sanitizeHtml(html: string, options?: any): string;
  sanitizeUrl(url: string): string;
  sanitizeStyle(style: string | Record<string, string>): string;
  sanitizeStyleObject(obj: Record<string, string>): Record<string, string>;
  isSafeUrl(url: string): boolean;
  checkCSPCompatibility(): { compatible: boolean; issues: string[] };
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
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  setOverscan(n: number): void;
  refresh(): void;
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
}

export interface ThemeManager {
  registerTheme(theme: Theme): void;
  applyTheme(name: string): void;
  getCurrentTheme(): string;
  toggleTheme(): string;
  getAllThemes(): Theme[];
  setAnimationDuration(ms: number): void;
  getAnimationDuration(): number;
}

export interface Locale {
  code: string;
  name: string;
  translations: Record<string, string>;
}

export interface I18nManager {
  registerLocale(locale: Locale): void;
  setLocale(code: string): void;
  getLocale(): string;
  t(key: string, params?: Record<string, any>): string;
  detectBrowserLocale(): string;
  isRTL(locale?: string): boolean;
  setContainer(container: HTMLElement): void;
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
  getStats(): CircuitBreakerStats;
  reset(): void;
  enterSafeMode(): void;
  exitSafeMode(): void;
  isSafeMode(): boolean;
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
  cardTypes?: CardTypeDefinition[];
  install?: (context: PluginContext) => void | Promise<void>;
  uninstall?: (context: PluginContext) => void | Promise<void>;
  enable?: (context: PluginContext) => void | Promise<void>;
  disable?: (context: PluginContext) => void | Promise<void>;
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

export interface PluginContext {
  store: Store;
  typeRegistry: TypeRegistry;
  eventBus: EventBus;
  i18n: I18nManager;
  themeManager: ThemeManager;
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
}

// ============================================================
// 配置
// ============================================================

export interface CardFrameOptions {
  layoutMode?: LayoutMode;
  theme?: string;
  locale?: string;
  enableAutoFix?: boolean;
  enableRealTimeValidation?: boolean;
  enableVirtualScroll?: boolean;
  overscan?: number;
  debounceRenderMs?: number;
  validationDebounceMs?: number;
  fullCheckIntervalMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
  enableInteraction?: boolean;
  rtl?: boolean;
}

export interface CardFrameStats {
  totalCards: number;
  cardsByType: Record<string, number>;
  totalRelationships: number;
  relationshipsByType: Record<string, number>;
  validationStats: {
    totalErrors: number;
    totalWarnings: number;
    autoFixedCount: number;
  };
  circuitBreaker?: CircuitBreakerStats;
  performance: ReturnType<PerfStatic['getStats']>;
}

// ============================================================
// 主类
// ============================================================

export interface CardFrameClass {
  new (containerOrSelector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;
  create(containerOrSelector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;
}

export interface CardFrameInstance {
  // 卡片操作
  createCard(type: string, props?: Record<string, any>): Card;
  updateCard(cardOrId: string | Partial<Card> & { id: string }, changes?: Record<string, any>): void;
  removeCard(cardId: string): void;
  getCard(cardId: string): Card | undefined;
  getAllCards(): Card[];
  getCardsByType(type: string): Card[];

  // 批量操作
  batchCreateCards(cards: Array<{ type: string; props?: Record<string, any> }>): Card[];
  batchUpdateCards(updates: Array<{ id: string; changes: Record<string, any> }>): void;
  batchRemoveCards(cardIds: string[]): void;

  // 关系操作
  createRelationship(sourceId: string, targetId: string, type: RelationshipType, data?: Record<string, any>): Relationship;
  removeRelationship(relationshipId: string): void;
  getRelationship(relationshipId: string): Relationship | undefined;
  getAllRelationships(): Relationship[];

  // 布局
  setLayoutMode(mode: LayoutMode): void;
  getLayoutMode(): LayoutMode;

  // 事件
  on<T = any>(eventName: EventName, listener: EventListener<T>): () => void;
  once<T = any>(eventName: EventName, listener: EventListener<T>): void;
  off<T = any>(eventName: EventName, listener: EventListener<T>): void;
  emit<T = any>(eventName: EventName, data?: T): void;

  // 导入导出
  exportData(): { version: string; exportedAt: number; cards: Card[]; relationships: Relationship[]; layoutMode: LayoutMode; metadata: any };
  exportJSON(): string;
  importData(data: { version?: string; cards?: Card[]; relationships?: Relationship[]; layoutMode?: LayoutMode } | string,
    options?: { mode?: 'merge' | 'replace'; clearBeforeImport?: boolean; preserveLayout?: boolean; migrate?: (data: any, fromMajor: number, toMajor: number) => any }):
    { importedCards: number; importedRelationships: number; mode: string; totalCards: number; totalRelationships: number };

  // 统计
  getStats(): CardFrameStats;

  // 性能
  getPerfStats(): ReturnType<PerfStatic['getStats']>;

  // 插件
  installPlugin(pluginDef: PluginDefinition): void;
  uninstallPlugin(pluginName: string): void;
  enablePlugin(pluginName: string): void;
  disablePlugin(pluginName: string): void;

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
  relationshipEngine: RelationshipEngine;
  circuitBreaker: CircuitBreaker;
  eventBus: EventBus;
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
// 全局 CardFrame 命名空间
// ============================================================

declare const CardFrame: {
  new (containerOrSelector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;
  create(containerOrSelector: string | HTMLElement, options?: CardFrameOptions): CardFrameInstance;

  // 子模块
  Utils: UtilsStatic;
  Store: typeof Store;
  TypeRegistry: typeof TypeRegistry;
  Renderer: typeof Renderer;
  LayoutEngine: typeof LayoutEngine;
  EventBus: EventBus;
  AutoFixer: typeof AutoFixer;
  RealTimeValidator: typeof RealTimeValidator;
  FeedbackSystem: FeedbackSystemStatic;
  Security: SecurityStatic;
  Perf: PerfStatic;
  VirtualScroller: typeof VirtualScroller;
  RelationshipEngine: typeof RelationshipEngine;
  ThemeManager: typeof ThemeManager;
  I18nManager: typeof I18nManager;
  CircuitBreaker: typeof CircuitBreaker;
  PluginManager: typeof PluginManager;
  BackendSync: typeof BackendSync;
  Monitor: MonitorStatic;

  // 全局实例
  store: Store;
  typeRegistry: TypeRegistry;
  renderer: Renderer;
  autoFixer: AutoFixer;
  realTimeValidator: RealTimeValidator;

  // 常量
  EVENT_TYPES: Record<keyof CardFrameEventMap, string> & Record<string, string>;
  DEFAULT_CONFIG: DefaultConfig;
  CARD_STATUS: Record<'ACTIVE' | 'COMPLETED' | 'ARCHIVED', CardStatus>;
  RELATIONSHIP_TYPES: Record<string, RelationshipType>;

  // 模块加载
  load(moduleName: 'core' | 'render' | 'validation' | 'security' | 'extras' | 'plugins' | 'perf'): Promise<void>;
  preload(moduleName: string): Promise<void>;
  isModuleLoaded(moduleName: string): boolean;
  version: string;
};

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

// 浏览器全局
declare global {
  interface Window {
    CardFrame: typeof CardFrame;
  }

  interface HTMLElementTagNameMap {
    'card-frame': HTMLElement & { __cardFrame?: { store: Store; typeRegistry: TypeRegistry; renderer: Renderer; autoFixer: AutoFixer; realTimeValidator: RealTimeValidator } };
    'cf-card': HTMLElement & { _frame?: CardFrameInstance; dataset: DOMStringMap };
  }
}
