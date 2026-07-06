
# [wiki.simonwied.com](https://wiki.simonwied.com)

A personal, open wiki for any topic — no restrictions on what you can write about. Whether it's cooking, programming, science, music or anything else, every subject has a place here.

The wiki is being rebuilt as a Next.js + Supabase app with a canvas-based block editor and accounts (anyone can register and publish). It lives in [`wiki-v2/`](wiki-v2/) and will run on wiki.simonwied.com. See [WIKI-V2.md](WIKI-V2.md) for the roadmap and [wiki-v2/README.md](wiki-v2/README.md) for developer docs.

## Repository layout

```
├── index.html / index.css   # Landing page currently served at wiki.simonwied.com
│                            # ("Beta im Aufbau" teaser with a button into the new wiki)
├── wiki-v2/                 # The new wiki (Next.js + Supabase), replaces the static site
├── pages/                   # Archived v1 wiki pages (plain HTML/JS), kept in case
│                            # some of them get embedded into the new wiki later
├── style.css / nav.js / version.js   # Shared assets the archived pages depend on
└── assets/                  # Logo, favicons, fonts
```

The old static wiki (v1) has been retired: its homepage, templates and the
pull-request contribution flow are gone. Only the content pages under
`pages/` are kept as an archive — they are not linked from the landing page.

In the new wiki, content is created directly in the browser (no Git workflow):
register, write articles or build canvas workspaces, keep them private or
publish them under a public link.

## License

This project is maintained by [simonwied](https://github.com/aimonkied).
