# whydavis.me

Personal portfolio of Davis Huaytán — SDET. Static site (HTML, CSS, vanilla JS), no build step.

## Run locally

```bash
python3 -m http.server 8080
```

## Deploy (GitHub Pages)

1. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. The `CNAME` file already points Pages at `whydavis.me`.
3. At your domain registrar, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `dwhytan.github.io`
4. Back in Settings → Pages, enable **Enforce HTTPS** once the certificate is issued.

Stack icons are from [Simple Icons](https://simpleicons.org) (CC0).
