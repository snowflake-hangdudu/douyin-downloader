import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const parse = require('../lib/aweme-parse.js');

const sample = {
  aweme_id: '7512345678901234567',
  desc: '测试标题 / 含:非法*',
  create_time: 1710000000,
  author: { nickname: '测试作者' },
  statistics: { play_count: 12345 },
  video: {
    duration: 12500,
    height: 1080,
    ratio: '1080p',
    cover: { url_list: ['http://p3.douyinpic.com/cover.jpg'] },
    origin_cover: { url_list: ['https://p3.douyinpic.com/origin.jpg'] },
    play_addr: {
      url_list: ['https://v26-web.douyinvod.com/play/default.mp4'],
      data_size: 1000,
      height: 720
    },
    play_addr_h264: {
      url_list: ['https://v26-web.douyinvod.com/play/h264.mp4'],
      data_size: 2000,
      height: 720
    },
    bit_rate: [
      {
        gear_name: 'adapt_lowest_1080_1',
        quality_type: 2,
        bit_rate: 3000000,
        is_h265: 1,
        play_addr: {
          url_list: ['https://v26-web.douyinvod.com/playwm/h265.mp4'],
          data_size: 4000,
          height: 1080
        }
      },
      {
        gear_name: 'adapt_lowest_720_1',
        bit_rate: 1800000,
        is_h265: 0,
        play_addr: {
          url_list: ['https://v26-web.douyinvod.com/play/720.mp4'],
          data_size: 2500,
          height: 720
        }
      }
    ]
  }
};

assert.equal(parse.parseAwemeId('https://www.douyin.com/video/7512345678901234567'), '7512345678901234567');
assert.equal(parse.parseAwemeId('https://www.douyin.com/jingxuan?modal_id=7512345678901234567'), '7512345678901234567');
assert.equal(parse.parseAwemeId('https://www.iesdouyin.com/share/video/7512345678901234567'), '7512345678901234567');
assert.equal(parse.parseAwemeId('https://www.douyin.com/user/MS4wLjAB'), '');
assert.equal(parse.isVideoPage('https://www.douyin.com/video/7512345678901234567'), true);
assert.equal(parse.isAwemeApi('https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=1'), true);

const infos = parse.ingestPayload({
  loaderData: {
    'video_(id)/page': { videoInfoRes: { item_list: [sample] } }
  }
});
assert.equal(infos.length, 1);
assert.equal(infos[0].id, '7512345678901234567');
assert.equal(infos[0].title, '测试标题 / 含:非法*');
assert.equal(infos[0].author, '测试作者');
assert.equal(infos[0].cover, 'https://p3.douyinpic.com/origin.jpg');
assert.deepEqual(infos[0].qualities.map((item) => item.qn), [1080, 720]);
assert.match(infos[0].qualities[0].urls[0], /\/play\/h265\.mp4$/);
assert.equal(infos[0].qualities[0].h265, true);
assert.equal(infos[0].qualities[1].h265, false);

const filename = parse.buildFilename(infos[0], infos[0].qualities[0], 'title-id-quality');
assert.equal(filename, '测试标题 _ 含_非法_ - 7512345678901234567 - 1080P · H.265');
assert.equal(parse.urlList({ url_list: ['https://v26-web.douyinvod.com/play/a.m3u8'] }).length, 0);
assert.equal(parse.formatDuration(12500), '0:13');
assert.equal(parse.formatCount(12345), '1.2万');
assert.equal(parse.formatBytes(2500), '2.4 KB');

const imageOnly = parse.normalizeAweme({
  aweme_id: '7512345678901234568',
  images: [{ url_list: ['https://p3.douyinpic.com/a.jpg'] }]
});
assert.equal(imageOnly, null);
assert.equal(parse.inspectCandidate(imageOnly || {
  aweme_id: '7512345678901234568',
  images: [{ url_list: ['https://p3.douyinpic.com/a.jpg'] }]
}).reason, 'image-note');
assert.equal(parse.inspectPayload({ loaderData: { page: { videoInfoRes: { item_list: [sample] } } } }).ok, 1);
assert.equal(parse.isAwemeApi('/aweme/v1/web/tab/feed/'), true);
assert.equal(parse.isNoiseApi('/aweme/v1/web/im/user/info/'), true);
assert.equal(parse.isNoiseApi('/aweme/v1/web/aweme/detail/'), false);

const uriOnly = parse.normalizeAweme({
  aweme_id: '7512345678901234569',
  desc: '只有uri',
  author: { nickname: '作者' },
  video: { play_addr: { uri: 'v0200fg10000cqd77sfog65gatpq9nm0', height: 1080 } }
});
assert.equal(uriOnly.qualities[0].qn, 1080);
assert.match(uriOnly.qualities[0].urls[0], /video_id=v0200fg10000cqd77sfog65gatpq9nm0/);

const html = '<script>window._ROUTER_DATA = {"loaderData":{"video_(id)/page":{"videoInfoRes":{"item_list":[' + JSON.stringify(sample) + ']}}}};</script>';
const fromHtml = parse.extractRouterFromHtml(html);
assert.equal(parse.ingestPayload(fromHtml).length, 1);

console.log('aweme-parse tests passed');
