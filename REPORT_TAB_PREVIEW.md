# Report Tab UI Preview

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                                  🔧   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────────────────────────────────────┐   │
│  │ Settings │  │  Speed Test Reports                      │   │
│  │ Live Hosts│  │  View and export historical results     │   │
│  │ Thresholds│  │                                          │   │
│  │ ▶ Report  │  │  ┌────────────────────────────────────┐ │   │
│  │ Donate   │  │  │ Time Range: [Last 24 Hours ▼]      │ │   │
│  └──────────┘  │  │                                      │ │   │
│                │  │ [Export CSV 📥]                      │ │   │
│                │  └────────────────────────────────────┘ │   │
│                │                                          │   │
│                │  ┌────────────────────────────────────┐ │   │
│                │  │ Statistics Summary                 │ │   │
│                │  ├────────┬────────┬────────┬─────────┤ │   │
│                │  │ Total  │  Avg   │  Avg   │  Avg   │ │   │
│                │  │ Tests  │Download│ Upload │  Ping  │ │   │
│                │  ├────────┼────────┼────────┼─────────┤ │   │
│                │  │   17   │125 Mbps│ 45 Mbps│ 12 ms  │ │   │
│                │  │        │Min: 110│Min: 40 │Min: 10 │ │   │
│                │  │        │Max: 135│Max: 50 │Max: 15 │ │   │
│                │  └────────┴────────┴────────┴─────────┘ │   │
│                │                                          │   │
│                │  ┌────────────────────────────────────┐ │   │
│                │  │ Timestamp    ↓Download ↑Upload Ping│ │   │
│                │  ├────────────────────────────────────┤ │   │
│                │  │ Oct 7, 15:30  125.50   45.30  12.5│ │   │
│                │  │ Oct 7, 15:00  128.20   46.10  11.9│ │   │
│                │  │ Oct 7, 14:30  122.80   44.50  13.2│ │   │
│                │  │ Oct 7, 14:00  126.40   45.80  12.1│ │   │
│                │  │ Oct 7, 13:30  124.10   45.00  12.8│ │   │
│                │  │      ... (scroll for more) ...    │ │   │
│                │  └────────────────────────────────────┘ │   │
│                └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Time Range Options

### Preset Ranges
```
┌─────────────────────────┐
│ Time Range:             │
├─────────────────────────┤
│ Last Hour              │
│ Last 6 Hours           │
│ ▶ Last 24 Hours        │
│ Last 7 Days            │
│ Last 30 Days           │
│ All Time               │
│ Custom Range           │
└─────────────────────────┘
```

### Custom Range (when selected)
```
┌──────────────────────────────────────────────────┐
│ 📅 Start Date: [2025-10-01]                     │
│ 📅 End Date:   [2025-10-07]                     │
└──────────────────────────────────────────────────┘
```

## Statistics Cards

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Total Tests   │  │ Avg Download   │  │  Avg Upload    │
│                │  │                │  │                │
│      17        │  │   125.50 Mbps  │  │   45.30 Mbps   │
│                │  │                │  │                │
│                │  │ Min: 110       │  │ Min: 40        │
│                │  │ Max: 135       │  │ Max: 50        │
└────────────────┘  └────────────────┘  └────────────────┘

┌────────────────┐
│   Avg Ping     │
│                │
│    12.50 ms    │
│                │
│ Min: 10        │
│ Max: 15        │
└────────────────┘
```

## Report Table Features

### Column Headers (Sticky)
```
┌───────────────────┬──────────────┬──────────────┬─────────┬─────────┬──────────┐
│ Timestamp         │ Download (↓) │ Upload (↑)   │ Ping    │ Jitter  │ Latency  │
│                   │   (Mbps)     │   (Mbps)     │  (ms)   │  (ms)   │   (ms)   │
├═══════════════════╪══════════════╪══════════════╪═════════╪═════════╪══════════┤
```

### Data Rows (Scrollable)
```
│ Oct 07, 15:30:45  │   125.50     │    45.30     │  12.50  │  2.10   │  11.80   │
│ Oct 07, 15:00:45  │   128.20     │    46.10     │  11.90  │  1.95   │  11.20   │
│ Oct 07, 14:30:45  │   122.80     │    44.50     │  13.20  │  2.30   │  12.50   │
│ Oct 07, 14:00:45  │   126.40     │    45.80     │  12.10  │  2.05   │  11.40   │
│ Oct 07, 13:30:45  │   124.10     │    45.00     │  12.80  │  2.15   │  12.10   │
│       ...         │     ...      │     ...      │   ...   │   ...   │   ...    │
└───────────────────┴──────────────┴──────────────┴─────────┴─────────┴──────────┘
```

## Color Scheme

- **Background**: Dark gradient (rgba(5, 5, 5, 0.98))
- **Border/Accent**: Cyan (#06b6d4)
- **Text**: White/Light gray
- **Download Values**: Green (#10b981)
- **Upload Values**: Orange (#f59e0b)
- **Ping Values**: Cyan (#06b6d4)
- **Export Button**: Cyan gradient

## Interactive Elements

### Hover Effects
```
Normal State:
┌─────────────────┐
│  Export CSV 📥  │
└─────────────────┘

Hover State:
┌═════════════════┐  ← Elevated shadow
║  Export CSV 📥  ║  ← Brighter gradient
└═════════════════┘  ← Slight upward transform
```

### Table Row Hover
```
Normal:  │ Oct 07, 15:30:45  │   125.50     │    45.30     │
Hover:   │ Oct 07, 15:30:45  │   125.50     │    45.30     │ ← Highlighted background
```

## CSV Export Sample

```csv
Timestamp,Download (Mbps),Upload (Mbps),Ping (ms),Jitter (ms),Latency (ms)
2025-10-07 15:30:45,125.50,45.30,12.50,2.10,11.80
2025-10-07 15:00:45,128.20,46.10,11.90,1.95,11.20
2025-10-07 14:30:45,122.80,44.50,13.20,2.30,12.50
2025-10-07 14:00:45,126.40,45.80,12.10,2.05,11.40
2025-10-07 13:30:45,124.10,45.00,12.80,2.15,12.10
```

## States

### Loading State
```
┌─────────────────────────────────────┐
│                                     │
│         Loading report data...      │
│              ⏳                     │
│                                     │
└─────────────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────────────┐
│                                     │
│  No speed test results found for    │
│    the selected time range.         │
│                                     │
└─────────────────────────────────────┘
```

## Responsive Behavior

### Desktop (>768px)
- 4 stat cards in a row
- Full table width
- Side-by-side date pickers

### Tablet/Mobile (<768px)
- Stacked stat cards (1 per row)
- Scrollable table
- Stacked date pickers
- Full-width export button
