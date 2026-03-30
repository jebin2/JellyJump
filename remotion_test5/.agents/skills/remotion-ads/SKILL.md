---
name: remotion-ads
description: Instagram Reels & Carousel ad creation with Remotion. Use when creating vertical videos (9:16) for Instagram Reels/Stories or carousel posts (4:5). Includes safe zones, typography specs, voiceover integration, animations, and export settings.
---

# Remotion Ads - Instagram Video & Carousel Creation

Complete toolkit for creating professional Instagram Reels and Carousel ads with Remotion.

---

## Onboarding Flow (Start Here)

**IMPORTANT: Before proceeding with video creation, Claude MUST check if brand configuration exists and guide the user through setup if needed.**

### Communication Style

**Use emojis throughout all responses** to make the experience engaging and visual:
- Progress updates: ✅ ⏳ 🔄 ⚠️
- Assets: 🖼️ 🎬 🎵 📦
- Brand elements: 🎨 ✍️ 🏷️
- Actions: 🚀 💡 📝
- Categories: 📁 📂 🗂️

### URL Auto-Detection (Priority Check)

**CRITICAL: If the user provides a website URL at ANY point, immediately trigger the FULL website research workflow (Option C). Do NOT just fetch the homepage - run the complete crawl with `scrape-brand.js` to download assets, then analyze subpages.**

Example user inputs that trigger auto-research:
- "Here's my website: https://example.com"
- "https://mybrand.com"
- "Can you check out example.com"
- "My company is at www.example.com"

When URL detected → Skip to **Option C: Website Research Flow** and execute the FULL workflow automatically.

### Step 1: Check Brand Configuration Status

First, check if these files exist and have content:
- `public/brand/about.md` - Company/product info
- `public/brand/voice-guidelines.md` - Tone/messaging
- `rules/design-system.md` - Colors, fonts, assets

### Step 2: If Brand Config is Missing or Incomplete

If any required files are missing or empty, present the user with these options:

**Ask the user:**
> "I noticed your brand configuration isn't set up yet. This helps me create better videos tailored to your brand. How would you like to proceed?"

**Options to present:**

| Option | Description |
|--------|-------------|
| **A. Manual Setup** | "I'll tell you exactly what files to create and where to put your assets. You can fill them in at your own pace." |
| **B. Guided Q&A** | "I'll ask you questions one by one about your brand, product, and preferences. Then I'll create the config files for you." |
| **C. Website Research** 🌐 | "Give me your website URL and I'll research your brand, **crawl subpages**, **download all assets** (logos, images, videos), extract colors/fonts, and set up the configuration automatically." **(Recommended if you have a website - AUTO-TRIGGERED when URL provided)** |
| **D. Use Example** | "Start with the FocusFlow example files and customize them for your brand." |

**Note:** If user provides a URL, Option C runs automatically without asking.

### Option A: Manual Setup Flow

If user chooses manual setup, explain the folder structure and what goes where:

```
1. Create brand brief files:
   - public/brand/about.md (see template below)
   - public/brand/voice-guidelines.md (see template below)

2. Organize your assets:
   public/assets/
   ├── images/
   │   ├── icons/        → Small icons (64-256px)
   │   ├── backgrounds/  → Full backgrounds (1080×1920)
   │   ├── photos/       → Real photographs
   │   └── transparent/  → PNGs with transparency (logos, etc.)
   ├── videos/
   │   └── clips/        → Video clips for ads
   └── audio/
       └── music/        → Background music tracks

3. Run asset scanner: node tools/scan-assets.js
4. Fill descriptions in manifest.csv files
5. Copy rules/design-system-template.md → rules/design-system.md
6. Edit design-system.md with your brand colors & fonts
```

Provide the user with template content for about.md and voice-guidelines.md to fill out.

### Option B: Guided Q&A Flow

If user chooses Q&A, ask questions in this order:

**Phase 1: Company Basics**
1. What is your company/brand name?
2. What is your tagline or slogan?
3. What does your company do in one sentence?

**Phase 2: Product/Service**
4. What product or service are you advertising?
5. What problem does it solve for customers?
6. What makes it different from competitors?
7. What is the price point? (optional)

**Phase 3: Target Audience**
8. Who is your ideal customer? (age, occupation, interests)
9. What are their main pain points?
10. Where do they spend time online?

**Phase 4: Brand Personality**
11. How would you describe your brand's personality? (e.g., professional, playful, luxury, friendly)
12. What tone should the ad have? (e.g., energetic, calm, authoritative, casual)

**Phase 5: Visual Identity**
13. What are your brand colors? (primary, secondary, accent - provide hex codes if you have them)
14. What fonts do you use? (or should I suggest based on your brand personality?)
15. Do you have a logo file? If so, where is it located?

**Phase 6: Campaign Goals**
16. What is the goal of this ad? (awareness, sign-ups, sales, downloads)
17. What action should viewers take? (visit website, download app, sign up, etc.)
18. Do you have any social proof to include? (ratings, testimonials, awards)

After collecting answers, Claude should:
- Create `public/brand/about.md` with the collected info
- Create `public/brand/voice-guidelines.md` with tone/messaging based on answers
- Create `rules/design-system.md` with colors/fonts
- Create necessary asset folders
- Inform user what assets they still need to provide

### Option C: Website Research Flow (AUTO-TRIGGERED)

**IMPORTANT: When user provides a website URL, Claude MUST automatically perform the FULL website research workflow - not just fetch the homepage. This is the DEFAULT behavior for URLs.**

**Use emojis throughout responses for visual engagement: brand setup, progress updates, and summaries.**

If user provides a website URL:

1. **Initial Website Analysis** using WebFetch tool
   - Fetch the main page to understand the brand
   - Extract initial brand information (name, tagline, description)

2. **AUTOMATIC Full Website Crawl** - Run the brand scraper tool:
   ```bash
   node tools/scrape-brand.js --url <USER_URL> --depth 2 --types logo,images,videos,colors,fonts --max-images 15 --max-videos 3 --min-image-size 300 --output public/brand/scraped/
   ```

   This automatically:
   - Crawls up to 50 pages (depth 2)
   - Downloads logos (unlimited - usually few)
   - Downloads up to 15 best images (prioritizes hero/featured images)
   - Downloads up to 3 videos
   - Filters out small images (< 300px)
   - Extracts brand colors from CSS
   - Identifies fonts used
   - Saves everything to `public/brand/scraped/`

   **For more focused scraping (fewer assets):**
   ```bash
   node tools/scrape-brand.js --url <USER_URL> --depth 1 --max-images 10 --max-videos 2 --priority-only --output public/brand/scraped/
   ```

3. **AUTOMATIC Website Screenshots** - Capture visual references:
   ```bash
   node tools/capture-screenshots.js --url <USER_URL> --devices desktop,mobile --output public/brand/scraped/screenshots/
   ```

   Also capture key pages:
   ```bash
   node tools/capture-screenshots.js --url <USER_URL>/about --devices desktop --output public/brand/scraped/screenshots/
   node tools/capture-screenshots.js --url <USER_URL>/pricing --devices desktop --output public/brand/scraped/screenshots/
   ```

   This automatically:
   - 📸 Captures desktop (1920x1080) and mobile screenshots
   - 📱 Shows how the brand presents on different devices
   - 🎨 Provides visual reference for ad design
   - 💡 Useful for recreating website elements in ads

4. **Crawl Additional Key Pages** using WebFetch:
   - `/about`, `/about-us` - Company story, team, mission
   - `/pricing`, `/plans` - Pricing tiers, value props
   - `/features`, `/product` - Product details, benefits
   - `/testimonials`, `/reviews` - Social proof
   - `/contact` - Contact info, locations
   - Any other relevant subpages found during initial analysis

5. **Extract comprehensive brand information:**
   - Company name and tagline
   - Product/service description
   - Value propositions and USPs
   - Brand colors (from scraped CSS + visual analysis)
   - Font usage (from scraped fonts)
   - Tone of voice (from copy style across pages)
   - Target audience (inferred from content)
   - Social proof (testimonials, ratings, awards)
   - CTAs used on the site
   - Pricing information

6. **Review downloaded assets** from `public/brand/scraped/`:
   - Check `logo/` folder for brand logos
   - Check `images/` folder for usable images
   - Check `videos/` folder for video content
   - Check `screenshots/` folder for website screenshots (desktop + mobile)
   - Review `brand-info.json` for extracted colors/fonts
   - Review `about-draft.md` for auto-generated brand brief

7. **Generate config files:**
   - Create `public/brand/about.md` from extracted info
   - Create `public/brand/voice-guidelines.md` based on website tone
   - Create `rules/design-system.md` with extracted colors/fonts

8. **Present findings to user with emojis:**
   ```
   🎨 **Brand Research Complete!**

   📦 **Assets Downloaded:**
   - ✅ Logo found and saved
   - 🖼️ 15 images downloaded
   - 🎬 2 videos found
   - 📸 Website screenshots captured (desktop + mobile)

   📸 **Screenshots Captured:**
   - 🖥️ Desktop: homepage, about, pricing
   - 📱 Mobile: homepage

   🎨 **Brand Colors Extracted:**
   - Primary: #1a73e8
   - Secondary: #34a853
   - Accent: #ea4335

   ✍️ **Fonts Detected:**
   - Headings: Montserrat
   - Body: Open Sans

   📝 **Config Files Created:**
   - ✅ public/brand/about.md
   - ✅ public/brand/voice-guidelines.md
   - ✅ rules/design-system.md

   ⚠️ **Still Needed:**
   - High-res logo (if scraped version is low quality)
   - Product-specific screenshots
   ```

**Website Research Prompt Template:**
```
Analyze this website and extract:
1. Company name and tagline
2. What they do (product/service)
3. Key features and benefits
4. Target audience
5. Brand personality and tone
6. Color scheme (note any hex codes visible)
7. Social proof (testimonials, ratings)
8. Call-to-action style
```

**CRITICAL: Do NOT stop after just fetching the homepage. The full workflow includes:**
1. WebFetch for initial analysis
2. `scrape-brand.js` for automated asset crawling (logos, images, videos, colors, fonts)
   - Uses smart limits: max 15 images, max 3 videos, min 300px size
   - Prioritizes hero/featured/main images over decorative ones
3. `capture-screenshots.js` for website screenshots (desktop + mobile)
4. WebFetch for key subpages (/about, /pricing, /features, etc.)
5. Asset review and config file generation
6. Present summary with emojis

### Option D: Use Example Flow

If user wants to start from the example:

```bash
# Copy example brand files
cp .agents/skills/remotion-ads/examples/focusflow/brand-about.md public/brand/about.md
cp .agents/skills/remotion-ads/examples/focusflow/brand-voice.md public/brand/voice-guidelines.md

# Then edit these files to match your brand
```

Tell the user to edit the copied files with their own brand info.

### Step 3: Verify Setup Before Proceeding

Before creating any video, verify:
- [ ] `public/brand/about.md` exists and has content
- [ ] `public/brand/voice-guidelines.md` exists and has content
- [ ] `rules/design-system.md` exists with brand colors/fonts
- [ ] Logo file exists in `public/` folder
- [ ] At least some assets exist in `public/assets/` folders

If anything is still missing, inform the user what's needed before proceeding.

---

## Quick Setup

**Before creating any videos, configure your brand:**

1. **Fill out brand brief** (most important for Claude):
   - Edit `public/brand/about.md` - company, product, audience, visual identity
   - Edit `public/brand/voice-guidelines.md` - tone, phrases, script style
2. **Organize and describe assets:**
   - Place assets in `public/assets/{images,videos,audio}/` folders
   - Run `node tools/scan-assets.js` to populate manifests
   - Fill in descriptions/tags in `manifest.csv` files
3. Copy `rules/design-system-template.md` to `rules/design-system.md`
4. Fill in your brand colors, fonts, and asset paths
5. Generate backgrounds: `node scripts/generate-backgrounds.js`

See [rules/setup.md](rules/setup.md) for complete project setup.

### Example Project

Want to see the skill in action? Check out the **FocusFlow example**:

```bash
# View the example
ls .claude/skills/remotion-ads/examples/focusflow/

# Quick start - copy example brand files
cp .claude/skills/remotion-ads/examples/focusflow/brand-about.md public/brand/about.md
cp .claude/skills/remotion-ads/examples/focusflow/brand-voice.md public/brand/voice-guidelines.md
```

See [examples/focusflow/README.md](examples/focusflow/README.md) for full setup instructions.

---

## Rule Files

### Brand Brief (Start Here)

| File | Description |
|------|-------------|
| [public/brand/about.md](../../../public/brand/about.md) | Company overview, product, audience, visual identity, goals |
| [public/brand/voice-guidelines.md](../../../public/brand/voice-guidelines.md) | Tone, messaging, power words, script templates, voiceover prefs |

### Asset Manifests

| File | Description |
|------|-------------|
| [public/assets/images/manifest.csv](../../../public/assets/images/manifest.csv) | Image assets: photos, 3D, 2D, icons, backgrounds |
| [public/assets/videos/manifest.csv](../../../public/assets/videos/manifest.csv) | Video assets: clips, transparent overlays |
| [public/assets/audio/manifest.csv](../../../public/assets/audio/manifest.csv) | Audio assets: music, sound effects |

### Presets (Quick Configuration)

| File | Description |
|------|-------------|
| [presets/formats.json](presets/formats.json) | Platform formats: Instagram Reel, TikTok, YouTube Short, Carousel |
| [presets/pacing.json](presets/pacing.json) | Timing presets: slow, medium, fast, dramatic, snappy |
| [presets/styles.json](presets/styles.json) | Visual styles: minimal, bold, playful, professional, luxury, neon |
| [presets/templates.json](presets/templates.json) | Scene structures: problem-solution, testimonial, listicle, before-after |

### Example Project

| File | Description |
|------|-------------|
| [examples/focusflow/](examples/focusflow/) | Complete demo: brand brief, scenes, assets manifest, Remotion composition |

### Core Documentation

| File | Description |
|------|-------------|
| [rules/setup.md](rules/setup.md) | Initial project setup, dependencies, folder structure |
| [rules/design-system-template.md](rules/design-system-template.md) | Template for your brand colors, fonts, and assets |
| [rules/formats.md](rules/formats.md) | Instagram display formats (9:16, 4:5, 1:1) and crop zones |

### Video Creation

| File | Description |
|------|-------------|
| [rules/voiceover.md](rules/voiceover.md) | ElevenLabs integration, scene JSON, timing sync |
| [rules/captions.md](rules/captions.md) | Animated captions with word-level timing and highlighting |
| [rules/animations.md](rules/animations.md) | Spring configs, transitions, animation components |
| [rules/components.md](rules/components.md) | Reusable template components for scenes |

### Assets & Carousels

| File | Description |
|------|-------------|
| [rules/local-assets.md](rules/local-assets.md) | Backgrounds, icons, illustrations management |
| [rules/carousels.md](rules/carousels.md) | Instagram carousel design specs, batch rendering |

---

## Core Dimensions

### Instagram Reels (9:16)

| Property | Value |
|----------|-------|
| Canvas | 1080×1920px (9:16 aspect ratio) |
| Resolution | Minimum 720p, optimal 1080p |
| Format | MP4 (H.264 codec) with AAC audio |
| Frame Rate | 30 FPS |
| Duration | 15-60 seconds (15s recommended for ads) |

### Instagram Carousels (4:5)

| Property | Value |
|----------|-------|
| Canvas | 1080×1350px (4:5 aspect ratio) |
| Slides | 2-10 images per carousel |
| Format | PNG or JPEG |

---

## Safe Zones (Critical)

### Reels Safe Zone Map (1080×1920)

```
┌─────────────────────────────────────┐ 0px
│          TOP DANGER ZONE            │
│   (username, "Reels" branding, UI)  │
│         250px buffer                │
├─────────────────────────────────────┤ ~285px
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │      OPTIMAL CONTENT        │    │
│  │         ZONE                │    │
│  │                             │    │
│  │    880×1350px centered      │    │
│  │    (middle 60% of screen)   │    │
│  │                             │    │
│  │   Place logos, key text,    │    │
│  │   faces, CTAs here          │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│ ←80px                      120px→   │
├─────────────────────────────────────┤ ~1520px
│        BOTTOM DANGER ZONE           │
│  (captions, buttons, audio, CTA)    │
│         400px buffer                │
│     ⚠️ MOST CRITICAL ZONE ⚠️        │
└─────────────────────────────────────┘ 1920px
```

### Safe Zone Constants

```tsx
export const INSTAGRAM_REELS = {
  width: 1080,
  height: 1920,
  aspectRatio: "9:16",
  fps: 30,

  buffer: {
    top: 250,
    bottom: 400,
    left: 80,
    right: 120,
  },

  safeArea: {
    x: 80,
    y: 285,
    width: 880,
    height: 1235,
  },

  // Feed preview (4:5) crops
  feedPreview: {
    cropTop: 285,
    cropBottom: 285,
  },

  // Grid preview (1:1) crops
  gridPreview: {
    cropTop: 420,
    cropBottom: 420,
  },
};
```

See [rules/formats.md](rules/formats.md) for detailed format specifications.

---

## Brand Configuration

### Brand Brief (For Claude Context)

Before generating any video content, Claude reads these files to understand your brand:

**`public/brand/about.md`** - Contains:
- Company name, tagline, mission
- Product features and USP
- Target audience demographics
- Visual identity preferences
- Social proof and trust signals
- Content restrictions and compliance

**`public/brand/voice-guidelines.md`** - Contains:
- Tone of voice by context
- Power words and phrases to use/avoid
- Script templates (15s, 30s formats)
- Caption and voiceover preferences

### Design System Template

Create `rules/design-system.md` from the template:

```tsx
// TODO: Replace with your brand values
const COLORS = {
  primary: "#YOUR_PRIMARY_COLOR",
  secondary: "#YOUR_SECONDARY_COLOR",
  background: "#YOUR_BG_COLOR",
  foreground: "#YOUR_TEXT_COLOR",
  dark: "#YOUR_DARK_COLOR",
  accent: "#YOUR_ACCENT_COLOR",
};

// TODO: Import your brand fonts
import { loadFont } from "@remotion/google-fonts/YourHeadingFont";
import { loadFont as loadBodyFont } from "@remotion/google-fonts/YourBodyFont";

const { fontFamily: headingFont } = loadFont();
const { fontFamily: bodyFont } = loadBodyFont();

// TODO: Set your logo path
const LOGO_PATH = "your-logo.png";  // In public/ folder
```

See [rules/design-system-template.md](rules/design-system-template.md) for complete configuration.

---

## Presets (Quick Configuration)

Use presets to quickly configure video parameters. Claude reads these to understand your preferences.

### Format Presets (`presets/formats.json`)

| Format | Dimensions | Duration Options | Platform |
|--------|------------|------------------|----------|
| `instagram-reel` | 1080×1920 (9:16) | 15s, 30s, 60s | Instagram |
| `instagram-story` | 1080×1920 (9:16) | 15s | Instagram |
| `tiktok` | 1080×1920 (9:16) | 15s, 30s, 60s, 180s | TikTok |
| `youtube-short` | 1080×1920 (9:16) | 15s, 30s, 60s | YouTube |
| `instagram-carousel` | 1080×1350 (4:5) | 5-10 slides | Instagram |
| `linkedin-video` | 1080×1920 (9:16) | 30s, 60s, 120s | LinkedIn |

### Pacing Presets (`presets/pacing.json`)

| Pacing | Words/Sec | Transitions | Voice | Best For |
|--------|-----------|-------------|-------|----------|
| `slow` | 2.0 | Crossfade 0.8s | calm | Luxury, wellness, meditation |
| `medium` | 2.8 | Fade 0.4s | narrator | SaaS, e-commerce, most brands |
| `fast` | 3.5 | Cut 0.15s | salesperson | Gaming, youth, sales |
| `dramatic` | 2.3 | Fade-to-black | dramatic | Storytelling, emotional |
| `snappy` | 4.0 | Cut 0.05s | dramatic | TikTok, memes, hooks |

### Style Presets (`presets/styles.json`)

| Style | Colors | Typography | Best For |
|-------|--------|------------|----------|
| `minimal` | Light, high contrast | Bold sans-serif | Tech, SaaS, luxury |
| `bold` | Dark/vibrant | Extra bold, condensed | Sales, gaming, events |
| `playful` | Colorful, pastels | Rounded, friendly | Kids, food, casual apps |
| `professional` | Neutral, blue-heavy | Medium weight | B2B, finance, healthcare |
| `luxury` | Dark/cream, gold | Serif, elegant | Fashion, hotels, premium |
| `retro` | Warm, muted | Vintage display | Coffee, craft, nostalgia |
| `neon` | Dark + neon | Futuristic | Gaming, crypto, tech |
| `organic` | Earth tones | Organic, handwritten | Wellness, eco, natural |

### Template Presets (`presets/templates.json`)

| Template | Scenes | Structure | Best For |
|----------|--------|-----------|----------|
| `problem-solution` | 4 | Hook → Problem → Solution → CTA | Product launches, SaaS |
| `testimonial` | 4 | Hook → Testimonial → Benefits → CTA | E-commerce, fitness |
| `listicle` | 5 | Hook → Point 1 → Point 2 → Point 3 → CTA | Education, thought leadership |
| `before-after` | 4 | Before → Transition → After → CTA | Fitness, beauty, software |
| `educational` | 4 | Question → Explanation → Demo → CTA | B2B, courses |
| `announcement` | 4 | Teaser → Reveal → Highlights → CTA | Launches, events |
| `comparison` | 4 | Setup → Them → Us → CTA | Competitive markets |
| `story` | 5 | Setup → Conflict → Discovery → Resolution → CTA | Brand building, emotional |

### Using Presets

When asking Claude to create a video, specify your preferences:

```
Create a 30-second Instagram Reel using:
- Format: instagram-reel (30s)
- Pacing: medium
- Style: minimal
- Template: problem-solution
```

Claude will use these presets to configure timing, animations, voiceover, and scene structure.

---

## Ad Structure (4 Scenes)

### Recommended Scene Flow

| Scene | Purpose | Duration | Character |
|-------|---------|----------|-----------|
| **Scene 1: Hook** | Grab attention | 2-4s | `dramatic` |
| **Scene 2: Problem** | Establish pain point | 3-5s | `narrator` |
| **Scene 3: Solution** | Present answer | 3-5s | `expert` |
| **Scene 4: CTA** | Call to action | 2-4s | `calm` |

### Scene 1: Hook
- Large attention-grabbing icon (160-240px)
- Bold headline with keyword highlighted
- Empathetic subtitle
- Dark gradient background

### Scene 2: Problem
- Problem list with icons (55-75px)
- Staggered fade-in animation
- Optional section title
- Serious tone gradient

### Scene 3: Solution
- Large solution icon (140-180px)
- Solution highlight with accent color
- Reassuring subtitle
- Positive brand gradient

### Scene 4: CTA
- Brand logo prominently displayed
- Trust signals (ratings, badges)
- CTA button with arrow
- "Link in Bio" text
- Light background

---

## Voiceover Integration

### Quick Start

```bash
# Generate voiceover with timestamps
node tools/generate.js \
  --scenes remotion/instagram-ads/scenes/ad-example-scenes.json \
  --with-timestamps \
  --output-dir public/audio/instagram-ads/ad-example/

# With pronunciation dictionary for brand names
node tools/generate.js \
  --scenes remotion/instagram-ads/scenes/ad-example-scenes.json \
  --dictionary your-brand \
  --with-timestamps \
  --output-dir public/audio/instagram-ads/ad-example/
```

### Pronunciation Dictionaries

Create custom dictionaries in `dictionaries/` for correct brand name pronunciation:

```xml
<!-- dictionaries/your-brand.pls -->
<lexeme>
  <grapheme>YourBrand</grapheme>
  <alias>Jor Bränd</alias>
</lexeme>
```

See `dictionaries/template.pls` for full format.

### Scene JSON Format

```json
{
  "name": "ad-example",
  "voice": "YourVoiceName",
  "character": "narrator",
  "scenes": [
    {
      "id": "scene1",
      "text": "Hook text here.",
      "duration": 3.5,
      "character": "dramatic"
    },
    {
      "id": "scene2",
      "text": "Problem description.",
      "duration": 4.5
    },
    {
      "id": "scene3",
      "text": "Solution presentation.",
      "duration": 4.0,
      "character": "expert"
    },
    {
      "id": "scene4",
      "text": "Call to action. Brand Name.",
      "duration": 3.0,
      "character": "calm"
    }
  ]
}
```

### Character Presets

| Character | Style | Best For |
|-----------|-------|----------|
| `dramatic` | Intense, emotional | Hooks, problem statements |
| `narrator` | Professional, smooth | General content |
| `expert` | Authoritative | Solutions, legal content |
| `calm` | Soothing, reassuring | CTAs, trust-building |
| `salesperson` | Enthusiastic | Marketing, ads |

See [rules/voiceover.md](rules/voiceover.md) for complete integration guide.

---

## Captions

### TikTok-Style Captions

Generate word-level timestamps for animated captions:

```bash
node tools/generate.js \
  --scenes scenes.json \
  --with-timestamps \
  --output-dir public/audio/ad-example/
```

Key features:
- Word-by-word highlighting
- Page grouping (1-6 words per page)
- Entrance animations
- Text replacement (phonetic → display)

See [rules/captions.md](rules/captions.md) for implementation.

---

## Typography Specifications

### Font Sizes (1080×1920)

| Element | Size | Weight |
|---------|------|--------|
| Hero headline | 64-80px | 700 |
| Section headline | 52-64px | 600 |
| Body/subtitle | 44-52px | 500 |
| Bullet points | 40-48px | 500 |
| Captions | 48-56px | 400 |
| CTA button | 36-48px | 600 |
| Fine print | 24-28px | 400 |

### Text Formatting

```tsx
// High-contrast text (readable on any background)
const contrastTextStyle = {
  color: "#ffffff",
  textShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)",
};

// Highlighted word
<span style={{ color: COLORS.accent, fontWeight: 700 }}>
  keyword
</span>
```

---

## Animation Presets

### Spring Configurations

```tsx
// Smooth - professional, no bounce
const SPRING_SMOOTH = { damping: 200 };

// Quick - snappy transitions
const SPRING_QUICK = { damping: 15, stiffness: 100 };

// Bouncy - attention-grabbing
const SPRING_BOUNCY = { damping: 8, stiffness: 200 };
```

### Common Animations

| Animation | Use For |
|-----------|---------|
| Fade in + slide up | Text reveals |
| Scale pop | Icons, logos |
| Staggered list | Bullet points |
| Crossfade | Scene transitions |

See [rules/animations.md](rules/animations.md) for all animation patterns.

---

## Asset Structure

### New Organized Structure (Recommended)

```
public/
├── brand/                        # Brand brief (fill this first!)
│   ├── about.md                  # Company, product, audience
│   └── voice-guidelines.md       # Tone, messaging, scripts
│
├── assets/                       # All assets with CSV manifests
│   ├── images/
│   │   ├── manifest.csv          # Describes all images
│   │   ├── photos/               # Real photographs
│   │   ├── 3d/                   # 3D renders
│   │   ├── 2d-illustrations/     # Flat illustrations
│   │   ├── transparent/          # PNGs with transparency
│   │   ├── icons/                # Small icons (64-256px)
│   │   └── backgrounds/          # Full-size backgrounds
│   │
│   ├── videos/
│   │   ├── manifest.csv          # Describes all videos
│   │   ├── clips/                # Regular video clips
│   │   └── transparent/          # Alpha channel videos
│   │
│   └── audio/
│       ├── manifest.csv          # Describes all audio
│       ├── music/                # Background music tracks
│       ├── sfx/                  # Sound effects
│       └── voiceovers/           # Generated voiceovers
│
└── your-logo.png
```

### Asset Manifest CSV Format

Each manifest describes assets so Claude can suggest appropriate ones:

**Images (`public/assets/images/manifest.csv`):**
```csv
path,type,category,name,description,tags,width,height,transparent,mood,usage_notes
3d/product-hero.png,3d,product,Product Hero,Main 3D render,product hero,1080,1080,true,professional,Use in hook scene
icons/checkmark.png,icon,decorative,Checkmark,Green check icon,success done,256,256,true,positive,Use in benefit lists
```

**Videos (`public/assets/videos/manifest.csv`):**
```csv
path,type,category,name,description,tags,width,height,duration,fps,transparent,has_audio,mood,usage_notes
clips/demo.mp4,clip,product-demo,Product Demo,App walkthrough,demo ui,1080,1920,8.5,30,false,false,professional,Solution scene
```

**Audio (`public/assets/audio/manifest.csv`):**
```csv
path,type,category,name,description,tags,duration,bpm,key,mood,license,usage_notes
music/upbeat.mp3,music,background-music,Upbeat Track,Energetic background,corporate,30.0,120,C,upbeat,royalty-free,Fast-paced ads
sfx/whoosh.mp3,sfx,transition,Whoosh,Scene transition,whoosh swipe,0.5,,,energetic,royalty-free,Between scenes
```

### Scanning Assets

Automatically scan and populate manifests:

```bash
# Scan all asset types
node tools/scan-assets.js

# Scan specific types
node tools/scan-assets.js --images
node tools/scan-assets.js --videos
node tools/scan-assets.js --audio

# Preview what would be added (dry run)
node tools/scan-assets.js --dry-run
```

The scanner:
- Detects image dimensions (sips/ImageMagick)
- Detects video metadata (ffprobe)
- Detects audio duration (ffprobe)
- Infers type from folder structure
- Preserves existing descriptions when updating

### Legacy Structure (Still Supported)

```
public/
├── images/
│   └── instagram-ads/
│       ├── backgrounds/          # 1080×1920 or 1080×1350
│       ├── icons/                # 64-256px elements
│       ├── illustrations/        # 256-800px graphics
│       └── overlays/             # Transparent overlays
├── audio/
│   └── instagram-ads/
│       └── ad-example/           # Per-ad voiceover files
└── your-logo.png
```

See [rules/local-assets.md](rules/local-assets.md) for additional asset management.

---

## Export Settings

### Reels Export

```bash
npx remotion render AdExample out/reel.mp4 \
  --codec=h264 \
  --crf=18 \
  --audio-codec=aac \
  --audio-bitrate=192k
```

### Carousel Export

```bash
# Batch render all slides
for i in 1 2 3 4 5; do
  npx remotion still remotion/index.ts "Carousel-Slide$i" \
    "public/images/carousels/example/slide$i.png" --overwrite
done
```

---

## Complete Template

```tsx
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
  useVideoConfig,
} from "remotion";

// TODO: Import from your design-system.md
const COLORS = {
  primary: "#YOUR_PRIMARY",
  secondary: "#YOUR_SECONDARY",
  background: "#YOUR_BG",
  dark: "#YOUR_DARK",
  accent: "#YOUR_ACCENT",
};

export const AdTemplate: React.FC = () => {
  const { fps } = useVideoConfig();

  // Durations from voiceover info.json (actualDuration values)
  const SCENE_DURATIONS = {
    scene1: 3.5,
    scene2: 4.5,
    scene3: 4.0,
    scene4: 3.0,
  };

  const paddingFrames = 5;
  const scene1Frames = Math.round(SCENE_DURATIONS.scene1 * fps) + paddingFrames;
  const scene2Frames = Math.round(SCENE_DURATIONS.scene2 * fps) + paddingFrames;
  const scene3Frames = Math.round(SCENE_DURATIONS.scene3 * fps) + paddingFrames;
  const totalTargetFrames = Math.round(15 * fps);
  const scene4Frames = totalTargetFrames - scene1Frames - scene2Frames - scene3Frames;

  return (
    <AbsoluteFill>
      <Audio src={staticFile("audio/instagram-ads/ad-example/ad-example-combined.mp3")} />

      <Series>
        <Series.Sequence durationInFrames={scene1Frames}>
          <Scene1Hook />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scene2Frames}>
          <Scene2Problem />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scene3Frames}>
          <Scene3Solution />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scene4Frames}>
          <Scene4CTA />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
```

See [rules/components.md](rules/components.md) for scene template components.

---

## Pre-Upload Checklist

### Reels
- [ ] Resolution is 1080×1920 (9:16)
- [ ] All text within safe zones (80px+ from edges)
- [ ] No critical content in top 285px
- [ ] No critical content in bottom 400px
- [ ] Text minimum 40px font size
- [ ] Logo visible in center 1080×1080 (grid thumbnail)
- [ ] Tested 4:5 feed preview (y = 285-1635)
- [ ] Tested 1:1 grid preview (y = 420-1500)
- [ ] Voiceover synced with visuals
- [ ] Captions readable and properly timed
- [ ] Total duration ~15 seconds
- [ ] Tested on actual mobile device

### Carousels
- [ ] Resolution is 1080×1350 (4:5)
- [ ] All text within 80px padding
- [ ] First slide is attention-grabbing
- [ ] CTA with button on final slide
- [ ] Brand logo visible
- [ ] 5-10 slides total
- [ ] Swipe indicators on slides 1-4

---

## Workflow Summary

```bash
# 1. Setup (one time)
# Fill out public/brand/about.md with company & product info
# Fill out public/brand/voice-guidelines.md with tone & messaging

# Organize assets and scan them
# Place assets in public/assets/{images,videos,audio}/ folders
node tools/scan-assets.js
# Then fill in descriptions in manifest.csv files

cp rules/design-system-template.md rules/design-system.md
# Edit design-system.md with your brand values
cp dictionaries/template.pls dictionaries/your-brand.pls
# Edit your-brand.pls with brand pronunciations
node scripts/generate-backgrounds.js

# 2. Create scenes JSON
vim remotion/instagram-ads/scenes/ad-new-scenes.json

# 3. Generate voiceover (with optional dictionary)
node tools/generate.js \
  --scenes remotion/instagram-ads/scenes/ad-new-scenes.json \
  --dictionary your-brand \
  --with-timestamps \
  --output-dir public/audio/instagram-ads/ad-new/

# 4. Create composition
# Use actualDuration values from ad-new-info.json

# 5. Preview
npx remotion studio

# 6. Render
npx remotion render AdNew out/ad-new.mp4 --codec=h264 --crf=18

# 7. Test on mobile before uploading
```

---

## File Structure

```
public/
├── brand/                          # Brand brief (Claude reads this first)
│   ├── about.md                    # Company, product, audience, goals
│   └── voice-guidelines.md         # Tone, phrases, script templates
│
└── assets/                         # Organized assets with manifests
    ├── images/
    │   ├── manifest.csv            # Image descriptions for Claude
    │   ├── photos/
    │   ├── 3d/
    │   ├── 2d-illustrations/
    │   ├── transparent/
    │   ├── icons/
    │   └── backgrounds/
    ├── videos/
    │   ├── manifest.csv            # Video descriptions for Claude
    │   ├── clips/
    │   └── transparent/
    └── audio/
        ├── manifest.csv            # Audio descriptions for Claude
        ├── music/
        ├── sfx/
        └── voiceovers/

remotion-ads/
├── SKILL.md                        # This file
├── README.md                       # Quick start guide
├── tools/
│   ├── generate.js                 # ElevenLabs voiceover generator
│   └── scan-assets.js              # Asset scanner for CSV manifests
├── presets/                        # Quick configuration presets
│   ├── formats.json                # Platform formats (Instagram, TikTok, etc.)
│   ├── pacing.json                 # Timing presets (slow, medium, fast)
│   ├── styles.json                 # Visual styles (minimal, bold, etc.)
│   └── templates.json              # Scene structures (problem-solution, etc.)
├── dictionaries/
│   ├── template.pls                # Dictionary template
│   └── example.pls                 # Example dictionary
├── examples/                       # Example projects
│   └── focusflow/                  # Complete demo ad project
│       ├── README.md               # Setup instructions
│       ├── brand-about.md          # Example brand brief
│       ├── brand-voice.md          # Example voice guidelines
│       ├── scenes.json             # Example scene config
│       ├── assets-manifest.csv     # Example asset list
│       └── FocusFlowAd.tsx         # Example Remotion composition
└── rules/
    ├── setup.md
    ├── voiceover.md                # Voiceover & dictionary docs
    ├── captions.md
    ├── animations.md
    ├── components.md
    ├── formats.md
    ├── local-assets.md
    ├── carousels.md
    └── design-system-template.md
```
