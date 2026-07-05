import { SimplyurPopularPlans } from "@/components/simplyur/SimplyurPopularPlans";
import { SimplyurHero } from "@/components/simplyur/SimplyurHero";
import { SimplyurReviewsSection, SimplyurWhySection } from "@/components/simplyur/SimplyurHomeSections";

export default function SimplyurHomePage() {
  return (
    <>
      <SimplyurHero />
      <main className="pb-12 pt-2">
        <SimplyurPopularPlans />
        <div className="mt-14 lg:mt-20">
          <SimplyurWhySection />
        </div>
        <SimplyurReviewsSection />
      </main>
    </>
  );
}
