export interface ContentSource {
  source_name: string;
  source_type: "person" | "channel" | "blog" | "platform" | "course_platform";
  source_url?: string;
}

// Default curated list of high-quality sources
export const DEFAULT_SOURCES: ContentSource[] = [
  // People
  { source_name: "Arpit Bhayani", source_type: "person", source_url: "https://arpitbhayani.me" },
  { source_name: "Martin Kleppmann", source_type: "person", source_url: "https://martin.kleppmann.com" },
  { source_name: "Alex Xu (ByteByteGo)", source_type: "person", source_url: "https://bytebytego.com" },

  // YouTube Channels
  { source_name: "ByteByteGo", source_type: "channel", source_url: "https://youtube.com/@ByteByteGo" },
  { source_name: "Hussein Nasser", source_type: "channel", source_url: "https://youtube.com/@haborris" },
  { source_name: "Fireship", source_type: "channel", source_url: "https://youtube.com/@Fireship" },
  { source_name: "ThePrimeagen", source_type: "channel", source_url: "https://youtube.com/@ThePrimeagen" },
  { source_name: "Theo - t3.gg", source_type: "channel", source_url: "https://youtube.com/@t3dotgg" },

  // Engineering Blogs
  { source_name: "Netflix Tech Blog", source_type: "blog", source_url: "https://netflixtechblog.com" },
  { source_name: "Uber Engineering", source_type: "blog", source_url: "https://eng.uber.com" },
  { source_name: "Meta Engineering", source_type: "blog", source_url: "https://engineering.fb.com" },
  { source_name: "Stripe Engineering", source_type: "blog", source_url: "https://stripe.com/blog/engineering" },
  { source_name: "Cloudflare Blog", source_type: "blog", source_url: "https://blog.cloudflare.com" },
  { source_name: "AWS Architecture Blog", source_type: "blog", source_url: "https://aws.amazon.com/blogs/architecture" },

  // Platforms
  { source_name: "dev.to", source_type: "platform", source_url: "https://dev.to" },
  { source_name: "HackerNews", source_type: "platform", source_url: "https://news.ycombinator.com" },
  { source_name: "LeetCode", source_type: "platform", source_url: "https://leetcode.com" },
  { source_name: "NeetCode", source_type: "platform", source_url: "https://neetcode.io" },

  // Course Platforms
  { source_name: "Educative", source_type: "course_platform", source_url: "https://educative.io" },
  { source_name: "Udemy", source_type: "course_platform", source_url: "https://udemy.com" },
  { source_name: "Coursera", source_type: "course_platform", source_url: "https://coursera.org" },
];
