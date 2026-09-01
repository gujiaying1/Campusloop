import "dotenv/config";
import {
  ListingCategory,
  ListingCondition,
  ListingStatus,
  PrismaClient
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoStudent = await prisma.user.upsert({
    where: { email: "demo@massey.ac.nz" },
    update: { name: "Demo Student" },
    create: { name: "Demo Student", email: "demo@massey.ac.nz" }
  });

  const listings = [
    { title: "IKEA Study Desk", description: "Compact white study desk in good condition, ideal for a dorm room or home study space.", priceCents: 4000, category: ListingCategory.FURNITURE, condition: ListingCondition.GOOD },
    { title: "Desk Lamp", description: "Adjustable LED desk lamp with warm and cool light settings. Barely used.", priceCents: 2000, category: ListingCategory.HOME_LIVING, condition: ListingCondition.LIKE_NEW },
    { title: "Calculus Textbook", description: "Clear, well-kept introductory calculus textbook with a few helpful pencil notes.", priceCents: 1500, category: ListingCategory.TEXTBOOKS, condition: ListingCondition.GOOD }
  ];

  for (const listing of listings) {
    await prisma.listing.upsert({
      where: { sellerId_title: { sellerId: demoStudent.id, title: listing.title } },
      update: { ...listing, location: "Albany Campus", status: ListingStatus.AVAILABLE },
      create: { ...listing, location: "Albany Campus", status: ListingStatus.AVAILABLE, sellerId: demoStudent.id }
    });
  }
}

main()
  .then(() => console.log("Seeded CampusLoop demo data."))
  .catch((error: unknown) => { console.error("Failed to seed CampusLoop demo data.", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
