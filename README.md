# wiki.simonwied.com

A personal, open wiki for any topic — no restrictions on what you can write about. Whether it's cybersecurity, cooking, programming, science, music or anything else, every subject has a place here.

The wiki is built with plain HTML, CSS and JavaScript — no frameworks, no build tools. Each page is a self-contained HTML file with its own JS, making it easy to understand, edit and contribute to. Anyone can add a new page by copying the included template files and submitting a pull request.

The main goal of this wiki is to spread useful information. That said, not every submission will be accepted — the repository owner reviews all pull requests and decides whether a page fits the wiki. Content must be respectful, constructive and genuinely informative.

## Project Structure

```
├── index.html / index.css / index.js   # Homepage with card grid & search
├── web-hacking.css                     # Shared stylesheet for all sub-pages
├── version.js                          # Site version constant
├── _template.html                      # Template for new pages
├── _template.js                        # Template JS for new pages
├── *.html / *.js                       # Individual wiki pages
└── assets/                             # Logo, favicons, images
```

## Contributing a New Page

Want to add a page to the wiki? Follow these steps:

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/wiki.simonwied.com.git
cd wiki.simonwied.com
git checkout -b my-new-page
```

### 2. Create Your Page Files

Copy the templates and rename them to match your topic:

```bash
cp _template.html my-topic.html
cp _template.js my-topic.js
```

### 3. Edit the HTML File (`my-topic.html`)

Open the file and replace all `PAGE_TITLE` placeholders with your actual title. Then:

- **`<title>`** — Set the browser tab title
- **`<script src="...">`** — Change `_template.js` to `my-topic.js`
- **Sidebar** — Add your section links (one per category)
- **Breadcrumb** — Replace `PAGE_TITLE`
- **Page header** — Set emoji, title, subtitle and tags
- **Categories & entries** — Fill in your content (copy the example blocks)

The template includes commented examples for code blocks, tables, callouts and notes — just uncomment what you need.

### 4. Edit the JS File (`my-topic.js`)

The JS file copied from `_template.js` works out of the box. It handles:

- Collapsible entries (click to expand/collapse)
- Smooth scroll for sidebar navigation
- Sidebar toggle & resize

No changes needed unless you want custom behavior.

### 5. Add a Card to the Homepage

Open `index.html` and add a card entry inside the correct category section:

```html
<a href="my-topic.html" class="card cat-other" data-tags="keyword1 keyword2 ...">
  <div class="card-top">
    <span class="card-icon">🐧</span>
    <span class="card-badge" style="background:rgba(68,136,255,0.12);color:#4488ff;border:1px solid rgba(68,136,255,0.3)">LABEL</span>
  </div>
  <div class="card-title">My Topic</div>
  <div class="card-desc">Short description of what's inside.</div>
  <div class="card-footer">
    <span class="card-tag">Category</span>
    <span class="card-arrow">→</span>
  </div>
</a>
```

### 6. Test Locally

Open `index.html` in your browser and verify:

- The new card appears on the homepage and links correctly
- Your page loads with working sidebar, breadcrumb and collapsible entries
- The version number shows in the footer

### 7. Submit a Pull Request

```bash
git add my-topic.html my-topic.js index.html
git commit -m "Add my-topic page"
git push origin my-new-page
```

Then open a pull request on GitHub.

## License

This project is maintained by [simonwied](https://github.com/aimonkied).
