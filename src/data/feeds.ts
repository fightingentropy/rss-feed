export interface FeedMeta {
  id: string
  title: string
  url: string
}

export const POPULAR_FEEDS: FeedMeta[] = [
  { id: 'hn', title: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { id: 'verge', title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'ars', title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'techcrunch', title: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { id: 'wired', title: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { id: 'bbc', title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { id: 'reuters', title: 'Reuters', url: 'https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen' },
  { id: 'ft', title: 'Financial Times', url: 'https://news.google.com/rss/search?q=site%3Aft.com&hl=en-US&gl=US&ceid=US%3Aen' },
  { id: 'engadget', title: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { id: 'lobsters', title: 'Lobsters', url: 'https://lobste.rs/rss' },
  { id: 'barrons', title: "Barron's Market", url: 'https://news.google.com/rss/search?q=site%3Abarrons.com+market&hl=en-US&gl=US&ceid=US%3Aen' },
]
