import React, { useState } from "react";

interface BlogSignupSectionProps {
  title: string;
  subtitle: string;
  buttonText: string;
}

export function BlogSignupSection({ title, subtitle, buttonText }: BlogSignupSectionProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Submit to the newsletter API endpoint
      const response = await fetch('/api/newsletter-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setEmail('');
      } else {
        setError(data.error || 'Failed to subscribe. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting newsletter signup:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-gradient-to-br from-blue-950/50 to-neutral-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl p-8 md:p-12 bg-background overflow-hidden">
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
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-gray-300 mb-8">
              {subtitle}
            </p>
            
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-grow px-4 py-3 rounded-lg bg-background text-foreground border border-border dark:border-border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                required
                disabled={loading || success}
              />
              <button
                type="submit"
                disabled={loading || success}
                className={`px-6 py-3 text-foreground font-medium rounded-lg transition-all shadow-lg ${
                  success 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 hover:shadow-blue-500/25'
                }`}
              >
                {loading ? 'Subscribing...' : success ? 'Subscribed!' : buttonText}
              </button>
            </form>
            
            {error && (
              <p className="text-red-400 text-sm mt-4">
                {error}
              </p>
            )}
            
            {success && (
              <p className="text-green-400 text-sm mt-4">
                Thank you for subscribing!
              </p>
            )}
            
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