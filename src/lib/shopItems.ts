export type ShopItem = {
  img: string;
  name: string;
  price: number;
  description?: string;
};

export const allShopItems: ShopItem[] = [
  // LVL 1 CLEARANCE — 1 hour
  { name: "water balloon thrown at me", price: 1, img: "/prizes/waterBalloonThrown.jpeg", description: "a water balloon will be thrown at me on stream. 1 hour = 1 water balloon"},
  { name: "eat half a lemon", price: 10, img: "/prizes/lemon_eating.jpeg", description: "on stream, i'll grab a lemon and start chomping."},
  // { name: "eat the spiciest chip (one chip challenge)", price: 25, img: "", description: "i will buy and eat the spiciest chip on stream"},
  // { name: "ill wear a rlly tight skirt for a full day", price: 30, img: "", description: "i will wear a rlly tight skirt for a full day"},
  { name: "One Key Keychain", price: 1, img: "/prizes/keychain_image.jpg", description: "it clicks" },
  { name: "$6.5/hr Hardware Grant", price: 1, img: "/prizes/grant_image.jpg", description: "funding to actually build out your project" },
  { name: "$5.00/hr Upgrade Grant", price: 1, img: "/prizes/grant_image.jpg", description: "lets say you want a slightly better laptop that costs 50 bucks more. you first would qualify for the laptop, n then you can use the upgrade grant to 'upgrade' ur prize further. "},

  // LVL 2 CLEARANCE — 3 hours
  { name: "$20 AI Grant", price: 3, img: "/prizes/claude_vs_gemini.png", description: "we all love ai" },
  { name: "$20 Domain Grant", price: 3, img: "/prizes/porkbun.png", description: "buying domains is p cool" },
  { name: "Four Key Macropad", price: 3, img: "/prizes/macropad_image.jpg", description: "little macropad you can actually use" },

  // LVL 3 CLEARANCE — 15 hours
  // { name: "Casio Watch", price: 15, img: "/prizes/casio_image.jpg", description: "buy yourself a watch up to 100 dollars worth" },
  { name: "ProtonMe 1 year subscription", price: 15, img: "/prizes/protonMe.jpg", description: "we all love privacy and stuff" },
  { name: "wake up archer in middle of night (and record it)", price: 15, img: "/prizes/archer_awakened.jpg", description: "wakey wakey archer" },
  { name: "TryHackMe 6 month subscription", price: 15, img: "/prizes/tryHackMe.png", description: "get cracked at cybersec rlly quick here" },
  { name: "EPOMAKER TH99 PRO Keyboard", price: 15, img: "/prizes/creamy_keyboard.jpg", description: "my favorite keyboard by far." },
  { name: "Anker Nano Charger (100W) with USB-C Cable", price: 15, img: "/prizes/anker_image.png", description: "best charger ever" },

  // LVL 4 CLEARANCE — 25 hours
  { name: "144Hz Curved Monitor", price: 25, img: "/prizes/minotor_pic.avif", description: "$125 dollar monitor grant for your setup" },


  // LVL 5 CLEARANCE — 50 hours
  { name: "GoPro HERO12 Black", price: 65, img: "/prizes/gopro.jpg", description: "record your adventures?" },
  { name: "Flipper Zero", price: 35, img: "/prizes/flipper_zero_img.webp", description: "flipper zero to flip into people's computers (im tryna be clever here)." },
  { name: "Thinkpad T14 (Gen 2)", price: 50, img: "/prizes/thinkpad_laptop_img.jpg", description: "decent laptop for the price: Gen 2 14 inch FHD Intel i5-1135G7 2.4GHz 16GB RAM 128GB "  },
  // { name: "Hack The Box VIP+ 1 Year Subscription", price: 50, img: "/prizes/hackthebox.png" },
  { name: "Sony WH-1000XM5 Wireless Noise Canceling Headphones (Black)", price: 50, img: "/prizes/headphones.png", description: "rlly nice headphones" },
  { name: "Meta Glasses Gen 1", price: 65, img: "/prizes/metaGlasses.jpeg", description: "because meta glasses r cool" },

  { name: "Gaming PC with a 4060", price: 200, img: "/prizes/gaming_pc_img.webp", description: "1.1k PC grant. some people like prebuilts, others don't. i wont bat an eye as long as its a PC." },
];

export function findShopItemByName(name: string): ShopItem | undefined {
  return allShopItems.find((item) => item.name === name);
}
