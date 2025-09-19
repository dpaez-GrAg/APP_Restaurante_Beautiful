const HeroSkeleton = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background placeholder */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-restaurant-brown/80 via-restaurant-brown/50 to-transparent"></div>
      </div>

      {/* Hero Content Skeleton */}
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        {/* Title skeleton */}
        <div className="mb-6">
          <div className="h-16 md:h-20 bg-white/20 rounded-lg animate-pulse mb-4 mx-auto max-w-4xl"></div>
          <div className="h-12 md:h-16 bg-white/15 rounded-lg animate-pulse mx-auto max-w-3xl"></div>
        </div>

        {/* Subtitle skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-6 bg-white/15 rounded animate-pulse mx-auto max-w-2xl"></div>
          <div className="h-6 bg-white/15 rounded animate-pulse mx-auto max-w-xl"></div>
        </div>

        {/* Button skeleton */}
        <div className="h-14 w-48 bg-white/20 rounded-lg animate-pulse mx-auto"></div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSkeleton;
