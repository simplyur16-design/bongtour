import { describe, expect, it } from 'vitest'
import {
  airlineOptionForParam,
  airlineOptionsFromPriceRows,
  compactPublicPriceRow,
  departureCarrierPublicLabel,
  expandAirlineCompactRow,
  filterPatchRowsByAirline,
  filterPriceRowsByAirline,
  type AirlineDepartureOption,
} from '@/lib/airline-variant-group'
import type { ProductPriceRow } from '@/app/components/travel/travel-product-detail-types'

/**
 * 상세 달력 항공사 필터 — 공급사별 실데이터 fixture(2026-10-27 KST, 예약가능 회차 앞 24개, 읽기전용 조회).
 * [departureId, 출발일, 성인가, carrierName, outboundFlightNo]
 */
type FxRow = [string, string, number, string | null, string | null]
type Fx = { productId: string; slug: string; rows: FxRow[] }
const FX: Record<string, Fx> = {
 "ybtour": {
  "productId": "cmpfoui7300cdd7swtx65uu2t",
  "slug": "pkg-yb-0026",
  "rows": [
   [
    "cmv8lpxo006961wlknpa238vq",
    "2026-10-29",
    749000,
    "제주항공",
    null
   ],
   [
    "cmv8lpxzt06981wlkoe6pde33",
    "2026-10-29",
    849000,
    "제주항공",
    null
   ],
   [
    "cmv8loaw005za1wlkdt9xarui",
    "2026-10-29",
    1449900,
    "대한항공",
    null
   ],
   [
    "cmv8lob7t05zc1wlky0197rdm",
    "2026-10-29",
    1499900,
    "대한항공",
    null
   ],
   [
    "cmv8lp9jr06541wlkla0oswoa",
    "2026-10-29",
    1449900,
    "캐세이퍼시픽",
    null
   ],
   [
    "cmv8lp9vk06561wlkp1r9kbyq",
    "2026-10-29",
    1499900,
    "캐세이퍼시픽",
    null
   ],
   [
    "cmv8lpgrp066c1wlk7ooub4sc",
    "2026-10-29",
    949900,
    "제주항공",
    null
   ],
   [
    "cmv8lpnq7067i1wlkxbocyeul",
    "2026-10-29",
    999900,
    "아시아나항공",
    null
   ],
   [
    "cmv8lqi5g06cm1wlkp0lx9xms",
    "2026-11-01",
    1099900,
    "대한항공",
    null
   ],
   [
    "cmv8lqijl06co1wlkjoaprha6",
    "2026-11-01",
    1149900,
    "대한항공",
    null
   ],
   [
    "cmv8lqvey06eu1wlklka7nqwj",
    "2026-11-01",
    699900,
    "에어마카오",
    null
   ],
   [
    "cmv8lrosc06ju1wlkgg6zokpv",
    "2026-11-01",
    899900,
    "에어프레미아",
    null
   ],
   [
    "cmv8lrp3t06jw1wlkg9q15cfl",
    "2026-11-01",
    999900,
    "에어프레미아",
    null
   ],
   [
    "cmv8lrpf906jy1wlk5s9msac4",
    "2026-11-01",
    1049900,
    "에어프레미아",
    null
   ],
   [
    "cmv8lszy106s01wlk06a6hfc7",
    "2026-11-01",
    1149900,
    "대한항공",
    null
   ],
   [
    "cmv8lt9li06to1wlkm3xvef9h",
    "2026-11-01",
    849900,
    "제주항공",
    null
   ],
   [
    "cmv8ltj8806vc1wlkxdu5zmm1",
    "2026-11-01",
    849900,
    "아시아나항공",
    null
   ],
   [
    "cmv8ltsvm06x01wlkxj3uaup7",
    "2026-11-01",
    1049900,
    "대한항공",
    null
   ],
   [
    "cmv8lu0vz06ye1wlks3pjpkbr",
    "2026-11-01",
    599900,
    "제주항공",
    null
   ],
   [
    "cmv8lu17i06yg1wlkjze1rzyb",
    "2026-11-01",
    699900,
    "제주항공",
    null
   ],
   [
    "cmv8lqivd06cq1wlkj5nhzali",
    "2026-11-02",
    1199900,
    "대한항공",
    null
   ],
   [
    "cmv8lqj7706cs1wlkwsjh1r1l",
    "2026-11-02",
    1249900,
    "대한항공",
    null
   ],
   [
    "cmv8lqwef06f01wlk52wf6ucd",
    "2026-11-02",
    699900,
    "에어마카오",
    null
   ],
   [
    "cmv8lrqdo06k41wlkp5vjwruc",
    "2026-11-02",
    699900,
    "에어프레미아",
    null
   ]
  ]
 },
 "hanatour": {
  "productId": "cmroqryqk00067i9n0kgjiv19",
  "slug": "pkg-hn-0049",
  "rows": [
   [
    "cmrxxr3j403tfode03qluupye",
    "2026-11-06",
    5250000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmtndz4rf004ypnn4sweuue5t",
    "2026-11-06",
    3349000,
    "LOT폴란드 항공",
    "LO2006"
   ],
   [
    "cmrxxr3l903thode0pbavz3w3",
    "2026-11-07",
    4635800,
    "대한항공",
    "KE0969"
   ],
   [
    "cmta6lhea002rh0vz2qbkitqf",
    "2026-11-10",
    4893000,
    "대한항공",
    "KE0963"
   ],
   [
    "cmuheb7we02vl9l35fg2oq76c",
    "2026-11-14",
    4643000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmvpou9dl001j6znwsdw5yj3u",
    "2026-11-15",
    5201200,
    "아시아나항공",
    "OZ0545"
   ],
   [
    "cmvfoo6vk2g6v1wlkipbowmiq",
    "2026-11-17",
    4843000,
    "대한항공",
    "KE0963"
   ],
   [
    "cmvfoo7772g6x1wlk9izxw3ak",
    "2026-11-18",
    4443000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmvpouaca001p6znwi2fcamfg",
    "2026-11-20",
    4543000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmvpouant001r6znwivlo2cy6",
    "2026-11-21",
    5043000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmvpouaze001t6znwzgtscg5y",
    "2026-11-22",
    4543000,
    "대한항공",
    "KE0937"
   ],
   [
    "cmvpoubax001v6znwt61ehmc6",
    "2026-11-23",
    4643000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmrxxr3pk03tlode0766v7y2e",
    "2026-12-01",
    4743000,
    "대한항공",
    "KE0963"
   ],
   [
    "cmrxxr3rp03tnode0guh1e7b1",
    "2026-12-02",
    4343000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmtndz6rb005cpnn407ptz37l",
    "2026-12-02",
    4350000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmrxxr3tv03tpode0xkfp8n71",
    "2026-12-03",
    4979200,
    "아시아나항공",
    "OZ0545"
   ],
   [
    "cmu7e8ghw02ip45br5llljdp8",
    "2026-12-03",
    4301400,
    "아시아나항공",
    "OZ0545"
   ],
   [
    "cmvpoucbw00216znwfshlvxac",
    "2026-12-03",
    8351200,
    "아시아나항공",
    "OZ0545"
   ],
   [
    "cmta6lhfu0033h0vzb7xd5y1b",
    "2026-12-04",
    4443000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmtndz7be005gpnn4k1tlicsh",
    "2026-12-04",
    3249000,
    "LOT폴란드 항공",
    "LO2006"
   ],
   [
    "cmrxxr3w103trode0h6dryp4i",
    "2026-12-04",
    5043000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmrxxr3y703ttode0bdacoe01",
    "2026-12-05",
    4543000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmtndz7ld005ipnn47dfqfukt",
    "2026-12-05",
    5043000,
    "대한항공",
    "KE0969"
   ],
   [
    "cmu7e8hge02iv45bry18vbj8a",
    "2026-12-07",
    4443000,
    "대한항공",
    "KE0969"
   ]
  ]
 },
 "lottetour": {
  "productId": "cmtd7obr4035yea0fhjs2g3t1",
  "slug": "pkg-lt-0042",
  "rows": [
   [
    "cmtd7ogvi03xhea0fnv4t1f1o",
    "2026-10-29",
    929000,
    "에어부산",
    null
   ],
   [
    "cmtd7ogwa03xjea0fv8dsd49g",
    "2026-10-29",
    939000,
    "진에어",
    null
   ],
   [
    "cmtd7ogx103xlea0f8gaks99e",
    "2026-10-29",
    919000,
    "에어서울",
    null
   ],
   [
    "cmtd7ogxu03xnea0f094ye31g",
    "2026-10-30",
    929000,
    "에어부산",
    null
   ],
   [
    "cmtd7ogys03xpea0fau6kn246",
    "2026-10-30",
    1259000,
    "대한항공",
    null
   ],
   [
    "cmtd7ogzl03xrea0flcsu27ci",
    "2026-10-30",
    959000,
    "에어서울",
    null
   ],
   [
    "cmtd7oh0d03xtea0fag4nkbkl",
    "2026-10-31",
    889000,
    "에어부산",
    null
   ],
   [
    "cmtd7oh1a03xvea0folnt7ji7",
    "2026-10-31",
    1259000,
    "대한항공",
    null
   ],
   [
    "cmtd7oh2303xxea0fu1jax40g",
    "2026-10-31",
    919000,
    "에어서울",
    null
   ],
   [
    "cmtd7oh2x03xzea0f2g29u776",
    "2026-11-01",
    929000,
    "에어부산",
    null
   ],
   [
    "cmtd7oh3s03y1ea0f5vqtb0rp",
    "2026-11-01",
    1229000,
    "대한항공",
    null
   ],
   [
    "cmtd7oh4k03y3ea0ft7oygwwn",
    "2026-11-01",
    909000,
    "에어서울",
    null
   ],
   [
    "cmtd7oh5l03y5ea0f1sczv5ho",
    "2026-11-02",
    929000,
    "에어부산",
    null
   ],
   [
    "cmtd7oh6e03y7ea0fht5emnv1",
    "2026-11-02",
    1209000,
    "대한항공",
    null
   ],
   [
    "cmtd7oh7c03y9ea0f3osiq2e2",
    "2026-11-02",
    909000,
    "에어서울",
    null
   ],
   [
    "cmtd7oh8803ybea0fcy1hljae",
    "2026-11-03",
    929000,
    "에어부산",
    null
   ],
   [
    "cmtd7oh9603ydea0fa9tpe7b0",
    "2026-11-03",
    1209000,
    "대한항공",
    null
   ],
   [
    "cmtd7oh9z03yfea0fz7sgnmol",
    "2026-11-03",
    909000,
    "에어서울",
    null
   ],
   [
    "cmtd7ohav03yhea0fen49k0h2",
    "2026-11-04",
    969000,
    "에어부산",
    null
   ],
   [
    "cmtd7ohbt03yjea0fskaige74",
    "2026-11-04",
    1259000,
    "대한항공",
    null
   ],
   [
    "cmtd7ohd203ylea0f3gmuw9ff",
    "2026-11-04",
    1009000,
    "진에어",
    null
   ],
   [
    "cmtd7ohdu03ynea0fpv6dumbq",
    "2026-11-04",
    949000,
    "에어서울",
    null
   ],
   [
    "cmtd7ohes03ypea0fovo1yojy",
    "2026-11-05",
    969000,
    "에어부산",
    null
   ],
   [
    "cmtd7ohfr03yrea0fy4lg23hu",
    "2026-11-05",
    1009000,
    "진에어",
    null
   ]
  ]
 },
 "kyowontour": {
  "productId": "cmrqayu7q00f5mhsy98kij0u4",
  "slug": "pkg-ky-0021",
  "rows": [
   [
    "cmrqayx0l00gzmhsyi92qz3cb",
    "2026-11-01",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr0711800w7yu03fmzjwh0w",
    "2026-11-01",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayx4t00h1mhsyqrpux8d7",
    "2026-11-02",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr0713p00w9yu03nrhrono7",
    "2026-11-02",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayx6z00h3mhsyp341pu35",
    "2026-11-03",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr0716600wbyu03acswhg7r",
    "2026-11-03",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayx9400h5mhsylz6ps2p7",
    "2026-11-04",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr0718n00wdyu03srkh0i0o",
    "2026-11-04",
    1199000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxb800h7mhsytxuueasl",
    "2026-11-05",
    1349000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071b200wfyu03s5ui360s",
    "2026-11-05",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxdd00h9mhsysmqsl71y",
    "2026-11-06",
    1299000,
    "티웨이항공",
    null
   ],
   [
    "cmrqayxfh00hbmhsy2m7kn55n",
    "2026-11-07",
    1299000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071fz00wjyu03j8kirfbj",
    "2026-11-07",
    1199000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxhm00hdmhsyphzdr1rk",
    "2026-11-08",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071if00wlyu0356yq3j9c",
    "2026-11-08",
    1199000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxjq00hfmhsy7vg5cnle",
    "2026-11-09",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071kv00wnyu03w5ngq095",
    "2026-11-09",
    1199000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxlw00hhmhsynivunrd2",
    "2026-11-10",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071nd00wpyu034xpaud4n",
    "2026-11-10",
    1199000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxo000hjmhsy14yx01zn",
    "2026-11-11",
    1249000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071q000wryu03nwirwx7e",
    "2026-11-11",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxq500hlmhsyre546nw7",
    "2026-11-12",
    1349000,
    "티웨이항공",
    null
   ],
   [
    "cmrr071sg00wtyu03e2o3f45n",
    "2026-11-12",
    1249000,
    "트리니티항공",
    null
   ],
   [
    "cmrqayxsa00hnmhsy419342dx",
    "2026-11-13",
    1299000,
    "티웨이항공",
    null
   ]
  ]
 },
 "modetour": {
  "productId": "cmp8ft380004q3t9y47h8iass",
  "slug": "pkg-mt-0035",
  "rows": [
   [
    "cmrnvn4x80112otb2dc8ob4gg",
    "2026-10-31",
    438400,
    null,
    null
   ],
   [
    "cmrnvn51h0116otb20587l4u8",
    "2026-11-07",
    515400,
    null,
    null
   ],
   [
    "cmrnvn55q011aotb2b85x0jei",
    "2026-11-14",
    515400,
    null,
    null
   ],
   [
    "cmrnvn5a0011eotb2f1v2uhbc",
    "2026-11-21",
    559400,
    null,
    null
   ],
   [
    "cmrnvn5ek011iotb22frgwe4q",
    "2026-11-28",
    559400,
    null,
    null
   ],
   [
    "cmrnvn5it011motb20v6ofk5a",
    "2026-12-05",
    614400,
    null,
    null
   ],
   [
    "cmrnvn5n3011qotb2b16m46ui",
    "2026-12-12",
    603400,
    null,
    null
   ],
   [
    "cmrnvn5tg011wotb25lva1gae",
    "2026-12-20",
    707400,
    null,
    null
   ],
   [
    "cmrnvn5xp0120otb2a5xcoru4",
    "2026-12-27",
    822400,
    null,
    null
   ],
   [
    "cmrnvn61y0124otb2w3ym7q04",
    "2027-01-03",
    832400,
    null,
    null
   ],
   [
    "cmrnvn6670128otb2ez4gyoxq",
    "2027-01-10",
    832400,
    null,
    null
   ],
   [
    "cmrxvmkft00epode05co5564n",
    "2027-01-17",
    832400,
    null,
    null
   ],
   [
    "cmsdlknsa006qnkm3alykuipg",
    "2027-01-24",
    832400,
    null,
    null
   ],
   [
    "cmsdlkp10006unkm38t9ev4v6",
    "2027-01-31",
    832400,
    null,
    null
   ],
   [
    "cmsnlkaz7005gxlsvi3q3hq9d",
    "2027-02-07",
    1034400,
    null,
    null
   ],
   [
    "cmsxln4pe00ayawu3ibd0801u",
    "2027-02-14",
    847400,
    null,
    null
   ],
   [
    "cmt7lqa200050b4u5ghtfx9cm",
    "2027-02-21",
    832400,
    null,
    null
   ],
   [
    "cmtlwcx3406x6qihb8o14rnrf",
    "2027-02-28",
    811400,
    null,
    null
   ],
   [
    "cmtxbvbp600354l6apkmc1cs5",
    "2027-03-06",
    571400,
    null,
    null
   ],
   [
    "cmtxbvbz300374l6a07k2azgq",
    "2027-03-07",
    571400,
    null,
    null
   ],
   [
    "cmu7bybwe002z45brw2jrkdj8",
    "2027-03-13",
    571400,
    null,
    null
   ],
   [
    "cmu7byc8b003145brrae08qij",
    "2027-03-14",
    571400,
    null,
    null
   ],
   [
    "cmuhc0wlo002p9l35uzl0lcin",
    "2027-03-20",
    571400,
    null,
    null
   ],
   [
    "cmuhc0wyv002r9l35xnsyublk",
    "2027-03-21",
    571400,
    null,
    null
   ]
  ]
 },
 "verygoodtour": {
  "productId": "cmpd19l3g0006w34hsn0684dd",
  "slug": "pkg-vg-0010",
  "rows": [
   [
    "cmql9xpht01d3lhqb7c1256e4",
    "2026-10-29",
    860000,
    null,
    null
   ],
   [
    "cmql9xpib01d7lhqbg6ie0rty",
    "2026-10-30",
    520000,
    null,
    null
   ],
   [
    "cmql9xpik01d9lhqbzjtcj5og",
    "2026-10-31",
    520000,
    null,
    null
   ],
   [
    "cmql9xpit01dblhqbl6pdj26j",
    "2026-11-01",
    500000,
    null,
    null
   ],
   [
    "cmql9xpj101ddlhqb974oxtdk",
    "2026-11-02",
    500000,
    null,
    null
   ],
   [
    "cmql9xpja01dflhqbqr2lulwb",
    "2026-11-03",
    500000,
    null,
    null
   ],
   [
    "cmql9xpjj01dhlhqbgs66mwjf",
    "2026-11-04",
    580000,
    null,
    null
   ],
   [
    "cmql9xpka01dnlhqbeup6h9c2",
    "2026-11-05",
    680000,
    null,
    null
   ],
   [
    "cmql9xpl201dtlhqbmjp0dqy5",
    "2026-11-06",
    460000,
    null,
    null
   ],
   [
    "cmql9xplb01dvlhqbcdc2czkp",
    "2026-11-07",
    530000,
    null,
    null
   ],
   [
    "cmql9xplj01dxlhqbxuk1u1da",
    "2026-11-08",
    540000,
    null,
    null
   ],
   [
    "cmql9xpls01dzlhqbyzaz37v6",
    "2026-11-09",
    540000,
    null,
    null
   ],
   [
    "cmql9xpm101e1lhqbj4onq2by",
    "2026-11-10",
    580000,
    null,
    null
   ],
   [
    "cmql9xpma01e3lhqbrmfxfij8",
    "2026-11-11",
    580000,
    null,
    null
   ],
   [
    "cmql9xpn101e9lhqbn8o2zlet",
    "2026-11-12",
    1680000,
    null,
    null
   ],
   [
    "cmql9xpnt01eflhqbya7nh5u8",
    "2026-11-13",
    580000,
    null,
    null
   ],
   [
    "cmql9xpo201ehlhqbrm1z0fe1",
    "2026-11-14",
    660000,
    null,
    null
   ],
   [
    "cmql9xpoc01ejlhqbsceh2lr7",
    "2026-11-15",
    590000,
    null,
    null
   ],
   [
    "cmql9xpok01ellhqbq1vogvsf",
    "2026-11-16",
    620000,
    null,
    null
   ],
   [
    "cmql9xpou01enlhqbx04im6vt",
    "2026-11-17",
    580000,
    null,
    null
   ],
   [
    "cmql9xpp301eplhqbpmzy32eg",
    "2026-11-18",
    690000,
    null,
    null
   ],
   [
    "cmql9xppu01evlhqbft0tjode",
    "2026-11-19",
    560000,
    null,
    null
   ],
   [
    "cmtxkecwk0y2v4l6agzra0728",
    "2026-11-22",
    600000,
    null,
    null
   ],
   [
    "cmtxked680y2z4l6abf3utj04",
    "2026-11-23",
    910000,
    null,
    null
   ]
  ]
 },
 "naeiltour": {
  "productId": "cmtd946f105myea0fjc2qvir2",
  "slug": "src:naeiltour",
  "rows": [
   [
    "cmuz3ztom002a1gddk4mhlk7p",
    "2026-10-29",
    719000,
    "제주에어",
    null
   ],
   [
    "cmuz3ztys002c1gddgjgzimje",
    "2026-10-30",
    1149000,
    "제주에어",
    null
   ],
   [
    "cmvpywlvp03ml6znwwec42kvo",
    "2026-10-31",
    879000,
    "제주에어",
    null
   ],
   [
    "cmuz3zu8y002e1gdd5dhwzgrt",
    "2026-10-31",
    1009000,
    "대한항공",
    null
   ],
   [
    "cmuz3zuj5002g1gdd4u1xtjto",
    "2026-11-01",
    669000,
    "제주에어",
    null
   ],
   [
    "cmuz3zutb002i1gddk11kv2p4",
    "2026-11-02",
    699000,
    "제주에어",
    null
   ],
   [
    "cmuz3zv3g002k1gddjwc9vtn9",
    "2026-11-03",
    749000,
    "제주에어",
    null
   ],
   [
    "cmuz3zvdm002m1gddocudsyzp",
    "2026-11-04",
    849000,
    "제주에어",
    null
   ],
   [
    "cmuz3zvnt002o1gddtnzi6vs0",
    "2026-11-05",
    879000,
    "제주에어",
    null
   ],
   [
    "cmuz3zvxz002q1gdd5uwgyu1i",
    "2026-11-06",
    889000,
    "제주에어",
    null
   ],
   [
    "cmuz3zw85002s1gddqk3vnmd0",
    "2026-11-07",
    1079000,
    "대한항공",
    null
   ],
   [
    "cmuz3zwib002u1gddy8cgr57c",
    "2026-11-08",
    1079000,
    "대한항공",
    null
   ],
   [
    "cmuz3zwsh002w1gddfnese4iy",
    "2026-11-09",
    909000,
    "대한항공",
    null
   ],
   [
    "cmuz3zx2n002y1gddf9kn4pcj",
    "2026-11-10",
    959000,
    "대한항공",
    null
   ],
   [
    "cmuz3zxct00301gdd3kn5zpsk",
    "2026-11-11",
    999000,
    "대한항공",
    null
   ],
   [
    "cmuz3zxmz00341gdda1fs63mt",
    "2026-11-12",
    729000,
    "제주에어",
    null
   ],
   [
    "cmuz3zxx600361gdd26b5f4n3",
    "2026-11-13",
    1199000,
    "제주에어",
    null
   ],
   [
    "cmuz3zy7e00381gddia8xzy8u",
    "2026-11-14",
    709000,
    "제주에어",
    null
   ],
   [
    "cmuz3zyhk003a1gdd31vg7suz",
    "2026-11-15",
    729000,
    "제주에어",
    null
   ],
   [
    "cmuz3zyrq003c1gdda8i12wwx",
    "2026-11-16",
    699000,
    "제주에어",
    null
   ],
   [
    "cmuz3zz1x003e1gdd0sz07ce7",
    "2026-11-17",
    709000,
    "제주에어",
    null
   ],
   [
    "cmuz3zzc4003h1gddfte8yby8",
    "2026-11-18",
    709000,
    "제주에어",
    null
   ],
   [
    "cmuz3zzma003j1gdd9yyc6yax",
    "2026-11-19",
    799000,
    "제주에어",
    null
   ],
   [
    "cmuz3zzyg003l1gdd1vmv6mx1",
    "2026-11-20",
    989000,
    "제주에어",
    null
   ]
  ]
 }
} as unknown as Record<string, Fx>

const toPriceRow = (productId: string, r: FxRow): ProductPriceRow => ({
  id: r[0],
  productId,
  date: r[1],
  adult: r[2],
  childBed: null,
  childNoBed: null,
  infant: null,
  localPrice: null,
  priceGap: 0,
  priceAdult: r[2],
  priceChildWithBed: null,
  priceChildNoBed: null,
  priceInfant: null,
  status: '예약가능',
})

const labelOf = (r: FxRow) => departureCarrierPublicLabel({ carrierName: r[3], outboundFlightNo: r[4] })

function optionsFor(fx: Fx): AirlineDepartureOption[] {
  return airlineOptionsFromPriceRows(fx.rows.map((r) => ({ row: toPriceRow(fx.productId, r), label: labelOf(r) })))
}

const WITH_CARRIERS = ['ybtour', 'hanatour', 'lottetour', 'kyowontour', 'naeiltour'] as const

describe('상세 달력 항공사 필터 — 공급사별 fixture', () => {
  for (const supplier of WITH_CARRIERS) {
    it(`${supplier}: 항공사별 그 항공사 회차만, 날짜당 최저가 1행, 모델 상한(앞 8행) 밖 날짜도 포함`, () => {
      const fx = FX[supplier]
      const opts = optionsFor(fx)
      expect(opts.length).toBeGreaterThan(0)
      const model = fx.rows.slice(0, 8).map((r) => toPriceRow(fx.productId, r))
      for (const opt of opts) {
        const filtered = filterPriceRowsByAirline(model, opt, fx.productId)
        const mine = fx.rows.filter((r) => labelOf(r) === opt.label && r[2] > 0)
        const dates = [...new Set(mine.map((r) => r[1]))].sort()
        expect(filtered.map((r) => r.date)).toEqual(dates)
        for (const row of filtered) {
          const src = fx.rows.find((r) => r[0] === row.id)!
          expect(labelOf(src)).toBe(opt.label)
          const sameDay = mine.filter((r) => r[1] === row.date).map((r) => r[2])
          expect(row.adult).toBe(Math.min(...sameDay))
          const inModel = model.find((m) => m.id === row.id)
          if (inModel) expect(row).toBe(inModel)
        }
        expect(Math.min(...filtered.map((r) => r.adult))).toBe(opt.minPriceKrw)
      }
    })
  }

  it('필터 없음 → 원본 배열 그대로(기존 동작)', () => {
    const fx = FX.ybtour
    const model = fx.rows.map((r) => toPriceRow(fx.productId, r))
    expect(filterPriceRowsByAirline(model, null, fx.productId)).toBe(model)
    expect(filterPatchRowsByAirline(model, null)).toBe(model)
  })

  it('항공사 데이터 없는 상품(참좋은·모두투어 일부) → 옵션 없음 = 필터 UI 없음', () => {
    expect(optionsFor(FX.verygoodtour)).toEqual([])
    expect(optionsFor(FX.modetour)).toEqual([])
  })

  it('하나투어 표기 변형(LOT폴란드 항공) → 공개명 LOT폴란드항공 하나로', () => {
    const labels = optionsFor(FX.hanatour).map((o) => o.label)
    expect(labels).toContain('LOT폴란드항공')
    expect(labels).not.toContain('LOT폴란드 항공')
  })

  it('교원 (구)티웨이 표기 → 트리니티항공으로 합침', () => {
    const labels = optionsFor(FX.kyowontour).map((o) => o.label)
    expect(labels).toContain('트리니티항공')
    expect(labels.some((l) => l.includes('티웨이'))).toBe(false)
  })

  it('내일투어 제주에어 → 제주항공(7C)', () => {
    const opt = airlineOptionForParam({ options: optionsFor(FX.naeiltour) }, '7c')
    expect(opt?.label).toBe('제주항공')
  })

  it('?airline= 해석: 코드·이름 / 이 상품에 없는 항공사·모르는 값 → null(필터 안 함)', () => {
    const data = { options: optionsFor(FX.hanatour) }
    expect(airlineOptionForParam(data, 'KE')?.label).toBe('대한항공')
    expect(airlineOptionForParam(data, 'ke')?.label).toBe('대한항공')
    expect(airlineOptionForParam(data, '대한항공')?.label).toBe('대한항공')
    expect(airlineOptionForParam(data, '7C')).toBeNull()
    expect(airlineOptionForParam(data, 'ZZ')).toBeNull()
    expect(airlineOptionForParam(data, '')).toBeNull()
    expect(airlineOptionForParam(null, 'KE')).toBeNull()
  })

  it('현장 수집 패치: 필터 중엔 그 항공사 회차 id 만, od-* 제외', () => {
    const fx = FX.lottetour
    const opt = optionsFor(fx)[0]
    const known = expandAirlineCompactRow(opt.rows[0], fx.productId)
    const od = { ...known, id: 'od-2026-12-01', date: '2026-12-01' }
    const other = toPriceRow(fx.productId, fx.rows.find((r) => labelOf(r) !== opt.label)!)
    expect(filterPatchRowsByAirline([known, od, other], opt).map((r) => r.id)).toEqual([known.id])
  })

  it('압축행 왕복 — 예약 흐름에 필요한 가격·상태 보존', () => {
    const row: ProductPriceRow = {
      ...toPriceRow('p1', ['d1', '2026-11-01', 1000, '대한항공', null]),
      childBed: 900,
      childNoBed: 800,
      infant: 100,
      priceChildWithBed: 900,
      priceChildNoBed: 800,
      priceInfant: 100,
      availableSeats: 4,
      seatsStatusRaw: '잔여 4석',
      baselineAdultPrice: 1200,
    }
    const compact = compactPublicPriceRow(row)
    const back = expandAirlineCompactRow(compact, 'p1')
    expect(back).toEqual(row)
    // localPrice(내부 수집 메모)는 싣지 않음
    expect(JSON.stringify(compactPublicPriceRow({ ...row, localPrice: 'ybtour:by-goods evCd=X' }))).not.toContain('evCd')
    // 끝쪽 빈 값은 잘라 페이로드 절감
    expect(compactPublicPriceRow(toPriceRow('p1', ['d2', '2026-11-02', 500, null, null])).length).toBe(7)
  })
})
