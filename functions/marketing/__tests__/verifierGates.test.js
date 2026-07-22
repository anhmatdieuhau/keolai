/**
 * Plain assert-based test — run with:
 *   node functions/marketing/__tests__/verifierGates.test.js
 * This is the most important gate in the whole system (Gate #1 —
 * evidenceVerifier) — tests every fixture from the plan's Phase 2 acceptance
 * criteria: a bogus source, a real source whose snippet doesn't support the
 * claim, and a site-metric claim citing a non-GSC/GA4 source. All must be
 * rejected 100% of the time, and no real fetch/LLM call happens (fully mocked).
 */
const assert = require('assert');
const { verifyClaim, claimId, snippetOverlapRatio, extractNumbers, flattenNumbers } = require('../lib/verifierGates');

function fakeFetch(responses) {
  return async (url) => {
    if (!(url in responses)) throw new Error(`unexpected fetch: ${url}`);
    const r = responses[url];
    if (r instanceof Error) throw r;
    return { ok: r.ok !== false, status: r.status || 200, async text() { return r.text || ''; } };
  };
}

function fakeClaudeClient(verdict) {
  return {
    async callJSON() {
      if (verdict instanceof Error) throw verdict;
      return verdict;
    },
  };
}

(async () => {
  // ══ Tier 2: site-metric claims ══

  // Happy path: numbers in claim match raw_api_response exactly (as they
  // always will for our own sensors, since claim text is built FROM raw_api_response).
  {
    const claim = {
      claim: 'Trang X đang ở vị trí 8.2 với 500 impression.',
      source_url: 'https://keolaigiamhom.vn/articles/x/',
      evidence_snippet: 'query="x", position=8.2, impressions=500',
      raw_api_response: { query: 'x', page: 'y', position: 8.2, impressions: 500, clicks: 3, ctr: 0.6 },
    };
    const result = await verifyClaim(claim, { fetchFn: fakeFetch({}), claudeClient: fakeClaudeClient({}) });
    assert.strictEqual(result.verdict, 'SUPPORTED');
    assert.strictEqual(result.tier, 2);
    console.log('PASS: tier 2 — claim numbers matching raw_api_response is SUPPORTED, no fetch/LLM call made');
  }

  // Fixture: site-metric claim with a fabricated number not in raw_api_response.
  {
    const claim = {
      claim: 'Trang X đang ở vị trí 8.2 với 999999 impression.', // 999999 does not appear in raw_api_response
      source_url: 'https://keolaigiamhom.vn/articles/x/',
      evidence_snippet: 'query="x", position=8.2, impressions=500',
      raw_api_response: { query: 'x', page: 'y', position: 8.2, impressions: 500, clicks: 3, ctr: 0.6 },
    };
    const result = await verifyClaim(claim, { fetchFn: fakeFetch({}), claudeClient: fakeClaudeClient({}) });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'metric_mismatch');
    console.log('PASS: tier 2 fixture — fabricated number not in raw_api_response is REJECTED (metric_mismatch)');
  }

  // Fixture from plan acceptance criteria: site-metric claim citing a non-GSC/GA4 source.
  {
    const claim = {
      claim: 'Trang X có 500 lượt xem theo nguồn bên thứ ba.',
      source_url: 'https://keolaigiamhom.vn/articles/x/',
      evidence_snippet: 'third-party analytics: 500 views',
      raw_api_response: { views: 500, source: 'some-third-party-tool' }, // no impressions/position -> not GSC shape
    };
    const result = await verifyClaim(claim, { fetchFn: fakeFetch({}), claudeClient: fakeClaudeClient({}) });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'source_not_gsc_ga4');
    console.log('PASS: tier 2 fixture — claim with non-GSC/GA4-shaped raw_api_response is REJECTED (source_not_gsc_ga4)');
  }

  // ══ Tier 1 + 3: content/competitor claims ══

  // Fixture from plan acceptance criteria: source URL that doesn't exist / fetch fails.
  {
    const claim = {
      claim: 'Đối thủ có bài viết về chủ đề X.',
      source_url: 'https://does-not-exist.example/page/',
      evidence_snippet: 'nội dung về chủ đề X',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({ 'https://does-not-exist.example/page/': new Error('getaddrinfo ENOTFOUND') }),
      claudeClient: fakeClaudeClient({}),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'api_error');
    assert.strictEqual(result.tier, 1);
    console.log('PASS: tier 1 fixture — nonexistent source_url is REJECTED (api_error), LLM never called');
  }

  // Fixture from plan acceptance criteria: real source, but snippet doesn't
  // actually support the claim (page content doesn't overlap with the snippet).
  {
    const claim = {
      claim: 'Đối thủ có bài viết chi tiết về kỹ thuật ghép cành keo lai.',
      source_url: 'https://competitor.example/random-page/',
      evidence_snippet: 'kỹ thuật ghép cành chi tiết chuyên sâu quy trình thực hiện',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({
        'https://competitor.example/random-page/': { text: 'Trang này chỉ nói về giá cả sản phẩm và thông tin liên hệ, không liên quan.' },
      }),
      claudeClient: fakeClaudeClient({ verdict: 'SUPPORTED', confidence: 0.99, reason: 'should never be reached' }),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'no_snippet_match');
    assert.strictEqual(result.tier, 1);
    console.log('PASS: tier 1 fixture — real source whose content does not support the snippet is REJECTED before ever reaching the LLM');
  }

  // Tier 1 passes, tier 3 LLM says NOT_SUPPORTED.
  {
    const claim = {
      claim: 'Đối thủ có bài về xuất khẩu gỗ dăm sang Nhật Bản.',
      source_url: 'https://competitor.example/xuat-khau/',
      evidence_snippet: 'thông tin xuất khẩu gỗ dăm thị trường quốc tế',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({
        'https://competitor.example/xuat-khau/': { text: 'Bài viết nói về thông tin xuất khẩu gỗ dăm ra thị trường quốc tế nói chung, không đề cập cụ thể Nhật Bản.' },
      }),
      claudeClient: fakeClaudeClient({ verdict: 'NOT_SUPPORTED', confidence: 0.9, reason: 'evidence không nhắc cụ thể Nhật Bản' }),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'not_supported');
    assert.strictEqual(result.tier, 3);
    console.log('PASS: tier 3 — LLM verdict NOT_SUPPORTED is REJECTED');
  }

  // Tier 3: AMBIGUOUS is rejected (fail-closed), not treated as pass.
  {
    const claim = {
      claim: 'Đối thủ có nội dung tương tự.',
      source_url: 'https://competitor.example/vague/',
      evidence_snippet: 'một số thông tin chung chung',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({ 'https://competitor.example/vague/': { text: 'một số thông tin chung chung khác trên trang' } }),
      claudeClient: fakeClaudeClient({ verdict: 'AMBIGUOUS', confidence: 0.5, reason: 'không rõ ràng' }),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'ambiguous');
    console.log('PASS: tier 3 — AMBIGUOUS verdict is REJECTED (fail-closed, not treated as pass)');
  }

  // Tier 3: SUPPORTED but confidence below threshold is still rejected.
  {
    const claim = {
      claim: 'Đối thủ có bài về chủ đề Y.',
      source_url: 'https://competitor.example/y/',
      evidence_snippet: 'nội dung liên quan chủ đề Y đầy đủ',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({ 'https://competitor.example/y/': { text: 'nội dung liên quan chủ đề Y đầy đủ chi tiết' } }),
      claudeClient: fakeClaudeClient({ verdict: 'SUPPORTED', confidence: 0.4, reason: 'khá chắc nhưng không hoàn toàn' }),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'low_confidence');
    console.log('PASS: tier 3 — SUPPORTED with confidence below 0.7 is REJECTED (low_confidence)');
  }

  // Tier 3: LLM judge throws (API outage) -> fail-closed, distinguishable reject_reason.
  {
    const claim = {
      claim: 'Đối thủ có bài về chủ đề Z.',
      source_url: 'https://competitor.example/z/',
      evidence_snippet: 'nội dung chủ đề Z',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({ 'https://competitor.example/z/': { text: 'nội dung chủ đề Z đầy đủ' } }),
      claudeClient: fakeClaudeClient(new Error('Anthropic API 529 overloaded')),
    });
    assert.strictEqual(result.verdict, 'REJECTED');
    assert.strictEqual(result.reject_reason, 'api_error');
    console.log('PASS: tier 3 — LLM judge error (e.g. outage) is REJECTED (api_error, distinguishable from content-quality rejects)');
  }

  // Happy path: tier 1 + tier 3 both pass -> SUPPORTED.
  {
    const claim = {
      claim: 'Đối thủ có bài về phân bón hữu cơ cho keo lai.',
      source_url: 'https://competitor.example/phan-bon/',
      evidence_snippet: 'hướng dẫn sử dụng phân bón hữu cơ cho cây keo lai',
      raw_api_response: null,
    };
    const result = await verifyClaim(claim, {
      fetchFn: fakeFetch({ 'https://competitor.example/phan-bon/': { text: 'Bài viết hướng dẫn sử dụng phân bón hữu cơ cho cây keo lai hiệu quả.' } }),
      claudeClient: fakeClaudeClient({ verdict: 'SUPPORTED', confidence: 0.85, reason: 'evidence khớp đúng nội dung claim' }),
    });
    assert.strictEqual(result.verdict, 'SUPPORTED');
    assert.strictEqual(result.tier, 3);
    console.log('PASS: happy path — tier 1 + tier 3 both pass, claim is SUPPORTED');
  }

  // ══ helper function unit tests ══
  {
    assert.ok(snippetOverlapRatio('cây keo lai', 'bài viết về cây keo lai chất lượng') >= 0.99);
    assert.ok(snippetOverlapRatio('hoàn toàn không liên quan gì cả', 'trang chủ sản phẩm giá cả') < 0.3);
    assert.strictEqual(snippetOverlapRatio('', 'anything'), 0);
    console.log('PASS: snippetOverlapRatio — high overlap for matching text, low for unrelated, 0 for empty snippet');
  }
  {
    assert.deepStrictEqual(extractNumbers('vị trí 8.2, impression 500'), [8.2, 500]);
    assert.deepStrictEqual(flattenNumbers({ a: 1, b: { c: 2, d: [3, 4] } }).sort(), [1, 2, 3, 4]);
    console.log('PASS: extractNumbers/flattenNumbers pull the right numeric values out of text/objects');
  }
  {
    const claim = { claim: 'x', source_url: 'y', retrieved_at: 'z' };
    assert.strictEqual(claimId(claim), claimId({ ...claim }), 'same claim content must produce the same ID');
    assert.notStrictEqual(claimId(claim), claimId({ ...claim, claim: 'different' }));
    console.log('PASS: claimId is stable for identical content, differs when content differs');
  }

  console.log('\nAll verifierGates tests passed — 100% rejection on every fabricated-claim fixture.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
