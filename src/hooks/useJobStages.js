import { useState, useEffect } from 'react';

const KEY = 'cpwtcv_job_stages_v1';

export const PREDEFINED_STAGES = [
  'Applied',
  'Phone Screen',
  'OA / Take-Home',
  'Technical Screen',
  'Technical Round 1',
  'Technical Round 2',
  'DSA Round',
  'System Design Round',
  'HR Round',
  'Manager Round',
  'Panel Interview',
  'Final Round',
  'Offer',
  'Negotiation',
];

/** The saved custom stages; anything that is not a list of names reads as none. */
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved.filter(s => typeof s === 'string' && s.trim());
  } catch { /* unreadable: none */ }
  return [];
}

export function useJobStages() {
  const [customStages, setCustomStages] = useState(load);

  useEffect(() => {
    // Storage full: the stages just aren't remembered — the job being edited still gets its stage.
    try { localStorage.setItem(KEY, JSON.stringify(customStages)); } catch { /* not remembered */ }
  }, [customStages]);

  function addCustomStage(label) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const allLower = [...PREDEFINED_STAGES, ...customStages].map(s => s.toLowerCase());
    if (allLower.includes(trimmed.toLowerCase())) return;
    setCustomStages(prev => [...prev, trimmed]);
  }

  function removeCustomStage(label) {
    setCustomStages(prev => prev.filter(s => s !== label));
  }

  return { customStages, addCustomStage, removeCustomStage };
}
