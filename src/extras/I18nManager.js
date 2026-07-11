/**
 * I18nManager — internationalization with 8 built-in locales.
 * @module extras/I18nManager
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class I18nManager {
  constructor(container = null, eventBus = null) {
    this.currentLocale = 'zh-CN';
    this.locales = new Map();
    this._fallbackLocale = 'en-US';
    this.container = container;
    this._eventBus = eventBus;
    this._rtlLocales = ['ar', 'ar-', 'he', 'he-', 'fa', 'fa-', 'ur', 'ur-', 'ps', 'ps-', 'sd', 'sd-', 'dv', 'dv-', 'yi', 'yi-'];

    this._registerDefaultLocales();
  }

  setContainer(container) {
    this.container = container;
    this._updateContainerDir();
  }

  _registerDefaultLocales() {
    this.registerLocale('zh-CN', {
      label: '简体中文',
      messages: {
        'card.title.default': '未命名卡片',
        'card.error.render': '卡片渲染错误',
        'card.error.unknownType': '未知类型',
        'card.error.retry': '重试',
        'card.error.delete': '删除',
        'plugin.install.success': '插件安装成功',
        'plugin.uninstall.success': '插件已卸载',
        'plugin.enable.success': '插件已启用',
        'plugin.disable.success': '插件已禁用',
        'theme.changed': '主题已切换',
        'validation.required': '必填属性缺失',
        'validation.typeError': '类型错误',
        'validation.allowedValues': '值不在允许列表中',
        'autofix.defaultValue': '已填充默认值',
        'autofix.rollback': '已回滚到默认值',
        'circuitBreaker.opened': '熔断已触发',
        'circuitBreaker.closed': '熔断已恢复'
      }
    });

    this.registerLocale('en-US', {
      label: 'English',
      messages: {
        'card.title.default': 'Untitled Card',
        'card.error.render': 'Card Render Error',
        'card.error.unknownType': 'Unknown Type',
        'card.error.retry': 'Retry',
        'card.error.delete': 'Delete',
        'plugin.install.success': 'Plugin installed successfully',
        'plugin.uninstall.success': 'Plugin uninstalled',
        'plugin.enable.success': 'Plugin enabled',
        'plugin.disable.success': 'Plugin disabled',
        'theme.changed': 'Theme changed',
        'validation.required': 'Required property missing',
        'validation.typeError': 'Type error',
        'validation.allowedValues': 'Value not in allowed list',
        'autofix.defaultValue': 'Filled with default value',
        'autofix.rollback': 'Rolled back to default value',
        'circuitBreaker.opened': 'Circuit breaker opened',
        'circuitBreaker.closed': 'Circuit breaker closed'
      }
    });

    this.registerLocale('ja-JP', {
      label: '日本語',
      messages: {
        'card.title.default': '無題のカード',
        'card.error.render': 'カードレンダリングエラー',
        'card.error.unknownType': '不明なタイプ',
        'card.error.retry': '再試行',
        'card.error.delete': '削除',
        'plugin.install.success': 'プラグインのインストールに成功しました',
        'plugin.uninstall.success': 'プラグインをアンインストールしました',
        'plugin.enable.success': 'プラグインが有効になりました',
        'plugin.disable.success': 'プラグインが無効になりました',
        'theme.changed': 'テーマが変更されました',
        'validation.required': '必須項目が欠落しています',
        'validation.typeError': 'タイプエラー',
        'validation.allowedValues': '値が許可されたリストにありません',
        'autofix.defaultValue': 'デフォルト値で埋めました',
        'autofix.rollback': 'デフォルト値にロールバックしました',
        'circuitBreaker.opened': 'サーキットブレーカーがオープンしました',
        'circuitBreaker.closed': 'サーキットブレーカーがクローズしました'
      }
    });

    this.registerLocale('ko-KR', {
      label: '한국어',
      messages: {
        'card.title.default': '제목 없는 카드',
        'card.error.render': '카드 렌더링 오류',
        'card.error.unknownType': '알 수 없는 유형',
        'card.error.retry': '재시도',
        'card.error.delete': '삭제',
        'plugin.install.success': '플러그인 설치 성공',
        'plugin.uninstall.success': '플러그인 제거됨',
        'plugin.enable.success': '플러그인 활성화됨',
        'plugin.disable.success': '플러그인 비활성화됨',
        'theme.changed': '테마가 변경되었습니다',
        'validation.required': '필수 속성이 누락되었습니다',
        'validation.typeError': '유형 오류',
        'validation.allowedValues': '값이 허용 목록에 없습니다',
        'autofix.defaultValue': '기본값으로 채워졌습니다',
        'autofix.rollback': '기본값으로 롤백되었습니다',
        'circuitBreaker.opened': '회로 차단기가 열렸습니다',
        'circuitBreaker.closed': '회로 차단기가 닫혔습니다'
      }
    });

    this.registerLocale('fr-FR', {
      label: 'Français',
      messages: {
        'card.title.default': 'Carte sans titre',
        'card.error.render': 'Erreur de rendu de carte',
        'card.error.unknownType': 'Type inconnu',
        'card.error.retry': 'Réessayer',
        'card.error.delete': 'Supprimer',
        'plugin.install.success': 'Plugin installé avec succès',
        'plugin.uninstall.success': 'Plugin désinstallé',
        'plugin.enable.success': 'Plugin activé',
        'plugin.disable.success': 'Plugin désactivé',
        'theme.changed': 'Thème changé',
        'validation.required': 'Propriété requise manquante',
        'validation.typeError': 'Erreur de type',
        'validation.allowedValues': 'Valeur hors de la liste autorisée',
        'autofix.defaultValue': 'Rempli avec la valeur par défaut',
        'autofix.rollback': 'Rétabli à la valeur par défaut',
        'circuitBreaker.opened': 'Disjoncteur ouvert',
        'circuitBreaker.closed': 'Disjoncteur fermé'
      }
    });

    this.registerLocale('es-ES', {
      label: 'Español',
      messages: {
        'card.title.default': 'Tarjeta sin título',
        'card.error.render': 'Error de renderizado de tarjeta',
        'card.error.unknownType': 'Tipo desconocido',
        'card.error.retry': 'Reintentar',
        'card.error.delete': 'Eliminar',
        'plugin.install.success': 'Plugin instalado con éxito',
        'plugin.uninstall.success': 'Plugin desinstalado',
        'plugin.enable.success': 'Plugin habilitado',
        'plugin.disable.success': 'Plugin deshabilitado',
        'theme.changed': 'Tema cambiado',
        'validation.required': 'Propiedad requerida faltante',
        'validation.typeError': 'Error de tipo',
        'validation.allowedValues': 'Valor fuera de la lista permitida',
        'autofix.defaultValue': 'Rellenado con valor por defecto',
        'autofix.rollback': 'Restaurado al valor por defecto',
        'circuitBreaker.opened': 'Disyuntor abierto',
        'circuitBreaker.closed': 'Disyuntor cerrado'
      }
    });

    this.registerLocale('de-DE', {
      label: 'Deutsch',
      messages: {
        'card.title.default': 'Unbenannte Karte',
        'card.error.render': 'Karten-Rendering-Fehler',
        'card.error.unknownType': 'Unbekannter Typ',
        'card.error.retry': 'Wiederholen',
        'card.error.delete': 'Löschen',
        'plugin.install.success': 'Plugin erfolgreich installiert',
        'plugin.uninstall.success': 'Plugin deinstalliert',
        'plugin.enable.success': 'Plugin aktiviert',
        'plugin.disable.success': 'Plugin deaktiviert',
        'theme.changed': 'Theme gewechselt',
        'validation.required': 'Pflichtfeld fehlt',
        'validation.typeError': 'Typfehler',
        'validation.allowedValues': 'Wert nicht in der erlaubten Liste',
        'autofix.defaultValue': 'Mit Standardwert gefüllt',
        'autofix.rollback': 'Auf Standardwert zurückgesetzt',
        'circuitBreaker.opened': 'Schutzschalter geöffnet',
        'circuitBreaker.closed': 'Schutzschalter geschlossen'
      }
    });
  }

  registerLocale(locale, localeDef) {
    if (!locale || !localeDef) {
      throw new Error('locale 和 localeDef 都是必填的');
    }

    this.locales.set(locale, {
      locale,
      label: localeDef.label || locale,
      messages: localeDef.messages || {},
      rtl: localeDef.rtl || false
    });

    return true;
  }

  getLocale(locale) {
    return this.locales.get(locale) || null;
  }

  getAllLocales() {
    return Array.from(this.locales.values()).map(l => ({
      locale: l.locale,
      label: l.label,
      rtl: l.rtl
    }));
  }

  setLocale(locale) {
    if (!this.locales.has(locale)) {
      FeedbackSystem.warn(`语言 "${locale}" 不存在`);
      return false;
    }

    this.currentLocale = locale;

    const localeDef = this.locales.get(locale);
    const isRTL = localeDef.rtl || this._isRTLLocale(locale);

    if (document.documentElement) {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }

    this._updateContainerDir();

    if (this._eventBus) {
      this._eventBus.emit(EVENT_TYPES.LANGUAGE_CHANGED, { locale, rtl: isRTL });
    }
    return true;
  }

  _updateContainerDir() {
    if (this.container) {
      const isRTL = this.isRTL();
      this.container.dir = isRTL ? 'rtl' : 'ltr';
      this.container.dataset.dir = isRTL ? 'rtl' : 'ltr';
    }
  }

  isRTL(locale = null) {
    const targetLocale = locale || this.currentLocale;
    const localeDef = this.locales.get(targetLocale);
    if (localeDef && localeDef.rtl !== undefined) {
      return localeDef.rtl;
    }
    return this._isRTLLocale(targetLocale);
  }

  _isRTLLocale(locale) {
    if (!locale) return false;
    const lowerLocale = locale.toLowerCase();
    return this._rtlLocales.some(rtlPrefix => lowerLocale.startsWith(rtlPrefix));
  }

  getCurrentLocale() {
    return this.currentLocale;
  }

  t(key, params = {}) {
    const locale = this.locales.get(this.currentLocale);
    let message = locale ? locale.messages[key] : null;

    if (!message) {
      const fallback = this.locales.get(this._fallbackLocale);
      message = fallback ? fallback.messages[key] : null;
    }

    if (!message) {
      return key;
    }

    return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }

  detectBrowserLocale() {
    if (typeof navigator === 'undefined') return 'en-US';

    const browserLocale = navigator.language || navigator.userLanguage || 'en-US';

    if (this.locales.has(browserLocale)) {
      return browserLocale;
    }

    const shortLocale = browserLocale.split('-')[0];
    for (const locale of this.locales.keys()) {
      if (locale.startsWith(shortLocale)) {
        return locale;
      }
    }

    return 'en-US';
  }

  setFallbackLocale(locale) {
    this._fallbackLocale = locale;
  }
}
