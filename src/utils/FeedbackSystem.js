/**
 * Feedback system for user-facing console messages.
 * @module utils/FeedbackSystem
 */

export const FeedbackSystem = {
  config: {
    level: 'info',
    showEmoji: true
  },

  setLevel(level) {
    this.config.level = level;
  },

  info(message, suggestion = '', example = '') {
    if (this.config.level === 'silent') return;
    const prefix = this.config.showEmoji ? 'ℹ️ ' : '';
    console.info(`[CardFrame] ${prefix}${message}`);
    if (suggestion) console.info(`[CardFrame] 💡 ${suggestion}`);
    if (example) console.info(`[CardFrame] 📝 示例：${example}`);
  },

  warn(message, fix = '', correctExample = '') {
    if (this.config.level === 'silent' || this.config.level === 'error') return;
    const prefix = this.config.showEmoji ? '⚠️ ' : '';
    console.warn(`[CardFrame] ${prefix}${message}`);
    if (fix) console.warn(`[CardFrame] 🔧 修复方式：${fix}`);
    if (correctExample) console.warn(`[CardFrame] ✅ 正确写法：${correctExample}`);
  },

  error(message, recover = '', docLink = '') {
    if (this.config.level === 'silent') return;
    const prefix = this.config.showEmoji ? '❌ ' : '';
    console.error(`[CardFrame] ${prefix}${message}`);
    if (recover) console.error(`[CardFrame] 🏥 恢复方式：${recover}`);
    if (docLink) console.error(`[CardFrame] 📚 文档：${docLink}`);
  },

  fix(message, changes = '') {
    if (this.config.level === 'silent') return;
    const prefix = this.config.showEmoji ? '🔧 ' : '';
    console.info(`[CardFrame] ${prefix}${message}`);
    if (changes) console.info(`[CardFrame] 📋 变更：${changes}`);
  }
};
