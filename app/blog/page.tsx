"use client";

import { NavBarDemo } from "@/components/ui/navbar-demo";
import { BlogHeader } from "@/components/ui/blog-header";
import { BlogPostList } from "@/components/ui/blog-post-list";
import { Footer } from "@/components/ui/landing-sections";
import { BlogSignupSection } from "@/components/ui/blog-signup-section";

export default function BlogPage() {
  return (
    <main className="bg-neutral-950 min-h-screen text-white">
      <NavBarDemo lang="en" />
      <BlogHeader 
        title="Solvify CRM Blog"
        subtitle="Expert tips, guides, and insights for improving your customer relationships and business efficiency"
      />
      <BlogPostList lang="en" />
      <BlogSignupSection
        title="Get the latest CRM insights straight to your inbox"
        subtitle="Join our newsletter for exclusive tips and strategies to help your business grow"
        buttonText="Subscribe"
      />
      <Footer />
    </main>
  );
} 