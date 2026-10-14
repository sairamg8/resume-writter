// Public job-board adapters. list(slug) -> [{title, location, url, team}] or null when the board does not exist.
import { fetchRetry } from './retry.mjs';
const UA = 'resume-writter-jobmap/1.0';
// net.retries: how often a busy host (429/502/503/504) is asked again, read at call time; the discovery probes set it to 0 (one fast miss).
export const net = { retries: 2 };
// deps = { fetchImpl, sleep, retries } only for tests; a busy host (429/5xx) is asked again, a 429 that lasts still throws like any bad status
export const get = async (url, deps = {}) => {
  const r = await fetchRetry(url, { headers: { 'user-agent': UA } }, { timeoutMs: 20000, retries: net.retries, ...deps });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const strip = (h = '') => h.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');

export const post = async (url, body, deps = {}) => {
  const r = await fetchRetry(url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify(body) }, { timeoutMs: 20000, retries: net.retries, ...deps });
  if (r.status === 404 || r.status === 422) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
// Workday needs a search term to page deeply, so ask for the empty search plus one term per job family.
const QUERIES = ['', 'engineer', 'developer', 'aml kyc compliance', 'risk audit', 'finance accounting', 'analyst', 'sales', 'marketing', 'operations', 'human resources', 'legal', 'data', 'product project manager', 'customer support', 'manager'];

export const ATS = {
  // slug = "host|tenant|site", e.g. "adobe.wd5.myworkdayjobs.com|adobe|external_experienced"
  workday: {
    async list(slug) {
      const [host, tenant, site] = slug.split('|');
      const seen = new Map();
      for (const q of QUERIES) {
        for (let off = 0; off < 200; off += 20) {
          const d = await post(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, { appliedFacets: {}, limit: 20, offset: off, searchText: q });
          if (!d) return null;
          for (const j of d.jobPostings) seen.set(j.externalPath, { title: j.title, location: j.locationsText ?? '', url: `https://${host}/en-US/${site}${j.externalPath}`, team: '' });
          if (off + 20 >= d.total) break;
        }
      }
      return [...seen.values()];
    },
  },
  workable: {
    async list(slug) {
      const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
      return d && (d.jobs ?? []).map((j) => ({ title: j.title, location: [j.city, j.state, j.country].filter(Boolean).join(', '), url: j.url ?? j.shortlink, team: j.department ?? '', desc: strip(j.description) }));
    },
  },
  atlassian: {
    async list() {
      const d = await get('https://www.atlassian.com/endpoint/careers/listings');
      return d.map((j) => ({ title: j.title, location: (j.locations ?? []).join('; '), url: j.portalJobPost?.portalUrl ?? '', team: j.category ?? '', desc: strip(j.overview) }));
    },
  },
  greenhouse: {
    async list(slug) {
      const d = await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      return d && d.jobs.map((j) => ({ title: j.title, location: j.location?.name ?? '', url: j.absolute_url, team: '', desc: strip(j.content) }));
    },
  },
  lever: {
    async list(slug) {
      const d = await get(`https://api.lever.co/v0/postings/${slug}?mode=json`);
      return d && d.map((j) => ({ title: j.text, location: j.categories?.location ?? '', url: j.hostedUrl, team: j.categories?.team ?? '', desc: j.descriptionPlain ?? '' }));
    },
  },
  ashby: {
    async list(slug) {
      const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
      return d && d.jobs.map((j) => ({ title: j.title, location: j.location ?? '', url: j.jobUrl, team: j.team ?? '', desc: j.descriptionPlain ?? '' }));
    },
  },
  smartrecruiters: {
    async list(slug) {
      const out = [];
      for (let off = 0; off < 1000; off += 100) {
        const d = await get(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${off}`);
        if (!d || !d.content?.length) return off === 0 && !d?.totalFound ? null : out;
        out.push(...d.content.map((j) => ({ title: j.name, location: [j.location?.city, j.location?.country].filter(Boolean).join(', '), url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`, team: j.department?.label ?? '' })));
        if (out.length >= d.totalFound) break;
      }
      return out;
    },
  },
};
