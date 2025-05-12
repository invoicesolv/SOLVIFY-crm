"use client";

import { useParams } from "next/navigation";
import { NavBarDemo } from "@/components/ui/navbar-demo";
import { Footer } from "@/components/ui/landing-sections";
import { BlogSignupSection } from "@/components/ui/blog-signup-section";
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function SwedishBlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  // In a real application, you would fetch the actual blog post data based on the slug
  // This is a simplified example with hardcoded data for Swedish
  const post = {
    title: "5 sätt CRM-program kan förbättra din försäljningsprestation",
    date: "15 oktober 2023",
    readTime: "8 min läsning",
    category: "Försäljning",
    content: `
      <p class="text-lg mb-6 text-white">Ett väl implementerat CRM-system kan revolutionera hur ditt säljteam arbetar, vilket leder till effektivare processer, bättre kundinsikter och i slutändan högre intäkter. Låt oss utforska de fem viktigaste sätten som CRM kan förbättra din försäljningsprestation.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">1. Centraliserad kundinformation</h2>
      <p class="mb-6 text-white">När all din kunddata lagras i ett centraliserat system kan ditt säljteam snabbt komma åt kompletta kundprofiler, inklusive kontaktinformation, köphistorik, kommunikationsuppgifter och eventuella utestående ärenden. Denna heltäckande vy hjälper säljrepresentanter att personalisera sin approach till varje kunds specifika behov och historia.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">2. Effektiviserad säljprocess</h2>
      <p class="mb-6 text-white">Ett CRM organiserar din säljpipeline, vilket gör det enkelt att spåra potentiella kunder från första kontakt till avslutad affär. Genom att tydligt definiera varje steg i säljprocessen i ditt CRM kan ditt team följa en systematisk approach, säkerställa att inga möjligheter faller mellan stolarna och hjälpa chefer att identifiera flaskhalsar i säljtratten.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">3. Förbättrat teamsamarbete</h2>
      <p class="mb-6 text-white">Moderna CRM-system som Solvify CRM underlättar sömlöst samarbete mellan teammedlemmar. Detta är särskilt värdefullt när flera personer interagerar med samma kund. Alla kan se de senaste anteckningarna, konversationerna och aktiviteterna, vilket säkerställer konsekvens i kundinteraktioner och förhindrar dubbelarbete.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">4. Datadriven beslutsfattning</h2>
      <p class="mb-6 text-white">Rapporteringsfunktionerna i CRM-programvara ger värdefulla insikter om försäljningsprestanda, kundbeteende och marknadstrender. Du kan analysera vilka produkter som säljer bäst, vilka säljtekniker som är mest effektiva och var det finns utrymme för förbättring. Dessa insikter möjliggör informerade beslut baserade på hårda data snarare än gissningar.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">5. Automatiserad uppföljning och uppgifter</h2>
      <p class="mb-6 text-white">Att automatisera rutinuppgifter och uppföljningar säkerställer att ingen möjlighet glöms bort. Ditt CRM kan påminna säljrepresentanter om att kontakta en potentiell kund, följa upp ett förslag eller höra av sig till en kund efter ett köp. Denna automatisering håller din säljprocess igång effektivt och konsekvent.</p>
      
      <h2 class="text-2xl font-bold text-white mt-12 mb-4">Implementeringstips för framgång</h2>
      <p class="mb-6 text-white">För att få ut det mesta av din CRM-investering, se till att ordentligt utbilda ditt team i att använda systemet, sätt tydliga förväntningar på hur och när kundernas information ska uppdateras, och granska regelbundet dina CRM-processer för att identifiera möjligheter till förbättring.</p>
    `,
    author: {
      name: "Alex Johnson",
      avatar: "/blog/authors/alex-johnson.jpg",
      bio: "Försäljningsstrateg på Solvify CRM"
    },
    image: "/blog/sales-performance.jpg",
    relatedPosts: [
      {
        title: "Den ultimata guiden till kundatahantering",
        slug: "ultimate-guide-customer-data-management",
        image: "/blog/data-management.jpg"
      },
      {
        title: "Automatisera ditt arbetsflöde med Solvify CRM",
        slug: "automating-workflow-solvify-crm",
        image: "/blog/automation.jpg"
      }
    ]
  };
  
  return (
    <main className="bg-neutral-950 min-h-screen text-white">
      <NavBarDemo lang="sv" />
      
      <article className="pt-12 pb-24 text-white">
        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl mb-12">
          <div className="text-sm text-blue-400 mb-2">
            <Link href="/blog/sv" className="hover:underline">
              Blogg
            </Link>
            {" / "}
            <span>{post.category}</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            {post.title}
          </h1>
          
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
              <Image 
                src={post.author.avatar} 
                alt={post.author.name} 
                width={40} 
                height={40} 
              />
            </div>
            <div>
              <div className="text-white font-medium">{post.author.name}</div>
              <div className="text-sm text-gray-400">{post.date} · {post.readTime}</div>
            </div>
          </div>
          
          <div className="relative w-full h-[400px] rounded-xl overflow-hidden mb-12">
            <Image
              src={post.image}
              alt={post.title}
              layout="fill"
              objectFit="cover"
            />
          </div>
        </header>
        
        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div 
            className="prose prose-lg prose-invert max-w-none text-white blog-content
              prose-headings:text-white prose-headings:font-bold
              prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 
              prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-4 prose-h2:mt-8
              prose-h3:text-xl prose-h3:font-bold prose-h3:mb-4 prose-h3:mt-6
              prose-p:text-white prose-p:my-4 prose-p:opacity-90
              prose-li:text-white prose-li:opacity-90
              prose-strong:text-white prose-strong:font-bold
              prose-a:text-blue-400 prose-a:hover:underline
              first-letter:text-4xl first-letter:font-bold first-letter:text-blue-400"
            dangerouslySetInnerHTML={{ __html: post.content }} 
          />
          
          {/* Author bio */}
          <div className="mt-16 p-6 bg-neutral-900 rounded-xl">
            <div className="flex items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
                <Image 
                  src={post.author.avatar} 
                  alt={post.author.name} 
                  width={64} 
                  height={64} 
                />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{post.author.name}</div>
                <div className="text-gray-400">{post.author.bio}</div>
              </div>
            </div>
          </div>
        </div>
      </article>
      
      {/* Related posts */}
      <section className="bg-neutral-950 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Relaterade artiklar</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {post.relatedPosts.map((relatedPost, index) => (
              <Link href={`/blog/sv/${relatedPost.slug}`} key={index} className="group">
                <div className="rounded-xl overflow-hidden bg-neutral-900 h-full">
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={relatedPost.image}
                      alt={relatedPost.title}
                      layout="fill"
                      objectFit="cover"
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {relatedPost.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      <BlogSignupSection
        title="Få de senaste CRM-insikterna direkt till din inkorg"
        subtitle="Prenumerera på vårt nyhetsbrev för exklusiva tips och strategier som hjälper ditt företag att växa"
        buttonText="Prenumerera"
      />
      
      <Footer />
    </main>
  );
} 