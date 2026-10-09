// H3-456: the ATS check counted words by splitting on white space. Chinese, Japanese and Thai are written
// without spaces between words: a full name ("山田太郎", family and given name together) was "Incomplete name
// detected — provide both first and last name", and a paragraph-long summary was one word, "Brief summary".
// Names of those scripts count as a family and a given name; a summary is counted in its own words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const item = (resume, id) => analyzeAtsScore(resume).categories.contact.items.find((i) => i.id === id);
const resumeWith = (personal) => ({ personal: { email: 'a@example.com', phone: '+81 90 1234 5678', location: 'Tokyo, Japan', ...personal }, sections: [] });

test('a name in Chinese, Japanese or Thai is a full name', () => {
  for (const name of ['山田太郎', '王小明', 'ともこ', '田中 太郎', 'สมชาย ใจดี', 'สมชายใจดี']) {
    assert.equal(item(resumeWith({ name }), 'name').status, 'pass', name);
  }
});

test('a one-word name in a spaced script, and a one-character one, are still incomplete', () => {
  assert.equal(item(resumeWith({ name: 'Madonna' }), 'name').status, 'warn');
  assert.equal(item(resumeWith({ name: '王' }), 'name').status, 'warn');
  assert.equal(item(resumeWith({ name: '' }), 'name').status, 'fail');
  assert.equal(item(resumeWith({ name: '山田太郎 2' }), 'name').status, 'fail');
});

test('a summary of a few paragraphs in Chinese is counted in words, not as one', () => {
  const summary = '<p>我是一名有十年经验的软件工程师，专注于大规模分布式系统的设计与开发。在过去的工作中，我带领团队把核心服务的响应时间缩短了三成，并推动了持续集成和自动化测试的落地。我擅长与产品和运营团队紧密合作，把复杂的业务需求拆解成清晰的技术方案，并按时交付。我也乐于指导新同事，分享工程实践。</p>';
  const found = item(resumeWith({ name: '王小明', summary }), 'summary');
  assert.equal(found.status, 'pass', found.detail);
  assert.match(found.detail, /Summary contains \d+ words/);
});

test('a short Chinese summary is still brief, and a spaced summary is counted as before', () => {
  assert.equal(item(resumeWith({ name: '王小明', summary: '<p>软件工程师。</p>' }), 'summary').status, 'warn');
  const twentyFive = Array.from({ length: 25 }, (_, i) => `word${i}`).join(' ');
  assert.equal(item(resumeWith({ name: 'Pat Doe', summary: `<p>${twentyFive}</p>` }), 'summary').status, 'pass');
  assert.equal(item(resumeWith({ name: 'Pat Doe', summary: `<p>${twentyFive.split(' ').slice(1).join(' ')}</p>` }), 'summary').status, 'warn');
});
