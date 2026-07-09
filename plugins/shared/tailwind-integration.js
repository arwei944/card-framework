/**
 * CardFrame Tailwind Integration Plugin
 * 将 Tailwind CSS 变量映射到 CardFrame 主题系统
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const TailwindIntegration = {
    name: 'tailwind-integration',
    version: '1.0.0',
    dependencies: [],

    /**
     * 安装插件
     * @param {CardFrame} frame - CardFrame 实例
     * @param {Object} options - 配置选项
     */
    install(frame, options = {}) {
      this._frame = frame;
      this._options = {
        project: options.project || 'mindcanvas', // mindcanvas | crypto-workstation | trade-hub
        customVars: options.customVars || {},
        ...options
      };

      this._registerThemes(frame);
      this._applyTailwindClasses(frame);
      this._setupVariableSync(frame);

      console.log(`[TailwindIntegration] 已安装项目: ${this._options.project}`);
    },

    /**
     * 1.3.1 / 1.3.2 / 1.3.3 注册 Tailwind 主题变量
     */
    _registerThemes(frame) {
      const project = this._options.project;

      // MindCanvas 主题变量
      if (project === 'mindcanvas') {
        frame.themeManager.registerTheme('mindcanvas', {
          '--cf-card-bg': '#FFFFFF',
          '--cf-card-border': 'rgba(0, 0, 0, 0.1)',
          '--cf-card-shadow': '0 2px 4px rgba(0, 0, 0, 0.05)',
          '--cf-primary': '#171717',
          '--cf-primary-light': '#353535',
          '--cf-text-primary': '#0A0A0A',
          '--cf-text-secondary': '#6E6E6E',
          '--cf-text-tertiary': '#A0A0A0',
          '--cf-bg-100': '#FFFFFF',
          '--cf-bg-200': '#F5F5F5',
          '--cf-bg-300': '#EBEBEB',
          '--cf-border': '#E5E5E5',
          '--cf-blue-700': '#2563EB',
          '--cf-blue-100': '#EFF6FF',
          '--cf-green-700': '#059669',
          '--cf-green-100': '#ECFDF5',
          '--cf-purple-700': '#7C3AED',
          '--cf-purple-100': '#F5F3FF',
          '--cf-amber-700': '#D97706',
          '--cf-amber-100': '#FFFBEB',
          '--cf-red-700': '#DC2626',
          '--cf-red-100': '#FEF2F2',
          '--cf-status-online': '#10b981',
          '--cf-status-offline': '#6b7280',
          '--cf-radius': '0.5rem',
          '--cf-radius-sm': '0.375rem',
          '--cf-spacing': '1rem',
          '--cf-font-sans': '-apple-system, BlinkMacSystemFont, "SF Pro", "PingFang SC", "Noto Sans SC", sans-serif'
        });
      }

      // Crypto Workstation 主题变量（基础，各页面可覆盖）
      if (project === 'crypto-workstation') {
        // 注册 5 个主题
        const themes = {
          'deep-space': {
            '--cf-card-bg': '#1a1f36',
            '--cf-card-border': 'rgba(255, 255, 255, 0.08)',
            '--cf-card-shadow': '0 4px 20px rgba(0, 0, 0, 0.3)',
            '--cf-primary': '#6366f1',
            '--cf-text-primary': '#f1f5f9',
            '--cf-text-secondary': '#94a3b8',
            '--cf-bg-100': '#0f172a',
            '--cf-bg-200': '#1e293b',
            '--cf-border': 'rgba(255, 255, 255, 0.1)',
            '--cf-radius': '0.75rem',
            '--cf-font-sans': 'system-ui, -apple-system, sans-serif'
          },
          'industrial': {
            '--cf-card-bg': '#f8fafc',
            '--cf-card-border': '#cbd5e1',
            '--cf-card-shadow': '0 1px 3px rgba(0, 0, 0, 0.1)',
            '--cf-primary': '#475569',
            '--cf-text-primary': '#1e293b',
            '--cf-text-secondary': '#64748b',
            '--cf-bg-100': '#ffffff',
            '--cf-bg-200': '#f1f5f9',
            '--cf-border': '#e2e8f0',
            '--cf-radius': '0.25rem',
            '--cf-font-sans': 'ui-monospace, monospace'
          },
          'mint': {
            '--cf-card-bg': '#f0fdf4',
            '--cf-card-border': '#bbf7d0',
            '--cf-card-shadow': '0 2px 8px rgba(0, 0, 0, 0.05)',
            '--cf-primary': '#10b981',
            '--cf-text-primary': '#064e3b',
            '--cf-text-secondary': '#059669',
            '--cf-bg-100': '#ffffff',
            '--cf-bg-200': '#ecfdf5',
            '--cf-border': '#a7f3d0',
            '--cf-radius': '1rem',
            '--cf-font-sans': 'system-ui, sans-serif'
          },
          'neon': {
            '--cf-card-bg': '#0a0a0a',
            '--cf-card-border': '#22d3ee',
            '--cf-card-shadow': '0 0 20px rgba(34, 211, 238, 0.2)',
            '--cf-primary': '#22d3ee',
            '--cf-text-primary': '#ffffff',
            '--cf-text-secondary': '#a5f3fc',
            '--cf-bg-100': '#000000',
            '--cf-bg-200': '#111111',
            '--cf-border': 'rgba(34, 211, 238, 0.3)',
            '--cf-radius': '0.5rem',
            '--cf-font-sans': 'monospace'
          },
          'platinum': {
            '--cf-card-bg': '#ffffff',
            '--cf-card-border': '#e2e8f0',
            '--cf-card-shadow': '0 4px 6px rgba(0, 0, 0, 0.05)',
            '--cf-primary': '#64748b',
            '--cf-text-primary': '#0f172a',
            '--cf-text-secondary': '#475569',
            '--cf-bg-100': '#f8fafc',
            '--cf-bg-200': '#f1f5f9',
            '--cf-border': '#cbd5e1',
            '--cf-radius': '0.5rem',
            '--cf-font-sans': 'system-ui, sans-serif'
          }
        };

        Object.entries(themes).forEach(([name, vars]) => {
          frame.themeManager.registerTheme(name, vars);
        });
      }

      // Trade Hub 主题变量
      if (project === 'trade-hub') {
        frame.themeManager.registerTheme('trade-hub', {
          '--cf-card-bg': '#ffffff',
          '--cf-card-border': '#e5e7eb',
          '--cf-card-shadow': '0 1px 3px rgba(0, 0, 0, 0.1)',
          '--cf-primary': '#3b82f6',
          '--cf-text-primary': '#111827',
          '--cf-text-secondary': '#6b7280',
          '--cf-bg-100': '#f9fafb',
          '--cf-bg-200': '#f3f4f6',
          '--cf-border': '#d1d5db',
          '--cf-radius': '0.5rem',
          '--cf-font-sans': 'system-ui, -apple-system, sans-serif'
        });
      }

      // 应用自定义变量覆盖
      if (this._options.customVars && Object.keys(this._options.customVars).length > 0) {
        frame.themeManager.registerTheme('custom', this._options.customVars);
        frame.themeManager.applyTheme('custom');
      }
    },

    /**
     * 在卡片渲染时应用 Tailwind 类
     */
    _applyTailwindClasses(frame) {
      frame.eventBus.on('card:rendered', (data) => {
        const { card, element } = data;
        if (!element) return;

        // 应用基础 Tailwind 类
        element.classList.add('cf-tailwind-card');

        // 根据项目应用特定类
        if (this._options.project === 'mindcanvas') {
          element.classList.add('rounded-xl', 'shadow-sm', 'border', 'border-black/10');
        } else if (this._options.project === 'crypto-workstation') {
          element.classList.add('rounded-lg', 'shadow-md');
        } else if (this._options.project === 'trade-hub') {
          element.classList.add('rounded-md', 'shadow-sm', 'border');
        }
      });
    },

    /**
     * 同步 CSS 变量到容器
     */
    _setupVariableSync(frame) {
      // 主题切换时更新 CSS 变量
      frame.eventBus.on('theme:changed', (data) => {
        const theme = frame.themeManager.getTheme(data.theme);
        if (!theme) return;

        Object.entries(theme).forEach(([key, value]) => {
          frame.container.style.setProperty(key, value);
        });
      });

      // 初始化应用默认主题变量
      const defaultTheme = frame.themeManager.getCurrentTheme();
      if (defaultTheme) {
        Object.entries(defaultTheme).forEach(([key, value]) => {
          frame.container.style.setProperty(key, value);
        });
      }
    },

    /**
     * 切换主题（crypto-workstation 专用）
     * @param {string} themeName - 主题名称
     */
    switchTheme(themeName) {
      if (this._frame && this._frame.themeManager) {
        this._frame.themeManager.applyTheme(themeName);
      }
    },

    /**
     * 获取可用主题列表
     */
    getAvailableThemes() {
      if (!this._frame || !this._frame.themeManager) return [];
      return this._frame.themeManager.getAvailableThemes();
    }
  };

  // 导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TailwindIntegration;
  }
  global.CardFrameTailwindIntegration = TailwindIntegration;

})(typeof window !== 'undefined' ? window : this);
