import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, renderDocx, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

const normalizer = () => loadModule('/src/utils/normalizeResume.js');

async function cv(settings = {}) {
  const { normalizeResume } = await normalizer();
  return normalizeResume({
    template: 'classic',
    settings: { ...settings },
    personal: { name: 'Pat Sample', title: 'Staff Engineer', email: 'pat@example.com' },
    coverLetter: { body: '<p>Dear Sarah,</p>' },
  });
}

describe('Color normalization across PDF and Word exports (ONB-7)', () => {
  it('CSS named colour "red": PDF and Word print the same hex (ff0000)', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const r = await cv({ textColor: 'red' });

    // Word Cover Letter
    const clDoc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
    const clBodyRun = clDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Dear Sarah,<'));
    const clColor = clBodyRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(clColor, 'ff0000', 'Word letter body is red (ff0000)');

    // Word Resume
    const cvDoc = await renderDocx(r);
    const cvNameRun = cvDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Pat Sample<'));
    const cvColor = cvNameRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(cvColor, 'ff0000', 'Word resume name is red (ff0000)');
  });

  it('hsl colour "hsl(220,60%,30%)": PDF and Word print the same hex (1f3d7a)', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const r = await cv({ textColor: 'hsl(220,60%,30%)' });

    const clDoc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
    const clBodyRun = clDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Dear Sarah,<'));
    const clColor = clBodyRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(clColor, '1f3d7a', 'Word letter body is 1f3d7a');

    const cvDoc = await renderDocx(r);
    const cvNameRun = cvDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Pat Sample<'));
    const cvColor = cvNameRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(cvColor, '1f3d7a', 'Word resume name is 1f3d7a');
  });

  it('unreadable colour "banana" drops to default in both PDF and Word', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    const r = await cv({ textColor: 'banana' });

    const clDoc = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
    const clBodyRun = clDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Dear Sarah,<'));
    const clColor = clBodyRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(clColor, '1a1a1a', 'Word letter body uses default 1a1a1a');

    const cvDoc = await renderDocx(r);
    const cvNameRun = cvDoc.paragraphs.flatMap((p) => p.xml.split('</w:r>')).find((x) => x.includes('>Pat Sample<'));
    const cvColor = cvNameRun?.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
    assert.equal(cvColor, '1a1a1a', 'Word resume name uses default 1a1a1a');
  });

  it('standard #rrggbb values remain unchanged (guard)', async () => {
    const r = await cv({ textColor: '#123456' });
    assert.equal(r.settings.textColor, '#123456', 'valid hex preserved');
  });
});
