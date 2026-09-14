import { buildTestState, DATA_VERSION } from '../../tests/helpers.js';

/**
 * A store holding one test résumé per template, named "Classic CV", "Modern CV", … — for specs
 * that need several cards (a real first visit is an empty dashboard).
 */
export function dashboardState(templates = ['classic', 'modern', 'minimal']) {
  const resumes = templates.map((t) => ({
    ...buildTestState(t).resumes[0],
    name: `${t[0].toUpperCase()}${t.slice(1)} CV`,
  }));
  return { dataVersion: DATA_VERSION, activeId: resumes[0].id, deletedIds: [], resumes };
}
