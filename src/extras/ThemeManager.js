/**
 * ThemeManager — light/dark theme switching with CSS variables.
 * @module extras/ThemeManager
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class ThemeManager {
  constructor(container = null, eventBus = null) {
    this.container = container;
    this.currentTheme = 'light';
    this.themes = new Map();
    this._systemThemeListener = null;
    this._followSystem = false;
    this._eventBus = eventBus;

    this._registerDefaultThemes();
  }

  setContainer(container) {
    this.container = container;
    this.applyTheme(this.currentTheme);
  }

  _emit(eventName, detail) {
    if (this._eventBus) {
      this._eventBus.emit(eventName, detail);
    }
  }

  _registerDefaultThemes() {
    this.registerTheme({
      name: 'light',
      label: '亮色主题',
      variables: {
        '--bg-primary': '#ffffff',
        '--bg-secondary': '#f5f5f5',
        '--bg-tertiary': '#e8e8e8',
        '--text-primary': '#1a1a1a',
        '--text-secondary': '#666666',
        '--text-tertiary': '#999999',
        '--border-color': '#e0e0e0',
        '--accent-color': '#3b82f6',
        '--accent-hover': '#2563eb',
        '--success-color': '#22c55e',
        '--warning-color': '#f59e0b',
        '--error-color': '#ef4444',
        '--card-shadow': '0 2px 8px rgba(0,0,0,0.1)',
        '--card-hover-shadow': '0 4px 16px rgba(0,0,0,0.15)'
      }
    });

    this.registerTheme({
      name: 'dark',
      label: '暗色主题',
      variables: {
        '--bg-primary': '#1a1a1a',
        '--bg-secondary': '#2a2a2a',
        '--bg-tertiary': '#3a3a3a',
        '--text-primary': '#ffffff',
        '--text-secondary': '#a0a0a0',
        '--border-color': '#404040',
        '--accent-color': '#60a5fa',
        '--accent-hover': '#3b82f6',
        '--success-color': '#4ade80',
        '--warning-color': '#fbbf24',
        '--error-color': '#f87171',
        '--card-shadow': '0 2px 8px rgba(0,0,0,0.3)',
        '--card-hover-shadow': '0 4px 16px rgba(0,0,0,0.4)'
      }
    });
  }

  registerTheme(themeDef) {
    if (!themeDef || !themeDef.name) {
      throw new Error('主题必须定义 name 属性');
    }

    this.themes.set(themeDef.name, {
      name: themeDef.name,
      label: themeDef.label || themeDef.name,
      description: themeDef.description || '',
      variables: themeDef.variables || {},
      extends: themeDef.extends || null
    });

    return true;
  }

  getTheme(name) {
    return this.themes.get(name) || null;
  }

  removeTheme(name) {
    return this.themes.delete(name);
  }

  getAllThemes() {
    return Array.from(this.themes.values()).map(t => ({
      name: t.name,
      label: t.label,
      description: t.description
    }));
  }

  applyTheme(themeName) {
    const theme = this.themes.get(themeName);
    if (!theme) {
      FeedbackSystem.warn(`主题 "${themeName}" 不存在`);
      return false;
    }

    this.currentTheme = themeName;

    if (this.container) {
      let variables = { ...theme.variables };

      if (theme.extends) {
        const parentTheme = this.themes.get(theme.extends);
        if (parentTheme) {
          variables = { ...parentTheme.variables, ...variables };
        }
      }

      for (const [key, value] of Object.entries(variables)) {
        this.container.style.setProperty(key, value);
      }

      this.container.dataset.theme = themeName;
    }

    this._emit(EVENT_TYPES.THEME_CHANGED, { themeName });
    return true;
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  followSystemTheme(enable = true) {
    this._followSystem = enable;

    if (enable) {
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        this._systemThemeListener = (e) => {
          if (this._followSystem) {
            this.applyTheme(e.matches ? 'dark' : 'light');
          }
        };

        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', this._systemThemeListener);
        } else if (mediaQuery.addListener) {
          mediaQuery.addListener(this._systemThemeListener);
        }

        this.applyTheme(mediaQuery.matches ? 'dark' : 'light');
      }
    } else {
      if (this._systemThemeListener && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', this._systemThemeListener);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(this._systemThemeListener);
        }
      }
      this._systemThemeListener = null;
    }
  }

  isFollowingSystem() {
    return this._followSystem;
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
    return nextTheme;
  }

  setAnimationDuration(duration) {
    if (typeof duration !== 'number' || duration < 0) {
      throw new Error('动画时长必须是非负数字');
    }
    this._animationDuration = duration;
    if (this.container) {
      this.container.style.setProperty('--transition-duration', duration + 's');
    }
  }

  getAnimationDuration() {
    return this._animationDuration !== undefined ? this._animationDuration : 0.3;
  }
}
