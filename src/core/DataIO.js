/**
 * Data import/export & version-migration concern, extracted from CardFrame to
 * reduce its surface area. Functions operate on explicitly-passed collaborators
 * (store, layoutEngine) rather than reaching into a CardFrame instance.
 * @module core/DataIO
 */

/**
 * Validate an imported payload's version and migrate across incompatible majors.
 * @param {Object} data - imported data
 * @param {string} version - current framework version
 * @param {Object} [options] - may contain migrate(data, fromMajor, toMajor)
 * @param {Function} [defaultMigrate] - fallback migration function
 * @returns {Object} validated/migrated data
 */
export function checkDataVersion(data, version, options = {}, defaultMigrate) {
  if (!data || typeof data !== 'object') {
    throw new Error('导入数据无效：期望对象或 JSON 字符串');
  }
  const dataVersion = String(data.version || '1.0');
  const currentVersion = String(version);
  const dataMajor = parseInt(dataVersion.split('.')[0], 10) || 0;
  const currentMajor = parseInt(currentVersion.split('.')[0], 10) || 0;

  if (dataMajor === currentMajor) {
    return data;
  }

  const migrate = options.migrate || defaultMigrate;
  if (typeof migrate === 'function') {
    const migrated = migrate(data, dataMajor, currentMajor);
    if (migrated && typeof migrated === 'object') {
      return migrated;
    }
  }
  throw new Error(
    `导入数据版本不兼容：数据 major=${dataMajor}，当前 major=${currentMajor}。` +
    `请提供 options.migrate 迁移函数。`
  );
}

/**
 * Build an export payload object.
 * @param {Object} deps - { store, layoutEngine, version }
 * @returns {Object}
 */
export function exportData({ store, layoutEngine, version }) {
  return {
    version,
    exportedAt: Date.now(),
    cards: store.getAllCards(),
    relationships: store.getAllRelationships(),
    layoutMode: layoutEngine.mode,
    metadata: {
      cardCount: store.getAllCards().length,
      relationshipCount: store.getAllRelationships().length
    }
  };
}

/**
 * Import a payload into the given store/layoutEngine.
 * @param {Object} deps - { store, layoutEngine, version, defaultMigrate }
 * @param {Object|string} data - object or JSON string
 * @param {Object} [options] - { mode, clearBeforeImport, preserveLayout, migrate }
 * @returns {Object} import result stats
 */
export function importData({ store, layoutEngine, version, defaultMigrate }, data, options = {}) {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  data = checkDataVersion(data, version, options, defaultMigrate);

  const { mode = 'merge', clearBeforeImport = false } = options;

  if (clearBeforeImport || mode === 'replace') {
    store.getAllCards().forEach(c => store.removeCard(c.id));
    store.getAllRelationships().forEach(r => store.removeRelationship(r.id));
  }

  let importedCards = 0;
  let importedRelationships = 0;

  if (data.cards) {
    data.cards.forEach(cardData => {
      if (mode === 'merge' && store.getCard(cardData.id)) {
        store.updateCard(cardData);
      } else {
        store.addCard(cardData);
      }
      importedCards++;
    });
  }

  if (data.relationships) {
    data.relationships.forEach(relData => {
      if (mode === 'merge' && store.getRelationship(relData.id)) {
        store.updateRelationship(relData);
      } else {
        store.addRelationship(relData);
      }
      importedRelationships++;
    });
  }

  if (data.layoutMode && !options.preserveLayout) {
    layoutEngine.setMode(data.layoutMode);
  }

  store.notify();

  return {
    importedCards,
    importedRelationships,
    mode,
    totalCards: store.getAllCards().length,
    totalRelationships: store.getAllRelationships().length
  };
}
