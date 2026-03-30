#!/usr/bin/env node

/**
 * Brand Asset Scraper
 *
 * Extracts brand assets from websites for use in ad creation:
 * - Logo detection
 * - Images (photos, graphics, backgrounds)
 * - Videos and GIFs
 * - Brand colors (from CSS)
 * - Fonts
 *
 * Uses Playwright for reliable scraping of modern JS-heavy sites.
 *
 * Usage:
 *   node scrape-brand.js --url https://example.com --output public/brand/scraped/
 *   node scrape-brand.js --url https://example.com --depth 2 --types images,videos,logo
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Check for Playwright
let playwright;
try {
  playwright = require('playwright');
} catch {
  console.error('Error: Playwright is not installed.');
  console.error('Install it with: npm install playwright');
  console.error('Then install browsers: npx playwright install chromium');
  process.exit(1);
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
  maxDepth: 2,
  maxPages: 50,
  maxAssetSize: 100 * 1024 * 1024, // 100MB max per asset
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (compatible; BrandScraper/1.0; +https://github.com/anthropics/claude-code)',
  types: ['logo', 'images', 'videos', 'colors', 'fonts'],
  respectRobotsTxt: true,
  concurrency: 3,
  // Asset limits - prevent downloading too many files
  maxImages: 20,        // Max images to download (excluding logos)
  maxVideos: 5,         // Max videos to download
  minImageWidth: 200,   // Minimum image width (filter out tiny images)
  minImageHeight: 200,  // Minimum image height
  priorityOnly: false,  // Only download hero/featured/main images
};

// Common logo patterns
const LOGO_PATTERNS = [
  /logo/i,
  /brand/i,
  /icon/i,
  /favicon/i,
  /symbol/i,
];

// File extensions by type
const EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.avif'],
  videos: ['.mp4', '.webm', '.mov', '.avi', '.m4v', '.ogv'],
  fonts: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
};

// ============================================
// ARGUMENT PARSING
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    output: 'public/brand/scraped',
    depth: DEFAULT_CONFIG.maxDepth,
    maxPages: DEFAULT_CONFIG.maxPages,
    types: DEFAULT_CONFIG.types,
    skipRobots: false,
    dryRun: false,
    verbose: false,
    help: false,
    // Asset limits
    maxImages: DEFAULT_CONFIG.maxImages,
    maxVideos: DEFAULT_CONFIG.maxVideos,
    minImageWidth: DEFAULT_CONFIG.minImageWidth,
    minImageHeight: DEFAULT_CONFIG.minImageHeight,
    priorityOnly: DEFAULT_CONFIG.priorityOnly,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--url':
      case '-u':
        options.url = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.output = nextArg;
        i++;
        break;
      case '--depth':
      case '-d':
        options.depth = parseInt(nextArg, 10);
        i++;
        break;
      case '--max-pages':
        options.maxPages = parseInt(nextArg, 10);
        i++;
        break;
      case '--types':
      case '-t':
        options.types = nextArg.split(',').map(t => t.trim());
        i++;
        break;
      case '--skip-robots':
        options.skipRobots = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--max-images':
        options.maxImages = parseInt(nextArg, 10);
        i++;
        break;
      case '--max-videos':
        options.maxVideos = parseInt(nextArg, 10);
        i++;
        break;
      case '--min-image-size':
        const size = parseInt(nextArg, 10);
        options.minImageWidth = size;
        options.minImageHeight = size;
        i++;
        break;
      case '--priority-only':
        options.priorityOnly = true;
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Brand Asset Scraper - Extract brand assets from websites

Usage:
  node scrape-brand.js --url <website> [options]

Options:
  --url, -u        Target website URL (required)
  --output, -o     Output directory (default: public/brand/scraped)
  --depth, -d      Link follow depth (default: 2, 0 = single page)
  --max-pages      Maximum pages to crawl (default: 50)
  --types, -t      Asset types to extract (default: all)
                   Options: logo,images,videos,colors,fonts
  --skip-robots    Ignore robots.txt (not recommended)
  --dry-run        Show what would be downloaded without downloading
  --verbose, -v    Show detailed progress
  --help, -h       Show this help

Asset Limits (to avoid downloading too much):
  --max-images     Maximum images to download (default: 20)
  --max-videos     Maximum videos to download (default: 5)
  --min-image-size Minimum image dimensions in px (default: 200)
  --priority-only  Only download hero/featured/main images

Examples:
  # Scrape single page
  node scrape-brand.js --url https://example.com --depth 0

  # Full crawl with all assets
  node scrape-brand.js --url https://example.com --depth 2

  # Only images and videos
  node scrape-brand.js --url https://example.com --types images,videos

  # Focused crawl - only important assets
  node scrape-brand.js --url https://example.com --max-images 10 --priority-only

  # Dry run to preview
  node scrape-brand.js --url https://example.com --dry-run

Output Structure:
  public/brand/scraped/
    logo/
      favicon.png
      logo.svg
    images/
      hero-1.jpg
      product-1.png
    videos/
      promo.mp4
    brand-info.json     # Colors, fonts, metadata
    about-draft.md      # Auto-generated brand brief

Legal Notice:
  - Respects robots.txt by default
  - Only downloads from the specified domain
  - Use responsibly and respect website terms of service
`);
}

// ============================================
// ROBOTS.TXT PARSER
// ============================================

async function fetchRobotsTxt(baseUrl) {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;

  return new Promise((resolve) => {
    const client = robotsUrl.startsWith('https') ? https : http;

    client.get(robotsUrl, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null));
  });
}

function parseRobotsTxt(robotsTxt, userAgent = '*') {
  if (!robotsTxt) return { disallowed: [], crawlDelay: 0 };

  const lines = robotsTxt.split('\n');
  const disallowed = [];
  let crawlDelay = 0;
  let inWildcardBlock = false;

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    if (trimmed.startsWith('user-agent:')) {
      const agent = trimmed.replace('user-agent:', '').trim();
      // Only follow rules for User-Agent: * (wildcard), not specific bot names
      inWildcardBlock = agent === '*';
    } else if (inWildcardBlock) {
      if (trimmed.startsWith('disallow:')) {
        const path = line.trim().replace(/disallow:/i, '').trim();
        if (path) disallowed.push(path);
      } else if (trimmed.startsWith('crawl-delay:')) {
        crawlDelay = parseInt(trimmed.replace('crawl-delay:', '').trim(), 10) || 0;
      }
    }
  }

  return { disallowed, crawlDelay };
}

function isAllowedByRobots(url, robotsRules) {
  if (!robotsRules || robotsRules.disallowed.length === 0) return true;

  const urlPath = new URL(url).pathname;

  for (const disallowed of robotsRules.disallowed) {
    if (disallowed === '/') return false;
    if (urlPath.startsWith(disallowed)) return false;
    // Handle wildcard patterns
    if (disallowed.includes('*')) {
      const regex = new RegExp('^' + disallowed.replace(/\*/g, '.*'));
      if (regex.test(urlPath)) return false;
    }
  }

  return true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext.split('?')[0]; // Remove query params
  } catch {
    return '';
  }
}

function getAssetType(url, contentType = '') {
  const ext = getExtension(url);

  if (EXTENSIONS.images.includes(ext)) return 'images';
  if (EXTENSIONS.videos.includes(ext)) return 'videos';
  if (EXTENSIONS.fonts.includes(ext)) return 'fonts';

  // Check content type
  if (contentType.includes('image')) return 'images';
  if (contentType.includes('video')) return 'videos';
  if (contentType.includes('font')) return 'fonts';

  return null;
}

function isLikelyLogo(url, element = null) {
  const urlLower = url.toLowerCase();

  // Check URL patterns
  for (const pattern of LOGO_PATTERNS) {
    if (pattern.test(urlLower)) return true;
  }

  // Check element attributes if available
  if (element) {
    const alt = element.alt || '';
    const className = element.className || '';
    const id = element.id || '';

    for (const pattern of LOGO_PATTERNS) {
      if (pattern.test(alt) || pattern.test(className) || pattern.test(id)) {
        return true;
      }
    }
  }

  return false;
}

function sanitizeFilename(url) {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname);

    // Remove query params
    filename = filename.split('?')[0];

    // If no extension, try to get from URL
    if (!path.extname(filename)) {
      filename = filename + '.bin';
    }

    // Sanitize
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    return filename || 'asset_' + Date.now();
  } catch {
    return 'asset_' + Date.now();
  }
}

async function downloadFile(url, outputPath, maxSize = DEFAULT_CONFIG.maxAssetSize) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, {
      timeout: DEFAULT_CONFIG.timeout,
      headers: {
        'User-Agent': DEFAULT_CONFIG.userAgent,
      },
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).href;
        downloadFile(redirectUrl, outputPath, maxSize).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      // Check size from headers
      const contentLength = parseInt(response.headers['content-length'], 10);
      if (contentLength && contentLength > maxSize) {
        reject(new Error(`File too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB`));
        return;
      }

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const file = fs.createWriteStream(outputPath);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (downloadedSize > maxSize) {
          file.close();
          fs.unlinkSync(outputPath);
          reject(new Error(`File too large: ${(downloadedSize / 1024 / 1024).toFixed(1)}MB`));
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve({
          path: outputPath,
          size: downloadedSize,
          contentType: response.headers['content-type'],
        });
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// ============================================
// COLOR EXTRACTION
// ============================================

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function parseColor(color) {
  if (!color || color === 'transparent' || color === 'inherit') return null;

  // Hex
  if (color.startsWith('#')) {
    return color.toUpperCase();
  }

  // RGB/RGBA
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  }

  return null;
}

function isSignificantColor(hex) {
  if (!hex) return false;

  // Skip near-white, near-black, and common grays
  const skipColors = ['#FFFFFF', '#000000', '#F5F5F5', '#EEEEEE', '#E0E0E0', '#CCCCCC', '#999999', '#666666', '#333333'];
  if (skipColors.includes(hex.toUpperCase())) return false;

  return true;
}

// ============================================
// MAIN SCRAPER CLASS
// ============================================

class BrandScraper {
  constructor(options) {
    this.options = options;
    this.baseUrl = new URL(options.url);
    this.baseDomain = this.baseUrl.hostname;
    this.visited = new Set();
    this.queue = [];
    this.assets = {
      logo: [],
      images: [],
      videos: [],
      fonts: [],
    };
    this.colors = new Map();
    this.fontFamilies = new Set();
    this.metadata = {
      title: '',
      description: '',
      ogImage: '',
    };
    this.robotsRules = null;
  }

  async init() {
    // Fetch and parse robots.txt
    if (!this.options.skipRobots) {
      console.log('📋 Checking robots.txt...');
      const robotsTxt = await fetchRobotsTxt(this.baseUrl.origin);
      this.robotsRules = parseRobotsTxt(robotsTxt);

      if (this.robotsRules.disallowed.length > 0) {
        console.log(`   Found ${this.robotsRules.disallowed.length} disallowed paths`);
      }
      if (this.robotsRules.crawlDelay > 0) {
        console.log(`   Crawl delay: ${this.robotsRules.crawlDelay}s`);
      }
    }

    // Launch browser
    console.log('🚀 Launching browser...');
    this.browser = await playwright.chromium.launch({
      headless: true,
    });

    this.context = await this.browser.newContext({
      userAgent: DEFAULT_CONFIG.userAgent,
      viewport: { width: 1920, height: 1080 },
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  isAllowedUrl(url) {
    try {
      const urlObj = new URL(url);

      // Must be same domain
      if (urlObj.hostname !== this.baseDomain) {
        return false;
      }

      // Check robots.txt
      if (!isAllowedByRobots(url, this.robotsRules)) {
        return false;
      }

      // Skip common non-content paths
      const skipPaths = ['/cdn-cgi/', '/wp-admin/', '/admin/', '/.well-known/'];
      for (const skip of skipPaths) {
        if (urlObj.pathname.includes(skip)) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async scrapePage(url, depth = 0) {
    if (this.visited.has(url)) return;
    if (this.visited.size >= this.options.maxPages) return;
    if (!this.isAllowedUrl(url)) return;

    this.visited.add(url);

    if (this.options.verbose) {
      console.log(`\n📄 [${this.visited.size}/${this.options.maxPages}] ${url}`);
    } else {
      process.stdout.write(`\r🔍 Scanning pages: ${this.visited.size}/${this.options.maxPages}`);
    }

    const page = await this.context.newPage();

    // Intercept requests to capture assets
    const capturedAssets = [];
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const requestUrl = request.url();

      // Capture asset URLs
      if (['image', 'media', 'font'].includes(resourceType)) {
        capturedAssets.push({
          url: requestUrl,
          type: resourceType,
        });
      }

      await route.continue();
    });

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: DEFAULT_CONFIG.timeout,
      });

      // Wait for dynamic content
      await page.waitForTimeout(1000);

      // Extract metadata (only from first page)
      if (this.visited.size === 1) {
        await this.extractMetadata(page);
      }

      // Extract colors from CSS
      if (this.options.types.includes('colors')) {
        await this.extractColors(page);
      }

      // Extract fonts
      if (this.options.types.includes('fonts')) {
        await this.extractFonts(page);
      }

      // Extract images from DOM
      if (this.options.types.includes('images') || this.options.types.includes('logo')) {
        await this.extractImages(page);
      }

      // Extract videos
      if (this.options.types.includes('videos')) {
        await this.extractVideos(page);
      }

      // Process captured assets from network
      for (const asset of capturedAssets) {
        this.addAsset(asset.url, asset.type === 'font' ? 'fonts' : asset.type === 'media' ? 'videos' : 'images');
      }

      // Find links to follow
      if (depth < this.options.depth) {
        const links = await page.$$eval('a[href]', (anchors) =>
          anchors.map(a => a.href).filter(href => href && !href.startsWith('javascript:'))
        );

        for (const link of links) {
          if (this.isAllowedUrl(link) && !this.visited.has(link)) {
            this.queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

    } catch (error) {
      if (this.options.verbose) {
        console.log(`   ⚠️ Error: ${error.message}`);
      }
    } finally {
      await page.close();
    }

    // Respect crawl delay
    if (this.robotsRules?.crawlDelay > 0) {
      await new Promise(r => setTimeout(r, this.robotsRules.crawlDelay * 1000));
    }
  }

  async extractMetadata(page) {
    try {
      this.metadata.title = await page.title() || '';

      this.metadata.description = await page.$eval(
        'meta[name="description"]',
        el => el.content
      ).catch(() => '');

      this.metadata.ogImage = await page.$eval(
        'meta[property="og:image"]',
        el => el.content
      ).catch(() => '');

      // Get favicon
      const favicon = await page.$eval(
        'link[rel*="icon"]',
        el => el.href
      ).catch(() => '');

      if (favicon) {
        this.addAsset(favicon, 'logo');
      }

      if (this.metadata.ogImage) {
        this.addAsset(this.metadata.ogImage, 'logo');
      }
    } catch {
      // Ignore metadata extraction errors
    }
  }

  async extractColors(page) {
    try {
      const colors = await page.evaluate(() => {
        const found = [];

        // Get CSS custom properties
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        const cssVars = Array.from(document.styleSheets)
          .flatMap(sheet => {
            try {
              return Array.from(sheet.cssRules);
            } catch {
              return [];
            }
          })
          .filter(rule => rule.cssText?.includes('--'))
          .flatMap(rule => {
            const matches = rule.cssText.match(/--[\w-]+:\s*#[0-9a-fA-F]{3,8}/g) || [];
            return matches.map(m => m.split(':')[1]?.trim());
          })
          .filter(Boolean);

        found.push(...cssVars);

        // Sample colors from key elements
        const selectors = [
          'header', 'nav', 'footer',
          'h1', 'h2', 'h3',
          'a', 'button',
          '.btn', '.button', '.cta',
          '[class*="primary"]', '[class*="brand"]',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const computed = getComputedStyle(el);
            found.push(computed.color);
            found.push(computed.backgroundColor);
            found.push(computed.borderColor);
          });
        }

        return found;
      });

      for (const color of colors) {
        const hex = parseColor(color);
        if (hex && isSignificantColor(hex)) {
          const count = this.colors.get(hex) || 0;
          this.colors.set(hex, count + 1);
        }
      }
    } catch {
      // Ignore color extraction errors
    }
  }

  async extractFonts(page) {
    try {
      const fonts = await page.evaluate(() => {
        const found = new Set();

        // From computed styles
        const elements = document.querySelectorAll('h1, h2, h3, p, a, button, span');
        elements.forEach(el => {
          const fontFamily = getComputedStyle(el).fontFamily;
          if (fontFamily) {
            // Extract first font family
            const primary = fontFamily.split(',')[0].replace(/["']/g, '').trim();
            if (primary && !primary.includes('system') && !primary.includes('serif') && !primary.includes('sans')) {
              found.add(primary);
            }
          }
        });

        // From Google Fonts links
        document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
          const match = link.href.match(/family=([^:&]+)/);
          if (match) {
            found.add(match[1].replace(/\+/g, ' '));
          }
        });

        return Array.from(found);
      });

      fonts.forEach(font => this.fontFamilies.add(font));
    } catch {
      // Ignore font extraction errors
    }
  }

  async extractImages(page) {
    try {
      const minW = this.options.minImageWidth;
      const minH = this.options.minImageHeight;
      const priorityOnly = this.options.priorityOnly;

      const images = await page.$$eval('img', (imgs) =>
        imgs.map(img => {
          // Get parent element info for priority detection
          const parent = img.parentElement;
          const grandparent = parent?.parentElement;
          const section = img.closest('section, header, [class*="hero"], [class*="banner"], [class*="feature"], [class*="main"]');

          return {
            src: img.src || img.dataset.src || img.dataset.lazySrc,
            alt: img.alt || '',
            className: img.className || '',
            id: img.id || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            // Priority indicators
            parentClass: parent?.className || '',
            grandparentClass: grandparent?.className || '',
            inPrioritySection: !!section,
            isPriority: !!(
              section ||
              img.className?.match(/hero|banner|feature|main|primary|product|showcase/i) ||
              img.alt?.match(/hero|banner|feature|main|product/i) ||
              parent?.className?.match(/hero|banner|feature|main|product/i)
            ),
          };
        })
      );

      // Filter by size
      let filteredImages = images.filter(img =>
        img.src && img.width >= minW && img.height >= minH
      );

      // If priorityOnly mode, filter to just priority images
      if (priorityOnly) {
        const priorityImages = filteredImages.filter(img => img.isPriority);
        // Fall back to largest images if no priority images found
        if (priorityImages.length > 0) {
          filteredImages = priorityImages;
        } else {
          // Sort by size and take largest
          filteredImages.sort((a, b) => (b.width * b.height) - (a.width * a.height));
          filteredImages = filteredImages.slice(0, 5);
        }
      }

      // Sort by priority and size (priority first, then largest)
      filteredImages.sort((a, b) => {
        if (a.isPriority && !b.isPriority) return -1;
        if (!a.isPriority && b.isPriority) return 1;
        return (b.width * b.height) - (a.width * a.height);
      });

      for (const img of filteredImages) {
        const isLogo = isLikelyLogo(img.src, img);
        this.addAsset(img.src, isLogo && this.options.types.includes('logo') ? 'logo' : 'images');
      }

      // Background images (only if not in priorityOnly mode or we have few images)
      if (!priorityOnly || filteredImages.length < 3) {
        const bgImages = await page.evaluate(() => {
          const found = [];
          // Only check hero/main sections for bg images
          const priorityElements = document.querySelectorAll(
            'header, section, [class*="hero"], [class*="banner"], [class*="feature"], [class*="main"]'
          );
          priorityElements.forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none') {
              const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
              if (match) found.push(match[1]);
            }
          });
          return found;
        });

        for (const url of bgImages) {
          if (url.startsWith('http') || url.startsWith('/')) {
            const fullUrl = url.startsWith('http') ? url : new URL(url, this.baseUrl).href;
            this.addAsset(fullUrl, 'images');
          }
        }
      }
    } catch {
      // Ignore image extraction errors
    }
  }

  async extractVideos(page) {
    try {
      // Video elements
      const videos = await page.$$eval('video source, video[src]', (els) =>
        els.map(el => el.src || el.getAttribute('src')).filter(Boolean)
      );

      for (const src of videos) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, this.baseUrl).href;
        this.addAsset(fullUrl, 'videos');
      }

      // Iframe embeds (YouTube, Vimeo)
      const iframes = await page.$$eval('iframe[src*="youtube"], iframe[src*="vimeo"]', (els) =>
        els.map(el => el.src)
      );

      for (const src of iframes) {
        this.addAsset(src, 'videos');
      }
    } catch {
      // Ignore video extraction errors
    }
  }

  addAsset(url, type) {
    if (!url || !type) return;

    try {
      // Normalize URL
      const fullUrl = url.startsWith('http') ? url : new URL(url, this.baseUrl).href;

      // Skip data URLs
      if (fullUrl.startsWith('data:')) return;

      // Check if already added
      const existing = this.assets[type] || [];
      if (existing.some(a => a.url === fullUrl)) return;

      // Check asset limits (logos are unlimited, they're usually few)
      if (type === 'images' && existing.length >= this.options.maxImages) {
        if (this.options.verbose) {
          console.log(`   ⚠️ Image limit reached (${this.options.maxImages}), skipping: ${fullUrl.substring(0, 50)}...`);
        }
        return;
      }
      if (type === 'videos' && existing.length >= this.options.maxVideos) {
        if (this.options.verbose) {
          console.log(`   ⚠️ Video limit reached (${this.options.maxVideos}), skipping: ${fullUrl.substring(0, 50)}...`);
        }
        return;
      }

      this.assets[type] = [...existing, { url: fullUrl, type }];
    } catch {
      // Invalid URL
    }
  }

  async crawl() {
    console.log(`\n🌐 Starting crawl of ${this.baseUrl.href}`);
    console.log(`   Depth: ${this.options.depth}`);
    console.log(`   Max pages: ${this.options.maxPages}`);
    console.log(`   Asset types: ${this.options.types.join(', ')}`);
    console.log(`   Max images: ${this.options.maxImages} | Max videos: ${this.options.maxVideos}`);
    console.log(`   Min image size: ${this.options.minImageWidth}x${this.options.minImageHeight}px`);
    if (this.options.priorityOnly) {
      console.log(`   Mode: Priority only (hero/featured images)`);
    }
    console.log('');

    // Start with base URL
    await this.scrapePage(this.options.url, 0);

    // Process queue
    while (this.queue.length > 0 && this.visited.size < this.options.maxPages) {
      const { url, depth } = this.queue.shift();
      await this.scrapePage(url, depth);
    }

    console.log('\n');
  }

  async downloadAssets() {
    const outputDir = this.options.output;

    console.log('\n📥 Downloading assets...');

    let totalDownloaded = 0;
    let totalSize = 0;

    for (const type of this.options.types) {
      const assets = this.assets[type] || [];
      if (assets.length === 0) continue;

      const typeDir = path.join(outputDir, type);

      console.log(`\n   ${type}: ${assets.length} found`);

      for (const asset of assets) {
        if (this.options.dryRun) {
          console.log(`   [DRY RUN] Would download: ${asset.url}`);
          continue;
        }

        const filename = sanitizeFilename(asset.url);
        const outputPath = path.join(typeDir, filename);

        // Skip if already exists
        if (fs.existsSync(outputPath)) {
          if (this.options.verbose) {
            console.log(`   ⏭️ Skipping (exists): ${filename}`);
          }
          continue;
        }

        try {
          process.stdout.write(`   ⬇️ ${filename}...`);
          const result = await downloadFile(asset.url, outputPath);
          const sizeMB = (result.size / 1024 / 1024).toFixed(2);
          console.log(` ✓ (${sizeMB}MB)`);
          totalDownloaded++;
          totalSize += result.size;
        } catch (error) {
          console.log(` ✗ (${error.message})`);
        }
      }
    }

    if (!this.options.dryRun) {
      console.log(`\n   Total: ${totalDownloaded} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  async saveBrandInfo() {
    const outputDir = this.options.output;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Sort colors by frequency
    const sortedColors = Array.from(this.colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color, count]) => ({ color, count }));

    const brandInfo = {
      url: this.options.url,
      scrapedAt: new Date().toISOString(),
      pagesVisited: this.visited.size,
      metadata: this.metadata,
      colors: {
        primary: sortedColors[0]?.color || null,
        secondary: sortedColors[1]?.color || null,
        all: sortedColors,
      },
      fonts: Array.from(this.fontFamilies),
      assets: {
        logo: this.assets.logo?.length || 0,
        images: this.assets.images?.length || 0,
        videos: this.assets.videos?.length || 0,
        fonts: this.assets.fonts?.length || 0,
      },
    };

    // Save brand-info.json
    const infoPath = path.join(outputDir, 'brand-info.json');
    fs.writeFileSync(infoPath, JSON.stringify(brandInfo, null, 2));
    console.log(`\n📄 Saved: ${infoPath}`);

    // Generate about-draft.md
    const aboutDraft = `# ${this.metadata.title || 'Brand Name'}

## About
${this.metadata.description || '[Add brand description here]'}

## Source
- Website: ${this.options.url}
- Scraped: ${new Date().toISOString()}

## Brand Colors
${sortedColors.slice(0, 5).map(c => `- \`${c.color}\``).join('\n') || '- [No colors detected]'}

## Fonts
${Array.from(this.fontFamilies).map(f => `- ${f}`).join('\n') || '- [No fonts detected]'}

## Assets Collected
- Logos: ${this.assets.logo?.length || 0}
- Images: ${this.assets.images?.length || 0}
- Videos: ${this.assets.videos?.length || 0}

---
*Auto-generated by scrape-brand.js - Review and customize before use*
`;

    const aboutPath = path.join(outputDir, 'about-draft.md');
    fs.writeFileSync(aboutPath, aboutDraft);
    console.log(`📄 Saved: ${aboutPath}`);

    return brandInfo;
  }

  printSummary() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 SCRAPE SUMMARY');
    console.log('═'.repeat(50));

    console.log(`\n🌐 URL: ${this.options.url}`);
    console.log(`📄 Pages visited: ${this.visited.size}`);

    console.log('\n📦 Assets found:');
    console.log(`   Logo candidates: ${this.assets.logo?.length || 0}`);
    console.log(`   Images: ${this.assets.images?.length || 0}`);
    console.log(`   Videos: ${this.assets.videos?.length || 0}`);
    console.log(`   Fonts: ${this.assets.fonts?.length || 0}`);

    console.log('\n🎨 Top colors:');
    const sortedColors = Array.from(this.colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [color, count] of sortedColors) {
      console.log(`   ${color} (${count} occurrences)`);
    }

    console.log('\n✏️ Fonts detected:');
    for (const font of Array.from(this.fontFamilies).slice(0, 5)) {
      console.log(`   ${font}`);
    }

    console.log('\n' + '═'.repeat(50));
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.url) {
    console.error('Error: --url is required');
    printHelp();
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(options.url);
  } catch {
    console.error('Error: Invalid URL');
    process.exit(1);
  }

  // User consent
  console.log('\n⚠️  LEGAL NOTICE');
  console.log('─'.repeat(40));
  console.log('This tool will download assets from the specified website.');
  console.log('Please ensure you have permission to use these assets.');
  console.log('Respect the website\'s terms of service and robots.txt.');
  console.log('');

  const scraper = new BrandScraper(options);

  try {
    await scraper.init();
    await scraper.crawl();
    scraper.printSummary();

    if (!options.dryRun) {
      await scraper.downloadAssets();
      await scraper.saveBrandInfo();
    } else {
      console.log('\n[DRY RUN] No files were downloaded.');
    }

    console.log('\n✅ Scrape complete!');
    console.log(`   Output: ${options.output}/`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

main();
