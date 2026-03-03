# Aether POS - Accessibility Testing Checklist (WCAG 2.1 AA)

## Overview
Complete accessibility testing to ensure Aether POS is usable by everyone, including people with disabilities. Target: WCAG 2.1 Level AA compliance.

## Automated Testing

### axe DevTools (Browser Extension)

1. **Install Extension**
   - Chrome: [axe DevTools](https://chrome.google.com/webstore)
   - Firefox: [axe Devtools](https://addons.mozilla.org/firefox)
   - Edge: Available in Edge Web Store

2. **Run Tests on Each Page**
   - [ ] Login page
   - [ ] Dashboard
   - [ ] POS screen
   - [ ] Product catalog
   - [ ] Reports page
   - [ ] Settings page
   - [ ] User management

3. **Automatic Checks**
   - [ ] Color contrast (WCAG AA: 4.5:1 for text, 3:1 for large text)
   - [ ] Missing alt text
   - [ ] Missing form labels
   - [ ] Keyboard navigation issues
   - [ ] ARIA violations
   - [ ] Heading hierarchy

### Lighthouse Accessibility Audit

```bash
# Run Lighthouse from Chrome DevTools
1. Open page in Chrome
2. DevTools > Lighthouse tab
3. Select "Accessibility"
4. Click "Analyze page load"

# Or command line
npm install -g lighthouse
lighthouse https://localhost:5173 --view --chrome-flags="--headless"
```

**Target Score**: 90+/100

### WAVE Browser Extension

1. **Install Extension**
   - Homepage: [WAVE](https://wave.webaim.org/extension/)

2. **Run on All Pages**
   - Click WAVE icon on toolbar
   - Review identified issues:
     - Errors (red)
     - Contrast errors (red)
     - Alerts (yellow)
     - Structural elements (green)

3. **Report Format**
   - No red errors
   - No contrast issues
   - Yellow alerts reviewed & explained

## Manual Testing

### Keyboard Navigation

#### Test Keyboard-Only Usage
- [ ] **Tab Key**: Navigate through interactive elements
  - Login form: Email → Password → Submit → Login link
  - POS: Add item button → Quantity input → Remove button
  - Should follow logical order
  - No keyboard traps

- [ ] **Enter/Space**: Activate buttons and links
  - `<button>` activates with Enter
  - `<a>` activates with Enter
  - Checkboxes toggle with Space

- [ ] **Escape Key**: Close modals and dropdowns
  - Modal appears → Escape → Modal closes
  - Dropdown open → Escape → Dropdown closes

- [ ] **Arrow Keys**: Navigate lists and radio buttons
  - Radio group: Left/Right arrows switch selection
  - Combobox: Up/Down to navigate options
  - Tab bar: Left/Right to switch tabs

#### Test Focus Indicators
- [ ] Visible focus ring on all interactive elements
- [ ] Focus ring color contrasts with background
- [ ] Focus order is logical (top-to-bottom, left-to-right)
- [ ] No focus changes on hover
- [ ] Focus doesn't move unexpectedly

### Screen Reader Testing

#### Setup NVDA (Free, Windows)
```bash
# Download from https://www.nvaccess.org/
# Install and launch
# Configure Firefox for TeST
```

#### Setup JAWS (Paid, Windows)
- Professional grade screen reader
- More robust than NVDA

#### Setup VoiceOver (Mac/iOS)
- Built-in to macOS
- System Preferences > Accessibility > VoiceOver

#### Test Common Workflows

**Login with Screen Reader**
```
Expected Audio Output:
"Search results, region
 Email address, required, edit text, blank
 Press Tab to continue
 Password, required, edit text, blank
 Press Tab to continue
 Submit button
 Press Tab to continue
 Don't have an account? link
"
```

**POS Checkout**
```
Expected Output:
"Cart, region
 Item 1: Laptop, quantity 1, remove button
 Item 2: Mouse, quantity 2, remove button
 Subtotal: $1,299
 Tax: $104
 Total: $1,403
 Pay button
"
```

**Generate Report**
```
Expected Output:
"Sales report, heading
 Date range: March 1 to March 4, selected
 Product filter: All, dropdown
 Generate button
 Report results table
 Date column, Revenue column, Profit column
 200 rows of data
 Export to CSV button
"
```

#### Common Issues to Check
- [ ] Images have alt text describing content
- [ ] Form fields labeled (visible or `aria-label`)
- [ ] Buttons/links have descriptive text
- [ ] Tables have header tags (`<th>`)
- [ ] Lists use semantic HTML (`<ul>`, `<ol>`, `<li>`)
- [ ] Headings in logical order (h1 → h2 → h3)
- [ ] No reliance on color alone to convey meaning
- [ ] Video has captions
- [ ] Page structure is logical

### Color Contrast Testing

#### Using Contrast Checker
1. Install: [Contrast Checker](https://www.tpgi.com/color-contrast-checker/)
2. Test colors against WCAG AA standards:
   - **Text**: 4.5:1 minimum
   - **Large text** (18pt+): 3:1 minimum
   - **UI components**: 3:1 minimum

#### Common Contrast Issues
```
❌ Light gray text (#999) on white (#FFF) = 4.48:1 (FAIL - too light)
✅ Dark gray text (#646464) on white (#FFF) = 7.54:1 (PASS)

❌ Dark blue (#003366) on black (#000) = 2.1:1 (FAIL - too similar)
✅ Light blue (#0066FF) on dark (#333) = 8.5:1 (PASS)
```

#### Audit All Colors
- [ ] Text on background
- [ ] Button background + text
- [ ] Links on background
- [ ] Focus indicators
- [ ] Icons and graphics
- [ ] Hover states
- [ ] Disabled states
- [ ] Error messages

### Form Label Association

#### Test All Forms
- [ ] Every input has a label
- [ ] Label linked with `<label for="id">`
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error messages associated with fields
- [ ] Helper text available
- [ ] Placeholder not used as label

**Example Good Form**:
```html
<div class="form-group">
  <label for="email">Email Address <span aria-label="required">*</span></label>
  <input
    id="email"
    type="email"
    required
    aria-required="true"
    aria-describedby="email-help"
  />
  <span id="email-help" class="help-text">
    We'll never share your email
  </span>
</div>
```

### Image Alt Text

#### Audit All Images
- [ ] Button icons: Descriptive alt or `role="presentation"`
- [ ] Product images: `alt="Product name - brief description"`
- [ ] Charts/graphs: `alt="Bar chart showing sales by region..."`
- [ ] Logo: `alt="Aether POS"`
- [ ] Decorative images: `alt=""` (empty)
- [ ] No alt text like "image-123.jpg"

**Examples**:
```html
<!-- Good: Descriptive -->
<img src="laptop.jpg" alt="Dell Latitude 5000 laptop, 15-inch screen" />

<!-- Good: Decorative (empty) -->
<img src="decorative-line.svg" alt="" role="presentation" />

<!-- Bad: Redundant -->
<img src="products/456.jpg" alt="image" />

<!-- Bad: Too vague -->
<img src="pic.jpg" alt="stuff" />
```

## Semantic HTML Testing

### Correct Use of Heading Tags
- [ ] Page has one `<h1>`
- [ ] Headings in order (h1 → h2 → h3, no gaps)
- [ ] Headings describe section content
- [ ] Not using bold for "fake" heading

### Correct Use of Lists
- [ ] Bullet lists use `<ul>`
- [ ] Numbered lists use `<ol>`
- [ ] Menu items don't use `<div>` with links
- [ ] List items use `<li>`

### Table Semantics
- [ ] Data tables have `<th>` for headers
- [ ] `<th scope="col">` for column headers
- [ ] `<th scope="row">` for row headers
- [ ] `<caption>` describes table purpose
- [ ] Complex tables have `id` and `headers` attributes

**Example Good Table**:
```html
<table>
  <caption>Daily Sales Summary</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Revenue</th>
      <th scope="col">Profit</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>March 1</td>
      <td>$5,200</td>
      <td>$1,200</td>
    </tr>
  </tbody>
</table>
```

### Form Semantics
- [ ] Forms use `<form>` tag
- [ ] Fieldsets for related fields
- [ ] Legends for fieldsets
- [ ] Radio buttons properly grouped
- [ ] Checkboxes properly grouped

## ARIA (Accessible Rich Internet Applications)

### When to Use ARIA
- Only when semantic HTML isn't sufficient
- Prefer semantic HTML first
- ARIA is a fallback for custom components

### ARIA Landmarks
- [ ] Bypass nav links at top
- [ ] `<main>` for main content
- [ ] `<nav>` for navigation
- [ ] `<aside>` for complementary content
- [ ] `<footer>` for footer
- [ ] `role="contentinfo"` for footer info
- [ ] `aria-label`/`aria-labelledby` for regions without visible labels

### ARIA States & Properties
- [ ] `aria-expanded`: Dropdowns and toggles
- [ ] `aria-current`: Current page in navigation
- [ ] `aria-disabled`: Disabled controls
- [ ] `aria-invalid`: Form validation
- [ ] `aria-required`: Required fields
- [ ] `aria-live`: Dynamic content updates
- [ ] `aria-describedby`: Additional descriptions

## Responsive Design & Mobile Accessibility

### Responsive Testing
- [ ] Page works on mobile (320px width)
- [ ] Page works on tablet (768px width)
- [ ] Page works on desktop (1920px width)
- [ ] Text readable without zoom
- [ ] Touch targets ≥48x48 pixels
- [ ] No horizontal scrolling at zoom 200%
- [ ] Orientation change works (portrait/landscape)

### Mobile Touch Testing
- [ ] Buttons are large enough to tap
- [ ] Forms don't require tiny inputs
- [ ] Mobile keyboard doesn't hide content
- [ ] Pinch-zoom works
- [ ] Double-tap functionality clear

## Video & Multimedia Accessibility

### Video Captions
- [ ] All videos have captions
- [ ] Captions include dialogue and sounds
- [ ] Captions are accurate and synchronized
- [ ] Captions include speaker identification

**Example Caption**:
```
[00:00] NARRATOR: Welcome to Aether POS
[00:02] [Register sound]
[00:03] CUSTOMER: Can I see the price?
[00:05] CASHIER: Of course, that'll be $9.99
```

### Audio Descriptions
- [ ] Important visual information described
- [ ] Descriptions don't obscure dialogue
- [ ] Text version available as alternative

## Error Prevention & Management

### Error Messages
- [ ] Errors identified
- [ ] Errors located near input
- [ ] Errors describe problem clearly
- [ ] Errors suggest solution
- [ ] Errors don't use only color

**Example Good Error**:
```
❌ Email address (required)
   Error: "Please enter a valid email address (e.g., user@example.com)"
   [Input field highlighted in red]
```

**Example Bad Error**:
```
❌ [Only shows red border, no message text]
```

### Confirmation Messages
- [ ] Success messages announced
- [ ] Error messages announced
- [ ] Messages don't disappear too quickly
- [ ] Messages can be navigated to with keyboard

## Automated Accessibility Testing

### Jest/Testing Library Tests
```typescript
describe('Accessibility', () => {
  it('should have proper heading structure', () => {
    render(<Page />);
    const h1 = screen.queryByRole('heading', { level: 1 });
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h1).toBeInTheDocument(); // One h1
    expect(h2.length).toBeGreaterThan(0); // Multiple h2s
  });

  it('should have contrast ratio > 4.5:1', async () => {
    render(<Component />);
    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });

  it('form inputs should have labels', () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText('Email Address');
    expect(emailInput).toBeInTheDocument();
  });
});
```

### Playwright Accessibility Tests
```typescript
test('page should have no accessibility violations', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  const accessibilityScanResults = await injectAxe(page);
  expect(accessibilityScanResults.violations).toEqual([]);
});
```

## Testing Checklist

### Perception (Can users see/hear content?)
- [ ] Color contrast ≥4.5:1
- [ ] Text readable without magnification
- [ ] Images have alt text
- [ ] Videos have captions
- [ ] No flashing content (risk of seizures)
- [ ] Colors not only way to convey information

### Operability (Can users navigate and control?)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] No keyboard traps
- [ ] Touch targets ≥48x48 pixels
- [ ] Links/buttons have visible focus
- [ ] No automatic time limits on actions
- [ ] Skip navigation link at top

### Understandability (Can users understand content/interface?)
- [ ] Language of page specified
- [ ] Page title descriptive
- [ ] Headings logical
- [ ] Form instructions clear
- [ ] Error messages helpful
- [ ] Jargon minimized

### Robustness (Works with assistive technology?)
- [ ] Valid HTML structure
- [ ] ARIA correctly used
- [ ] No keyboard traps
- [ ] Forms properly labeled
- [ ] Screen reader compatible
- [ ] Support for text sizing

## Accessibility Sign-Off

Before production release:
```
✅ Automated testing: No critical violations (axe, Lighthouse)
✅ Keyboard navigation: All features accessible without mouse
✅ Screen reader: Page navigable and understandable
✅ Color contrast: 4.5:1 minimum on all text
✅ Focus indicators: Visible on all interactive elements
✅ Semantic HTML: Proper use of heading, list, table, form tags
✅ Forms: All inputs have associated labels
✅ Images: All decorative or meaningful alt text
✅ Mobile: Works on small screens (320px), 48px touch targets
✅ Video: Captions and audio descriptions provided
✅ Error handling: Clear messages and recovery options
✅ WCAG 2.1 AA: Compliant on all pages
✅ Third-party components: Accessible
✅ Documentation: Accessibility features documented
✅ Training: Team trained on accessibility best practices
```

## Continuous Monitoring

### Test Every Code Change
- [ ] Run axe before commit
- [ ] Run Lighthouse before release
- [ ] Check keyboard nav before merge
- [ ] Screen reader spot check before release

### Regular Audits
- [ ] Monthly axe scan
- [ ] Quarterly manual testing
- [ ] Annual external accessibility audit
- [ ] User feedback collection

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)
- [Accessibility Keyboard](https://www.accessibility-keyboard.com/)
