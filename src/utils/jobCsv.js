/**
 * Job Tracker CSV Export Utility
 * Formats job applications into RFC 4180 compliant CSV for Excel / Google Sheets / Notion.
 */

export function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export function jobsToCsv(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return 'Company,Position,Status,Location,Salary,Deadline,Applied Date,URL,Source,Notes';
  }

  const headers = ['Company', 'Position', 'Status', 'Location', 'Salary', 'Deadline', 'Applied Date', 'URL', 'Source', 'Notes'];
  const lines = [headers.map(escapeCsvField).join(',')];

  for (const j of jobs) {
    if (!j || typeof j !== 'object') continue;
    lines.push([
      escapeCsvField(j.company || ''),
      escapeCsvField(j.position || ''),
      escapeCsvField(j.status || ''),
      escapeCsvField(j.location || ''),
      escapeCsvField(j.salary || ''),
      escapeCsvField(j.deadline || ''),
      escapeCsvField(j.appliedAt || ''),
      escapeCsvField(j.url || ''),
      escapeCsvField(j.source || ''),
      escapeCsvField(j.notes || ''),
    ].join(','));
  }

  return lines.join('\r\n');
}
