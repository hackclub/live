export type ShopItem = {
  img: string;
  name: string;
  price: number;
  description?: string;
};

export const allShopItems: ShopItem[] = [
  // ===== 1 HOUR =====
  { name: "water balloon thrown at me", price: 5, img: "/prizes/waterBalloonThrown.jpeg", description: "literally just throw a balloon at the founder" },
  { name: "Chrome Web Store Developer Grant", price: 1, img: "/prizes/chrome_web_store.png", description: "publish to the chrome web store" },
  { name: "$6.5/hr Hardware Grant", price: 1, img: "/prizes/grant_image.jpg", description: "funding to actually build out your project" },
  { name: "$5.00/hr Upgrade Grant", price: 1, img: "/prizes/grant_image.jpg", description: "lets say you want a slightly better laptop that costs 50 bucks more. you first would qualify for the laptop, n then you can use the upgrade grant to 'upgrade' ur prize further." },
  { name: "Caliper", price: 2, img: "/prizes/caliper.png", description: "measure stuff" },

  // ===== 2 HOURS =====
  { name: "2 hours for 5 pushups (stackable)", price: 2, img: "/prizes/pushups.jpg", description: "make the man suffer" },
  { name: "Random piece of paper from HQ", price: 3, img: "/prizes/paper.jpg", description: "who knows what it could be" },
  { name: "Hosting Credits", price: 2, img: "/prizes/hosting.png", description: "deploy your projects, 10$ grant" },
{ name: "$35 Codédex Grant", price: 8, img: "/prizes/codedex_grant.png", description: "$35 toward a Codédex subscription to learn and practice coding" },
{ name: "$20 Domain Grant", price: 3, img: "/prizes/porkbun.png", description: "buying domains is p cool" },
{ name: "PineCil Soldering Iron", price: 5, img: "/prizes/pinecil.jpg", description: "precision soldering for hardware projects" },
{ name: "eat half a lemon", price: 5, img: "/prizes/lemon_eating.jpeg", description: "you grind, i suffer" },
  { name: "10 hours for me to eat the spiciest chip", price: 10, img: "/prizes/spicy_chip.jpg", description: "pain is temporary, glory is forever" },
  { name: "Play Console Developer", price: 5, img: "/prizes/play_console.png", description: "publish android apps" },
   { name: "Hot Plate", price: 4, img: "/prizes/hot_plate.jpg", description: "make ramen while you code" },
   { name: "BLÅHAJ", price: 6, img: "/prizes/blahaj.jpg", description: "big big big" },
     { name: "BAOFENG UV-9R ", price: 6, img: "/prizes/baofengUV9R.jpg", description: "Dual-band handheld radio — UHF/VHF for staying in touch (or just vibing on the airwaves)" },
  // LVL 3 CLEARANCE — 15 hours
  // { name: "Casio Watch", price: 15, img: "/prizes/casio_image.jpg", description: "buy yourself a watch up to 100 dollars worth" },
  { name: "ProtonMe 1 year subscription", price: 15, img: "/prizes/protonMe.jpg", description: "we all love privacy and stuff" },
  { name: "wake up archer in middle of night (and record it)", price: 15, img: "/prizes/archer_awakened.jpg", description: "wakey wakey archer" },
  { name: "ProtonMe 1 year subscription", price: 18, img: "/prizes/protonMe.jpg", description: "we all love privacy and stuff" },
  { name: "EPOMAKER TH99 PRO Keyboard", price: 15, img: "/prizes/creamy_keyboard.jpg", description: "my favorite keyboard by far." },
  { name: "Anker Nano Charger (100W) with USB-C Cable", price: 17, img: "/prizes/anker_image.png", description: "best charger ever" },
  { name: "One Key Keychain", price: 3, img: "/prizes/keychain_image.jpg", description: "CLICKY CLICKY CLICKY" },
  { name: "Four Key Macropad", price: 4, img: "/prizes/macropad_image.jpg", description: "little macropad you can actually use" },
  { name: "$70 MX Master 3S Grant", price: 12, img: "/prizes/mouse.png", description: "$70 for mx master 3s" },
  // ===== 17 HOURS =====
  { name: "YubiKey 5C NFC", price: 20, img: "/prizes/yubikey.jpg", description: "secure your shi" },

  // ===== 20 HOURS =====
  { name: "Keychron K3 QMK Wireless Mechanical Keyboard", price: 20, img: "/prizes/keychron_k3.jpg", description: "programmable mechanical keyboard" },
  { name: "Apple Developer Program Grant", price: 17, img: "/prizes/apple_dev.png", description: "publish to the app store" },

  // ===== 25 HOURS =====
  { name: "144Hz Curved Monitor", price: 25, img: "/prizes/minotor_pic.avif", description: "$125 dollar monitor grant for your setup" },
  { name: "Kobo Clara BW", price: 25, img: "/prizes/kobo.jpg", description: "reading? whats that" },

  // ===== 22 HOURS =====
  { name: "Creality Ender-3 V3 SE", price: 28, img: "/prizes/creality.jpg", description: "3d printer for rapid prototyping" },

  // ===== 30 HOURS =====
  { name: "Flipper Zero", price: 30, img: "/prizes/flipper_zero_img.webp", description: "hardware security hacking tool" },
  { name: "Bambu A1 Mini", price: 30, img: "/prizes/bambu_a1.jpg", description: "fast and reliable 3d printing" },

  // ===== 33 HOURS =====
  { name: "Rode PodMic", price: 35, img: "/prizes/rode_podmic.jpg", description: "professional quality podcast microphone" },

  // ===== 40 HOURS =====
  { name: "Kindle Paperwhite", price: 40, img: "/prizes/kindle.jpg", description: "reading? whats that" },

  // ===== 44 HOURS =====
  { name: "Raspberry Pi 5", price: 44, img: "/prizes/rpi5.jpg", description: "its a expensive and tiny computer" },

  // ===== 46 HOURS =====
  { name: "Thinkpad T14 (Gen 2)", price: 46, img: "/prizes/thinkpad_laptop_img.jpg", description: "decent laptop for the price: Gen 2 14 inch FHD Intel i5-1135G7 2.4GHz 16GB RAM 128GB" },

  // ===== 51 HOURS =====
  { name: "Anycubic Kobra 3 Combo", price: 51, img: "/prizes/anycubic.jpg", description: "3d printer + enclosure bundle" },

  // ===== 58 HOURS =====
  // EPOMAKER TH99 PRO Keyboard removed (duplicate at price 15)

  // ===== 65 HOURS =====
  { name: "Meta Glasses Gen 1", price: 80, img: "/prizes/metaGlasses.jpeg", description: "because meta glasses r cool" },

  // ===== 75 HOURS =====

  // ===== 81 HOURS =====
  { name: "11\" iPad Wi-Fi 128GB with Apple Pencil", price: 75, img: "/prizes/ipad_pencil.jpg", description: "artttttttttt" },

  // ===== 83 HOURS =====
  { name: "Elgato Stream Deck MK.2", price: 83, img: "/prizes/elgato_streamdeck.jpg", description: "glorified macropad " },

  // ===== 110 HOURS =====
  { name: "GoPro HERO12 Black", price: 70, img: "/prizes/gopro.jpg", description: "record your adventures?" },

  // ===== 133 HOURS =====
  { name: "Sony WH-1000XM5 Wireless Noise Canceling Headphones (Black)", price: 60, img: "/prizes/headphones.png", description: "rlly nice headphones" },

  // ===== 200 HOURS =====
  { name: "Gaming PC with a 4060", price: 200, img: "/prizes/gaming_pc_img.webp", description: "1.1k PC grant. some people like prebuilts, others don't. i wont bat an eye as long as its a PC." },

  // ===== 300 HOURS =====
  { name: " wear a maid dress", price: 300, img: "/prizes/maid_dress.jpg", description: "the ultimate flex" },
];

export function findShopItemByName(name: string): ShopItem | undefined {
  return allShopItems.find((item) => item.name === name);
}
