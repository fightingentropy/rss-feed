export interface FeedMeta {
  id: string
  title: string
  url: string
}

export const POPULAR_FEEDS: FeedMeta[] = [
  { id: 'bloomberg', title: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { id: 'reuters', title: 'Reuters', url: 'https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen' },
  {
    id: 'the-information',
    title: 'The Information',
    url: 'https://news.google.com/rss/search?q=site%3Atheinformation.com&hl=en-US&gl=US&ceid=US%3Aen',
  },
  { id: 'apnews', title: 'AP News', url: 'https://news.google.com/rss/search?q=site%3Aapnews.com&hl=en-US&gl=US&ceid=US%3Aen' },
  { id: 'ft', title: 'Financial Times', url: 'https://news.google.com/rss/search?q=site%3Aft.com&hl=en-US&gl=US&ceid=US%3Aen' },
  { id: 'the-block', title: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { id: 'bbc', title: 'BBC News', url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { id: 'nytimes', title: 'NY Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { id: 'barrons', title: "Barron's Market", url: 'https://news.google.com/rss/search?q=site%3Abarrons.com+market&hl=en-US&gl=US&ceid=US%3Aen' },
  { id: 'hn', title: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { id: 'verge', title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'wired', title: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { id: 'techcrunch', title: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { id: 'engadget', title: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { id: 'ars', title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { id: 'lobsters', title: 'Lobsters', url: 'https://lobste.rs/rss' },
  { id: 'vanity-fair', title: 'Vanity Fair', url: 'https://www.vanityfair.com/feed/rss' },
  { id: 'new-yorker', title: 'The New Yorker', url: 'https://www.newyorker.com/feed/culture' },
  { id: 'the-atlantic', title: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
  { id: 'aeon', title: 'Aeon', url: 'https://aeon.co/feed.rss' },
]
