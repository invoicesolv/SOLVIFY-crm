# Solvify Brand Guide

## 🎨 Color System

### Primary Colors
```css
--primary-blue: #3B82F6;     /* Blue-500 */
--primary-indigo: #6366F1;   /* Indigo-500 */
--primary-cyan: #14B8A6;     /* Cyan-500 */
```

### Secondary Colors
```css
--success: #10B981;          /* Green-500 */
--error: #EF4444;           /* Red-500 */
--warning: #F59E0B;         /* Yellow-500 */
--info: #3B82F6;           /* Blue-500 */
--purple: #8B5CF6;         /* Purple-500 */
--pink: #EC4899;           /* Pink-500 */
```

### Neutral Colors
```css
--neutral-950: #0A0A0A;     /* Background */
--neutral-900: #171717;     /* Card Background */
--neutral-800: #262626;     /* Border */
--neutral-700: #404040;     /* Border Hover */
--neutral-500: #737373;     /* Muted Text */
--neutral-400: #A3A3A3;     /* Secondary Text */
--neutral-50: #FAFAFA;      /* Primary Text */
```

### Opacity Variants
- Background opacity: 5%, 10%, 20%
- Text opacity: 60%, 80%
- Border opacity: 10%, 20%

## 🔤 Typography

### Font Family
```css
--font-primary: 'Inter', sans-serif;
```

### Font Sizes
```css
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */
--text-2xl: 1.5rem;      /* 24px */
--text-3xl: 1.875rem;    /* 30px */
--text-4xl: 2.25rem;     /* 36px */
--text-6xl: 3.75rem;     /* 60px */
--text-7xl: 4.5rem;      /* 72px */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

## 🔷 Components

### Buttons
```css
/* Default Button */
.button-default {
  @apply inline-flex items-center justify-center whitespace-nowrap;
  @apply rounded-md text-sm font-medium;
  @apply bg-neutral-800 text-neutral-50 hover:bg-neutral-700;
  @apply h-10 px-4 py-2;
}

/* Outline Button */
.button-outline {
  @apply border border-neutral-700 bg-neutral-800;
  @apply hover:bg-neutral-700 hover:border-neutral-600;
  @apply text-neutral-50;
}

/* Ghost Button */
.button-ghost {
  @apply text-neutral-50 hover:bg-neutral-800;
}
```

### Cards
```css
.card {
  @apply rounded-lg border bg-card text-card-foreground shadow-sm;
  @apply border-neutral-800 bg-neutral-900;
  @apply p-4;
}
```

### Badges
```css
.badge {
  @apply inline-flex items-center rounded-full;
  @apply px-2.5 py-0.5 text-xs font-semibold;
  @apply transition-colors;
}
```

## 🎭 Effects & Animations

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

### Gradients
```css
/* Background Gradients */
.gradient-primary {
  @apply bg-gradient-to-br from-blue-900/20 via-neutral-950 to-indigo-900/20;
}

/* Text Gradients */
.gradient-text {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500;
}
```

### Glow Effects
```css
.glow {
  --glow-primary: rgba(59, 130, 246, 0.2);  /* Blue-500 at 20% */
  --glow-secondary: rgba(99, 102, 241, 0.2); /* Indigo-500 at 20% */
  filter: blur(100px);
}
```

## 📏 Spacing & Layout

### Border Radius
```css
--radius-sm: 0.125rem;    /* 2px */
--radius-md: 0.375rem;    /* 6px */
--radius-lg: 0.5rem;      /* 8px */
--radius-xl: 0.75rem;     /* 12px */
--radius-2xl: 1rem;       /* 16px */
--radius-full: 9999px;    /* Full rounded */
```

### Container Sizes
```css
--container-sm: 640px;    /* max-w-sm */
--container-md: 768px;    /* max-w-md */
--container-lg: 1024px;   /* max-w-lg */
--container-xl: 1280px;   /* max-w-xl */
--container-2xl: 1536px;  /* max-w-2xl */
```

### Grid System
- Base: 1 column mobile
- SM: 2 columns (640px)
- MD: 3 columns (768px)
- LG: 4 columns (1024px)
- XL: 5 columns (1280px)
- 2XL: 6 columns (1536px)

## 🎯 Best Practices

### Dark Theme Guidelines
1. Use neutral-950 as the base background
2. Use neutral-900 for card backgrounds
3. Use neutral-800 for borders
4. Use white text with appropriate opacity for hierarchy
5. Apply glow effects sparingly for emphasis
6. Use gradients to create depth

### Accessibility
1. Maintain contrast ratios:
   - Normal text: 4.5:1
   - Large text: 3:1
2. Include focus states with ring-2
3. Use semantic HTML elements
4. Provide hover states for interactive elements
5. Include aria-labels where necessary

### Component Hierarchy
1. Primary actions: Solid buttons
2. Secondary actions: Outline buttons
3. Tertiary actions: Ghost buttons
4. Use consistent spacing between elements
5. Maintain clear visual hierarchy through size and weight

### Animation Guidelines
1. Use transition-colors for color changes
2. Keep animations subtle and purposeful
3. Provide reduced-motion alternatives
4. Use consistent timing functions
5. Implement loading states appropriately

### Responsive Design
1. Mobile-first approach
2. Use relative units (rem, em)
3. Implement responsive typography
4. Maintain consistent spacing across breakpoints
5. Optimize touch targets for mobile 