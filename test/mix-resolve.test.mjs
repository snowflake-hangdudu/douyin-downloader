import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const agent = readFileSync(new URL('../content/page-agent.js', import.meta.url), 'utf8');
assert.match(agent, /fetchAll:\s*Boolean\(event\.data\.fetchAll\)/);
assert.match(agent, /shouldFetch/);
assert.match(agent, /dy-dl-list-tip|刷新列表/);
assert.match(agent, /mixRequestTemplates/);
assert.match(agent, /buildCollectionFetchUrls/);
assert.match(agent, /series\/aweme/);
assert.match(agent, /collectMixFromDom/);
assert.match(agent, /id !== playing/);
assert.match(agent, /主动请求合集接口/);
const fetchCall = agent.indexOf('await fetchMixPage(id, 0)');
const clickCall = agent.indexOf('if (shortList && clickCollectionTab())');
assert.ok(fetchCall > 0 && clickCall > fetchCall);

console.log('mix-resolve tests passed');
