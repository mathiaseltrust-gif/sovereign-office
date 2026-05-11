import { db } from "@workspace/db";
import { familyLineageTable, forumPostsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

let seeded = false;

export async function ensureCommunitySeeded(): Promise<void> {
  if (seeded) return;

  try {
    const existing = await db.select().from(familyLineageTable).limit(1);
    if (existing.length > 0) {
      seeded = true;
      return;
    }

    logger.info("Seeding community directory with initial family data…");

    const members = await db.insert(familyLineageTable).values([
      {
        fullName: "Mathias El",
        firstName: "Mathias",
        lastName: "El",
        birthYear: 1945,
        gender: "male",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: true,
        trustBeneficiary: true,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "sovereign",
        generationalPosition: 1,
        sourceType: "founding",
        notes: "Founding trustee and Chief Justice of the Mathias El Tribe.",
      },
      {
        fullName: "Miriam El",
        firstName: "Miriam",
        lastName: "El",
        birthYear: 1948,
        gender: "female",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: true,
        trustBeneficiary: true,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "sovereign",
        generationalPosition: 1,
        sourceType: "manual",
      },
      {
        fullName: "Joseph El",
        firstName: "Joseph",
        lastName: "El",
        birthYear: 1972,
        gender: "male",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: true,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "member",
        generationalPosition: 2,
        sourceType: "manual",
      },
      {
        fullName: "Sarah El-Whitehorse",
        firstName: "Sarah",
        lastName: "El-Whitehorse",
        birthYear: 1975,
        gender: "female",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: true,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "member",
        generationalPosition: 2,
        sourceType: "manual",
      },
      {
        fullName: "Daniel El",
        firstName: "Daniel",
        lastName: "El",
        birthYear: 1999,
        gender: "male",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: false,
        icwaEligible: true,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "member",
        generationalPosition: 3,
        sourceType: "manual",
      },
      {
        fullName: "Leah El",
        firstName: "Leah",
        lastName: "El",
        birthYear: 2004,
        gender: "female",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: false,
        icwaEligible: true,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "member",
        generationalPosition: 3,
        sourceType: "manual",
      },
      {
        fullName: "Thomas Running Bear El",
        firstName: "Thomas",
        lastName: "Running Bear El",
        birthYear: 1968,
        gender: "male",
        tribalNation: "Mathias El Tribe",
        tribalEnrollmentNumber: "MET-1968-003",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: true,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "member",
        generationalPosition: 2,
        sourceType: "manual",
      },
      {
        fullName: "Ana Clearwater",
        firstName: "Ana",
        lastName: "Clearwater",
        birthYear: 1985,
        gender: "female",
        tribalNation: "Mathias El Tribe",
        isDeceased: false,
        isAncestor: false,
        trustBeneficiary: false,
        icwaEligible: true,
        pendingReview: true,
        membershipStatus: "pending",
        protectionLevel: "pending",
        generationalPosition: 3,
        sourceType: "manual",
        notes: "Enrollment application under review. Supporting documents submitted.",
      },
      {
        fullName: "Elder Rose Two Feathers",
        firstName: "Rose",
        lastName: "Two Feathers",
        birthYear: 1932,
        deathYear: 2019,
        gender: "female",
        tribalNation: "Mathias El Tribe",
        isDeceased: true,
        isAncestor: true,
        trustBeneficiary: false,
        icwaEligible: false,
        pendingReview: false,
        membershipStatus: "active",
        protectionLevel: "ancestor",
        generationalPosition: 0,
        sourceType: "historical",
        notes: "Beloved elder who preserved oral traditions and tribal history.",
      },
    ]).returning();

    if (members.length >= 3) {
      const [mathias, miriam, joseph] = members;
      await db.update(familyLineageTable)
        .set({ spouseIds: [miriam.id], childrenIds: [joseph.id] })
        .where(eq(familyLineageTable.id, mathias.id));
      await db.update(familyLineageTable)
        .set({ spouseIds: [mathias.id], childrenIds: [joseph.id] })
        .where(eq(familyLineageTable.id, miriam.id));
      await db.update(familyLineageTable)
        .set({ parentIds: [mathias.id, miriam.id] })
        .where(eq(familyLineageTable.id, joseph.id));
    }

    const forumCount = await db.select().from(forumPostsTable).limit(1);
    if (forumCount.length === 0) {
      await db.insert(forumPostsTable).values([
        {
          title: "Welcome to the Mathias El Tribe Community Forum",
          body: "This is our community space to connect, share announcements, ask questions, and discuss matters affecting our tribal family. All members are encouraged to participate respectfully. The Tribal Office will post official announcements here. May our connections grow as strong as the roots of our ancestors.",
          category: "Announcements",
          authorName: "Tribal Office",
          pinned: true,
          replyCount: 0,
        },
        {
          title: "Understanding Your ICWA Rights — Community Discussion",
          body: "The Indian Child Welfare Act protects our children and families. If you or someone you know has been contacted by state child welfare services, please reach out to the Tribal Office immediately. We have designated counsel who can intervene in proceedings to assert ICWA protections. Time is critical — we must be notified within the first 24 hours whenever possible.",
          category: "ICWA",
          authorName: "Chief Justice Office",
          pinned: true,
          replyCount: 0,
        },
        {
          title: "Annual Gathering Planning — Share Your Ideas",
          body: "We are beginning early planning for our annual tribal gathering. This year we want more community input on location, schedule, and cultural programming. Please share your ideas, memories from past gatherings, and any skills or resources you'd like to contribute. Our cultural traditions strengthen us as a people.",
          category: "Culture",
          authorName: "Community Council",
          pinned: false,
          replyCount: 0,
        },
        {
          title: "Federal Trust Responsibility — Know Your Rights",
          body: "As members of a federally recognized tribe, we are entitled to the full federal trust responsibility. This includes rights to health care through IHS, educational support through BIE programs, and protection of our trust lands and resources. If any federal agency is denying you services, please document it and contact the office. We will assert your rights.",
          category: "Legal",
          authorName: "Legal Department",
          pinned: false,
          replyCount: 0,
        },
        {
          title: "Youth Scholarship Fund — Applications Open",
          body: "The Mathias El Tribe is accepting applications for educational scholarships for tribal youth pursuing higher education. Priority is given to members enrolled in fields that will benefit the tribe — law, medicine, environmental science, social work, and education. Contact the office for the application form.",
          category: "Youth",
          authorName: "Tribal Office",
          pinned: false,
          replyCount: 0,
        },
      ]);
    }

    seeded = true;
    logger.info("Community seed complete.");
  } catch (err) {
    logger.error({ err }, "Community seeding failed");
  }
}
