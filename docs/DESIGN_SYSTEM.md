# ORI LEARNING — DESIGN SYSTEM V1
## Typography-First Product Design Reference & Architecture

---

### 1. Philosophy & Brand Identity
ORI Learning is designed to feel like a modern, high-precision aviation training SaaS: clean, structured, calm, information-rich, and visually trustworthy.
- **Brand Colors**: Preserved existing ORI palette (Bright Blue `#0284c7`, Emerald Green `#059669`, Amber `#d97706`, Rose/Red `#e11d48`, Deep Slate/Navy `#0f172a`, Light Slate `#f8fafc`).
- **Principles**:
  - Information hierarchy over visual decoration.
  - One primary action per screen.
  - Tabular numerals (`tabular-nums`) for scannable metrics and data alignment.
  - High Vietnamese diacritic readability (comfortable line-heights, no cramped leading on paragraphs).
  - Quiet interface: avoid badge overload, card-in-card syndrome, and excessive shadows.

---

### 2. Typography Roles & Scale
All text elements use **Plus Jakarta Sans** with strict semantic roles:

| Role | Font Size | Line Height | Weight | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `28px` (`text-2xl`) | `36px` | `700` (`bold`) | `-0.02em` | Primary page headers (`.type-page-title`) |
| **Section Heading** | `20px` (`text-xl`) | `28px` | `700` (`bold`) | `-0.01em` | Section headings & drawer titles (`.type-section-heading`) |
| **Component Heading** | `16px` (`text-base`) | `24px` | `600` (`semibold`) | `normal` | Card titles, modal headers (`.type-component-heading`) |
| **Body** | `14px` (`text-sm`) | `22px` | `400` (`normal`) | `normal` | Standard body text, descriptions (`.type-body`) |
| **Body Strong** | `14px` (`text-sm`) | `22px` | `600` (`semibold`) | `normal` | Emphasized body text (`.type-body-strong`) |
| **Label / Meta** | `12px` (`text-xs`) | `18px` | `600` (`semibold`) | `normal` | Input labels, form headers (`.type-label`) |
| **Table Header** | `12px` (`text-xs`) | `16px` | `600` (`semibold`) | `+0.05em` | Admin table column headers (`.type-table-header`) |
| **Table Body** | `14px` (`text-sm`) | `20px` | `400` (`normal`) | `normal` | Admin table data rows (`.type-table-body`) |
| **Helper Text** | `12px` (`text-xs`) | `18px` | `400` (`normal`) | `normal` | Captions & form error messages (`.type-helper`) |

---

### 3. Vietnamese Typography Rules
- **Line-Height Safety**: Vietnamese diacritics (accents like `ơ`, `ư`, `ầ`, `ể`, `ố`) collide when using `leading-tight` or `leading-none`. Always use `leading-[22px]` for 14px text or `leading-relaxed`.
- **Uppercase Restriction**: Avoid ALL-CAPS for Vietnamese headings or button labels. Uppercase is allowed ONLY for short 1-2 word metadata labels or table column headers.

---

### 4. Numeric Typography & Formatting
- **Tabular Numerals**: Apply `.tabular-nums` (`font-variant-numeric: tabular-nums;`) to all numbers, scores, progress metrics (e.g. `200/200`, `54/54`, `Q147`), timestamps, and statistics.

---

### 5. Spacing Rhythm & Radius System
- **Canonical Spacing Scale**: `4px` (micro), `8px` (internal gap), `12px` (compact control), `16px` (standard control/padding), `24px` (card padding), `32px` (section gap), `48px` (page gap).
- **Canonical Radius Scale**:
  - `8px` (`rounded-lg`): Small tags, input inner badges.
  - `10px` (`rounded-xl`): Buttons, form inputs, select controls.
  - `16px` (`rounded-2xl`): Cards, tables, modal containers.
  - `9999px` (`rounded-full`): Status pills.

---

### 6. Information Density Modes
1. **Comfortable**: Student practice views, reading exercises, review modals.
2. **Standard**: Admin dashboards, form dialogs, management settings.
3. **Dense**: Staging tables, TOEIC Import Studio, question classification grids.

---

### 7. Core Component Primitives (`src/components/ui/`)
- `<Button>`: Variants `primary`, `secondary`, `success`, `danger`, `ghost`, `outline`. Heights `sm: 36px`, `md: 40px`, `lg: 44px`.
- `<Badge>`: Variants `neutral`, `success`, `warning`, `danger`, `info`, `purple`. Max 1-2 badges per table row.
- `<Card>`: Standard 16px radius, neutral 1px border, 24px padding.
- `<PageHeader>`: Page identity + optical actions alignment.
- `<SectionHeader>`: Section title + metadata + secondary actions.
- `<StatCard>`: Tabular numerals + aligned label + status indicator.
- `<Tabs>`: Underline or Pill navigation with active state transitions.
- `<AdminTable>`: Scannable table with column width stability, middle vertical-alignment, and hover highlight.
- `<Input>`, `<Select>`, `<Textarea>`: 40px height form controls with clear focus ring.
- `<Alert>`: Accessible callout containers for info, success, warning, danger.
- `<EmptyState>`: Standard clean fallback container.

---

### 8. Do's and Don'ts
- **DO** use one primary button per screen context.
- **DO** use `.tabular-nums` for all quantitative metrics and dates.
- **DON'T** use `font-black` or `font-extrabold` on normal body paragraphs.
- **DON'T** put colored badges on every table column.
- **DON'T** use raw emojis in professional admin UI; use SVG/Lucide icons.
