# Dynamic Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a footer that expands smoothly when scrolled into view, increasing the size of the MTT brand logo/text and the EMODnet sponsorship logo.

**Architecture:** Use React state and `IntersectionObserver` in `Layout.tsx` to detect when the footer enters the viewport. Map this visibility state to dynamic styling classes on the footer container, brand elements, and EMODnet sponsor assets with smooth CSS transitions.

**Tech Stack:** React, TailwindCSS, HTML5.

## Global Constraints
- Use React `ref` and `IntersectionObserver` in `Layout.tsx`.
- Styling: Logo changes and padding changes must animate smoothly using `transition-all duration-500 ease-in-out` and `hover:scale-105 duration-200`.

---

### Task 1: Setup Visibility Detection in Layout.tsx

**Files:**
- Modify: `frontend/components/Layout.tsx`

**Interfaces:**
- Produces: `isFooterVisible` boolean state and `footerRef` to observe.

- [ ] **Step 1: Declare state and ref, and setup IntersectionObserver**

Add state `isFooterVisible`, ref `footerRef`, and `useEffect` observer inside the `Layout` component definition (around line 26).

```diff
   const [isReportIssueModalOpen, setIsReportIssueModalOpen] = useState(false);
   const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
   const location = useLocation();
   const navigate = useNavigate();
+
+  const [isFooterVisible, setIsFooterVisible] = useState(false);
+  const footerRef = React.useRef<HTMLElement>(null);
+
+  useEffect(() => {
+    const observer = new IntersectionObserver(
+      ([entry]) => {
+        setIsFooterVisible(entry.isIntersecting);
+      },
+      {
+        threshold: 0.8,
+      }
+    );
+    const currentFooter = footerRef.current;
+    if (currentFooter) {
+      observer.observe(currentFooter);
+    }
+    return () => {
+      if (currentFooter) {
+        observer.unobserve(currentFooter);
+      }
+    };
+  }, []);
```

- [ ] **Step 2: Verify the code compiles successfully**

Run:
```bash
npm run build --prefix frontend
```
Expected: The build completes without errors.

- [ ] **Step 3: Commit state and observer setup**

Run:
```bash
git add frontend/components/Layout.tsx
git commit -m "feat: setup dynamic footer visibility observer in Layout"
```

---

### Task 2: Apply Transition Classes to Footer Elements

**Files:**
- Modify: `frontend/components/Layout.tsx`

**Interfaces:**
- Consumes: `isFooterVisible` and `footerRef`

- [ ] **Step 1: Modify layout footer markup and classes in Layout.tsx**

Update the `<footer>` tag to attach `footerRef`, add transitions, and dynamically set padding, heights, sizes, and hover effects for the elements.

Replace the footer section (approx. lines 322-340 in `Layout.tsx` after Task 1 changes):

```diff
-      {/* Footer - hidden on phone when authenticated */}
-      <footer className={`bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 ${isAuthenticated ? 'hidden md:block' : ''}`}>
-        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
-          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
-            <div className="flex items-center gap-2">
-              <img src="/mtt-logo.svg" alt="Marine Term Translations" className="w-5 h-5" />
-              <span className="font-semibold text-slate-700 dark:text-slate-300">Marine Term Translations</span>
-            </div>
-            <div className="flex items-center gap-2 border-slate-300 dark:border-slate-800 sm:border-l sm:pl-6 py-1">
-              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sponsored by</span>
-              <a href="https://emodnet.ec.europa.eu/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
-                <img src="/emodnet-logo.png" alt="EMODnet" className="h-6 object-contain bg-white/90 dark:bg-white px-1.5 py-0.5 rounded" />
-              </a>
-            </div>
-          </div>
-          <p className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">
-            &copy; {format(parse(now()), 'YYYY')} Marine Term Translations. Data sourced from NERC Vocabulary Server.
-          </p>
-        </div>
-      </footer>
+      {/* Footer - hidden on phone when authenticated */}
+      <footer 
+        ref={footerRef}
+        className={`bg-slate-100 dark:bg-slate-955 border-t border-slate-200 dark:border-slate-800 ${isAuthenticated ? 'hidden md:block' : ''}`}
+      >
+        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-500 ease-in-out ${isFooterVisible ? 'py-14' : 'py-8'}`}>
+          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
+            <div className="flex items-center gap-2 group cursor-pointer">
+              <img 
+                src="/mtt-logo.svg" 
+                alt="Marine Term Translations" 
+                className={`transition-all duration-500 ease-in-out transform group-hover:scale-105 active:scale-95 ${isFooterVisible ? 'w-7 h-7' : 'w-5 h-5'}`} 
+              />
+              <span className={`font-semibold text-slate-700 dark:text-slate-300 transition-all duration-500 ease-in-out ${isFooterVisible ? 'text-lg' : 'text-base'}`}>
+                Marine Term Translations
+              </span>
+            </div>
+            <div className={`flex items-center border-slate-300 dark:border-slate-800 sm:border-l sm:pl-6 py-1 transition-all duration-500 ease-in-out ${isFooterVisible ? 'gap-3' : 'gap-2'}`}>
+              <span className={`text-slate-500 dark:text-slate-400 font-medium transition-all duration-500 ease-in-out ${isFooterVisible ? 'text-sm' : 'text-xs'}`}>
+                Sponsored by
+              </span>
+              <a 
+                href="https://emodnet.ec.europa.eu/" 
+                target="_blank" 
+                rel="noopener noreferrer" 
+                className="hover:scale-105 active:scale-95 transition-transform duration-200"
+              >
+                <img 
+                  src="/emodnet-logo.png" 
+                  alt="EMODnet" 
+                  className={`object-contain bg-white/90 dark:bg-white px-1.5 py-0.5 rounded transition-all duration-500 ease-in-out ${isFooterVisible ? 'h-14' : 'h-6'}`} 
+                />
+              </a>
+            </div>
+          </div>
+          <p className="text-sm text-slate-500 dark:text-slate-400 text-center md:text-right">
+            &copy; {format(parse(now()), 'YYYY')} Marine Term Translations. Data sourced from NERC Vocabulary Server.
+          </p>
+        </div>
+      </footer>
```

- [ ] **Step 2: Verify the compilation build succeeds**

Run:
```bash
npm run build --prefix frontend
```
Expected: Build passes without errors.

- [ ] **Step 3: Commit footer layout changes**

Run:
```bash
git add frontend/components/Layout.tsx
git commit -m "feat: apply dynamic sizing, transitions, and hover scales to footer elements"
```
