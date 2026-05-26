const PAGE_DIR_01 = "chapters/chapter-01-youre-late-again/pages";
const PAGE_DIR_02 = "chapters/chapter-02-under-the-same-rain/pages";
const pageImg01 = (n) => `${PAGE_DIR_01}/page-${String(n).padStart(3, '0')}.png`;
const pageImg02 = (n) => `${PAGE_DIR_02}/page-${String(n).padStart(3, '0')}.png`;

const makePage = (number, title, goal, tone, image, extra = {}) => ({
  number,
  title,
  goal,
  tone,
  image,
  references: ["Use current canon references and page continuity."],
  panels: [{
    label: "Storyboard",
    type: "Comic page",
    shot: "See page art",
    text: "Rough storyboard page. Dialogue and panel details will continue to be refined later.",
    dialogue: ""
  }],
  ...extra
});

const chapter1Pages = [
  makePage(1,  "Symbolic Nightmare", "Create unease and foreshadowing without revealing the future tragedy.", "dark, dreamlike, quiet", pageImg01(1)),
  makePage(2,  "Barcodia — Morning", "Separate the nightmare from the waking world with a bright village transition.", "bright, safe, warm", pageImg01(2)),
  makePage(3,  "Warm Bedroom Wake-Up", "Show Nick waking up late in the cozy bedroom.", "sleepy, safe, warm", pageImg01(3)),
  makePage(4,  "Sister Texts / Realization", "Show the sister's messages and Nick realizing he needs to hurry.", "warm concern shifting to urgency", pageImg01(4)),
  makePage(5,  "Scramble", "Nick rushes to get dressed and grab his things.", "comedic urgency", pageImg01(5)),
  makePage(6,  "Mom Kitchen Moment", "Quick domestic warmth before Nick runs into town.", "warm, familiar, teasing", pageImg01(6)),
  makePage(7,  "Running Through Town", "Nick runs through Barcodia toward the meeting.", "movement, bright town energy", pageImg01(7)),
  makePage(8,  "Street Con Begins", "Nick stops to help a child, revealing his kindness.", "concern, slight suspicion", pageImg01(8)),
  makePage(9,  "The Theft", "The child steals Nick's money pouch and runs.", "fast, surprised", pageImg01(9)),
  makePage(10, "Chase Continues", "Nick actively chases the boy through a crowded alley.", "kinetic, unlucky, urgent", pageImg01(10)),
  makePage(11, "School Papers Accident", "Nick bumps into a teacher and stops to help gather school papers.", "frustrated but kind", pageImg01(11)),
  makePage(12, "Shortcut / Fence", "Nick spots the boy and scales a vine-covered fence for a shortcut.", "athletic, clever, urgent", pageImg01(12)),
  makePage(13, "Catch!", "Nick cuts off the boy, but the pouch is thrown over his head to the thugs.", "reversal, planned con reveal", pageImg01(13)),
  makePage(14, "The Con Revealed", "The thugs taunt Nick and he realizes he has no time for this.", "frustrated, time pressure", pageImg01(14)),
  makePage(15, "Forced Into the Fight", "The thugs attack Nick before he can walk away.", "overwhelmed, unfair, forced conflict", pageImg01(15)),
  makePage(16, "Nick Fights Back", "Nick turns the fight around and starts winning.", "scrappy, determined", pageImg01(16)),
  makePage(17, "Aftermath", "Nick wins, remembers the real goal, and runs to meet his sister.", "relief, urgency", pageImg01(17)),
  makePage(18, "The Money Returned", "The little thief nervously tosses Nick's pouch back before Nick runs again.", "brief humanity, urgency returning", pageImg01(18)),
  makePage(19, "Collision", "Nick collides with Maverick as the weather shifts.", "abrupt, ominous, startling", pageImg01(19)),
  makePage(20, "Maverick", "A full intimidating reveal of Maverick's presence and power.", "ominous, intimidating, rain-soaked", pageImg01(20)),
  makePage(21, "First Sight", "Nick sees Lumiere waiting for him in the rain.", "beautiful, guilty, emotionally heavy", pageImg01(21)),
  makePage(22, "I Knew You Would", "Nick apologizes and Lumiere gently receives him.", "tender, restrained, emotional", pageImg01(22)),
  makePage(23, "Come On. You're Soaked.", "Close Chapter 1 on a quiet rain-lit sibling image.", "gentle, forgiving, beautiful", pageImg01(23))
];

const encoreAudio = {
  src: "audio/lumiere_quiet_encore_192kbps.mp3",
  mode: "play",
  continueAcrossPages: true,
  stopWhenLeavingSequence: true,
  volume: 0.85
};

const chapter2Pages = [
  makePage(24, "Under the Same Rain", "Open Chapter 2 from the rain reunion and move the siblings into the next scene.", "soft, intimate, rain-lit", pageImg02(24)),
  makePage(25, "Under the Awning", "Lumiere notices Nick's bruise and checks on him before anything else.", "gentle concern, sheltered from the rain", pageImg02(25)),
  makePage(26, "The Hall He Missed", "Nick realizes the performance is over and that he truly missed her headlining moment.", "guilt, quiet regret", pageImg02(26)),
  makePage(27, "Everyone's Gone", "Inside the empty music hall, Nick feels the full weight of arriving too late.", "quiet sadness, consolation", pageImg02(27)),
  makePage(28, "Play It For Me", "Lumiere offers him a private encore, just for him.", "tender, forgiving, intimate", pageImg02(28)),
  makePage(29, "Readying the Stage", "Lumiere shifts from rain-soaked waiting to performance mode with clear continuity before the encore.", "calm preparation", pageImg02(29)),
  makePage(30, "Encore Begins", "Lumiere begins her private violin performance as the music starts.", "graceful, luminous", pageImg02(30), { audio: encoreAudio }),
  makePage(31, "Violin and Voice", "The encore expands into soft violin, song, and flowing movement.", "beautiful, expressive", pageImg02(31), { audio: encoreAudio }),
  makePage(32, "Grace in Motion", "Nick watches in awe as Lumiere dances and plays with emotional grace.", "awe, beauty, warmth", pageImg02(32), { audio: encoreAudio }),
  makePage(33, "The Last Note", "The private encore resolves gently while Nick takes in what he missed.", "soft emotional release", pageImg02(33), { audio: encoreAudio }),
  makePage(34, "Back Row Witnesses", "Two quiet friends are revealed in the back row after the encore.", "warm surprise, wider cast reveal", pageImg02(34)),
  makePage(35, "What Comes After", "The group settles into the next step as the music hall begins to hint at a larger mystery.", "reflective, transitional", pageImg02(35))
];

const BARCODIA_BOOK = {
  title: "Barcodia Comic Reader",
  subtitle: "Chapter browser enabled. Includes music playback for Lumiere's private encore pages.",
  readingMode: "left-to-right",
  chapters: [
    {
      id: "chapter-01-youre-late-again",
      shortLabel: "Chapter 1",
      title: "Chapter 1: You're Late Again",
      pages: chapter1Pages
    },
    {
      id: "chapter-02-under-the-same-rain",
      shortLabel: "Chapter 2",
      title: "Chapter 2: Under the Same Rain",
      pages: chapter2Pages
    }
  ]
};
