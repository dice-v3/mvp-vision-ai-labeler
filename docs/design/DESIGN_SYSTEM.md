# Vision AI Labeler - Design System

**Version**: 1.0
**Last Updated**: 2025-01-13
**Status**: Final

---

## 🎯 Overview

This design system ensures **visual consistency** between the Vision AI Labeler and the Vision AI Training Platform. All components, colors, typography, and spacing follow the same design language to provide a seamless user experience.

**Key Principles**:
- **Consistency**: Maintain visual harmony with the Platform
- **Accessibility**: WCAG 2.1 AA compliant color contrasts
- **Korean-First**: Optimized for Korean text with SUIT font
- **Dark Mode**: Support for dark theme in modals and overlays

---

## 🎨 Color Palette

### Primary Colors

```css
/* Violet (Primary Brand Color) */
violet-50:  #faf5ff
violet-100: #f3e8ff
violet-200: #e9d5ff
violet-300: #d8b4fe
violet-400: #c084fc  /* Primary accent */
violet-500: #a855f7
violet-600: #9333ea  /* Primary buttons */
violet-700: #7e22ce  /* Primary hover */
violet-800: #6b21a8
violet-900: #581c87

/* Fuchsia/Purple (Secondary Accent) */
fuchsia-400: #e879f9
fuchsia-500: #d946ef
purple-400:  #c084fc
purple-500:  #a855f7
```

### Semantic Colors

```css
/* Success / Active */
green-100: #dcfce7
green-500: #22c55e
green-600: #16a34a
green-800: #166534
emerald-500: #10b981

/* Warning / Experimental */
yellow-500: #eab308

/* Error / Danger */
red-50:  #fef2f2
red-200: #fecaca
red-400: #f87171
red-500: #ef4444
red-800: #991b1b

/* Info */
blue-50:  #eff6ff
blue-100: #dbeafe
blue-200: #bfdbfe
blue-300: #93c5fd
blue-400: #60a5fa
blue-500: #3b82f6
blue-600: #2563eb  /* Info buttons */
blue-700: #1d4ed8  /* Info hover */
blue-800: #1e40af
blue-900: #1e3a8a

/* Neutral */
gray-50:  #f9fafb
gray-100: #f3f4f6
gray-200: #e5e7eb
gray-300: #d1d5db
gray-400: #9ca3af
gray-500: #6b7280
gray-600: #4b5563
gray-700: #374151
gray-800: #1f2937
gray-900: #111827  /* Dark backgrounds */
```

### Special Colors

```css
/* Indigo (Selection states) */
indigo-50:  #eef2ff
indigo-300: #a5b4fc
indigo-500: #6366f1
indigo-600: #4f46e5
```

### Gradients

```css
/* Primary Gradient */
.gradient-primary {
  background: linear-gradient(to right, #c084fc, #e879f9);
}

/* Gradient Text */
.gradient-text {
  background: linear-gradient(to right, #c084fc, #e879f9);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* Animated Gradient (Background) */
@keyframes gradient-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient {
  background: linear-gradient(270deg, #c084fc, #e879f9, #a855f7);
  background-size: 400% 400%;
  animation: gradient-rotate 15s ease infinite;
}
```

---

## 📝 Typography

### Font Family

```typescript
// tailwind.config.ts
fontFamily: {
  sans: ['var(--font-suit)', 'system-ui', 'sans-serif']
}

// layout.tsx (SUIT font setup)
import localFont from 'next/font/local'

const suit = localFont({
  src: './fonts/SUIT-Variable.woff2',
  variable: '--font-suit',
  display: 'swap',
  weight: '100 900',
})

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={suit.variable}>
      <body className={suit.className}>
        {children}
      </body>
    </html>
  )
}
```

### Font Sizes

```css
text-xs:   0.75rem   (12px)
text-sm:   0.875rem  (14px)
text-base: 1rem      (16px)
text-lg:   1.125rem  (18px)
text-xl:   1.25rem   (20px)
text-2xl:  1.5rem    (24px)
```

### Font Weights

```css
font-normal:   400
font-medium:   500  /* Labels, badges */
font-semibold: 600  /* Headings, buttons */
font-bold:     700  /* Card titles, emphasis */
```

### Typography Scale

```tsx
/* Headings */
<h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
<h2 className="text-lg font-semibold text-gray-900">Section Title</h2>
<h3 className="text-base font-semibold text-gray-900">Card Title</h3>

/* Body Text */
<p className="text-sm text-gray-600">Body text</p>
<p className="text-xs text-gray-500">Helper text</p>

/* Labels */
<label className="text-sm font-medium text-gray-700">Input Label</label>

/* Korean Text (Avatar Initials) */
// Extract 2 characters for Korean names
const getAvatarInitials = (name: string) => {
  if (/[가-힣]/.test(name)) {
    return name.slice(0, 2); // "홍길동" → "홍길"
  }
  // English names: first + last initial
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}
```

---

## 📐 Spacing System

### Padding

```css
p-1:  0.25rem  (4px)
p-2:  0.5rem   (8px)
p-3:  0.75rem  (12px)
p-4:  1rem     (16px)
p-6:  1.5rem   (24px)

/* Common Patterns */
px-2 py-1    /* Small badges */
px-4 py-2    /* Buttons, inputs */
px-4 py-2.5  /* Medium inputs */
px-4 py-3    /* Large inputs */
px-6 py-4    /* Card padding */
```

### Margin

```css
m-1:  0.25rem  (4px)
m-2:  0.5rem   (8px)
m-3:  0.75rem  (12px)
m-4:  1rem     (16px)
m-6:  1.5rem   (24px)

/* Common Patterns */
mb-1  /* Tight spacing */
mb-2  /* Standard spacing */
mb-3  /* Section spacing */
mt-4  /* Top spacing after content */
```

### Gap (Flexbox/Grid)

```css
gap-1: 0.25rem  (4px)
gap-2: 0.5rem   (8px)
gap-3: 0.75rem  (12px)

/* Common Patterns */
flex gap-2       /* Badge groups */
flex gap-3       /* Button groups */
grid gap-3       /* Stats grid */
```

---

## 🔲 Border Radius

```css
rounded:     0.25rem   (4px)   /* Small elements */
rounded-md:  0.375rem  (6px)   /* Badges, small buttons */
rounded-lg:  0.5rem    (8px)   /* Inputs, cards, buttons */
rounded-xl:  0.75rem   (12px)  /* Large cards */
rounded-2xl: 1rem      (16px)  /* Modals */
rounded-full: 9999px           /* Pills, avatars, circular badges */
```

**Usage**:
- **Buttons/Inputs**: `rounded-lg`
- **Cards**: `rounded-lg` or `rounded-xl`
- **Modals**: `rounded-2xl`
- **Badges**: `rounded-full` or `rounded-md`
- **Avatars**: `rounded-full`

---

## 🎭 Shadows

```css
/* Standard Shadows */
shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.05)
shadow-md:   0 4px 6px rgba(0, 0, 0, 0.1)
shadow-lg:   0 10px 15px rgba(0, 0, 0, 0.1)
shadow-xl:   0 20px 25px rgba(0, 0, 0, 0.1)
shadow-2xl:  0 25px 50px rgba(0, 0, 0, 0.25)

/* Custom Glow Shadows */
shadow-glow-violet:  0 0 20px rgba(139, 92, 246, 0.4)
shadow-glow-emerald: 0 0 20px rgba(16, 185, 129, 0.4)
```

**Usage**:
- **Hover states**: `hover:shadow-sm` or `hover:shadow-md`
- **Cards**: `shadow-md` when selected
- **Modals**: `shadow-2xl`
- **Buttons**: `shadow-lg` on primary buttons
- **Glow effects**: Use on special elements or active states

---

## ✨ Animations

### Scale In (Modal Entry)

```css
@keyframes scale-in {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
```

### Gradient Animations

```css
/* Rotating Gradient */
@keyframes gradient-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Horizontal Gradient Movement */
@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

### Slide In (Side Panel)

```tsx
<div className={`
  transform transition-transform duration-200 ease-out
  ${isOpen ? 'translate-x-0' : 'translate-x-full'}
`}>
  {/* Panel content */}
</div>
```

### Transitions

```css
/* Standard Transitions */
transition-colors    /* 150ms - color changes */
transition-all       /* 150ms - all properties */
duration-200         /* 200ms - medium speed */

/* Common Patterns */
transition-all duration-200       /* Hover effects */
transition-colors                 /* Button hover */
transition-transform duration-200 /* Slide panels */
```

---

## 🧩 Component Library

### 1. Buttons

#### Primary Button

```tsx
<button className="
  px-4 py-2.5 rounded-lg font-semibold
  bg-violet-600 hover:bg-violet-700 text-white
  transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
  shadow-lg hover:shadow-xl
">
  Primary Action
</button>
```

#### Secondary Button

```tsx
<button className="
  px-4 py-2 rounded-lg font-medium
  bg-blue-600 hover:bg-blue-700 text-white
  transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Secondary Action
</button>
```

#### Tertiary/Outline Button

```tsx
<button className="
  px-4 py-2.5 rounded-lg font-medium
  border border-gray-300 text-gray-700
  hover:bg-gray-50
  transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Cancel
</button>
```

#### Danger Button

```tsx
<button className="
  px-4 py-2 rounded-lg font-medium
  bg-red-600 hover:bg-red-700 text-white
  transition-colors
">
  Delete
</button>
```

#### Link Button

```tsx
<button className="
  font-semibold text-violet-400 hover:text-violet-300
  transition-colors
">
  Learn More
</button>
```

#### Icon Button

```tsx
<button className="
  p-2 hover:bg-gray-100 rounded-lg
  transition-colors
">
  <IconComponent className="w-5 h-5 text-gray-600" />
</button>
```

---

### 2. Inputs & Forms

#### Text Input (Light Mode)

```tsx
<div>
  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
    Label <span className="text-red-500">*</span>
  </label>
  <input
    type="text"
    id="name"
    className="
      w-full px-4 py-2.5 border border-gray-300 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent
      text-sm
    "
    placeholder="Placeholder text"
  />
</div>
```

#### Text Input (Dark Mode)

```tsx
<input
  type="text"
  className="
    w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg
    focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent
    text-white placeholder-gray-500
  "
  placeholder="your@email.com"
/>
```

#### Textarea

```tsx
<textarea
  className="
    w-full px-4 py-2.5 border border-gray-300 rounded-lg
    focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent
    text-sm resize-none
  "
  rows={3}
  placeholder="Enter description..."
/>
```

#### Select Dropdown

```tsx
<select className="
  w-full px-4 py-2.5 border border-gray-300 rounded-lg
  focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent
  text-sm
">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

#### Error Message

```tsx
{error && (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-sm text-red-800">{error}</p>
  </div>
)}

{/* Dark mode variant */}
{error && (
  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
    <p className="text-sm text-red-400">{error}</p>
  </div>
)}
```

#### Info Box

```tsx
<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <h3 className="text-sm font-semibold text-blue-900 mb-2">
    Info Title
  </h3>
  <p className="text-xs text-blue-800">
    Helpful information goes here
  </p>
</div>

{/* Dark mode variant */}
<div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
  <p className="text-xs text-blue-400">
    Demo account: admin@example.com
  </p>
</div>
```

---

### 3. Cards

#### Standard Card

```tsx
<div className="
  p-4 rounded-lg border-2 border-gray-200 bg-white
  hover:border-gray-300 hover:shadow-sm
  transition-all cursor-pointer
">
  {/* Card content */}
</div>
```

#### Selected Card

```tsx
<div className={`
  p-4 rounded-lg border-2 cursor-pointer transition-all
  ${selected
    ? 'border-indigo-500 bg-indigo-50 shadow-md'
    : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
  }
`}>
  {/* Selected indicator */}
  {selected && (
    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    </div>
  )}
</div>
```

#### Model Card (Alternative Selection)

```tsx
<div className={`
  relative rounded-lg border-2 transition-all duration-200 cursor-pointer
  ${selected
    ? 'border-blue-500 bg-blue-50 shadow-lg'
    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
  }
`}>
  {/* Card content */}
</div>
```

#### Dark Mode Card

```tsx
<div className="
  bg-gray-900 rounded-2xl shadow-2xl
  border border-gray-800
">
  {/* Dark card content */}
</div>
```

---

### 4. Badges

#### Status Badge Component

```tsx
// components/ui/Badge.tsx
interface BadgeProps {
  variant: 'active' | 'experimental' | 'deprecated';
  children: React.ReactNode;
  className?: string;
}

const BADGE_STYLES = {
  active: 'bg-green-500 text-white',
  experimental: 'bg-yellow-500 text-white',
  deprecated: 'bg-gray-400 text-white',
};

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`
      px-2 py-1 rounded-full text-xs font-medium
      ${BADGE_STYLES[variant]}
      ${className}
    `}>
      {children}
    </span>
  );
}
```

#### Inline Badges

```tsx
{/* Success/Labeled */}
<span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Labeled
</span>

{/* Neutral */}
<span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
  COCO
</span>

{/* Role Badge (Owner) */}
<span className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
  Owner
</span>

{/* Role Badge (Member) */}
<span className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
  Member
</span>

{/* Framework Badge */}
<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
  timm
</span>

{/* Task Type Badge */}
<span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
  이미지 분류
</span>

{/* Special Feature Badge */}
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
  <Sparkles className="w-3 h-3" />
  특별 기능
</span>
```

#### Tag Badge

```tsx
<span className="px-2 py-0.5 text-xs bg-gray-50 text-gray-600 rounded">
  #tag-name
</span>
```

---

### 5. Modals

#### Modal Component

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export default function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`
            ${sizeClasses[size]} w-full
            bg-gray-900 rounded-2xl shadow-2xl
            border border-gray-800
            animate-scale-in
          `}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
```

---

### 6. Slide Panel

```tsx
interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

const widthClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]',
  xl: 'w-[40rem]',
};

export function SlidePanel({ isOpen, onClose, title, width = 'lg', children }: SlidePanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black z-40 transition-opacity duration-200
          ${isOpen ? 'bg-opacity-30' : 'bg-opacity-0'}
        `}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full ${widthClasses[width]}
          bg-white shadow-xl z-50
          transform transition-transform duration-200 ease-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
```

---

### 7. Sidebar

```tsx
<div className="w-64 h-screen bg-gray-900 text-white flex flex-col">
  {/* Logo */}
  <div className="p-6 border-b border-gray-800">
    <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
      Vision AI Labeler
    </h1>
  </div>

  {/* Navigation */}
  <nav className="flex-1 p-4">
    <a
      href="/projects"
      className="
        flex items-center gap-3 px-4 py-3 rounded-lg
        text-gray-300 hover:bg-gray-800 hover:text-violet-400
        transition-colors
      "
    >
      <FolderIcon className="w-5 h-5" />
      <span>Projects</span>
    </a>

    {/* Active link */}
    <a
      href="/datasets"
      className="
        flex items-center gap-3 px-4 py-3 rounded-lg
        bg-gray-800 text-violet-400
      "
    >
      <DatabaseIcon className="w-5 h-5" />
      <span>Datasets</span>
    </a>
  </nav>

  {/* User Section */}
  <div className="p-4 border-t border-gray-800">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
        <span className="text-sm font-semibold">홍길</span>
      </div>
      <div>
        <div className="text-sm font-medium">홍길동</div>
        <div className="text-xs text-gray-400">admin@example.com</div>
      </div>
    </div>
  </div>
</div>
```

---

### 8. Avatar

```tsx
// Avatar with dynamic color
interface AvatarProps {
  name?: string | null;
  email?: string | null;
  badgeColor?: string; // From backend
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function Avatar({ name, email, badgeColor, size = 'md' }: AvatarProps) {
  const getInitials = () => {
    if (name) {
      if (/[가-힣]/.test(name)) {
        return name.slice(0, 2); // Korean: first 2 characters
      }
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '?';
  };

  const getColorStyle = () => {
    if (badgeColor) {
      return { backgroundColor: badgeColor };
    }
    return { backgroundColor: '#9333ea' }; // Default violet-600
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        font-semibold text-white
        cursor-pointer hover:ring-2 hover:ring-offset-2 transition-all
      `}
      style={getColorStyle()}
      title={name ? `${name} (${email})` : email || 'Unknown'}
    >
      {getInitials()}
    </div>
  );
}
```

---

### 9. Visibility Icon Badge

```tsx
import { Globe, Lock } from 'lucide-react';

<span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 flex items-center gap-1">
  {visibility === 'public' ? (
    <Globe className="w-3 h-3 text-green-600" />
  ) : (
    <Lock className="w-3 h-3 text-gray-600" />
  )}
  <span className="capitalize">{visibility || 'private'}</span>
</span>
```

---

### 10. Stats Display

```tsx
<div className="grid grid-cols-2 gap-3 text-sm">
  <div>
    <span className="text-gray-500">Images:</span>
    <span className="ml-1 font-medium text-gray-900">
      {numImages.toLocaleString()}
    </span>
  </div>
  <div>
    <span className="text-gray-500">Size:</span>
    <span className="ml-1 font-medium text-gray-900">
      {sizeMb.toFixed(1)} MB
    </span>
  </div>
</div>
```

---

## 🎨 Usage Guidelines

### Color Usage

| Use Case | Light Mode | Dark Mode |
|----------|-----------|-----------|
| **Primary Action** | `bg-violet-600 hover:bg-violet-700` | Same |
| **Secondary Action** | `bg-blue-600 hover:bg-blue-700` | Same |
| **Danger Action** | `bg-red-600 hover:bg-red-700` | Same |
| **Background** | `bg-gray-50` | `bg-gray-900` |
| **Card Background** | `bg-white` | `bg-gray-900` |
| **Border** | `border-gray-200` | `border-gray-800` |
| **Text (Primary)** | `text-gray-900` | `text-white` |
| **Text (Secondary)** | `text-gray-600` | `text-gray-300` |
| **Text (Tertiary)** | `text-gray-500` | `text-gray-400` |
| **Input Background** | `bg-white` | `bg-gray-800` |
| **Input Border** | `border-gray-300` | `border-gray-700` |
| **Focus Ring** | `ring-violet-600` | `ring-violet-600` |

### Border & Shadow Hierarchy

```tsx
/* Default State */
border-2 border-gray-200

/* Hover State */
hover:border-gray-300 hover:shadow-sm

/* Selected State */
border-indigo-500 bg-indigo-50 shadow-md

/* Focus State (Inputs) */
focus:ring-2 focus:ring-violet-600 focus:border-transparent
```

### Interactive States

```tsx
/* Button States */
bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50

/* Link States */
text-violet-400 hover:text-violet-300

/* Card States */
border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer
```

---

## 📦 Setup Instructions

### 1. Install Tailwind CSS

```bash
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. Configure Tailwind

Create `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors (if needed beyond default Tailwind)
      },
      fontFamily: {
        sans: ['var(--font-suit)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(139, 92, 246, 0.4)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.4)',
      },
      keyframes: {
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'gradient-rotate': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.2s ease-out',
        'gradient-rotate': 'gradient-rotate 15s ease infinite',
      },
    },
  },
  plugins: [],
}
export default config
```

### 3. Add Global Styles

Create `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Global Styles */
body {
  @apply bg-gray-50 text-gray-900;
}

/* Animations */
@keyframes gradient-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes scale-in {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}

.animate-gradient {
  background: linear-gradient(270deg, #c084fc, #e879f9, #a855f7);
  background-size: 400% 400%;
  animation: gradient-rotate 15s ease infinite;
}

/* Gradient Text */
.gradient-text {
  @apply bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent;
}
```

### 4. Install SUIT Font

Download SUIT font and place in `app/fonts/`:

```
app/
  fonts/
    SUIT-Variable.woff2
```

Configure in `app/layout.tsx`:

```tsx
import localFont from 'next/font/local'
import './globals.css'

const suit = localFont({
  src: './fonts/SUIT-Variable.woff2',
  variable: '--font-suit',
  display: 'swap',
  weight: '100 900',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={suit.variable}>
      <body className={suit.className}>
        {children}
      </body>
    </html>
  )
}
```

### 5. Install Required Dependencies

```bash
npm install lucide-react  # Icon library
npm install clsx          # Classname utility
```

### 6. Create Utility Function

Create `lib/utils/cn.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwindcss-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 🧪 Testing Components

### Visual Regression Testing

```tsx
// components/__tests__/Button.test.tsx
import { render } from '@testing-library/react'
import Button from '../Button'

describe('Button', () => {
  it('renders primary button correctly', () => {
    const { container } = render(<Button variant="primary">Click me</Button>)
    expect(container).toMatchSnapshot()
  })

  it('applies correct hover styles', () => {
    const { getByRole } = render(<Button variant="primary">Hover me</Button>)
    const button = getByRole('button')
    expect(button).toHaveClass('bg-violet-600', 'hover:bg-violet-700')
  })
})
```

---

## 📋 Checklist for New Components

When creating new components, ensure:

- [ ] **Colors**: Use theme colors (violet, blue, gray, etc.)
- [ ] **Typography**: Use SUIT font and defined text sizes
- [ ] **Spacing**: Follow spacing system (p-4, gap-2, etc.)
- [ ] **Border Radius**: Use consistent rounded values
- [ ] **Shadows**: Apply appropriate shadow levels
- [ ] **Transitions**: Add smooth transitions for interactive elements
- [ ] **Dark Mode**: Support dark mode where applicable
- [ ] **Accessibility**: Include proper ARIA labels, keyboard navigation
- [ ] **Responsive**: Ensure mobile-friendly (even though desktop-focused)
- [ ] **Korean Text**: Test with Korean characters for proper rendering

---

## 🔄 Updates & Versioning

**Version History**:
- **v1.0** (2025-01-13): Initial design system based on Platform frontend analysis

**Future Improvements**:
- Add Storybook for component documentation
- Add accessibility testing guidelines
- Define responsive breakpoints strategy
- Document animation performance best practices

---

## 📞 Questions?

For design system questions or new component requests, refer to the Platform frontend source code at:
```
C:\Users\flyto\Project\Github\mvp-vision-ai-platform\platform\frontend
```

---

**Status**: Ready for Implementation ✅
