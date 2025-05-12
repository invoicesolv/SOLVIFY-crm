"use client";

import { NavBarDemo } from "@/components/ui/navbar-demo";
import { BlogHeader } from "@/components/ui/blog-header";
import { BlogPostList } from "@/components/ui/blog-post-list";
import { Footer } from "@/components/ui/landing-sections";
import { BlogSignupSection } from "@/components/ui/blog-signup-section";

export default function SwedishBlogPage() {
  return (
    <main className="bg-neutral-950 min-h-screen text-white">
      <NavBarDemo lang="sv" />
      <BlogHeader 
        title="Solvify CRM Blogg"
        subtitle="Experttips, guider och insikter för att förbättra dina kundrelationer och företagets effektivitet"
      />
      <BlogPostList lang="sv" />
      <BlogSignupSection
        title="Få de senaste CRM-insikterna direkt till din inkorg"
        subtitle="Prenumerera på vårt nyhetsbrev för exklusiva tips och strategier som hjälper ditt företag att växa"
        buttonText="Prenumerera"
      />
      <Footer />
    </main>
  );
} 