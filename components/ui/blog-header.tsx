import React from "react";

interface BlogHeaderProps {
  title: string;
  subtitle: string;
}

export function BlogHeader({ title, subtitle }: BlogHeaderProps) {
  return (
    <section className="relative w-full py-20 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-neutral-950/70 z-10"></div>
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40" 
        style={{ 
          backgroundImage: "url('/blog-header-bg.jpg')",
          backgroundBlendMode: "overlay",
          backgroundColor: "rgba(0,0,0,0.7)"
        }}
      ></div>
      
      {/* Animated dots overlay */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}>
        </div>
      </div>
      
      <div className="container relative z-20 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400 mb-4 tracking-tight">
          {title}
        </h1>
        <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto">
          {subtitle}
        </p>
      </div>
    </section>
  );
} 