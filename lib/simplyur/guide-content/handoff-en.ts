import type { SimplyurGuideMessages } from "@/lib/simplyur/guide-types";

/** design_handoff_guide — English SSOT (verified menu paths from install PDFs). */
export const GUIDE_EN_HANDOFF: SimplyurGuideMessages = {
  title: "How to install your eSIM",
  intro:
    "This guide matches the Simply UR website and app flow, so the steps below are exactly what you'll see when you set up your Korea eSIM.",
  // REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: live checkout/My eSIM copy — manifest
  phaseBanner:
    "Live now: browse Korea plans, in-app checkout, install guide, and My eSIM (QR + usage) after sign-in.",
  flowPhaseNote:
    "Live now: browse Korea plans, in-app checkout, install guide, and My eSIM (QR + usage) after sign-in.",
  tabs: { precheck: "Before you start", iphone: "iPhone", android: "Android" },
  stepsTitle: "Installation steps",
  faqTitle: "FAQ — Korea eSIM",
  supportHint: "Questions? Email bongtour24@naver.com (KST 09:00–18:00).",
  devicesLinkLabel: "Compatible devices",
  quickSteps: [],
  precheckBlocks: [],
  precheckFaq: [],
  iphoneSteps: [],
  androidSteps: [],
  commonFaq: [],
  precheckCards: [
    {
      title: "Check device compatibility",
      body: "Your phone needs to support eSIM and be carrier-unlocked.",
      bullets: [
        "eSIM-capable iPhone (XS/XR or later) or Android flagship (2020 or newer)",
        "Unlocked by your current carrier",
      ],
      linkLabel: "Compatible devices",
    },
    {
      title: "Use a stable network",
      body: "Install your eSIM over Wi-Fi for the smoothest setup.",
      bullets: ["Avoid installing over weak mobile data"],
      note: "Started but got interrupted? You can retry using the same QR code.",
    },
    {
      title: "When to install",
      body: "You can install before you even leave home.",
      bullets: [
        "Your plan's validity starts when you first connect to a network in Korea — not at install time",
        "Keep your QR code / order email until your trip ends",
      ],
    },
  ],
  iphoneStepCards: [
    {
      title: "1. Receive your eSIM",
      bullets: [
        "After choosing a plan, check your email and your Simply UR order page for your QR code and activation details.",
      ],
    },
    {
      title: "2. Install the eSIM",
      mockRows: [
        { label: "Settings", value: "Cellular" },
        { label: "Cellular", value: "Add eSIM", highlight: true },
        { label: "Set Up Cellular", value: "Use QR Code", highlight: true },
      ],
      bullets: [
        "Settings → Cellular → Add eSIM → Use QR Code, then scan the code from your order",
        "Tap Continue, then Done — your Simply UR eSIM is installed",
      ],
      note: 'No camera handy? Tap "Enter Details Manually" and type in the SM-DP+ address and activation code shown on your order page instead of scanning.',
    },
    {
      title: "3. Activate in Korea",
      mockRows: [
        { label: "Cellular Data", value: "Simply UR", highlight: true },
        { label: "Data Roaming", value: "On", highlight: true },
        { label: "Allow Cellular Data Switching", value: "Off" },
      ],
      bullets: [
        "Once you land, go to Settings → Cellular and set Cellular Data to your Simply UR line",
        "Turn on Data Roaming for that line",
        'Turn OFF "Allow Cellular Data Switching" so your phone doesn\'t quietly fall back to your home SIM\'s data (and its roaming charges)',
      ],
    },
    {
      title: "4. Remove after your trip",
      bullets: ["Settings → Cellular → select the Simply UR line → Remove eSIM"],
    },
  ],
  androidStepCards: [
    {
      title: "1. Receive your eSIM",
      bullets: [
        "After choosing a plan, check your email and your Simply UR order page for your QR code and activation details.",
      ],
    },
    {
      title: "2. Install the eSIM",
      mockRows: [
        { label: "Settings", value: "Connections" },
        { label: "Connections", value: "SIM manager", highlight: true },
        { label: "SIM manager", value: "Add eSIM", highlight: true },
      ],
      bullets: [
        'Settings → Connections → SIM manager → Add eSIM → "Scan QR code from service provider", then scan the code from your order',
        "Tap Add to finish — your Simply UR eSIM is installed",
      ],
      note: 'Menu names vary a little by manufacturer (e.g. "Network & Internet → SIMs" on Pixel), but it\'s always under your phone\'s network/SIM settings. No camera handy? Use "Enter activation code" instead.',
    },
    {
      title: "3. Activate in Korea",
      mockRows: [
        { label: "Mobile data", value: "Simply UR", highlight: true },
        { label: "Data switching", value: "Off" },
      ],
      bullets: [
        "Once you land, go to Settings → Connections → SIM manager → Mobile data, select your Simply UR eSIM, then tap Apply",
        'Keep "Data switching" off so your phone doesn\'t fall back to your home SIM\'s data',
      ],
    },
    {
      title: "4. Remove after your trip",
      bullets: ["Settings → Connections → SIM manager → select Simply UR → Remove"],
    },
  ],
  faqItems: [
    {
      q: "Do I need to remove my physical SIM?",
      a: "No. Your eSIM works alongside your existing SIM — both can stay active at the same time.",
    },
    {
      q: "Will I keep my home phone number?",
      a: "Yes. Simply UR only provides data; calls and texts continue on your original SIM/eSIM line.",
    },
    {
      q: "When does my plan actually start?",
      a: "The moment you first connect to a network in Korea — not when you install the eSIM.",
    },
    {
      q: "Can I install before I leave home?",
      a: "Yes — install any time after purchase. Just don't activate the line until you land in Korea.",
    },
    {
      q: "What if the QR code won't scan?",
      a: "Use manual entry with the SM-DP+ address and activation code from your order, or contact support — each QR code is generally usable once.",
    },
    {
      q: "Is my phone compatible?",
      a: "Most iPhones XS/XR and later, and most Android flagships from 2020 onward, support eSIM. See Compatible devices to check yours.",
    },
    {
      q: "What happens if I run out of data?",
      a: "You can browse and select a new plan from Find my eSIM — topping up your current plan isn't available yet.",
    },
    {
      q: "Can I use this plan outside Korea?",
      a: "No — Simply UR plans are for use within Korea only.",
    },
  ],
};
