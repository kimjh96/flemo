import type { PlaygroundLang } from "./dict";

type Localized<T = string> = Record<PlaygroundLang, T>;

export type Product = {
  id: string;
  brand: string;
  name: Localized;
  price: number;
  oldPrice?: number;
  category: string;
  hue: number;
  description: Localized;
  sizes: string[];
  tag?: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "denim-jacket",
    brand: "AURA",
    name: {
      en: "Oversized denim jacket",
      ko: "오버사이즈 데님 자켓"
    },
    price: 89000,
    oldPrice: 119000,
    category: "Outer",
    hue: 220,
    description: {
      en: "Heavyweight denim that finishes a look on its own. The vintage wash deepens with wear.",
      ko: "두께감 있는 헤비 데님으로 한 벌만 걸쳐도 룩이 완성되는 자켓이에요. 빈티지 워싱으로 입을수록 자연스러운 색감이 더해집니다."
    },
    sizes: ["S", "M", "L", "XL"],
    tag: "WEEKLY"
  },
  {
    id: "knit-sweater",
    brand: "ROOM",
    name: {
      en: "Crewneck wool knit",
      ko: "라운드넥 울 니트"
    },
    price: 59000,
    category: "Top",
    hue: 30,
    description: {
      en: "70% merino wool blend. Just enough weight to wear daily through autumn and early winter.",
      ko: "메리노 울 70% 혼방. 적당한 두께감으로 가을·초겨울 데일리로 무난하게 입어요."
    },
    sizes: ["S", "M", "L"]
  },
  {
    id: "wide-pants",
    brand: "FERN",
    name: {
      en: "Wide-leg slacks",
      ko: "와이드 슬랙스"
    },
    price: 72000,
    oldPrice: 89000,
    category: "Bottom",
    hue: 280,
    description: {
      en: "Elastic waist with a wide leg. Easy to move in, clean line down the front.",
      ko: "허리 밴딩 + 와이드 핏. 활동성과 라인을 모두 잡았어요."
    },
    sizes: ["S", "M", "L"]
  },
  {
    id: "sneakers",
    brand: "MILE",
    name: {
      en: "Canvas sneakers",
      ko: "캔버스 스니커즈"
    },
    price: 98000,
    category: "Shoes",
    hue: 130,
    description: {
      en: "Round toe that follows the foot. Lightweight, breathable canvas — wear them year-round.",
      ko: "발 모양을 따라가는 라운드 토. 가볍고 통기성 좋은 캔버스로 사계절 신어요."
    },
    sizes: ["240", "250", "260", "270"]
  },
  {
    id: "tote-bag",
    brand: "POKET",
    name: {
      en: "Canvas tote",
      ko: "캔버스 토트백"
    },
    price: 42000,
    category: "Bag",
    hue: 8,
    description: {
      en: "Plenty of room for a laptop and tumbler. Reinforced bottom keeps shape under weight.",
      ko: "노트북과 텀블러까지 여유롭게. 바닥은 강화 처리되어 무게에도 형태가 잡혀요."
    },
    sizes: ["ONE"]
  },
  {
    id: "sunglasses",
    brand: "FRAME",
    name: {
      en: "Round metal sunglasses",
      ko: "라운드 메탈 선글라스"
    },
    price: 120000,
    category: "Acc",
    hue: 200,
    description: {
      en: "Slim round metal frame. UV400 protection, 7g featherweight.",
      ko: "얇은 메탈 라운드 프레임. UV400 차단, 7g 초경량."
    },
    sizes: ["ONE"]
  }
];

export type CartItem = {
  productId: string;
  size: string;
  quantity: number;
};

export const INITIAL_CART: CartItem[] = [
  { productId: "denim-jacket", size: "M", quantity: 1 },
  { productId: "knit-sweater", size: "L", quantity: 2 },
  { productId: "sneakers", size: "260", quantity: 1 }
];

export type OrderStatus = "delivered" | "shipping" | "paid";

export type Order = {
  id: string;
  date: Localized;
  status: OrderStatus;
  total: number;
  itemSummary: Localized;
};

export const ORDERS: Order[] = [
  {
    id: "20251215-3829",
    date: { en: "Dec 15", ko: "12월 15일" },
    status: "delivered",
    total: 161000,
    itemSummary: {
      en: "Crewneck wool knit + 1 more",
      ko: "라운드넥 울 니트 외 1건"
    }
  },
  {
    id: "20251108-7194",
    date: { en: "Nov 8", ko: "11월 8일" },
    status: "delivered",
    total: 98000,
    itemSummary: { en: "Canvas sneakers", ko: "캔버스 스니커즈" }
  },
  {
    id: "20251020-2451",
    date: { en: "Oct 20", ko: "10월 20일" },
    status: "delivered",
    total: 89000,
    itemSummary: {
      en: "Oversized denim jacket",
      ko: "오버사이즈 데님 자켓"
    }
  }
];

export const ACCOUNT_PROFILE = {
  name: { en: "Jonghyeok Kim", ko: "김종혁" } satisfies Localized,
  handle: "@kimjh96",
  email: "kimjhs@kakao.com",
  level: "PLUS",
  point: 12480
};

export function formatKRW(n: number, lang: PlaygroundLang = "en"): string {
  if (lang === "ko") {
    return `${n.toLocaleString("ko-KR")}원`;
  }
  return `₩${n.toLocaleString("en-US")}`;
}

export function gradientFor(hue: number) {
  return `linear-gradient(135deg, hsl(${hue}, 65%, 70%) 0%, hsl(${(hue + 40) % 360}, 70%, 50%) 100%)`;
}

export function findProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0];
}

export function pick<T>(rec: Localized<T>, lang: PlaygroundLang): T {
  return rec[lang] ?? rec.en;
}

export type Review = {
  id: string;
  user: Localized;
  date: Localized;
  rating: number;
  size: string;
  comment: Localized;
};

export const REVIEWS: Review[] = [
  {
    id: "r1",
    user: { en: "Jung", ko: "정**" },
    date: { en: "Dec 18", ko: "12월 18일" },
    rating: 5,
    size: "M",
    comment: {
      en: "Just the right weight — works for both fall and winter. Goes with your usual size.",
      ko: "두께감이 적당해서 가을·겨울 모두 잘 어울려요. 평소 사이즈 그대로 가시면 됩니다."
    }
  },
  {
    id: "r2",
    user: { en: "Kim", ko: "김**" },
    date: { en: "Dec 12", ko: "12월 12일" },
    rating: 4,
    size: "L",
    comment: {
      en: "Color and fit are clean. Sleeves run a touch long — I cuff them once.",
      ko: "색감이랑 핏 깔끔합니다. 다만 소매가 살짝 길어서 한 번 접고 입어요."
    }
  },
  {
    id: "r3",
    user: { en: "Park", ko: "박**" },
    date: { en: "Dec 4", ko: "12월 4일" },
    rating: 5,
    size: "M",
    comment: {
      en: "Repurchase. Best value I've found.",
      ko: "재구매입니다. 가격대비 만족도 최고에요."
    }
  },
  {
    id: "r4",
    user: { en: "Lee", ko: "이**" },
    date: { en: "Nov 28", ko: "11월 28일" },
    rating: 4,
    size: "S",
    comment: {
      en: "It's an oversized cut, so you can size down comfortably.",
      ko: "오버핏이라 한 사이즈 작게 가도 충분할 것 같아요."
    }
  },
  {
    id: "r5",
    user: { en: "Choi", ko: "최**" },
    date: { en: "Nov 20", ko: "11월 20일" },
    rating: 5,
    size: "L",
    comment: {
      en: "Bought another one as a gift for a friend. Packaging is clean too.",
      ko: "친구 선물로 같은 거 하나 더 샀습니다. 포장도 깔끔해요."
    }
  }
];

export const REVIEW_SUMMARY = {
  average: 4.6,
  count: 142,
  breakdown: [
    { stars: 5, count: 96 },
    { stars: 4, count: 32 },
    { stars: 3, count: 8 },
    { stars: 2, count: 4 },
    { stars: 1, count: 2 }
  ]
};

export type SizeRow = {
  size: string;
  chest: number;
  length: number;
  sleeve: number;
};

export const SIZE_CHART: SizeRow[] = [
  { size: "S", chest: 100, length: 64, sleeve: 60 },
  { size: "M", chest: 104, length: 66, sleeve: 61 },
  { size: "L", chest: 108, length: 68, sleeve: 62 },
  { size: "XL", chest: 112, length: 70, sleeve: 63 }
];
