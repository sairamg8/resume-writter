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

function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function useJobStages() {
  const [customStages, setCustomStages] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(customStages));
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
