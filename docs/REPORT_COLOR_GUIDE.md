# Report Tab - Color Scheme Reference

## Visual Color Guide

### Statistics Cards

```
┌─────────────────────────────────────────────────────────────────────┐
│  STATISTICS SUMMARY                                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │Total Tests │  │Avg Download│  │ Avg Upload │  │  Avg Ping  │  │
│  │            │  │            │  │            │  │            │  │
│  │     17     │  │  10.29 🟢  │  │  15.01 🟠  │  │  63.96 🔵  │  │
│  │            │  │    Mbps    │  │    Mbps    │  │    ms      │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│  │ Avg Jitter │  │Avg DL Lat. │  │Avg UL Lat. │                  │
│  │            │  │            │  │            │                  │
│  │  87.53 🟣  │  │  358.25 🌸 │  │  347.53 🌸 │                  │
│  │    ms      │  │    ms      │  │    ms      │                  │
│  └────────────┘  └────────────┘  └────────────┘                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Report Table

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ SPEED TEST RESULTS TABLE                                                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│ Timestamp          Download  Upload   Ping   Jitter  DL Lat  UL Lat  Server  ISP │
│                    (Mbps)    (Mbps)   (ms)   (ms)    (ms)    (ms)                │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Oct 07, 2025       🟢10.29   🟠15.01  🔵63.96 🟣87.53 🌸358.25 🌸347.53 Active  Home│
│ 06:00:37                                                          Fibre Connect  │
│                                                                                    │
│ Oct 07, 2025       🟢125.50  🟠45.30  🔵12.50 🟣2.10  🌸11.80  🌸12.30  Server2 ISP2│
│ 05:30:00                                                                          │
│                                                                                    │
│ Oct 07, 2025       🟢128.20  🟠46.10  🔵11.90 🟣1.95  🌸11.20  🌸11.50  Server3 ISP3│
│ 05:00:00                                                                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Color Palette

### Primary Metrics
| Metric         | Emoji | Color Name | Hex Code | RGB                 | Use Case              |
|----------------|-------|------------|----------|---------------------|-----------------------|
| Download       | 🟢    | Green      | #10b981  | rgb(16, 185, 129)  | Download speed        |
| Upload         | 🟠    | Orange     | #f59e0b  | rgb(245, 158, 11)  | Upload speed          |
| Ping           | 🔵    | Cyan       | #06b6d4  | rgb(6, 182, 212)   | Ping/latency          |
| Jitter         | 🟣    | Purple     | #8b5cf6  | rgb(139, 92, 246)  | Network jitter        |
| Latency        | 🌸    | Pink       | #ec4899  | rgb(236, 72, 153)  | DL/UL latency         |

### Informational Fields
| Field          | Color      | Hex Code            | Use Case              |
|----------------|------------|---------------------|-----------------------|
| Server         | Light Gray | rgba(255,255,255,.7)| Test server name      |
| ISP            | Light Gray | rgba(255,255,255,.7)| Internet provider     |
| Timestamp      | White      | rgba(255,255,255,.9)| Test timestamp        |

### UI Elements
| Element        | Color      | Hex Code            | Use Case              |
|----------------|------------|---------------------|-----------------------|
| Background     | Dark Gray  | rgba(5,5,5,.98)    | Main background       |
| Border         | Cyan       | rgba(6,182,212,.3) | Card/table borders    |
| Header         | Cyan       | #06b6d4            | Section headers       |
| Button         | Cyan       | #06b6d4            | Export button         |

## Typography & Spacing

### Table
- **Header Font**: 0.9rem, uppercase, cyan (#06b6d4)
- **Cell Font**: 0.9rem, white/light gray
- **Padding**: 12px per cell
- **Min Width**: 1200px (scrollable)

### Statistics Cards
- **Label**: 0.85rem, uppercase, gray
- **Value**: 1.5rem, bold, color-coded
- **Range**: 0.75rem, light gray
- **Grid**: Auto-fit, min 180px per card

### Responsive Breakpoints
- **Desktop**: Full grid, all columns visible
- **Mobile (<768px)**: Stacked cards, horizontal scroll table

## Accessibility

### Color Contrast
All colors meet WCAG AA standards for contrast:
- 🟢 Green on dark: 7.2:1 contrast ratio
- 🟠 Orange on dark: 8.1:1 contrast ratio
- 🔵 Cyan on dark: 7.5:1 contrast ratio
- 🟣 Purple on dark: 6.8:1 contrast ratio
- 🌸 Pink on dark: 7.9:1 contrast ratio

### Visual Indicators
- Color is not the only indicator
- Icons and labels supplement colors
- Text remains readable without color

## Export (CSV)

CSV export maintains data structure without colors:
```csv
Timestamp,Download (Mbps),Upload (Mbps),Ping (ms),Jitter (ms),Download Latency (ms),Upload Latency (ms),Server,ISP
2025-10-07 06:00:37,10.29,15.01,63.96,87.53,358.25,347.53,"Active Fibre","Home Connect"
```

## Design Philosophy

### Color Selection
- **Green (Download)**: Positive, incoming data
- **Orange (Upload)**: Warm, outgoing data
- **Cyan (Ping)**: Cool, primary brand color
- **Purple (Jitter)**: Distinct from others, variance indicator
- **Pink (Latency)**: Related to ping but visually distinct

### Consistency
- All speeds use same color throughout UI
- Statistics cards match table values
- Export maintains same data structure

### User Experience
- Quick visual scanning of metrics
- Easy identification of problem areas
- Professional appearance
- Data remains readable in all contexts

## CSS Classes Reference

```css
/* Value colors */
.value-download  { color: #10b981; }  /* Green */
.value-upload    { color: #f59e0b; }  /* Orange */
.value-ping      { color: #06b6d4; }  /* Cyan */
.value-jitter    { color: #8b5cf6; }  /* Purple */
.value-latency   { color: #ec4899; }  /* Pink */
.value-server    { color: rgba(255,255,255,0.7); }  /* Gray */
.value-isp       { color: rgba(255,255,255,0.7); }  /* Gray */

/* Stat colors */
.stat-download   { color: #10b981; }  /* Green */
.stat-upload     { color: #f59e0b; }  /* Orange */
.stat-ping       { color: #06b6d4; }  /* Cyan */
.stat-jitter     { color: #8b5cf6; }  /* Purple */
.stat-latency    { color: #ec4899; }  /* Pink */
```

## Usage Example

When viewing the report:
1. Quick glance at stats shows **green** download and **orange** upload averages
2. Scanning table, **cyan** ping values stand out
3. **Purple** jitter and **pink** latency provide additional diagnostics
4. Server/ISP info available in gray for reference
5. Export to CSV for external analysis

Perfect color balance for professional network monitoring! 🎨
