import React from "react";

interface BlogSignupSectionProps {
  title: string;
  subtitle: string;
  buttonText: string;
}

export function BlogSignupSection({ title, subtitle, buttonText }: BlogSignupSectionProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, this would submit to a newsletter service
    console.log("Form submitted");
  };

  return (
    <section className="py-16 bg-gradient-to-br from-blue-950/50 to-neutral-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl p-8 md:p-12 bg-neutral-900 overflow-hidden">
          {/* Decorative dot grid background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" 
              style={{
                backgroundImage: "radial-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}>
            </div>
          </div>
          
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {title}
            </h2>
            <p className="text-gray-300 mb-8">
              {subtitle}
            </p>
            
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-grow px-4 py-3 rounded-lg bg-neutral-800 text-white border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                required
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-violet-700 transition-all shadow-lg hover:shadow-blue-500/25"
              >
                {buttonText}
              </button>
            </form>
            
            <p className="text-gray-400 text-xs mt-4">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
          
          {/* Decorative glowing orb */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl"></div>
        </div>
      </div>
    </section>
  );
} 