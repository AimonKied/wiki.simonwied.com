
# [wiki.simonwied.com](https://wiki.simonwied.com)

A personal, open wiki for any topic — no restrictions on what you can write about. Whether it' cooking, programming, science, music or anything else, every subject has a place here.

The wiki is built with plain HTML, CSS and JavaScript — no frameworks, no build tools. Each page is a self-contained HTML file with its own JS, making it easy to understand, edit and contribute to. Anyone can add a new page by copying the included template files and submitting a pull request.

The main goal of this wiki is to spread useful information. That said, not every submission will be accepted — the repository owner reviews all pull requests and decides whether a page fits the wiki. Content must be respectful, constructive and genuinely informative.

## Project Structure (as of 2026)

```
├── index.html / index.css / index.js   # Homepage with card grid & search
├── style.css                          # Shared stylesheet for all sub-pages
├── version.js                         # Site version constant
├── _template.html                     # Template for new pages
├── _template.js                       # Template JS for new pages
├── assets/                            # Logo, favicons, images
└── pages/
    └── my-topic/
        ├── my-topic.html              # Your page's HTML
        └── my-topic.js                # Your page's JS
```

**Each wiki page now lives in its own folder under `/pages/`, named after the topic.**

## Contributing a New Page

Want to add a page to the wiki? Follow these steps:

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/wiki.simonwied.com.git
cd wiki.simonwied.com
git checkout -b my-new-page
```

### 2. Create a New Page Folder

Create a new folder under `/pages/` named after your topic (use dashes, not spaces):

```bash
mkdir pages/my-topic
cp _template.html pages/my-topic/my-topic.html
cp _template.js pages/my-topic/my-topic.js
```

### 3. Edit Your Page Files

Open `pages/my-topic/my-topic.html` and:

- Replace all `PAGE_TITLE` placeholders with your actual title
- Set the `<title>` and update the `<script src="...">` to use your JS file
- Fill in the sidebar, breadcrumb, header, and content as needed
- Update asset and navigation paths if you add new resources

Edit `pages/my-topic/my-topic.js` if you want custom JS behavior (optional)

### 4. Add a Card to the Homepage

Open `index.html` and add a card entry inside the correct category section. Make sure the link points to your new page:

```html
<a href="pages/my-topic/my-topic.html" class="card cat-other" data-tags="keyword1 keyword2 ...">
  ...
</a>
```

### 5. Test Locally

Open `index.html` in your browser and verify:

- The new card appears on the homepage and links correctly
- The page and category counter is correct
- Your page loads with working sidebar, breadcrumb, and collapsible entries
- The version number shows in the footer

### 6. Submit a Pull Request

```bash
git add pages/my-topic/ index.html
git commit -m "ADD: my-topic page"
git push origin my-new-page
```

Then open a pull request on GitHub. Please ensure your page folder and files follow the naming conventions and structure above.

## License

This project is maintained by [simonwied](https://github.com/aimonkied).
