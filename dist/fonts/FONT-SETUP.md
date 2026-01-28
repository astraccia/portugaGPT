# Font Setup

## Selfie Printed Font

**Source**: WebFontFree CDN (same as danielportuga.com uses)
**CDN Script**: Loaded in `index.html` via `<script src="https://c.webfontfree.com/c.js?f=Selfie-Printed">`
**Font Name**: 'Selfie-Printed' (registered by the CDN script)
**CSS Reference**: `font-family: 'Selfie-Printed', 'Selfie Printed', cursive, 'Roboto', sans-serif;`

The WebFontFree CDN script dynamically injects the font files, so no local @font-face src URLs are needed. The script handles the font loading automatically.

## CooperBlack Font

**Source**: jsDelivr CDN from GitHub (indestructible-type/Cooper repository)
**CDN URLs**: 
- OTF: `https://cdn.jsdelivr.net/gh/indestructible-type/Cooper@main/fonts/CooperBlack-Regular.otf`
- TTF: `https://cdn.jsdelivr.net/gh/indestructible-type/Cooper@main/fonts/CooperBlack-Regular.ttf`
**Font Name**: 'CooperBlack'
**CSS Reference**: `font-family: 'CooperBlack', 'Roboto', serif;`

## Testing

Run `npm run dev` and check the browser console for font loading status. The console will show:
- ✓ Loaded - Font is working
- ✗ Not loaded (using fallback) - Font failed to load, using Roboto fallback
