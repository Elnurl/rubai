---
name: Expo vector-icons font loading
description: How to correctly load @expo/vector-icons fonts so icons render on all platforms including web/Android simulation.
---

## Rule
Load icon fonts by spreading the `.font` static property of each icon component into `useFonts`:

```ts
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";

const [fontsLoaded, fontError] = useFonts({
  Inter_400Regular,
  ...Feather.font,       // { feather: <vendor TTF asset> }
  ...Ionicons.font,      // { ionicons: <vendor TTF asset> }
  ...MaterialIcons.font, // { material: <vendor MaterialIcons.ttf asset> }
});
```

**Why:** The Expo `createIconSet` wrapper checks `Font.isLoaded(fontName)` on first render and renders `<Text />` if not loaded, then loads via `componentDidMount`. Crucially, `Font.isLoaded` checks by the exact key the vendor registers the font under. If you load a LOCAL copy with the same key name (e.g. `require('../assets/fonts/Feather.ttf')`), expo-font registers a different asset source. On web and Android simulation, this causes a CSS `@font-face` mismatch where `fontIsLoaded=true` (key exists) but the browser applies a fallback font that lacks the Private Use Area glyphs → all icons show as □.

**How to apply:** Always use `.font` spread — it's the exact same vendor TTF asset the icon component itself would load in `componentDidMount`, guaranteeing zero mismatch. The local TTF copy approach was an attempt to work around an intermittent Metro-on-Android asset delivery bug ("sometimes registers without delivering the font binary"), but it introduced a worse systematic bug on web.

**Font family names** (for reference): `feather`, `ionicons`, `material` — all lowercase, as registered by the vendor `createIconSet`.
