import type { Locale } from "@/lib/i18n";
import type { FishingStatus } from "@/lib/koi-pond/fishing";
import type { PondFailure } from "@/lib/koi-pond/pond";

const zh = {
  description:
    "XingKaiXin，坐标上海的工程师与摄影爱好者。写 AI 编程、Agent 工程与开发者工具，也记录摄影和生活。",
  agent: {
    about: "关于",
    contact: "联系",
    sections: "栏目",
    posts: "文章",
    projects: "项目",
    photos: "照片墙",
  },
  scenes: { "living-room": "客厅", "say-hello": "打个招呼", credits: "片尾", pond: "池塘" },
  railLabel: "首页场景",
  seasons: {
    spring: "春 · 落樱",
    "summer-day": "夏 · 树影",
    "summer-night": "夏 · 萤火",
    autumn: "秋 · 落叶",
    winter: "冬 · 初雪",
  },
  pauseSeason: "暂停季节动画",
  room: {
    kicker: "01 · 客厅",
    status: "上海 · 工程师 · 摄影爱好者",
    extra: "这里是我的颠倒世界：写 AI 编程和 Agent 工程，做些小而顺手的工具，也记录生活。",
    recordIdle: "放一首 Stoic Morning",
    recordActive: "正在播放 · Stoic Morning",
    recordHint: "片尾字幕会跟着滚动",
    cue: "往下滚，跟我走走",
  },
  hello: {
    kicker: "02 · 打个招呼",
    title: "Hey，来打个招呼？",
    text: "聊 AI、工具、摄影，或者只是来打个招呼。",
  },
  creditsKicker: "03 · 片尾",
  pond: {
    kicker: "04 · 片尾彩蛋",
    title: "院子里的池塘",
    text: "片尾之后，到院子里坐一会儿。池子里有七尾锦鲤。",
  },
  character: "卷发、圆眼镜的开心，悠闲地坐在沙发上，目光随着鼠标轻轻转动",
  contact: {
    labels: { email: "邮箱" } as Partial<Record<string, string>>,
    card: (label: string) => `${label}联系卡片`,
    link: (label: string, value: string) => `${label}：${value}`,
    xPost: "人生不该只有一种体验。",
    telegram: "随时来聊：AI、摄影、数码。",
  },
  shanghai: {
    title: "上海",
    subtitle: "SHANGHAI",
    close: "关闭上海地图",
    city: "上海",
    sea: ["东海"],
    caption: "长江入海处，黄浦江两岸。",
  },
  record: {
    play: "播放 Stoic Morning",
    pause: "暂停 Stoic Morning",
    toPlay: "点击播放",
    toResume: "点击继续",
    toPause: "点击暂停",
    preparing: "正在准备…",
    failed: "加载失败，点击重试",
    noScript: "启用 JavaScript 后播放",
  },
  credits: { heading: "片尾字幕", list: "Credits 名单" },
  koi: {
    surface: "池塘水面",
    rod: "竹竿垂钓",
    dropRod: "放下竹竿",
    basket: "累计钓获，鱼儿随后放回池中",
    caught: (count: number) => `${count} 尾`,
    instructions:
      "七尾锦鲤在池中游动。点击或横向拖动水面划水。拿起竹竿后，移动指针或轻点水面放置浮漂；鱼儿咬钩时点击或向上移动鼠标提竿。键盘按回车开始，方向键移动浮漂，回车或空格提竿，Escape 放下竹竿。钓获后会把鱼儿放回池中。",
    phases: {
      idle: "点击或拖动水面 · 也可以拿起竹竿钓鱼",
      waiting: "移动浮漂靠近鱼儿 · 咬钩时点击提竿",
      nibble: "鱼儿正在试探 · 再等一等",
      bite: "咬钩了！点击、向上提竿或按空格",
      reeling: "钓到了！",
    } satisfies Record<FishingStatus["phase"], string>,
    landed: (species: string, length: number) => `钓获 ${species} · ${length} cm`,
    missed: "鱼儿脱钩了 · 稍等片刻再试试",
    species: ["红白锦鲤", "秋翠锦鲤", "黄金锦鲤", "白别甲", "丹顶锦鲤", "乌鲤"],
    failures: {
      webgl2: "当前浏览器不支持 WebGL2，无法运行这片水面。",
      "float-target": "当前设备不支持浮点渲染目标，无法运行波动仿真。",
      canvas2d: "当前浏览器不支持 Canvas 2D，无法显示垂钓互动。",
      shader: "着色器编译失败，无法运行这片水面。",
    } satisfies Record<PondFailure, string>,
  },
};

export type HomeMessages = typeof zh;

const en: HomeMessages = {
  description:
    "XingKaiXin is a Shanghai-based engineer and photography enthusiast who writes about AI coding, agent engineering and developer tools, and keeps notes on photography and life.",
  agent: {
    about: "About",
    contact: "Contact",
    sections: "Sections",
    posts: "Posts (Chinese)",
    projects: "Projects",
    photos: "Photo wall",
  },
  scenes: {
    "living-room": "Living room",
    "say-hello": "Say hello",
    credits: "Credits",
    pond: "Pond",
  },
  railLabel: "Homepage scenes",
  seasons: {
    spring: "Spring · Falling blossoms",
    "summer-day": "Summer · Leaf shadows",
    "summer-night": "Summer · Fireflies",
    autumn: "Autumn · Falling leaves",
    winter: "Winter · First snow",
  },
  pauseSeason: "Pause the seasonal animation",
  room: {
    kicker: "01 · Living room",
    status: "Shanghai · Engineer · Photography enthusiast",
    extra:
      "Welcome to my upside-down world. I write about AI coding and agent engineering, build small, handy tools, and keep notes on life.",
    recordIdle: "Play Stoic Morning",
    recordActive: "Now playing · Stoic Morning",
    recordHint: "The end credits roll along with it",
    cue: "Scroll down and walk with me",
  },
  hello: {
    kicker: "02 · Say hello",
    title: "Hey, want to say hi?",
    text: "Talk about AI, tools, photography, or just drop by to say hello.",
  },
  creditsKicker: "03 · Credits",
  pond: {
    kicker: "04 · After the credits",
    title: "The pond in the yard",
    text: "After the credits, come sit in the yard for a while. Seven koi live in the pond.",
  },
  character:
    "Kaixin, with curly hair and round glasses, lounging on the sofa, eyes following your cursor",
  contact: {
    labels: { email: "Email" },
    card: (label) => `${label} contact card`,
    link: (label, value) => `${label}: ${value}`,
    xPost: "Life shouldn't be just one kind of experience.",
    telegram: "Happy to chat anytime: AI, photography, gadgets.",
  },
  shanghai: {
    title: "Shanghai",
    subtitle: "上海",
    close: "Close the Shanghai map",
    city: "Shanghai",
    sea: ["East China", "Sea"],
    caption: "Where the Yangtze meets the sea, on both banks of the Huangpu.",
  },
  record: {
    play: "Play Stoic Morning",
    pause: "Pause Stoic Morning",
    toPlay: "Press to play",
    toResume: "Press to resume",
    toPause: "Press to pause",
    preparing: "Getting ready…",
    failed: "Couldn't load. Press to retry",
    noScript: "Enable JavaScript to play",
  },
  credits: { heading: "End credits", list: "Credits list" },
  koi: {
    surface: "Pond surface",
    rod: "Go fishing",
    dropRod: "Put the rod down",
    basket: "Total catch; every koi goes back into the pond",
    caught: (count) => `${count} caught`,
    instructions:
      "Seven koi swim in the pond. Tap or drag sideways across the water to make ripples. Once you pick up the rod, move the pointer or tap the water to place the float; when a koi bites, tap or move the mouse up to strike. With a keyboard, press Enter to start, the arrow keys to move the float, Enter or Space to strike, and Escape to put the rod down. Every koi you catch goes back into the pond.",
    phases: {
      idle: "Tap or drag the water · or pick up the rod and fish",
      waiting: "Move the float near a koi · tap to strike when it bites",
      nibble: "A koi is nibbling · wait for it",
      bite: "It's biting! Tap, pull up, or press Space",
      reeling: "Got one!",
    },
    landed: (species, length) => `Caught a ${species} · ${length} cm`,
    missed: "It got away · give it a moment and try again",
    species: ["Kohaku", "Shusui", "Ogon", "Shiro Bekko", "Tancho", "Karasu"],
    failures: {
      webgl2: "This browser doesn't support WebGL2, so the pond can't run.",
      "float-target":
        "This device can't render to float targets, so the ripples can't be simulated.",
      canvas2d: "This browser doesn't support Canvas 2D, so fishing isn't available.",
      shader: "The shaders failed to compile, so the pond can't run.",
    },
  },
};

export const homeMessages: Record<Locale, HomeMessages> = { zh, en };
