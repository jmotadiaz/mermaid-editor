
import mermaid from 'mermaid';
import { EditorView, basicSetup } from 'codemirror';
import { mermaid as mermaidLang } from 'codemirror-lang-mermaid';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { githubLight } from '@uiw/codemirror-theme-github';
import { EditorState, Prec } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: '"Outfit", sans-serif',
  htmlLabels: false,
  flowchart: {
    htmlLabels: false,
    useMaxWidth: false
  }
});

// Custom Highlight Style to fix visibility issues
// Specifically targets arrows/operators that might be blue/hard to read in Tokyo Night
// We use a broad set of tags to catch whatever the Mermaid parser is using for arrows
const customHighlightStyle = HighlightStyle.define([
  {
    tag: [
      t.operator,
      t.punctuation,
      t.atom,
      t.link,
      t.special(t.string),
      t.definitionOperator,
      t.arithmeticOperator,
      t.logicOperator,
      t.bitwiseOperator,
      t.compareOperator,
      t.derefOperator
    ],
    color: "#ff9e64"
  }, // Bright Orange for arrows like -->
  { tag: t.string, color: "#9ece6a" }, // Ensure strings are Green
  { tag: t.keyword, color: "#bb9af7" }, // Keywords Purple
]);

// Theme icons
const ICONS = {
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
};

const editorContainer = document.getElementById('editor-container');
const previewContainer = document.getElementById('preview-container');
const outputDiv = document.getElementById('graph-output');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const themeBtn = document.getElementById('themeBtn');

// View Mode Elements
const viewCodeBtn = document.getElementById('viewCodeBtn');
const viewSplitBtn = document.getElementById('viewSplitBtn');
const viewChartBtn = document.getElementById('viewChartBtn');
const editorGrid = document.querySelector('.editor-grid');

// Zoom Elements
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevelText = document.getElementById('zoomLevel');

// Default State
const DEFAULT_CODE = `graph TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Great!]
  B -->|No| D[Debug]
  C --> E[End]
  D --> B`;

// Load from Session Storage
let currentTheme = sessionStorage.getItem('mermaid-theme') || 'default';
let savedCode = sessionStorage.getItem('mermaid-code') || DEFAULT_CODE;
let currentViewMode = sessionStorage.getItem('mermaid-view-mode') || 'split';
let currentZoom = 1;

let editorView;
let timeoutId = null;

// Apply initial global theme
applyGlobalTheme(currentTheme);

// Initialize
initializeMermaid(currentTheme);
initializeEditor();
updateThemeButton();
initializeZoom();
initializeViewModes();
renderDiagram();

function applyGlobalTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function initializeMermaid(theme) {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme, // 'default' (light) or 'dark'
    securityLevel: 'loose',
    fontFamily: '"Outfit", sans-serif',
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      useMaxWidth: false
    }
  });
}

function initializeEditor() {
  const extensions = [
    basicSetup,
    mermaidLang(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onCodeChange(update.state.doc.toString());
      }
    })
  ];

  if (currentTheme === 'dark') {
    extensions.push(tokyoNight); // Use Tokyo Night theme for dark mode
    extensions.push(Prec.highest(syntaxHighlighting(customHighlightStyle))); // Apply custom overrides for better visibility
    extensions.push(EditorView.theme({
          "&": {
              fontFamily: '"JetBrains Mono", monospace'
          },
           ".cm-content": {
               fontFamily: '"JetBrains Mono", monospace'
          }
      }));
  } else {
    // Light Mode: Use GitHub Light
    extensions.push(githubLight);
    // You could add custom light styles here if needed, but githubLight is usually good
    extensions.push(EditorView.theme({
          "&": {
              fontFamily: '"JetBrains Mono", monospace',
              backgroundColor: "transparent" // Ensure seamless blending with panel
          },
          ".cm-content": {
               fontFamily: '"JetBrains Mono", monospace'
          }
      }));
  }


  const state = EditorState.create({
    doc: savedCode,
    extensions: extensions
  });

  editorView = new EditorView({
    state,
    parent: editorContainer
  });
}

function onCodeChange(code) {
  saveCode(code);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    savedCode = code; // Update global var for render
    renderDiagram();
  }, 500);
}


function updateThemeButton() {
  const isDark = currentTheme === 'dark';
  themeBtn.innerHTML = isDark ? `${ICONS.sun} Light Mode` : `${ICONS.moon} Dark Mode`;
}

// Theme Toggle
themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'default' ? 'dark' : 'default';
    sessionStorage.setItem('mermaid-theme', currentTheme);

    applyGlobalTheme(currentTheme); // Update global CSS variables
    initializeMermaid(currentTheme);
    updateThemeButton();

    // Re-initialize editor to swap themes (easiest way cleanly)
    editorView.destroy();
    initializeEditor();

    // Re-render diagram
    outputDiv.removeAttribute('data-processed');
    renderDiagram();
});

// Save to Session Storage
function saveCode(code) {
    sessionStorage.setItem('mermaid-code', code);
}

async function renderDiagram() {
  const code = editorView ? editorView.state.doc.toString() : savedCode;

  try {
    const isValid = await mermaid.parse(code);
    if (!isValid) return; // Mermaid parse will throw if invalid usually, but this is a double check logic if they change API

    // We need to use a unique ID for each render or clear the div
    outputDiv.innerHTML = '';
    const id = 'mermaid-graph-' + Date.now();
    const { svg } = await mermaid.render(id, code);
    outputDiv.innerHTML = svg;

    // Apply current zoom to the new SVG
    applyZoom();

    // Remove error class if previously added
    outputDiv.classList.remove('error');

  } catch (error) {
    console.error('Mermaid processing error:', error);
    // Visual indicator of error (optional, could be an overlay)
    // For now we keep the old diagram or show a small error text
    const errorDiv = document.createElement('div');
    errorDiv.style.color = '#ef4444';
    errorDiv.style.padding = '1rem';
    errorDiv.style.background = 'rgba(239, 68, 68, 0.1)';
    errorDiv.style.borderRadius = '8px';
    errorDiv.textContent = 'Syntax Error';

    // We append it without clearing if we want to show it over...
    // but better to just log it for now as mermaid usually handles syntax error visuals internally in the SVG if configured,
    // but since we are manually rendering, we catch the exception.
    outputDiv.innerHTML = '';
    outputDiv.appendChild(errorDiv);
  }
}

function initializeViewModes() {
  const modes = {
    code: viewCodeBtn,
    split: viewSplitBtn,
    chart: viewChartBtn
  };

  Object.entries(modes).forEach(([mode, btn]) => {
    btn.addEventListener('click', () => {
      setViewMode(mode);
    });
  });

  // Apply initial mode
  setViewMode(currentViewMode);
}

function setViewMode(mode) {
  currentViewMode = mode;
  sessionStorage.setItem('mermaid-view-mode', mode);

  // Update classes on grid
  editorGrid.classList.remove('view-code', 'view-split', 'view-chart');
  if (mode !== 'split') {
    editorGrid.classList.add(`view-${mode}`);
  }

  // Update button active state
  [viewCodeBtn, viewSplitBtn, viewChartBtn].forEach(btn => btn.classList.remove('active'));
  if (mode === 'code') viewCodeBtn.classList.add('active');
  else if (mode === 'split') viewSplitBtn.classList.add('active');
  else if (mode === 'chart') viewChartBtn.classList.add('active');

  // Trigger editor refresh if needed
  if (editorView && (mode === 'code' || mode === 'split')) {
    editorView.requestMeasure();
  }

  // If switching to chart or split, ensure diagram is visible/rendered
  if (mode === 'chart' || mode === 'split') {
    renderDiagram();
  }
}

function initializeZoom() {
  zoomInBtn.addEventListener('click', () => {
    updateZoom(currentZoom + 0.1);
  });

  zoomOutBtn.addEventListener('click', () => {
    updateZoom(currentZoom - 0.1);
  });

  zoomResetBtn.addEventListener('click', () => {
    updateZoom(1);
  });

  // Mouse wheel zoom
  previewContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      updateZoom(currentZoom + delta);
    }
  }, { passive: false });
}

function updateZoom(newZoom) {
  currentZoom = Math.max(0.1, newZoom);
  zoomLevelText.textContent = `${Math.round(currentZoom * 100)}%`;
  applyZoom();
}

function applyZoom() {
  const svg = outputDiv.querySelector('svg');
  if (svg) {
    svg.style.transform = `scale(${currentZoom})`;
  }
}

// Shared function to generate Blob or DataURL
async function generateImage(type = 'blob') {
  const svgElement = outputDiv.querySelector('svg');
  if (!svgElement) return null;

  // 1. Get computed styles for key elements (text, lines) to ensure they look right
  // We'll actually just inject a style block into the SVG to safeguard fonts and colors
  // This is a common fix for mermaid exports
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    .mermaid { font-family: "Outfit", sans-serif; }
    text { font-family: "Outfit", sans-serif; }
  `;
  // Prepend style to SVG
  svgElement.insertBefore(style, svgElement.firstChild);

  // Get current dimensions
  const box = svgElement.getBoundingClientRect();
  const width = box.width;
  const height = box.height;

  // Create a canvas
  const canvas = document.createElement('canvas');
  // Scale up for better resolution
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Serialize SVG
  const data = new XMLSerializer().serializeToString(svgElement);
  const img = new Image();

  // We need to encode the SVG data to be used as a source
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      if (type === 'blob') {
          canvas.toBlob((blob) => {
              resolve(blob);
          }, 'image/png');
      } else {
          resolve(canvas.toDataURL('image/png'));
      }
    };
    img.src = url;
  });
}

// Download Logic
downloadBtn.addEventListener('click', async () => {
    const dataUrl = await generateImage('dataurl');
    console.log(dataUrl);
    if (!dataUrl) return;

    const downloadLink = document.createElement('a');
    downloadLink.href = dataUrl;
    downloadLink.download = `mermaid-diagram-${Date.now()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
});

// Copy Logic
copyBtn.addEventListener('click', async () => {
    try {
        const blob = await generateImage('blob');
        if (!blob) return;

        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);

        // Show temporary feedback
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);

    } catch (err) {
        console.error('Failed to copy matches: ', err);
        alert('Failed to copy to clipboard');
    }
});
