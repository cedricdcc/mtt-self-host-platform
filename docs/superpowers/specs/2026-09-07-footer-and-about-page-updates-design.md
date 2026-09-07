# Design Spec: Footer & About Page Content Updates

This document specifies updates to the Marine Term Translations (MTT) platform footer, About page content, ecosystem architecture descriptions, and partner branding.

## Context & Motivation

Marine Term Translations (MTT) was developed with support of EMODnet Biology and operates on top of the NERC Vocabulary Server (NVS). Following user feedback and brand alignment with the Flanders Marine Institute (VLIZ):
1. The sticky bottom behavior of the footer is being removed to restore standard document flow and eliminate viewport jitter.
2. The footer text is being updated to state "Supported by EMODnet" rather than "Sponsored by", with updated copyright attribution to VLIZ and direct links to the VLIZ website and Privacy Policy. The EU financing regulation disclaimer is removed.
3. The About page is being updated to clarify EMODnet Biology's supporting role, feature EMODnet as a key marine science community alongside NVS in an Ecosystem section, relocate VLIZ Vocabulary Server to downstream systems architecture, and streamline the Partners section into a clean logo strip featuring VLIZ, EMODnet, and BODC.

---

## Detailed Specifications

### 1. Global Footer (`frontend/components/Layout.tsx`)

#### Structural Changes
- **Remove Sticky Layout**: Remove conditional classes `!isAuthenticated ? 'sticky bottom-0 z-40 backdrop-blur-md shadow-lg' : 'relative z-10'` on the `<footer>` tag. Replace with standard static positioning: `relative z-10 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800`.
- **Remove Scroll Event Listener**: Remove `handleScroll` and `isFooterVisible` state toggle from `Layout.tsx`, along with the dynamic padding transitions (`py-4` / `py-3`).
- **Remove EU Regulation Disclaimer**: Delete the bottom disclaimer container displaying EU Regulation 2021/1139 text.

#### Content & Layout
- **Left Side**:
  - MTT logo and title linking to `/`.
  - Vertical border divider.
  - Label: `"Supported by"` (`text-xs text-slate-500 dark:text-slate-400 font-medium`).
  - EMODnet logo (`/emodnet-logo.png`) wrapped in a link to `https://emodnet.ec.europa.eu/en/biology` (`target="_blank" rel="noopener noreferrer"`).
- **Right Side**:
  - Copyright text: `&copy; {format(parse(now()), 'YYYY')} VLIZ.`
  - Navigational legal links separated by bullets or spacing:
    - `VLIZ Website`: `https://www.vliz.be/en`
    - `Privacy Policy`: `https://www.vliz.be/en/privacy`
  - Typography: `text-xs text-slate-500 dark:text-slate-400`, hover styles `hover:text-marine-600 dark:hover:text-marine-300 transition-colors`.

---

### 2. About Page Updates (`frontend/pages/About.tsx`)

#### Lead Intro Text
- Update sentence from:
  > *"was developed within the framework of [EMODnet Biology]..."*
  to:
  > *"was developed with support of [EMODnet Biology]..."*

#### Ecosystem & Vocabularies Section (Dual-Column Grid)
Replace the single centered NERC Vocabulary Server box with a 2-column grid (`grid md:grid-cols-2 gap-6 mb-16`):

1. **Card 1: NERC Vocabulary Server (Thesauri Authority)**:
   - Header: NERC Vocabulary Server (NVS)
   - Description: The NVS is a service providing access to curated collections of controlled vocabularies in oceanographic and related earth-science domains. Managed by the **British Oceanographic Data Centre (BODC)** and funded by the UK's **Natural Environment Research Council (NERC)**, it provides the core vocabulary concepts that MTT enables communities to translate.
   - Outbound Link: `https://vocab.nerc.ac.uk/`

2. **Card 2: EMODnet Community (Marine Data Harmonization)**:
   - Header: EMODnet Community
   - Description: The European Marine Observation and Data Network (**EMODnet**) Biology community aggregates and harmonizes marine biodiversity data across European regional seas. Multilingual translations produced on MTT enable data providers to bridge national terminologies with European semantic standards, expanding the accessibility of FAIR marine biodiversity data.
   - Outbound Link: `https://emodnet.ec.europa.eu/en/biology`

#### Downstream Integration: VLIZ Vocabulary Server
- Remove VLIZ Vocabulary Server from the Partners section.
- In the **"Built for Data Sovereignty" / Architecture** grid, add a card titled **"Downstream Vocabulary Systems"**:
  - Description: Multilingual SKOS translations and LDES feeds generated within MTT can be consumed by platforms such as the **VLIZ Vocabulary Server** (`https://vocab.vliz.be/`), enabling seamless institutional vocabulary discovery, indexing, and governance.

#### Partners Logo Strip
- Header: **"Partners"** (replacing *"Partners & Sponsors"*).
- Subtitle: *"Developed and maintained in collaboration with leading marine research institutions and data networks."*
- Structure: A clean, centered 3-column logo grid (`grid grid-cols-1 sm:grid-cols-3 gap-6 items-center justify-center max-w-3xl mx-auto`):
  1. **Flanders Marine Institute (VLIZ)**:
     - Logo: `/vliz-logo.svg`
     - Link: `https://www.vliz.be/en`
     - Label: Flanders Marine Institute (VLIZ)
  2. **EMODnet Biology**:
     - Logo: `/emodnet-logo.png`
     - Link: `https://emodnet.ec.europa.eu/en/biology`
     - Label: EMODnet Biology
  3. **British Oceanographic Data Centre (BODC)**:
     - Logo: `/bodc-logo.png`
     - Link: `https://www.bodc.ac.uk/`
     - Label: British Oceanographic Data Centre (BODC)
- Visual styling: Clean rounded white/dark-slate card containers (`h-24 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-marine-500 transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md`).

---

### 3. Assets Acquisition

1. **VLIZ Logo**: Save vector SVG asset at `frontend/public/vliz-logo.svg`.
2. **BODC Logo**: Save high-resolution PNG/SVG asset at `frontend/public/bodc-logo.png`.
3. **EMODnet Logo**: Existing `/emodnet-logo.png` will continue to be used.

---

### 4. Tests & Verification (`frontend/tests/emodnet-content.test.js`)

- Update unit assertions:
  - Verify navbar renders EMODnet logo when `isAuthenticated` is true.
  - Verify footer is static (`relative z-10`), not sticky (`sticky bottom-0`).
  - Verify footer text contains `"Supported by"`.
  - Verify footer contains `"VLIZ"` copyright, link to `https://www.vliz.be/en/privacy`, and link to `https://www.vliz.be/en`.
  - Verify footer does NOT contain the removed EU regulation 2021/1139 text.
  - Verify About page contains `"was developed with support of"`, the updated `"Partners"` section, and the `"EMODnet Community"` card.
