import { DashboardWithGlow } from "@/components/ui/dashboard-with-glow";

export default function DashboardWithGlowPage() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Dashboard with Glowing Effects</h1>
      <p className="text-muted-foreground mb-8">
        This dashboard demonstrates the glowing effect component integrated into dashboard cards.
        Move your cursor near the borders of the cards to see the glowing effect.
      </p>
      <DashboardWithGlow />
    </div>
  );
} 