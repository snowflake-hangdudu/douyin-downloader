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
assert.equal(parse.parseAwemeId('https://www.douyin.com/search/%E4%B8%9C%E4%BA%AC?modal_id=7634880373175913755&type=general'), '7634880373175913755');
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
assert.deepEqual(infos[0].qualities.map((item) => item.qn), [1080]);
assert.match(infos[0].qualities[0].urls[0], /\/play\/h265\.mp4$/);
assert.equal(infos[0].qualities[0].h265, true);
assert.equal(infos[0].qualities[0].label, '1080P');

const filename = parse.buildFilename(infos[0], infos[0].qualities[0], 'title-id-quality');
assert.equal(filename, '测试标题 _ 含_非法_ - 7512345678901234567 - 1080P');
assert.equal(parse.buildFilename(infos[0], infos[0].qualities[0], 'title'), '测试标题 _ 含_非法_');
assert.equal(parse.urlList({ url_list: ['https://v26-web.douyinvod.com/play/a.m3u8'] }).length, 0);
assert.deepEqual(parse.urlList({ url_list: 'https://v26-web.douyinvod.com/play/single.mp4' }), ['https://v26-web.douyinvod.com/play/single.mp4']);
assert.equal(parse.pickCover({ cover: { url_list: 'https://p3.douyinpic.com/cover.webp' } }), 'https://p3.douyinpic.com/cover.webp');
assert.equal(parse.pickCover({ cover: 'http://p3.douyinpic.com/plain.jpg' }), 'https://p3.douyinpic.com/plain.jpg');
assert.equal(parse.pickCover({ dynamic_cover: { url_list: [{ url: 'https://p3.douyinpic.com/dyn.webp' }] } }), 'https://p3.douyinpic.com/dyn.webp');
assert.equal(parse.pickCover({ cover: { url_list: [] } }, { cover: { urlList: ['https://p3.douyinpic.com/item.jpg'] } }), 'https://p3.douyinpic.com/item.jpg');
assert.equal(parse.imageExtension('https://p3.douyinpic.com/cover?format=webp'), 'webp');
assert.equal(parse.imageExtension('https://p3.douyinpic.com/tplv-cover-webp'), 'webp');
assert.equal(parse.imageExtension('https://p3.douyinpic.com/cover'), 'jpg');
assert.ok(parse.scoreCoverUrl('https://p3.douyinpic.com/origin-cover.webp') > parse.scoreCoverUrl('https://p3.douyinpic.com/x-signature-blur.jpg'));
assert.equal(parse.isBadCoverUrl('https://p3.douyinpic.com/avatar/100x100.webp'), true);
assert.equal(parse.isSuspiciousCoverUrl('https://p3.douyinpic.com/x-signature-blur.jpg'), true);
assert.equal(parse.isLikelyLowResCover('https://p3.douyinpic.com/x-signature-blur.jpg', 'https://p3.douyinpic.com/origin-cover.webp'), true);
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
assert.equal(parse.isNoiseApi('/aweme/v1/web/mix/watch/record/'), true);
assert.equal(parse.isMixApi('/aweme/v1/web/mix/aweme/?mix_id=12345'), true);
assert.equal(parse.isMixApi('/aweme/v1/web/series/aweme/?series_id=12345'), true);
assert.equal(parse.parseMixId('https://www.douyin.com/collection/7512345678901234560'), '7512345678901234560');
assert.equal(parse.parseMixId('https://www.douyin.com/video/1?mix_id=7512345678901234560'), '7512345678901234560');
assert.equal(parse.parseMixId('https://www.douyin.com/aweme/v1/web/series/aweme/?series_id=7512345678901234560'), '7512345678901234560');

const withMix = {
  ...sample,
  mix_info: {
    mix_id: '7512345678901234560',
    mix_name: '测试合集',
    stat: { current_episode: 3, updated_to_episode: 6, play_vv: 10000 }
  }
};
const mixInfo = parse.normalizeAweme(withMix);
assert.equal(mixInfo.mix.id, '7512345678901234560');
assert.equal(mixInfo.mix.name, '测试合集');
assert.equal(mixInfo.episode, 3);

const mixPayload = parse.ingestMixPayload({
  mix_info: withMix.mix_info,
  cursor: 20,
  has_more: 1,
  aweme_list: [
    withMix,
    {
      ...sample,
      aweme_id: '7512345678901234561',
      desc: '第二集',
      mix_info: { ...withMix.mix_info, stat: { current_episode: 4, updated_to_episode: 6, play_vv: 10000 } }
    }
  ]
}, 'https://www.douyin.com/aweme/v1/web/mix/aweme/?mix_id=7512345678901234560');
assert.equal(mixPayload.meta.id, '7512345678901234560');
assert.equal(mixPayload.items.length, 2);
assert.equal(mixPayload.items[1].id, '7512345678901234561');
assert.equal(mixPayload.hasMore, true);
assert.equal(mixPayload.cursor, 20);

const verticalQualities = parse.buildQualities({
  bit_rate: [{
    quality_type: 2,
    bit_rate: 2000000,
    play_addr: {
      url_list: ['https://v26-web.douyinvod.com/play/vertical.mp4'],
      width: 720,
      height: 1280
    }
  }]
});
assert.equal(verticalQualities[0].qn, 720);
assert.equal(parse.qualityFromMeta('adapt_1080_1', 720, 1280).qn, 1080);
const playerQualities = parse.buildQualities({
  ratio: '720p',
  width: 720,
  height: 1280,
  play_addr: { url_list: ['https://v26-web.douyinvod.com/play/current.mp4'], width: 720, height: 1280 },
  bit_rate: [
    { gear_name: 'normal_1080_0', bit_rate: 3000000, play_addr: { url_list: ['https://v26-web.douyinvod.com/play/1080.mp4'], width: 1080, height: 1920 } },
    { gear_name: 'adapt_lowest_720_1', bit_rate: 1800000, play_addr: { url_list: ['https://v26-web.douyinvod.com/play/720.mp4'], width: 720, height: 1280 } },
    { gear_name: 'low_540_0', bit_rate: 800000, play_addr: { url_list: ['https://v26-web.douyinvod.com/play/540.mp4'], width: 540, height: 960 } }
  ]
});
assert.deepEqual(playerQualities.map((item) => item.qn), [1080, 540]);
const namedWebQualities = parse.buildQualities({
  bit_rate: [
    { gear_name: 'normal_1080_0', play_addr: { url_list: ['https://v26-web.douyinvod.com/play/1080.mp4'], width: 1080, height: 1920 } },
    { gear_name: 'normal_720_0', play_addr: { url_list: ['https://v26-web.douyinvod.com/play/720.mp4'], width: 720, height: 1280 } },
    { gear_name: 'low_540_0', play_addr: { url_list: ['https://v26-web.douyinvod.com/play/540.mp4'], width: 540, height: 960 } }
  ]
});
assert.deepEqual(namedWebQualities.map((item) => item.qn), [1080, 540]);
assert.equal(parse.qualityFromMeta('', 0, 0, 2).qn, 1);
assert.equal(parse.sanitizeFilename('CON. '), '_CON');
assert.equal(parse.sanitizeFilename('CON.txt'), '_CON.txt');
assert.ok(parse.buildFilename({ title: '题'.repeat(80), author: '作'.repeat(80), id: '7653794808998426996' }, { label: '1080P' }, 'detailed').length <= 120);
assert.equal(parse.sanitizeFilename('视频标题... '), '视频标题');

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

const streamPayload = { aweme_list: [{ ...sample, aweme_id: '7634880373175913755' }] };
const streamText = JSON.stringify({ status_code: 0 }) + JSON.stringify(streamPayload);
assert.equal(parse.parseJsonFragments(streamText).length, 2);
assert.equal(parse.ingestPayload(parse.parseJsonFragments(streamText)[1])[0].id, '7634880373175913755');

assert.equal(parse.isLikelyAudioOnlyUrl('https://v.douyinvod.com/audio/track.m4a'), true);
assert.equal(parse.isLikelyAudioOnlyUrl('https://v.douyinvod.com/play/video.mp4'), false);
assert.equal(parse.urlList({ url_list: ['https://v.douyinvod.com/audio/track.m4a', 'https://v.douyinvod.com/play/video.mp4'] }).length, 1);

const h265Q = { qn: 720, h265: true, urls: ['https://v.douyinvod.com/h265.mp4'] };
const h264Q = { qn: 540, h265: false, urls: ['https://v.douyinvod.com/h264.mp4'] };
assert.deepEqual(parse.pickDownloadUrls(h265Q, [h265Q, h264Q]), ['https://v.douyinvod.com/h264.mp4', 'https://v.douyinvod.com/h265.mp4']);
assert.deepEqual(parse.pickDownloadUrls(h264Q, [h265Q, h264Q]), ['https://v.douyinvod.com/h264.mp4']);

const est = parse.estimateQualityBytes({ size: 100, bitrate: 2000000 }, 60000);
assert.ok(est > 100);

const listOnly = parse.normalizeMixListItem({
  aweme_id: '7512345678901234570',
  desc: '只有标题的合集条目',
  author: { nickname: '作者' },
  mix_info: withMix.mix_info
}, withMix.mix_info);
assert.equal(listOnly.id, '7512345678901234570');
assert.equal(listOnly.title, '只有标题的合集条目');
assert.deepEqual(listOnly.qualities, []);

console.log('aweme-parse tests passed');
