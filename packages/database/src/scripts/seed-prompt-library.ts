import { createDb } from "../client.js";
import * as schema from "../schema.js";

const connectionString = process.env.DATABASE_URL!;
const db = createDb(connectionString);

type Theme = typeof schema.promptLibraryThemeEnum.enumValues[number];
type Tier = typeof schema.promptLibraryTierEnum.enumValues[number];
type Sensitivity = typeof schema.promptLibrarySensitivityEnum.enumValues[number];

interface LibraryQ {
  theme: Theme;
  tier: Tier;
  questionText: string;
  sensitivity?: Sensitivity;
  recommendedPosition: number;
  followUpTags?: string[];
}

const library: LibraryQ[] = [
  // ── warmup ────────────────────────────────────────────────────────────────
  { theme: "warmup", tier: "warm_up", questionText: "What is your full name, and were you named after anyone?", recommendedPosition: 0 },
  { theme: "warmup", tier: "warm_up", questionText: "Where were you born, and what was the house like?", recommendedPosition: 1, followUpTags: ["childhood", "family_home"] },
  { theme: "warmup", tier: "warm_up", questionText: "Who was in your family when you were little? List everyone you can remember.", recommendedPosition: 2, followUpTags: ["family_home"] },
  { theme: "warmup", tier: "warm_up", questionText: "What did you call your grandparents?", recommendedPosition: 3, followUpTags: ["family_home"] },
  { theme: "warmup", tier: "warm_up", questionText: "What is your earliest memory? Even a fragment counts.", recommendedPosition: 4, followUpTags: ["childhood", "family_home"] },
  { theme: "warmup", tier: "warm_up", questionText: "What was your favorite thing to do as a child?", recommendedPosition: 5, followUpTags: ["childhood"] },
  { theme: "warmup", tier: "warm_up", questionText: "What season felt like home when you were growing up?", recommendedPosition: 6, followUpTags: ["childhood", "holidays"] },
  { theme: "warmup", tier: "warm_up", questionText: "If you could relive one ordinary day from your past, which day would it be?", recommendedPosition: 7, followUpTags: ["childhood", "family_home"] },
  { theme: "warmup", tier: "warm_up", questionText: "What sound or smell instantly takes you back to childhood?", recommendedPosition: 8, followUpTags: ["childhood", "food"] },

  // ── childhood ─────────────────────────────────────────────────────────────
  { theme: "childhood", tier: "middle", questionText: "What games did you play with the kids on your street?", recommendedPosition: 0, followUpTags: ["family_home"] },
  { theme: "childhood", tier: "middle", questionText: "What was your bedroom like growing up?", recommendedPosition: 1, followUpTags: ["family_home"] },
  { theme: "childhood", tier: "middle", questionText: "Who was your best friend when you were young, and what did you do together?", recommendedPosition: 2 },
  { theme: "childhood", tier: "middle", questionText: "What scared you when you were little?", recommendedPosition: 3 },
  { theme: "childhood", tier: "deep", questionText: "What is something you never told your parents when you were growing up?", recommendedPosition: 4, sensitivity: "careful" },
  { theme: "childhood", tier: "middle", questionText: "Describe a perfect Saturday when you were about ten years old.", recommendedPosition: 5, followUpTags: ["holidays"] },
  { theme: "childhood", tier: "deep", questionText: "Was there a moment you realized you were no longer a child?", recommendedPosition: 6 },
  { theme: "childhood", tier: "middle", questionText: "What books or shows shaped you the most?", recommendedPosition: 7 },
  { theme: "childhood", tier: "middle", questionText: "What did you want to be when you grew up? Did it change over the years?", recommendedPosition: 8, followUpTags: ["work"] },
  { theme: "childhood", tier: "middle", questionText: "Did you have a nickname as a kid? How did you get it?", recommendedPosition: 9 },
  { theme: "childhood", tier: "deep", questionText: "Is there a moment from childhood you wish you could live over differently?", recommendedPosition: 10, sensitivity: "careful" },

  // ── family_home ───────────────────────────────────────────────────────────
  { theme: "family_home", tier: "middle", questionText: "Describe the house you grew up in. Where was it? What did it look like?", recommendedPosition: 0, followUpTags: ["childhood"] },
  { theme: "family_home", tier: "middle", questionText: "What was dinnertime like in your house?", recommendedPosition: 1, followUpTags: ["food"] },
  { theme: "family_home", tier: "middle", questionText: "Who did the cooking, and what was their signature dish?", recommendedPosition: 2, followUpTags: ["food"] },
  { theme: "family_home", tier: "deep", questionText: "What was the rule in your house that everyone knew but nobody said out loud?", recommendedPosition: 3, sensitivity: "careful" },
  { theme: "family_home", tier: "middle", questionText: "Was there a room or corner of the house that felt like yours?", recommendedPosition: 4 },
  { theme: "family_home", tier: "middle", questionText: "How did your family handle disagreements?", recommendedPosition: 5, sensitivity: "careful" },
  { theme: "family_home", tier: "deep", questionText: "What did your family not talk about?", recommendedPosition: 6, sensitivity: "careful" },
  { theme: "family_home", tier: "middle", questionText: "What did Sundays look like in your household?", recommendedPosition: 7, followUpTags: ["holidays"] },
  { theme: "family_home", tier: "middle", questionText: "Who was the funniest person in your family, and what made them funny?", recommendedPosition: 8 },
  { theme: "family_home", tier: "deep", questionText: "Was there a person in your family everyone leaned on? What happened when they needed help?", recommendedPosition: 9, sensitivity: "careful" },

  // ── work ──────────────────────────────────────────────────────────────────
  { theme: "work", tier: "warm_up", questionText: "What was your first job, and how old were you?", recommendedPosition: 0 },
  { theme: "work", tier: "middle", questionText: "What did you want to be when you grew up? What did you end up doing?", recommendedPosition: 1 },
  { theme: "work", tier: "middle", questionText: "What was the hardest you ever worked for something?", recommendedPosition: 2 },
  { theme: "work", tier: "deep", questionText: "Was there a job you hated? What made it unbearable?", recommendedPosition: 3, sensitivity: "careful" },
  { theme: "work", tier: "middle", questionText: "Who believed in you when no one else did?", recommendedPosition: 4, followUpTags: ["courtship"] },
  { theme: "work", tier: "middle", questionText: "What is the proudest thing you built, fixed, or finished?", recommendedPosition: 5 },
  { theme: "work", tier: "deep", questionText: "If you could do one thing differently in your career, what would it be?", recommendedPosition: 6 },
  { theme: "work", tier: "middle", questionText: "What did you learn on the job that nobody could have taught you in school?", recommendedPosition: 7 },
  { theme: "work", tier: "warm_up", questionText: "What did you carry in your lunchbox or briefcase?", recommendedPosition: 8, followUpTags: ["food"] },

  // ── service ──────────────────────────────────────────────────────────────
  { theme: "service", tier: "middle", questionText: "Did you serve in the military? What was that experience like?", recommendedPosition: 0, sensitivity: "careful" },
  { theme: "service", tier: "middle", questionText: "What do you think people misunderstand about that time in your life?", recommendedPosition: 1, sensitivity: "careful", followUpTags: ["legacy"] },
  { theme: "service", tier: "deep", questionText: "How did service change what you care about?", recommendedPosition: 2, sensitivity: "careful" },
  { theme: "service", tier: "warm_up", questionText: "Where were you stationed, and what did the landscape look like?", recommendedPosition: 3 },
  { theme: "service", tier: "middle", questionText: "Did you make a friend during service that you still think about?", recommendedPosition: 4 },
  { theme: "service", tier: "middle", questionText: "What is something you learned about yourself during that time?", recommendedPosition: 5, followUpTags: ["legacy"] },
  { theme: "service", tier: "warm_up", questionText: "What did a typical day look like?", recommendedPosition: 6, followUpTags: ["work"] },
  { theme: "service", tier: "deep", questionText: "Was there a moment during service when you felt most alone, or most connected?", recommendedPosition: 7, sensitivity: "careful" },

  // ── courtship ────────────────────────────────────────────────────────────
  { theme: "courtship", tier: "warm_up", questionText: "How did you meet your partner?", recommendedPosition: 0 },
  { theme: "courtship", tier: "middle", questionText: "What was your first impression of them?", recommendedPosition: 1 },
  { theme: "courtship", tier: "middle", questionText: "When did you know this was the person?", recommendedPosition: 2 },
  { theme: "courtship", tier: "deep", questionText: "What is something your partner did for you that you never forgot?", recommendedPosition: 3 },
  { theme: "courtship", tier: "middle", questionText: "What was your wedding day like?", recommendedPosition: 4, followUpTags: ["family_home"] },
  { theme: "courtship", tier: "deep", questionText: "What is the hardest thing you and your partner went through together?", recommendedPosition: 5, sensitivity: "careful", followUpTags: ["legacy"] },
  { theme: "courtship", tier: "warm_up", questionText: "What did you do on your first date?", recommendedPosition: 6 },
  { theme: "courtship", tier: "middle", questionText: "What is a small thing your partner does that still makes you smile?", recommendedPosition: 7 },
  { theme: "courtship", tier: "deep", questionText: "What did you learn about love that surprised you?", recommendedPosition: 8, followUpTags: ["legacy"] },

  // ── holidays ─────────────────────────────────────────────────────────────
  { theme: "holidays", tier: "warm_up", questionText: "What holiday did your family celebrate best?", recommendedPosition: 0, followUpTags: ["food"] },
  { theme: "holidays", tier: "warm_up", questionText: "What was on the table at a big family meal?", recommendedPosition: 1, followUpTags: ["food"] },
  { theme: "holidays", tier: "middle", questionText: "What traditions did your family have that other families didn't?", recommendedPosition: 2 },
  { theme: "holidays", tier: "middle", questionText: "Is there a holiday that changed meaning for you as you got older?", recommendedPosition: 3 },
  { theme: "holidays", tier: "deep", questionText: "Is there a holiday you now find hard? What happened?", recommendedPosition: 4, sensitivity: "grief_safe" },
  { theme: "holidays", tier: "middle", questionText: "What was the best gift you ever gave or received?", recommendedPosition: 5 },
  { theme: "holidays", tier: "middle", questionText: "Who always hosted, and what was their house like during the holidays?", recommendedPosition: 6, followUpTags: ["family_home"] },
  { theme: "holidays", tier: "warm_up", questionText: "What was the first holiday you remember really enjoying?", recommendedPosition: 7, followUpTags: ["childhood"] },

  // ── food ─────────────────────────────────────────────────────────────────
  { theme: "food", tier: "warm_up", questionText: "What did you eat for breakfast when you were growing up?", recommendedPosition: 0 },
  { theme: "food", tier: "middle", questionText: "Is there a recipe that has been in your family for generations? Can you describe it?", recommendedPosition: 1, followUpTags: ["family_home"] },
  { theme: "food", tier: "middle", questionText: "What food did you hate as a child but love now (or still hate)?", recommendedPosition: 2 },
  { theme: "food", tier: "deep", questionText: "Was food ever scarce when you were growing up? What was that like?", recommendedPosition: 3, sensitivity: "careful" },
  { theme: "food", tier: "middle", questionText: "What dish do you make when someone you love is sad?", recommendedPosition: 4 },
  { theme: "food", tier: "warm_up", questionText: "What is your comfort food?", recommendedPosition: 5 },
  { theme: "food", tier: "middle", questionText: "What did your family eat on birthdays?", recommendedPosition: 6, followUpTags: ["holidays"] },
  { theme: "food", tier: "middle", questionText: "What is the best thing your mother or father cooked?", recommendedPosition: 7, followUpTags: ["family_home"] },
  { theme: "food", tier: "deep", questionText: "Is there a meal that tells the story of your family better than any photo?", recommendedPosition: 8, followUpTags: ["legacy"] },

  // ── migration ────────────────────────────────────────────────────────────
  { theme: "migration", tier: "warm_up", questionText: "Where did your family come from before they came here?", recommendedPosition: 0 },
  { theme: "migration", tier: "middle", questionText: "Why did your family move? What were they leaving, and what were they hoping for?", recommendedPosition: 1, sensitivity: "careful" },
  { theme: "migration", tier: "middle", questionText: "What was the journey like? What do you remember about arriving?", recommendedPosition: 2 },
  { theme: "migration", tier: "deep", questionText: "What did you have to leave behind?", recommendedPosition: 3, sensitivity: "careful" },
  { theme: "migration", tier: "middle", questionText: "What language or words from the old place do you still use?", recommendedPosition: 4, followUpTags: ["family_home"] },
  { theme: "migration", tier: "deep", questionText: "When you go back, does it still feel like home?", recommendedPosition: 5, sensitivity: "careful" },
  { theme: "migration", tier: "middle", questionText: "What was the first thing that surprised you about the new place?", recommendedPosition: 6 },
  { theme: "migration", tier: "warm_up", questionText: "What did you bring with you from the old country — an object, a recipe, a habit?", recommendedPosition: 7, followUpTags: ["food", "family_home"] },

  // ── legacy ────────────────────────────────────────────────────────────────
  { theme: "legacy", tier: "deep", questionText: "What do you want your grandchildren to know about you?", recommendedPosition: 0 },
  { theme: "legacy", tier: "deep", questionText: "What mistake do you hope they never have to make?", recommendedPosition: 1, sensitivity: "careful" },
  { theme: "legacy", tier: "legacy", questionText: "What is the best piece of advice anyone gave you?", recommendedPosition: 2 },
  { theme: "legacy", tier: "legacy", questionText: "Is there something you never got to say to someone? What would you tell them now?", recommendedPosition: 3, sensitivity: "grief_safe" },
  { theme: "legacy", tier: "legacy", questionText: "When people remember you, what do you hope they remember first?", recommendedPosition: 4 },
  { theme: "legacy", tier: "deep", questionText: "What are you most proud of?", recommendedPosition: 5 },
  { theme: "legacy", tier: "legacy", questionText: "Is there a message you want left in this archive for someone who isn't born yet?", recommendedPosition: 6 },
  { theme: "legacy", tier: "deep", questionText: "What is something you changed your mind about as you got older?", recommendedPosition: 7, followUpTags: ["warmup"] },
  { theme: "legacy", tier: "legacy", questionText: "What does a good life look like to you?", recommendedPosition: 8 },
  { theme: "legacy", tier: "deep", questionText: "What is a story your family will still be telling in a hundred years?", recommendedPosition: 9 },

  // ── grief_safe ───────────────────────────────────────────────────────────
  { theme: "grief_safe", tier: "deep", questionText: "Who do you miss the most right now?", recommendedPosition: 0, sensitivity: "grief_safe" },
  { theme: "grief_safe", tier: "deep", questionText: "What is a small thing that reminds you of them?", recommendedPosition: 1, sensitivity: "grief_safe" },
  { theme: "grief_safe", tier: "deep", questionText: "What do you wish you had asked them while you could?", recommendedPosition: 2, sensitivity: "grief_safe", followUpTags: ["legacy"] },
  { theme: "grief_safe", tier: "deep", questionText: "Is there a song, a smell, or a place that brings them back for a moment?", recommendedPosition: 3, sensitivity: "grief_safe" },
  { theme: "grief_safe", tier: "deep", questionText: "What would they say if they could see you now?", recommendedPosition: 4, sensitivity: "grief_safe" },
  { theme: "grief_safe", tier: "deep", questionText: "What is a photo or object of theirs you have kept?", recommendedPosition: 5, sensitivity: "grief_safe" },
  { theme: "grief_safe", tier: "deep", questionText: "Is there something they always said that you still hear in your head?", recommendedPosition: 6, sensitivity: "grief_safe" },
];

interface TemplateDef {
  name: string;
  description: string;
  campaignType: typeof schema.promptCampaignTypeEnum.enumValues[number];
  theme: Theme;
  defaultCadenceDays: number;
  sensitivityCeiling: Sensitivity;
  questionFilters: Array<{ theme: Theme; tier?: Tier; maxPosition?: number }>;
}

const templates: TemplateDef[] = [
  {
    name: "Getting to know you",
    description: "A gentle warm-up sequence for a grandparent or elder. Starts easy and slowly goes deeper over several weeks.",
    campaignType: "one_relative",
    theme: "warmup",
    defaultCadenceDays: 7,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "warmup" },
      { theme: "childhood", maxPosition: 3 },
      { theme: "family_home", maxPosition: 2 },
      { theme: "food", maxPosition: 2 },
    ],
  },
  {
    name: "A life in chapters",
    description: "A longer arc that walks through childhood, work, love, and legacy. For someone whose full story you want to keep.",
    campaignType: "about_person",
    theme: "childhood",
    defaultCadenceDays: 7,
    sensitivityCeiling: "careful",
    questionFilters: [
      { theme: "warmup" },
      { theme: "childhood" },
      { theme: "family_home" },
      { theme: "work" },
      { theme: "courtship" },
      { theme: "legacy" },
    ],
  },
  {
    name: "Around the table",
    description: "Questions about food, meals, and the table your family gathered around. Everyone has a food story.",
    campaignType: "theme_based",
    theme: "food",
    defaultCadenceDays: 5,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "food" },
      { theme: "holidays" },
      { theme: "family_home", maxPosition: 2 },
    ],
  },
  {
    name: "Coming to America",
    description: "A sequence about migration, arrival, and what was carried from the old place to the new one.",
    campaignType: "one_relative",
    theme: "migration",
    defaultCadenceDays: 10,
    sensitivityCeiling: "careful",
    questionFilters: [
      { theme: "migration" },
      { theme: "family_home" },
      { theme: "food" },
    ],
  },
  {
    name: "In their honor",
    description: "A gentle remembrance campaign for someone who has passed. Questions help the living share what they carry.",
    campaignType: "about_person",
    theme: "grief_safe",
    defaultCadenceDays: 10,
    sensitivityCeiling: "grief_safe",
    questionFilters: [
      { theme: "warmup" },
      { theme: "grief_safe" },
      { theme: "legacy", tier: "deep" },
    ],
  },
  {
    name: "Reunion collection",
    description: "Questions to send before a family reunion so you arrive with fresh stories to share.",
    campaignType: "reunion",
    theme: "holidays",
    defaultCadenceDays: 5,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "warmup" },
      { theme: "holidays" },
      { theme: "childhood", maxPosition: 5 },
      { theme: "food" },
    ],
  },
  {
    name: "Who is in this photo?",
    description: "Send photos to family members and ask them to identify the people, places, and moments captured in each one.",
    campaignType: "photo_identify",
    theme: "family_home",
    defaultCadenceDays: 7,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "warmup" },
      { theme: "family_home", maxPosition: 2 },
      { theme: "childhood", maxPosition: 3 },
      { theme: "holidays", maxPosition: 2 },
    ],
  },
  {
    name: "Anniversary memories",
    description: "A collection of questions about a couple's life together — how they met, what they built, and what they love most.",
    campaignType: "anniversary",
    theme: "courtship",
    defaultCadenceDays: 5,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "courtship" },
      { theme: "family_home", maxPosition: 2 },
      { theme: "food", maxPosition: 2 },
      { theme: "holidays", maxPosition: 2 },
      { theme: "legacy", tier: "deep", maxPosition: 1 },
    ],
  },
  {
    name: "Place memory drive",
    description: "Questions about the places that shaped a family — childhood homes, schools, workplaces, and the towns they called home.",
    campaignType: "place_drive",
    theme: "family_home",
    defaultCadenceDays: 7,
    sensitivityCeiling: "ordinary",
    questionFilters: [
      { theme: "family_home" },
      { theme: "childhood" },
      { theme: "migration" },
      { theme: "work", maxPosition: 2 },
    ],
  },
];

export async function seedPromptLibrary() {
  console.log("Seeding prompt library questions...");

  const questionRows = await db.query.promptLibraryQuestions.findMany();
  const needsQuestionSeed = questionRows.length === 0;

  if (needsQuestionSeed) {
    const inserted = await db
      .insert(schema.promptLibraryQuestions)
      .values(
        library.map((q) => ({
          theme: q.theme,
          tier: q.tier,
          questionText: q.questionText,
          sensitivity: q.sensitivity ?? "ordinary",
          recommendedPosition: q.recommendedPosition,
          followUpTags: q.followUpTags ?? [],
        })),
      )
      .returning();

    console.log(`Inserted ${inserted.length} library questions.`);
    questionRows.push(...inserted);
  } else {
    console.log(`Prompt library already has ${questionRows.length} questions, skipping question seed.`);
  }

  const questionIdByText = new Map<string, string>();
  for (const row of questionRows) {
    questionIdByText.set(row.questionText, row.id);
  }

  console.log("Checking campaign templates...");

  const existingTemplates = await db.query.promptCampaignTemplates.findMany({
    with: { questions: true },
  });
  const existingTemplateNames = new Set(existingTemplates.map((t) => t.name));

  for (const t of templates) {
    if (existingTemplateNames.has(t.name)) continue;

    const [template] = await db
      .insert(schema.promptCampaignTemplates)
      .values({
        name: t.name,
        description: t.description,
        campaignType: t.campaignType,
        theme: t.theme,
        defaultCadenceDays: t.defaultCadenceDays,
        sensitivityCeiling: t.sensitivityCeiling,
      })
      .returning();

    if (!template) continue;

    const templateQuestions: { libraryQuestionId: string; position: number }[] = [];
    let position = 0;

    type Filter = { theme: string; tier?: string; maxPosition?: number };
    for (const filter of t.questionFilters as Filter[]) {
      const matching = questionRows.filter(
        (q) =>
          q.theme === filter.theme &&
          (!filter.tier || q.tier === filter.tier) &&
          (filter.maxPosition === undefined || q.recommendedPosition <= filter.maxPosition),
      );
      const sorted = matching.sort((a, b) => a.recommendedPosition - b.recommendedPosition);
      for (const q of sorted) {
        templateQuestions.push({ libraryQuestionId: q.id, position: position++ });
      }
    }

    if (templateQuestions.length > 0) {
      await db.insert(schema.promptCampaignTemplateQuestions).values(
        templateQuestions.map((tq) => ({
          templateId: template.id,
          libraryQuestionId: tq.libraryQuestionId,
          position: tq.position,
        })),
      );
    }

    console.log(`Created template "${t.name}": ${templateQuestions.length} questions.`);
  }

  console.log("Prompt library seed complete.");
}

seedPromptLibrary().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});