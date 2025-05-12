import BlogPublishingTester from '@/components/BlogPublishingTester';

export default function BlogTesterPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Blog Publishing Diagnostics</h1>
        <p className="text-gray-600">
          Use this tool to diagnose issues with blog publishing and test API connectivity.
        </p>
      </div>
      
      <BlogPublishingTester />
    </div>
  );
} 