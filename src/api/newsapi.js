/**
 * NEWSAPI MODULE
 * Fetches and processes macro/news context
 * 
 * CONSTRAINTS:
 * - Must accept env parameter for secrets
 * - Must wrap ALL fetch in try/catch
 * - Must return null on failure (never throw)
 * - Must return minimal, analysis-ready data
 */

/**
 * Fetch latest macro/news sentiment
 * @param {Object} env - Cloudflare environment with secrets
 * @returns {Object|null} Structured news data or null
 */
export async function fetchNewsSentiment(env) {
  try {
    const apiKey = env.NEWSAPI_KEY;
    if (!apiKey) {
      console.warn('NEWSAPI_KEY not configured');
      return null;
    }
    
    // Query parameters focused on macro/business news
    const params = new URLSearchParams({
      q: 'economy OR federal reserve OR inflation OR GDP OR markets',
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 20,
      apiKey: apiKey
    });
    
    const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
    
    if (!response.ok) {
      console.warn(`NewsAPI returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Extract and structure relevant data
    return structureNewsData(data);
    
  } catch (error) {
    console.error('NewsAPI fetch failed:', error.message);
    return null; // Graceful degradation
  }
}

/**
 * Structure raw API response into analysis-ready format
 */
function structureNewsData(rawData) {
  if (!rawData.articles || rawData.articles.length === 0) {
    return null;
  }
  
  const articles = rawData.articles.slice(0, 10); // Top 10 only
  
  // Extract key themes and sentiment indicators
  const themes = extractThemes(articles);
  const recentHeadlines = articles.map(a => ({
    title: a.title,
    source: a.source.name,
    publishedAt: a.publishedAt,
    url: a.url
  }));
  
  return {
    articleCount: articles.length,
    themes: themes,
    headlines: recentHeadlines,
    timestamp: new Date().toISOString()
  };
}

/**
 * Extract dominant themes from articles
 */
function extractThemes(articles) {
  // Simple keyword-based theme extraction
  const themeKeywords = {
    'monetary_policy': ['fed', 'federal reserve', 'powell', 'interest rates', 'hawkish', 'dovish', 'policy'],
    'inflation': ['inflation', 'cpi', 'prices', 'pce', 'deflation'],
    'growth': ['gdp', 'growth', 'recession', 'expansion', 'contraction'],
    'employment': ['jobs', 'unemployment', 'payrolls', 'labor', 'wages'],
    'markets': ['stocks', 'equities', 'bonds', 'yields', 'volatility']
  };
  
  const themeCounts = {};
  
  articles.forEach(article => {
    const text = (article.title + ' ' + (article.description || '')).toLowerCase();
    
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some(kw => text.includes(kw))) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    });
  });
  
  // Return themes sorted by frequency
  return Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3) // Top 3 themes
    .map(([theme, count]) => theme);
}
