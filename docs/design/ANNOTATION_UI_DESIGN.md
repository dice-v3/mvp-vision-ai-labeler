# Annotation UI Design Specification

**Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: Design Phase
**Primary Task Type**: Object Detection (Bounding Boxes)

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Competitive Analysis](#competitive-analysis)
- [Design Principles](#design-principles)
- [Layout Architecture](#layout-architecture)
- [Component Specifications](#component-specifications)
- [Interaction Patterns](#interaction-patterns)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [State Management](#state-management)
- [Extensibility Strategy](#extensibility-strategy)
- [Performance Considerations](#performance-considerations)
- [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### Vision
Create a **world-class annotation interface** that enables annotators to label thousands of images efficiently with minimal cognitive load and maximum precision.

### Core Goals
1. **Productivity**: Enable 3-5x faster annotation through smart UX
2. **Accuracy**: Reduce human error with visual aids and validation
3. **Ergonomics**: Minimize repetitive clicks and mouse travel
4. **Extensibility**: Support all 7 task types with consistent mental model
5. **Delight**: Make labeling feel natural and satisfying

### Success Metrics
- **Time per annotation**: < 10 seconds for simple bbox
- **Clicks to complete**: ≤ 2 clicks for common actions
- **Keyboard coverage**: 80%+ actions accessible via hotkeys
- **Error rate**: < 5% incorrect labels
- **User satisfaction**: > 4.5/5 rating

---

## Competitive Analysis

### Best-in-Class Features Summary

| Tool | Standout Features | Lessons Learned |
|------|------------------|----------------|
| **Roboflow Annotate** | • Label Assist (auto-annotation)<br>• Clean, minimal UI<br>• Label autocomplete<br>• First-class navigation | Focus on automation and clean layout |
| **CVAT** | • 10x faster with AI integration<br>• AI agents for ML models<br>• Extensive shape support<br>• Customizable panels | Integrate AI assistance early |
| **Label Studio** | • XML-based customization<br>• Keyboard shortcuts<br>• Modular interface<br>• Keep labels selected after creation | Configurability and hotkeys matter |
| **Make-sense** | • Dark theme<br>• Dashed grid follows mouse<br>• Drag-and-drop to start<br>• React-based smooth UI | Visual feedback and onboarding |
| **VoTT (Microsoft)** | • Intuitive UX<br>• Time-saving workflows | Prioritize user time |

### Key Insights

1. ✅ **Hotkeys are critical** - Every major action needs a shortcut
2. ✅ **Auto-annotation wins** - AI-assisted labeling is table stakes in 2025
3. ✅ **Visual feedback** - Show grid, snap to edges, highlight on hover
4. ✅ **Reduce clicks** - Keep last-used class selected, clone previous bbox
5. ✅ **Dark mode** - Reduces eye strain for long sessions
6. ✅ **Modular design** - Easy to add new annotation types

---

## Design Principles

### 1. Zero-Friction Workflow
**Principle**: Annotator should never wait or wonder what to do next.

**Application**:
- Auto-load next image after save
- Pre-select most common class
- Show progress indicator
- Keyboard-only workflow possible

### 2. Spatial Efficiency
**Principle**: Every pixel counts on the canvas.

**Application**:
- Full-screen canvas mode (hide all panels)
- Collapsible sidebars
- Floating context menus
- Overlay controls fade when idle

### 3. Immediate Feedback
**Principle**: Every action has visible confirmation.

**Application**:
- Visual highlights on hover
- Bbox preview while dragging
- Sound on save (optional)
- Undo stack visualization

### 4. Intelligent Defaults
**Principle**: System predicts user intent.

**Application**:
- Remember last class selection
- Auto-zoom to fit image
- Suggest next image based on uncertainty
- Pre-fill attributes from previous annotation

### 5. Graceful Errors
**Principle**: Prevent mistakes, recover easily.

**Application**:
- Warn before deleting
- Undo/redo unlimited
- Auto-save every 30 seconds
- Conflict resolution UI

---

## Layout Architecture

### Overall Screen Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (60px)                                                          │
│ [Logo] [Dataset: xxx] [Progress: 32/209] [Saved ✓] [Fullscreen] [Exit] │
├───────┬─────────────────────────────────────────────────────────┬───────┤
│       │                                                         │       │
│ LEFT  │                   CANVAS AREA                           │ RIGHT │
│ PANEL │              (Main Image Viewer)                        │ PANEL │
│       │                                                         │       │
│ 280px │              [Image with Annotations]                   │ 320px │
│       │                                                         │       │
│ Tools │         Zoom: 100% | W: 1920 x H: 1080                 │ Anno  │
│ Image │                                                         │ List  │
│ List  │                                                         │ Attrs │
│ Class │                                                         │ Meta  │
│ List  │                                                         │       │
│       │                                                         │       │
├───────┴─────────────────────────────────────────────────────────┴───────┤
│ BOTTOM BAR (80px)                                                       │
│ [◀ Prev] [Image 32/209] [▶ Next] | [Delete] [Copy] [AI Assist]        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Panel Specifications

#### Top Bar (Always Visible)
- **Height**: 60px
- **Background**: Dark gray (#1f2937)
- **Content**:
  - Project breadcrumb
  - Progress indicator (32/209 images)
  - Auto-save status
  - Fullscreen toggle
  - Exit to dashboard

#### Left Panel (Collapsible, Default: Open)
- **Width**: 280px
- **Collapsible**: Yes (hotkey: `[`)
- **Sections**:
  1. **Annotation Tools** (100px)
     - Select/Move (V)
     - Bounding Box (R)
     - Polygon (P)
     - Classification (C)
  2. **Image List** (200px, Scrollable)
     - Thumbnail grid (2 columns)
     - Current image highlighted
     - Completion status (✓ icon)
     - Click to jump to image
     - Progress indicator per image
  3. **Class List** (Scrollable)
     - Quick class selection
     - Hotkeys 1-9, 0
     - Color indicators
     - Count per class
  4. **Settings** (Bottom, 60px)
     - Show labels toggle
     - Snap to edges
     - Dark mode

#### Right Panel (Collapsible, Default: Open)
- **Width**: 320px
- **Collapsible**: Yes (hotkey: `]`)
- **Sections**:
  1. **Current Annotation** (200px)
     - Class dropdown (searchable)
     - Attributes (if enabled)
     - Confidence score (AI-assisted)
     - Notes textarea
  2. **Annotations List** (Scrollable)
     - All bboxes on current image
     - Click to select/edit
     - Eye icon to hide/show
     - Delete icon
  3. **Image Metadata** (Bottom)
     - Filename
     - Dimensions
     - Date uploaded

#### Canvas Area (Center, Responsive)
- **Background**: Dark gray with grid pattern
- **Content**: Image with zoom/pan controls
- **Overlays**:
  - Bboxes with labels
  - Selected bbox highlight
  - Drawing preview
  - Minimap (bottom-right corner)

#### Bottom Bar (Always Visible)
- **Height**: 80px
- **Background**: Dark gray (#1f2937)
- **Content**:
  - Navigation: Prev/Next image
  - Image counter
  - Bulk actions: Delete All, Copy from Previous
  - AI Assist button

---

## Component Specifications

### 1. Canvas Component

#### Visual Features
```tsx
interface CanvasProps {
  image: ImageData;
  annotations: Annotation[];
  selectedAnnotation: Annotation | null;
  tool: 'select' | 'bbox' | 'polygon' | 'classification';
  zoom: number;  // 10% to 400%
  pan: { x: number; y: number };
}
```

#### Rendering Layers (Z-Index Order)
1. **Background Grid** (z: 0)
   - Subtle gray grid (20px squares)
   - Visible only when zoomed > 100%

2. **Image Layer** (z: 1)
   - Actual image
   - Max-width/height to fit canvas

3. **Annotations Layer** (z: 2)
   - All bounding boxes
   - Stroke width: 2px
   - Label background: semi-transparent
   - Font: 12px medium

4. **Selected Annotation** (z: 3)
   - Thicker stroke (3px)
   - Corner handles (8x8px circles)
   - Edge handles (midpoints)

5. **Drawing Preview** (z: 4)
   - Dashed stroke (2px)
   - Follow mouse

6. **Crosshair** (z: 5)
   - Full-screen horizontal/vertical lines
   - Visible only while drawing
   - Opacity: 30%

#### Interaction States

**Normal State**:
- Cursor: default
- Bboxes: class color with 60% opacity
- Labels: visible on hover

**Hover State** (over bbox):
- Cursor: move
- Bbox: highlight with 100% opacity
- Stroke width: 3px
- Label: always visible

**Drawing State** (bbox tool active):
- Cursor: crosshair
- Crosshair lines: visible
- Preview bbox: dashed red border
- Coordinates tooltip: "W: 240 x H: 180"

**Resizing State** (dragging handle):
- Cursor: nwse-resize / nesw-resize / ew-resize / ns-resize
- Bbox: 100% opacity
- Coordinates tooltip: live updates
- Snap to grid (if enabled)

**Selected State**:
- Bbox: pulsing border animation
- Handles: visible (8 total)
- Right panel: shows annotation details
- Keyboard: Delete/Backspace to remove

#### Zoom & Pan Controls

**Zoom Methods**:
1. Mouse wheel: Zoom in/out (10% increments)
2. Toolbar buttons: +/- (25% increments)
3. Keyboard: `Ctrl + Plus/Minus`
4. Fit to screen: `Ctrl + 0`
5. 100%: `Ctrl + 1`

**Pan Methods**:
1. Space + Drag: Pan around
2. Middle mouse button drag
3. Arrow keys: 50px increments
4. Minimap click: Jump to position

**Minimap** (Bottom-right corner):
- Size: 150x150px
- Shows: Full image thumbnail
- Viewport indicator: semi-transparent rectangle
- Click to jump to location

### 2. Bounding Box Tool

#### Drawing Workflow

**Step 1: Activate Tool**
- Click bbox tool icon OR press `R`
- Cursor changes to crosshair
- Crosshair lines appear

**Step 2: Draw Bbox**
- Click and drag to create rectangle
- Preview shows dashed border
- Dimensions tooltip: "W: 240 x H: 180"
- Release mouse to finalize

**Step 3: Assign Class**
- Class selector appears (floating near bbox)
- OR auto-assign last used class (configurable)
- OR press hotkey 1-9, 0 immediately
- OR click class in right panel

**Step 4: Refine (Optional)**
- Handles appear automatically
- Drag corners to resize
- Drag edges to resize
- Drag center to move

**Step 5: Save**
- Click outside bbox OR press Enter
- Auto-saves to backend
- Tool remains active (ready for next bbox)

#### Smart Features

**Auto-Suggest Class**:
- If AI model available, show predicted class
- Confidence score badge
- Accept: press Space
- Reject: press Escape, choose manually

**Copy Last Bbox**:
- Hotkey: `Ctrl + D` (duplicate)
- Creates identical bbox at offset position
- Same class and attributes
- Useful for similar objects

**Snap to Edges**:
- When dragging near image edge (< 10px)
- Bbox edge snaps to image boundary
- Visual feedback: edge turns yellow
- Disable: Hold `Shift` while dragging

**Minimum Size Validation**:
- Configurable in project settings (default: 10x10px)
- If bbox too small, show warning toast
- Bbox becomes red dashed border
- User must resize or cancel (Escape)

### 3. Class Selector Component

#### Visual Design

**Layout** (Left Panel):
```
┌──────────────────────────────┐
│ Classes (9)              [+] │ ← Add new class (admin only)
├──────────────────────────────┤
│ 🔵 1. Person          (32)  │ ← Color, Hotkey, Name, Count
│ 🟢 2. Car             (18)  │
│ 🟡 3. Bicycle         (5)   │
│ 🔴 4. Traffic Sign    (12)  │ ← Currently selected (highlight)
│ ⚫ 5. ...                    │
│                              │
│ [Search classes...]          │ ← Filter classes
└──────────────────────────────┘
```

**Interaction**:
- Click: Select class
- Hotkey 1-9, 0: Quick select (first 10 classes)
- Type to search: Filters list in real-time
- Color indicator: HSL golden ratio colors

**Floating Selector** (appears after drawing bbox):
```
┌─────────────────────────────┐
│ Select Class:               │
│ ┌─────────────────────────┐ │
│ │ Type to search...       │ │ ← Auto-focused
│ └─────────────────────────┘ │
│                             │
│ 1. Person          [Ctrl+1]│ ← Shows hotkey
│ 2. Car             [Ctrl+2]│
│ 3. Bicycle         [Ctrl+3]│
│ ...                         │
└─────────────────────────────┘
```

**Features**:
- Auto-focus on search input
- Fuzzy search (e.g., "ped" matches "Pedestrian")
- Arrow keys: Navigate list
- Enter: Confirm selection
- Escape: Cancel, delete bbox

### 4. Attributes Panel

**Conditional Display**:
- Only visible when project has attributes enabled
- Shown in right panel when annotation selected

**Layout**:
```
┌─────────────────────────────┐
│ Attributes                  │
├─────────────────────────────┤
│ ☑ Occluded                  │ ← Checkbox
│ ☑ Truncated                 │
│ ☐ Difficult                 │
│                             │
│ Pose: [Dropdown ▼]          │ ← Dropdown
│   ○ Front                   │
│   ○ Back                    │
│   ○ Side                    │
│   ○ Other                   │
│                             │
│ Quality: ●●●○○ (3/5)        │ ← Star rating
└─────────────────────────────┘
```

**Types Supported**:
1. **Boolean** (checkbox)
2. **Radio** (single choice)
3. **Dropdown** (single choice, many options)
4. **Multi-select** (multiple choices)
5. **Number** (slider or input)
6. **Text** (short text input)
7. **Rating** (1-5 stars)

**Auto-Apply**:
- Option to apply same attributes to all new bboxes
- "Use as default" checkbox
- Useful for batch labeling similar objects

### 5. Image List (Left Panel)

#### Visual Design

**Layout**:
```
┌──────────────────────────────────┐
│ Images (209)          [Filter ▼] │ ← Total count, Filter dropdown
├──────────────────────────────────┤
│ ┌───────┐ ┌───────┐              │
│ │ ✓     │ │       │              │ ← 2-column grid
│ │ 001   │ │ 002   │              │   Checkmark = completed
│ └───────┘ └───────┘              │   Number = image index
│                                  │
│ ┌───────┐ ┌───────┐              │
│ │ ✓     │ │ 🔵    │              │ ← Blue border = current
│ │ 003   │ │ 004   │              │
│ └───────┘ └───────┘              │
│                                  │
│ ┌───────┐ ┌───────┐              │
│ │       │ │ ⚠     │              │ ← Warning icon = needs review
│ │ 005   │ │ 006   │              │
│ └───────┘ └───────┘              │
│                                  │
│ ... (scroll)                     │
└──────────────────────────────────┘
```

**Thumbnail Specifications**:
- **Size**: 120x80px per thumbnail
- **Aspect Ratio**: Maintain original (letterbox if needed)
- **Border**:
  - Default: 2px gray (#374151)
  - Current: 3px violet (#9333ea)
  - Hover: 2px violet-light (#c084fc)
  - Completed: 2px green (#22c55e)
- **Overlay Icons**:
  - ✓ (top-right): Completed (has annotations)
  - ⚠ (top-right): Needs review (validation error)
  - 🤖 (top-left): AI-assisted
  - 🔒 (bottom-right): Locked by another user

**Image Number Badge**:
- Position: Bottom-left
- Background: Semi-transparent black (rgba(0, 0, 0, 0.7))
- Text: White, 10px
- Format: "001", "002", ... (zero-padded)

**Progress Indicator** (per image):
- Thin bar at bottom (2px height)
- Color gradient based on annotation count:
  - 0 annotations: Gray
  - 1-5 annotations: Yellow
  - 6+ annotations: Green

#### Interaction

**Click Behavior**:
- **Single Click**: Jump to image (loads in canvas)
- **Right Click**: Context menu
  - "Skip this image"
  - "Mark as completed"
  - "Mark for review"
  - "Copy URL"
- **Hover**: Show tooltip with metadata
  - Filename
  - Dimensions
  - Annotation count
  - Last modified

**Keyboard Navigation** (when list focused):
- `J` / `Down`: Next image
- `K` / `Up`: Previous image
- `Enter`: Select highlighted image
- `Space`: Toggle completed status
- `M`: Mark for review

**Filter Dropdown**:
- **All Images** (default)
- **Not Started** (0 annotations)
- **In Progress** (1+ annotations, not marked complete)
- **Completed** (marked as done)
- **Needs Review** (flagged)
- **AI-Assisted** (has AI predictions)

**Sort Options** (secondary dropdown):
- **By Number** (default)
- **By Completion** (not started → completed)
- **By Annotation Count** (ascending/descending)
- **By Last Modified** (recent first)
- **By Filename** (alphabetical)

#### Smart Features

**Auto-Scroll**:
- When navigating via Prev/Next buttons, list auto-scrolls to current image
- Current image always visible (scroll if out of view)

**Batch Selection** (Advanced):
- `Shift + Click`: Select range
- `Ctrl + Click`: Multi-select
- Bulk actions bar appears: "5 images selected [Mark Complete] [Export] [Delete]"

**Search** (Optional):
- Search bar at top
- Filter by filename
- Type to filter in real-time

**Preview on Hover** (Optional):
- Larger preview image (200x200px) appears on hover
- Shows first 3 annotation bboxes overlaid
- Helpful for quick review

#### Performance

**Lazy Loading**:
- Render only visible thumbnails (virtualized list)
- Load ±20 images buffer
- Use Intersection Observer API

**Thumbnail Generation**:
- Backend pre-generates thumbnails (150x100px)
- Stored in S3/MinIO
- Served via presigned URLs

**Caching**:
- Browser cache thumbnails
- Preload next 10 images in background

### 6. Annotations List (Right Panel)

**Layout**:
```
┌──────────────────────────────────┐
│ Annotations (4)        [Clear]   │
├──────────────────────────────────┤
│ 🔵 Person #1          👁 🗑      │ ← Visibility, Delete
│   W: 240 x H: 360                │
│   Conf: 95%                      │ ← AI confidence (if applicable)
│                                  │
│ 🟢 Car #2             👁 🗑      │
│   W: 180 x H: 120                │
│                                  │
│ 🟡 Bicycle #3         👁 🗑      │ ← Currently selected (highlight)
│   W: 160 x H: 200                │
│   ⚠ Too small                    │ ← Warning
│                                  │
│ 🔴 Traffic Sign #4    👁 🗑      │
│   W: 40 x H: 60                  │
└──────────────────────────────────┘
```

**Interactions**:
- Click annotation: Select on canvas
- Eye icon: Toggle visibility
- Delete icon: Remove annotation (with confirmation)
- Hover: Highlight on canvas
- Keyboard: Up/Down arrows to navigate

**Features**:
- Auto-scroll to selected annotation
- Sort by: Class, Size, Confidence, Creation time
- Filter by class (dropdown)
- Bulk actions: Hide all, Delete all, Export

### 7. Navigation Controls (Bottom Bar)

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│ [◀ Prev]  Image 32 of 209  [▶ Next]  │  [🗑 Delete All] [📋 Copy] [🤖 AI] │
│                                       │                                   │
│ Progress: ████████░░░░░░ 38%          │  Auto-save: ✓ Saved 2s ago      │
└─────────────────────────────────────────────────────────────────┘
```

**Prev/Next Buttons**:
- Keyboard: `A` (prev), `D` (next)
- Shows preview tooltip on hover
- Disabled at edges (first/last image)
- Smart navigation: Skip completed (optional)

**Image Counter**:
- Click: Jump to image modal
- Type number + Enter: Go to image N
- Shows completion status (✓ if annotated)

**Bulk Actions**:
- **Delete All**: Remove all annotations on current image (confirm)
- **Copy from Previous**: Duplicate annotations from image N-1 (useful for video frames)
- **AI Assist**: Run model predictions, import as annotations

**Progress Bar**:
- Percentage complete
- Color: Gradient violet to green
- Click: Show statistics modal

**Auto-save Indicator**:
- ✓ Saved: Green checkmark
- 💾 Saving...: Spinner
- ⚠ Error: Red exclamation, retry button

---

## Interaction Patterns

### Drawing Bounding Box (Detailed Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. USER ACTIVATES TOOL                                         │
│     - Clicks bbox tool OR presses R                             │
│     ↓                                                            │
│  2. CANVAS STATE CHANGES                                        │
│     - Cursor: crosshair                                         │
│     - Crosshair lines: visible                                  │
│     - Status: "Click and drag to draw bounding box"             │
│     ↓                                                            │
│  3. USER CLICKS (mousedown)                                     │
│     - Record start position (x1, y1)                            │
│     - Set drawing = true                                        │
│     ↓                                                            │
│  4. USER DRAGS (mousemove)                                      │
│     - Calculate current position (x2, y2)                       │
│     - Show preview bbox: dashed border                          │
│     - Show dimensions tooltip: "W: 240 x H: 180"                │
│     - Update in real-time (60fps)                               │
│     ↓                                                            │
│  5. USER RELEASES (mouseup)                                     │
│     - Finalize bbox coordinates                                 │
│     - Validate: width & height >= minSize (10px)                │
│     │                                                            │
│     ├─ VALID ──────────────────────────────────────────────────┐│
│     │   - Set drawing = false                                   ││
│     │   - Show class selector (floating)                        ││
│     │   - Auto-focus search input                               ││
│     │   ↓                                                        ││
│     │  6a. USER SELECTS CLASS                                   ││
│     │      - Via hotkey (1-9)                                   ││
│     │      - Via search + Enter                                 ││
│     │      - Via click                                          ││
│     │      ↓                                                     ││
│     │  7a. CREATE ANNOTATION                                    ││
│     │      - Generate unique ID                                 ││
│     │      - Add to annotations array                           ││
│     │      - Send POST /api/v1/annotations                      ││
│     │      - Show success toast: "Annotation added"             ││
│     │      - Select new annotation (show handles)               ││
│     │      - Tool remains active (ready for next)               ││
│     │                                                            ││
│     └─ INVALID ────────────────────────────────────────────────┐│
│         - Show error toast: "Bbox too small (min 10x10)"        ││
│         - Bbox border: red dashed                               ││
│         - User can resize OR press Escape to cancel             ││
│         - If resized to valid size, continue to step 6a         ││
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Editing Existing Annotation

**Select Annotation**:
1. Click bbox on canvas OR click in annotations list
2. Bbox highlights (pulsing border)
3. 8 handles appear (corners + midpoints)
4. Right panel shows annotation details

**Resize**:
1. Hover over handle: cursor changes (resize icon)
2. Click and drag handle
3. Bbox resizes in real-time
4. Dimensions tooltip updates
5. Release: Auto-saves to backend (debounced 500ms)

**Move**:
1. Hover inside bbox (not on handle): cursor = move
2. Click and drag
3. Bbox moves in real-time
4. Release: Auto-saves

**Change Class**:
1. With bbox selected, click class in left panel OR press hotkey
2. Bbox color updates immediately
3. Auto-saves to backend

**Delete**:
1. Select bbox, press Delete/Backspace
2. Confirmation modal: "Delete annotation?"
3. Confirm: DELETE /api/v1/annotations/{id}
4. Bbox fades out (200ms animation)

### Keyboard-Only Workflow (Power User)

```
Scenario: Label 100 images with bounding boxes

1. R                  → Activate bbox tool
2. Click-drag         → Draw first bbox
3. 1                  → Assign class "Person"
4. Click-drag         → Draw second bbox
5. 2                  → Assign class "Car"
6. D                  → Next image
7. R                  → (Tool still active from before)
8. Click-drag         → Draw bbox
9. 1                  → Same class as before
10. Ctrl+D            → Duplicate last bbox (for similar object)
11. D                 → Next image
12. Ctrl+V            → Paste annotations from previous image
13. D                 → Next image (skip if no changes)

Result: 13 actions to annotate 3 images (avg 4.3 actions/image)
```

### AI-Assisted Annotation Flow

**Scenario**: Model predictions available

```
1. User clicks [🤖 AI Assist] button
   ↓
2. Modal appears:
   ┌───────────────────────────────────────┐
   │ AI Assistance                     [×] │
   ├───────────────────────────────────────┤
   │ Run model predictions on this image?  │
   │                                       │
   │ Model: YOLOv8-medium                  │
   │ Expected time: ~2 seconds             │
   │                                       │
   │ ☑ Review each prediction             │ ← Option to auto-accept high confidence
   │ ☑ Only import conf > 80%             │
   │                                       │
   │ [Cancel]              [Run Model →]  │
   └───────────────────────────────────────┘
   ↓
3. Backend runs inference
   - POST /api/v1/annotations/ai-assist
   - Response: List of predicted bboxes with confidence
   ↓
4. Predictions appear on canvas
   - Dashed border (distinguishes from user annotations)
   - Confidence badge (e.g., "92%")
   - Different color (e.g., orange)
   ↓
5. User reviews predictions:
   - Accept: Click ✓ or press Space → Converts to solid annotation
   - Reject: Click ✗ or press X → Removes prediction
   - Edit: Drag handles to adjust → Converts to solid annotation
   - Accept all: Ctrl+Shift+A → Batch accept all predictions
   ↓
6. Accepted predictions saved to backend
   - POST /api/v1/annotations (batch)
   - Marked as AI-assisted (confidence stored)
   - User can edit later like normal annotations
```

---

## Keyboard Shortcuts

### Essential Shortcuts (Tier 1 - Must Know)

| Shortcut | Action | Context |
|----------|--------|---------|
| `R` | Activate Bbox tool | Global |
| `V` | Activate Select tool | Global |
| `1-9, 0` | Select class 1-10 | Drawing / Selected |
| `A` | Previous image | Global |
| `D` | Next image | Global |
| `Delete` / `Backspace` | Delete selected annotation | Selected |
| `Enter` | Save and next | Global |
| `Escape` | Cancel / Deselect | Drawing / Selected |
| `Space` | Pan mode (hold) | Global |

### Advanced Shortcuts (Tier 2 - Power Users)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl + Z` | Undo | Global |
| `Ctrl + Shift + Z` | Redo | Global |
| `Ctrl + S` | Force save | Global |
| `Ctrl + D` | Duplicate selected bbox | Selected |
| `Ctrl + A` | Select all annotations | Global |
| `Ctrl + V` | Paste from previous image | Global |
| `Ctrl + C` | Copy selected annotation | Selected |
| `Ctrl + 0` | Fit to screen | Global |
| `Ctrl + 1` | Zoom 100% | Global |
| `Ctrl + Plus` | Zoom in | Global |
| `Ctrl + Minus` | Zoom out | Global |
| `F` | Toggle fullscreen | Global |
| `[` | Toggle left panel | Global |
| `]` | Toggle right panel | Global |

### Expert Shortcuts (Tier 3 - Efficiency)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Shift + 1-9` | Assign attribute preset | Selected |
| `Ctrl + Shift + D` | Duplicate to all remaining images | Selected |
| `Ctrl + Shift + A` | Accept all AI predictions | AI-assisted |
| `G` | Go to image (opens jump modal) | Global |
| `S` | Toggle snap to edges | Global |
| `L` | Toggle labels visibility | Global |
| `H` | Hide selected annotation | Selected |
| `Ctrl + Shift + H` | Hide all annotations | Global |
| `T` | Toggle dark/light mode | Global |
| `?` | Show keyboard shortcuts help | Global |
| `Arrow keys` | Move selected bbox (1px) | Selected |
| `Shift + Arrows` | Move selected bbox (10px) | Selected |
| `Ctrl + Arrows` | Resize selected bbox | Selected |

### Keyboard Shortcuts Cheatsheet (In-App)

**Triggered by**: Press `?`

```
┌─────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                    [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TOOLS                         NAVIGATION                  │
│  R    Bounding Box             A    Previous Image         │
│  V    Select/Move              D    Next Image             │
│  P    Polygon                  G    Go to Image            │
│  C    Classification           Enter  Save & Next          │
│                                                             │
│  EDITING                       VIEW                        │
│  1-9  Select Class             Ctrl+0  Fit to Screen       │
│  Del  Delete                   Ctrl+1  Zoom 100%           │
│  Ctrl+Z  Undo                  Ctrl++  Zoom In             │
│  Ctrl+D  Duplicate             Ctrl+-  Zoom Out            │
│  Ctrl+C  Copy                  F       Fullscreen          │
│  Ctrl+V  Paste                 [       Toggle Left Panel   │
│                                ]       Toggle Right Panel  │
│                                                             │
│  ADVANCED                      AI                          │
│  Shift+1-9  Attribute Preset   Ctrl+Shift+A  Accept All    │
│  L          Labels On/Off      Space  Accept Prediction    │
│  S          Snap to Edges      X      Reject Prediction    │
│                                                             │
│  [ Show More Shortcuts → ]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## State Management

### Application State Architecture

```typescript
interface AnnotationState {
  // Image & Project
  currentImage: ImageData;
  images: ImageData[];
  currentIndex: number;
  project: Project;

  // Annotations
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  clipboard: Annotation | null;

  // UI State
  tool: 'select' | 'bbox' | 'polygon' | 'classification';
  canvas: {
    zoom: number;
    pan: { x: number; y: number };
    cursor: { x: number; y: number };
  };
  panels: {
    left: boolean;    // collapsed/expanded
    right: boolean;
  };

  // Interaction State
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;
  isDragging: boolean;
  dragTarget: 'bbox' | 'handle' | 'canvas';

  // Settings
  preferences: {
    autoSave: boolean;
    snapToEdges: boolean;
    showLabels: boolean;
    showGrid: boolean;
    darkMode: boolean;
    autoSelectClass: boolean;  // Remember last class
  };

  // AI
  aiPredictions: Prediction[];
  aiLoading: boolean;

  // History (Undo/Redo)
  history: {
    past: AnnotationSnapshot[];
    future: AnnotationSnapshot[];
  };

  // Network
  saveStatus: 'saved' | 'saving' | 'error';
  lastSaved: Date | null;
}
```

### Local Storage Strategy

**Persistent Data** (saved to localStorage):
```javascript
{
  "preferences": {
    "darkMode": true,
    "autoSave": true,
    "snapToEdges": true,
    "showLabels": true,
    "showGrid": false,
    "autoSelectClass": true
  },
  "lastProject": "proj_abc123",
  "lastImage": 32,
  "panelState": {
    "left": true,
    "right": true
  }
}
```

**Session Data** (saved to sessionStorage):
```javascript
{
  "clipboard": { /* annotation object */ },
  "recentClasses": [1, 3, 5],  // Last 3 used classes
  "undoStack": [ /* max 50 snapshots */ ]
}
```

### Auto-Save Mechanism

**Strategy**: Optimistic UI with background sync

```typescript
// Debounced auto-save (500ms after last change)
const autoSave = debounce(async (annotations: Annotation[]) => {
  setSaveStatus('saving');

  try {
    // 1. Update local state immediately (optimistic)
    updateLocalAnnotations(annotations);

    // 2. Batch save to backend
    await api.annotations.batchUpdate(annotations);

    // 3. Update status
    setSaveStatus('saved');
    setLastSaved(new Date());
  } catch (error) {
    // 4. On error, revert local state and show error
    setSaveStatus('error');
    revertToLastSaved();
    showErrorToast('Failed to save. Retrying...');

    // 5. Retry with exponential backoff
    retryWithBackoff(() => autoSave(annotations));
  }
}, 500);
```

### Undo/Redo Implementation

**Snapshot Strategy**:
```typescript
interface AnnotationSnapshot {
  timestamp: Date;
  annotations: Annotation[];
  action: 'create' | 'update' | 'delete' | 'move' | 'resize';
  affectedIds: string[];
}

// On every change
function recordSnapshot(action: string, affectedIds: string[]) {
  const snapshot: AnnotationSnapshot = {
    timestamp: new Date(),
    annotations: cloneDeep(currentAnnotations),
    action,
    affectedIds,
  };

  // Add to past stack
  history.past.push(snapshot);

  // Clear future (can't redo after new action)
  history.future = [];

  // Limit stack size (max 50)
  if (history.past.length > 50) {
    history.past.shift();
  }
}

// Undo
function undo() {
  if (history.past.length === 0) return;

  const current = {
    timestamp: new Date(),
    annotations: cloneDeep(currentAnnotations),
    action: 'undo',
    affectedIds: [],
  };

  const previous = history.past.pop();

  history.future.push(current);
  setAnnotations(previous.annotations);
  autoSave(previous.annotations);
}

// Redo
function redo() {
  if (history.future.length === 0) return;

  const current = {
    timestamp: new Date(),
    annotations: cloneDeep(currentAnnotations),
    action: 'redo',
    affectedIds: [],
  };

  const next = history.future.pop();

  history.past.push(current);
  setAnnotations(next.annotations);
  autoSave(next.annotations);
}
```

---

## Extensibility Strategy

### Task Type Abstraction

**Goal**: Support all 7 task types with minimal code duplication

**Architecture**:
```typescript
// Base annotation interface
interface BaseAnnotation {
  id: string;
  projectId: string;
  imageId: string;
  annotationType: 'classification' | 'bbox' | 'polygon' | 'line' | 'keypoints' | 'open_vocab';
  createdBy: number;
  createdAt: Date;
}

// Task-specific geometry
interface BboxGeometry {
  type: 'bbox';
  bbox: [number, number, number, number];  // [x, y, width, height]
}

interface PolygonGeometry {
  type: 'polygon';
  points: [number, number][];
}

interface KeypointsGeometry {
  type: 'keypoints';
  keypoints: [number, number, number][];  // [x, y, visibility]
  skeleton: string;  // 'coco_17', 'custom'
}

// Unified annotation type
type Annotation = BaseAnnotation & {
  geometry: BboxGeometry | PolygonGeometry | KeypointsGeometry | ...;
  classId?: string;
  className?: string;
  attributes?: Record<string, any>;
  caption?: string;  // For open vocabulary
};
```

**Tool Registration System**:
```typescript
interface AnnotationTool {
  id: string;
  name: string;
  icon: React.ComponentType;
  hotkey: string;

  // Rendering
  renderAnnotation: (annotation: Annotation, selected: boolean) => React.ReactNode;
  renderPreview: (startPoint: Point, currentPoint: Point) => React.ReactNode;

  // Interaction
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: (e: MouseEvent) => void;

  // Validation
  validate: (geometry: any) => { valid: boolean; error?: string };

  // Serialization
  toJSON: (geometry: any) => any;
  fromJSON: (json: any) => any;
}

// Register tools
const tools: Record<string, AnnotationTool> = {
  bbox: new BboxTool(),
  polygon: new PolygonTool(),
  classification: new ClassificationTool(),
  keypoints: new KeypointsTool(),
  line: new LineTool(),
  open_vocab: new OpenVocabTool(),
};

// Use in canvas
function renderAnnotations(annotations: Annotation[]) {
  return annotations.map(ann => {
    const tool = tools[ann.annotationType];
    return tool.renderAnnotation(ann, ann.id === selectedId);
  });
}
```

### Task-Specific UI Components

**Modular Right Panel**:
```tsx
function RightPanel({ annotation, taskType }) {
  return (
    <div className="right-panel">
      {/* Common sections */}
      <ClassSelector />

      {/* Task-specific sections */}
      {taskType === 'detection' && <AttributesPanel />}
      {taskType === 'keypoints' && <KeypointsEditor />}
      {taskType === 'open_vocab' && <CaptionEditor />}

      {/* Common sections */}
      <AnnotationsList />
      <ImageMetadata />
    </div>
  );
}
```

### Configuration-Driven UI

**Project Config Drives UI**:
```typescript
// From project.task_config
{
  "detection": {
    "bbox_types": ["horizontal", "rotated"],
    "min_bbox_size": 10,
    "enable_attributes": true,
    "attributes": [
      { "name": "occluded", "type": "boolean" },
      { "name": "pose", "type": "radio", "options": ["front", "back", "side"] }
    ]
  },
  "classification": {
    "mode": "single-label",  // or "multi-label"
    "hierarchical": false
  },
  "keypoints": {
    "skeleton": "coco_17",
    "keypoint_labels": ["nose", "left_eye", "right_eye", ...]
  }
}

// UI adapts based on config
function AttributesPanel({ config }) {
  if (!config.detection?.enable_attributes) return null;

  return (
    <div>
      {config.detection.attributes.map(attr => (
        <AttributeInput key={attr.name} attribute={attr} />
      ))}
    </div>
  );
}
```

---

## Performance Considerations

### Rendering Optimization

**Canvas Rendering**:
1. **Virtual Canvas**: Only render visible annotations (viewport culling)
2. **RAF Batching**: Batch canvas updates with requestAnimationFrame
3. **Layer Separation**: Static image on bottom canvas, dynamic annotations on top canvas
4. **Debounced Redraw**: Throttle redraw during pan/zoom (60fps max)

```typescript
// Viewport culling
function getVisibleAnnotations(
  annotations: Annotation[],
  viewport: Viewport
): Annotation[] {
  return annotations.filter(ann => {
    const bounds = getAnnotationBounds(ann);
    return intersects(bounds, viewport);
  });
}

// RAF batching
let pendingUpdate = false;

function scheduleRedraw() {
  if (pendingUpdate) return;

  pendingUpdate = true;
  requestAnimationFrame(() => {
    redrawCanvas();
    pendingUpdate = false;
  });
}
```

**React Optimization**:
1. **React.memo**: Memoize expensive components (AnnotationsList, ClassSelector)
2. **useMemo**: Cache computed values (filtered classes, annotation bounds)
3. **useCallback**: Stabilize event handlers
4. **Virtualized Lists**: Use react-window for long annotation lists (>100 items)

### Network Optimization

**Batch Operations**:
```typescript
// Instead of saving each annotation individually
await Promise.all(annotations.map(ann => api.save(ann)));  // ❌ N requests

// Batch save
await api.annotations.batchUpdate(annotations);  // ✅ 1 request
```

**Image Preloading**:
```typescript
// Preload next 3 images in background
useEffect(() => {
  const nextImages = images.slice(currentIndex + 1, currentIndex + 4);

  nextImages.forEach(img => {
    const image = new Image();
    image.src = img.url;  // Triggers browser cache
  });
}, [currentIndex]);
```

**Optimistic UI**:
```typescript
// Update UI immediately, sync to backend later
function createAnnotation(annotation: Annotation) {
  // 1. Update local state (instant feedback)
  setAnnotations(prev => [...prev, annotation]);

  // 2. Save to backend (async)
  api.annotations.create(annotation)
    .catch(error => {
      // Revert on error
      setAnnotations(prev => prev.filter(a => a.id !== annotation.id));
      showError('Failed to save annotation');
    });
}
```

### Memory Management

**Large Datasets**:
```typescript
// Limit annotations in memory
const MAX_IMAGES_IN_MEMORY = 100;

// Keep only current image + buffer
const buffer = {
  before: images.slice(Math.max(0, currentIndex - 10), currentIndex),
  current: images[currentIndex],
  after: images.slice(currentIndex + 1, currentIndex + 11),
};

// Unload images far from current position
useEffect(() => {
  const toUnload = images.filter((img, idx) =>
    Math.abs(idx - currentIndex) > 50
  );

  toUnload.forEach(img => {
    // Release image data
    if (img.data) {
      URL.revokeObjectURL(img.data);
      img.data = null;
    }
  });
}, [currentIndex]);
```

---

## Implementation Roadmap

### Phase 1: Core Canvas (Week 1)

**Goals**:
- ✅ Functional image viewer with zoom/pan
- ✅ Basic bbox drawing and rendering
- ✅ Class selection
- ✅ Save to backend

**Deliverables**:
1. Canvas component with zoom/pan
2. Bbox tool (draw, select, edit)
3. Class selector (left panel)
4. Integration with existing APIs
5. Basic keyboard shortcuts (R, V, 1-9, Delete)

**Success Criteria**:
- Can draw and save bboxes
- Can navigate between images
- Auto-saves work reliably

### Phase 2: Advanced Features (Week 2)

**Goals**:
- ✅ Full keyboard shortcuts
- ✅ Undo/redo
- ✅ Annotations list
- ✅ Attributes panel

**Deliverables**:
1. Complete keyboard shortcut system
2. Undo/redo implementation
3. Right panel (annotations list, attributes)
4. Minimap
5. Grid and snap-to-edges

**Success Criteria**:
- Power users can annotate without mouse
- Can undo mistakes
- Can manage complex scenes (10+ bboxes)

### Phase 3: AI Integration (Week 3)

**Goals**:
- ✅ AI-assisted annotation
- ✅ Model predictions import
- ✅ Confidence scores

**Deliverables**:
1. AI Assist button
2. Predictions rendering (dashed boxes)
3. Accept/reject UI
4. Batch operations

**Success Criteria**:
- Can import and review model predictions
- 3x faster annotation with AI assist

### Phase 4: Polish & Optimization (Week 4)

**Goals**:
- ✅ Performance optimization
- ✅ Responsive design
- ✅ Error handling
- ✅ User testing

**Deliverables**:
1. Performance profiling and fixes
2. Loading states and error boundaries
3. Confirmation modals
4. Onboarding tutorial
5. User feedback collection

**Success Criteria**:
- 60fps canvas rendering
- < 2s image load time
- Positive user feedback

### Phase 5: Multi-Task Support (Weeks 5-6)

**Goals**:
- ✅ Polygon tool
- ✅ Classification UI
- ✅ Keypoints (basic)

**Deliverables**:
1. Polygon drawing tool
2. Classification interface (dropdowns)
3. Keypoints tool (skeleton overlay)
4. Task switcher UI

**Success Criteria**:
- All 3 core task types work
- Consistent UX across task types

---

## Appendix

### Color Palette (Annotation Colors)

**Class Colors** (Generated via HSL golden ratio):
- Hue: `(index * 0.618033988749895) % 1.0`
- Saturation: 0.7 (70%)
- Lightness: 0.5 (50%)

**UI Colors** (From DESIGN_SYSTEM.md):
- Primary: Violet (#9333ea)
- Background: Gray-900 (#111827)
- Canvas: Gray-800 (#1f2937)
- Text: White (#ffffff) / Gray-300 (#d1d5db)

### Accessibility

**WCAG 2.1 AA Compliance**:
- Color contrast: 4.5:1 for text, 3:1 for UI elements
- Keyboard navigation: All functions accessible
- Screen reader: ARIA labels on all controls
- Focus indicators: Visible 2px outline

**Keyboard-Only Support**:
- Tab navigation through panels
- Arrow keys for canvas navigation
- Hotkeys for all tools and actions

### Browser Support

**Target Browsers**:
- Chrome 100+ (Primary)
- Edge 100+
- Firefox 100+
- Safari 15+ (Best effort)

**Required Features**:
- Canvas API
- ES2020 (async/await, optional chaining)
- CSS Grid & Flexbox
- Local Storage

### References

- [CVAT Architecture](https://github.com/opencv/cvat)
- [Label Studio Docs](https://labelstud.io/guide/)
- [Roboflow Annotate](https://docs.roboflow.com/annotate)
- [Fabric.js Canvas Library](http://fabricjs.com/)
- [Konva.js Canvas Library](https://konvajs.org/)

---

**Document Status**: Ready for Implementation ✅
**Next Step**: Begin Phase 1 - Core Canvas Development
**Owner**: Development Team
**Review Date**: 2025-11-21
