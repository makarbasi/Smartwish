'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  setPlugins,
  plugin_finetune,
  plugin_filter,
  plugin_annotate,
  plugin_sticker,
  plugin_retouch,
  plugin_finetune_defaults,
  plugin_filter_defaults,
  plugin_frame_defaults,
  markup_editor_defaults,
  locale_en_gb,
  plugin_finetune_locale_en_gb,
  plugin_filter_locale_en_gb,
  plugin_annotate_locale_en_gb,
  plugin_sticker_locale_en_gb,
  plugin_retouch_locale_en_gb,
  markup_editor_locale_en_gb,
  createDefaultImageReader,
  createDefaultImageWriter,
  createDefaultShapePreprocessor,
  createMarkupEditorShapeStyleControls
} from '@pqina/pintura';

// Set up the plugins WITHOUT crop but WITH retouch
setPlugins(plugin_finetune, plugin_filter, plugin_annotate, plugin_sticker, plugin_retouch);

// Create custom editor defaults WITHOUT crop
const editorDefaults = {
  utils: ['finetune', 'filter', 'annotate', 'sticker','retouch'], // explicitly exclude 'crop'
  imageReader: createDefaultImageReader(),
  imageWriter: createDefaultImageWriter(),
  shapePreprocessor: createDefaultShapePreprocessor(),
  ...plugin_finetune_defaults,
  ...plugin_filter_defaults,
  ...plugin_frame_defaults,
  ...markup_editor_defaults,
  // Add default stickers
  stickers: [
    ['Emoji', ['🎉', '🎂', '🎈', '🎁', '❤️', '😊', '😍', '🥳', '✨', '🌟', '⭐', '💫']],
    ['Hearts', ['💝', '💖', '💕', '💗', '💘', '💞', '💌', '🧡', '💛', '💚', '💙', '💜']],
    ['Celebration', ['🎊', '🎉', '🥳', '🎈', '🎁', '🎂', '🍰', '🧁', '🎪', '🎭', '🎨', '🎵']]
  ],
  // Add retouch tools configuration
  retouchTools: [


  ],
  retouchShapeControls: createMarkupEditorShapeStyleControls(),
  locale: {
    ...locale_en_gb,
    ...plugin_finetune_locale_en_gb,
    ...plugin_filter_locale_en_gb,
    ...plugin_annotate_locale_en_gb,
    ...plugin_sticker_locale_en_gb,
    ...plugin_retouch_locale_en_gb,
    ...markup_editor_locale_en_gb,
  },
};

// Dynamic import for the editor modal
const PinturaEditorModalComponent = dynamic(() => import('./DynamicPinturaEditor'), {
  ssr: false,
});

interface PinturaEditorModalProps {
  imageSrc: string;
  isVisible: boolean;
  onHide: () => void;
  onProcess?: (result: { dest: File }) => void;
}

export default function PinturaEditorModal({ 
  imageSrc, 
  isVisible, 
  onHide,
  onProcess
}: PinturaEditorModalProps) {
  // Use state to manage the current image source so we can update it dynamically
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  
  // Update currentImageSrc when imageSrc prop changes
  useEffect(() => {
    setCurrentImageSrc(imageSrc);
  }, [imageSrc]);

  console.log('🎨 PinturaEditorModal rendered:', { imageSrc, currentImageSrc, isVisible });

  const handleProcess = ({ dest }: { dest: File }) => {
    console.log('✅ Editor process complete:', dest);
    if (dest) {
      onProcess?.({ dest });
    }
    onHide();
  };

  const handleHide = () => {
    console.log('🚪 Editor hide triggered');
    onHide();
  };

  const handleLoad = (res: unknown) => {
    console.log('📷 Load editor image:', res);
    
    // Rename Retouch tab to AI
    const renameRetouchToAI = () => {
      const retouchTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(btn => 
        btn.textContent?.includes('Retouch')
      );
      
      if (retouchTab && !retouchTab.hasAttribute('data-renamed-to-ai')) {
        // Find text nodes and replace only the "Retouch" text, keeping icons
        const walker = document.createTreeWalker(
          retouchTab,
          NodeFilter.SHOW_TEXT
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
          if (textNode.textContent && textNode.textContent.includes('Retouch')) {
            textNode.textContent = textNode.textContent.replace('Retouch', 'AI');
          }
        }
        
        retouchTab.setAttribute('data-renamed-to-ai', 'true');
        console.log('✅ Renamed Retouch tab to AI (keeping icon)');
      }
    };
    
    // Inject AI prompt interface into retouch tab
    const injectAIPromptIntoRetouch = () => {
      const modifyRetouchTab = () => {
        // Find the AI tab button (formerly retouch)
        const retouchTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(btn => 
          btn.textContent?.includes('AI') || btn.textContent?.includes('Retouch')
        );
        
        if (!retouchTab) {
          console.log('❌ AI tab not found');
          return false;
        }

        // Check if AI tab is active
        const isRetouchTabActive = retouchTab.getAttribute('aria-selected') === 'true';
        
        if (!isRetouchTabActive) {
          console.log('🔍 AI tab not active, skipping AI injection');
          return false;
        }

        // Find the retouch tools area within the active AI panel
        const retouchPanel = document.querySelector('.PinturaUtilPanel[data-util="retouch"]') ||
                            document.querySelector('[data-util="retouch"]');
        
        if (!retouchPanel) {
          console.log('❌ AI panel not found');
          return false;
        }

        // Look for the footer area where tools are displayed
        const retouchFooter = retouchPanel.querySelector('.PinturaUtilFooter') ||
                             retouchPanel.querySelector('[class*="Footer"]');
        
        if (!retouchFooter) {
          console.log('❌ AI footer not found');
          return false;
        }

        // Check if AI interface already exists
        if (retouchFooter.querySelector('.ai-prompt-interface')) {
          console.log('✅ AI interface already exists in AI footer');
          return true;
        }

        console.log('🎯 Found AI footer, injecting AI interface');

        // Store original content
        if (!retouchFooter.hasAttribute('data-original-content-stored')) {
          retouchFooter.setAttribute('data-original-html', retouchFooter.innerHTML);
          retouchFooter.setAttribute('data-original-content-stored', 'true');
        }

        // Clear the footer content
        retouchFooter.innerHTML = '';

        // Create AI prompt interface
        const aiInterface = document.createElement('div');
        aiInterface.className = 'ai-prompt-interface';
        aiInterface.innerHTML = `
          <div style="transform: none;">
            <div class="PinturaTabPanels PinturaControlPanels">
              <div class="PinturaTabPanel PinturaControlPanel" aria-hidden="false" data-inert="false" role="tabpanel">
                <!-- Style options: horizontally scrollable single-line for mobile with cyclic arrows -->
                <style>
                  /* center the button container */
                  .ai-style-scroll-wrapper{position:relative;padding:0.25rem 0.5rem;margin-bottom:0.25rem;display:flex;justify-content:center}
                  .ai-style-container{display:flex;gap:0.5rem;align-items:center;justify-content:center;overflow-x:auto;white-space:nowrap;flex-wrap:nowrap;padding:0 8px 4px}
                  .ai-style-container::-webkit-scrollbar{display:none}
                  /* square buttons with rounded corners */
                  .ai-style-button{flex:0 0 auto;border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:8px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:0.35rem;background:#fff;width:96px;height:104px;box-sizing:border-box}
                  .ai-style-thumb{width:56px;height:56px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px}
                  .ai-style-label{font-size:12px;color:#111;text-align:center;line-height:1;margin-top:6px}
                  @media (max-width:420px){
                    .ai-style-thumb{width:44px;height:44px;font-size:13px}
                    .ai-style-label{font-size:11px}
                    .ai-style-button{width:76px;height:88px;padding:6px}
                  }
                </style>

                <div class="ai-style-scroll-wrapper">
                  <div id="ai-style-container" class="ai-style-container" role="list">
                  <!-- Each button is a vertical pill: thumbnail on top, label below. Using theme image thumbnails from public/resources/themes -->
                    <button type="button" class="ai-style-button selected" data-style="natural" tabindex="0" role="button" aria-pressed="true">
                      <div class="ai-style-thumb"><img src="/resources/themes/theme-watercolor.jpg" alt="Watercolor" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block"/></div>
                      <span class="ai-style-label">Natural</span>
                    </button>
                    <button type="button" class="ai-style-button" data-style="vibrant" tabindex="0" role="button" aria-pressed="false">
                      <div class="ai-style-thumb"><img src="/resources/themes/theme-pixar.jpg" alt="Pixar" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block"/></div>
                      <span class="ai-style-label">Vibrant</span>
                    </button>
                    <button type="button" class="ai-style-button" data-style="portrait" tabindex="0" role="button" aria-pressed="false">
                      <div class="ai-style-thumb"><img src="/resources/themes/theme-disney.jpg" alt="Disney" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block"/></div>
                      <span class="ai-style-label">Portrait</span>
                    </button>
                    <button type="button" class="ai-style-button" data-style="cinematic" tabindex="0" role="button" aria-pressed="false">
                      <div class="ai-style-thumb"><img src="/resources/themes/theme-anime.jpg" alt="Anime" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block"/></div>
                      <span class="ai-style-label">Cinematic</span>
                    </button>
                    <button type="button" class="ai-style-button" data-style="vintage" tabindex="0" role="button" aria-pressed="false">
                      <div class="ai-style-thumb"><img src="/resources/themes/theme-pencil-sketch.jpg" alt="Pencil Sketch" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block"/></div>
                      <span class="ai-style-label">Vintage</span>
                    </button>
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; padding: 1rem;">
                  <input 
                    type="text" 
                    id="ai-prompt-input"
                    placeholder="Ask AI to enhance your image..."
                    style="
                      flex: 1;
                      padding: 0.75rem 1rem;
                      border: 1px solid rgba(0,0,0,0.15);
                      border-radius: 0.5rem;
                      font-size: 0.875rem;
                      outline: none;
                      background: white;
                    "
                  />
                  <button 
                    type="button" 
                    id="ai-send-button"
                    style="
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 0.75rem;
                      background: linear-gradient(45deg, #6366f1, #8b5cf6);
                      color: white;
                      border: none;
                      border-radius: 0.5rem;
                      cursor: pointer;
                      transition: all 0.2s ease;
                    "
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;

        retouchFooter.appendChild(aiInterface);

        // Populate style thumbnails from theme image filenames and derive labels
        try {
          const themePaths = [
            '/resources/themes/theme-watercolor.jpg',
            '/resources/themes/theme-pixar.jpg',
            '/resources/themes/theme-disney.jpg',
            '/resources/themes/theme-anime.jpg',
            '/resources/themes/theme-pencil-sketch.jpg',
          ];

          const containerEl = aiInterface.querySelector('#ai-style-container') as HTMLElement | null;
          if (containerEl) {
            // clear any placeholder content
            containerEl.innerHTML = '';
            themePaths.forEach((p, idx) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'ai-style-button' + (idx === 0 ? ' selected' : '');
              btn.setAttribute('data-style', (p.split('/').pop() || '').replace(/\.[^.]+$/, '').toLowerCase());
              btn.tabIndex = 0;
              btn.setAttribute('role', 'button');
              btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');

              const thumb = document.createElement('div');
              thumb.className = 'ai-style-thumb';
              const img = document.createElement('img');
              img.src = p;
              img.alt = '';
              img.style.width = '56px';
              img.style.height = '56px';
              img.style.borderRadius = '10px';
              img.style.objectFit = 'cover';
              img.style.display = 'block';
              thumb.appendChild(img);

              const label = document.createElement('span');
              label.className = 'ai-style-label';
              // derive readable label from filename: remove prefix 'theme-' and extension, replace '-' with spaces and capitalize
              const filename = (p.split('/').pop() || '').replace(/\.[^.]+$/, '');
              const text = filename.replace(/^theme-/, '').replace(/-/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
              label.textContent = text || 'Style';

              btn.appendChild(thumb);
              btn.appendChild(label);
              containerEl.appendChild(btn);
            });
          }
        } catch (e) {
          console.warn('Failed to populate theme thumbnails', e);
        }

        // Add event listeners
  const sendButton = aiInterface.querySelector('#ai-send-button') as HTMLButtonElement | null;
  const promptInput = aiInterface.querySelector('#ai-prompt-input') as HTMLInputElement | null;
  const styleButtons = Array.from(aiInterface.querySelectorAll('.ai-style-button')) as HTMLButtonElement[];
  const styleContainer = aiInterface.querySelector('#ai-style-container') as HTMLElement | null;

        // Keep track of selected style
        let selectedStyle = 'natural';

        styleButtons.forEach(btn => {
          const activate = () => {
            styleButtons.forEach(b => {
              b.classList.remove('selected');
              b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
            selectedStyle = btn.getAttribute('data-style') || 'natural';
            console.log('🎨 AI style selected:', selectedStyle);
            // Ensure activated button is visible (center it)
            if (styleContainer) {
              const btnRect = btn.getBoundingClientRect();
              const contRect = styleContainer.getBoundingClientRect();
              const offset = (btnRect.left + btnRect.right) / 2 - (contRect.left + contRect.right) / 2;
              styleContainer.scrollBy({ left: offset, behavior: 'smooth' });
            }
          };

          btn.addEventListener('click', activate);
          btn.addEventListener('keydown', (ev) => {
            if ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ') {
              ev.preventDefault();
              activate();
            }
          });
        });

  // No arrows: container remains horizontally scrollable on small screens

        sendButton?.addEventListener('click', async () => {
          const prompt = promptInput?.value?.trim();
          if (!prompt) return;
          console.log('🤖 AI Prompt:', prompt, 'Style:', selectedStyle);

          // Visual feedback
          const originalButtonText = sendButton!.innerHTML;
          sendButton!.disabled = true;
          sendButton!.style.opacity = '0.6';
          sendButton!.innerHTML = 'Sending...';

          try {
            // Helper: convert dataURL to Blob
            const dataURLToBlob = (dataUrl: string) => {
              const parts = dataUrl.split(',')
              const meta = parts[0]
              const base64 = parts[1]
              const m = /data:([^;]+);base64/.exec(meta)
              const contentType = m ? m[1] : 'image/png'
              const byteString = atob(base64)
              const ia = new Uint8Array(byteString.length)
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
              return new Blob([ia], { type: contentType })
            }

            // Try to obtain the edited image as a Blob
            let imageBlob: Blob | null = null

            // 1) Try editor instance methods from the onLoad `res` if available
            try {
              type EditorLike = {
                toBlob?: (cb: (b: Blob) => void) => void
                toDataURL?: () => string
                getResult?: () => Promise<{ dest?: Blob | File } | null>
              }

              const maybe = res as unknown as EditorLike
              // Common Pintura instance methods: toBlob, toDataURL, toFile, getResult
              if (typeof maybe.toBlob === 'function') {
                imageBlob = await new Promise<Blob | null>((resolve) => {
                  try {
                    maybe.toBlob!((b: Blob) => resolve(b))
                  } catch {
                    resolve(null)
                  }
                })
              } else if (typeof maybe.toDataURL === 'function') {
                const dataUrl = maybe.toDataURL!()
                imageBlob = dataURLToBlob(dataUrl)
              } else if (typeof maybe.getResult === 'function') {
                try {
                  const out = await maybe.getResult!()
                  if (out && out.dest) {
                    // dest could be a File/Blob
                    imageBlob = out.dest instanceof Blob ? out.dest : null
                  }
                } catch {
                  // ignore
                }
              }
            } catch {
              console.warn('Editor instance extraction failed')
            }

            // 2) Try to find a canvas inside the Pintura editor and use it
            if (!imageBlob) {
              const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
              if (canvas) {
                const dataUrl = canvas.toDataURL('image/png')
                imageBlob = dataURLToBlob(dataUrl)
              }
            }

            // 3) Fallback to the original imageSrc prop (fetch it)
            if (!imageBlob && imageSrc) {
              try {
                const fetched = await fetch(imageSrc)
                if (fetched.ok) imageBlob = await fetched.blob()
              } catch (e) {
                console.warn('Failed to fetch original imageSrc', e)
              }
            }

            if (!imageBlob) throw new Error('Could not obtain edited image from the editor')

            const file = new File([imageBlob], 'image.png', { type: imageBlob.type || 'image/png' })

            // Prepare form data and call backend Gemini inpaint route
            const formData = new FormData()
            formData.append('image', file)
            formData.append('prompt', prompt)
            formData.append('style', selectedStyle)

            // Add the original image as context for Gemini to understand what user is working on
            try {
              const originalImageBlob = await fetch(currentImageSrc).then(r => r.blob())
              const originalImageFile = new File([originalImageBlob], 'original.png', { type: originalImageBlob.type || 'image/png' })
              formData.append('extraImage', originalImageFile)
            } catch (e) {
              console.warn('Could not fetch original image for context:', e)
            }

            // POST to the backend API instead of Next.js API route
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
            const resp = await fetch(`${backendUrl}/gemini-inpaint`, {
              method: 'POST',
              body: formData,
            })

            if (!resp.ok) {
              const text = await resp.text()
              throw new Error(text || `HTTP ${resp.status}`)
            }

            const data = await resp.json()

            // Backend returns imageUrl instead of imageBase64
            const returned = data?.imageUrl || data?.imageBase64 || data?.image
            if (!returned) throw new Error('No image returned from server')

            // Try to load the returned image back into the Pintura editor by updating the src prop
            const returnedUrl = returned as string
            
            console.log('🎨 Loading AI result back into editor:', returnedUrl)
            
            // Update the image source - this will cause Pintura to reload with the new image
            setCurrentImageSrc(returnedUrl)

            // clear input
            if (promptInput) promptInput.value = ''
          } catch (err) {
            console.error('Gemini inpaint error:', err)
            alert('Failed to process AI request: ' + (err as Error).message)
          } finally {
            // restore button
            sendButton!.disabled = false
            sendButton!.style.opacity = ''
            sendButton!.innerHTML = originalButtonText
          }
        });

        promptInput?.addEventListener('keypress', (e) => {
          if ((e as KeyboardEvent).key === 'Enter') {
            sendButton?.click();
          }
        });

        // Focus input when interface is created
        setTimeout(() => promptInput?.focus(), 100);

        console.log('✅ AI prompt interface injected into AI footer');
        return true;
      };

      // Monitor for AI tab activation
      const addRetouchTabListener = () => {
        const retouchTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(btn => 
          btn.textContent?.includes('AI') || btn.textContent?.includes('Retouch')
        );

        if (retouchTab && !retouchTab.hasAttribute('data-ai-listener-added')) {
          retouchTab.setAttribute('data-ai-listener-added', 'true');
          retouchTab.addEventListener('click', () => {
            console.log('🎯 AI tab clicked, will inject AI interface');
            // Delay to allow Pintura to set up the AI panel
            setTimeout(modifyRetouchTab, 200);
          });
        }

        // Also add listeners to other tabs to restore original content
        const allTabs = document.querySelectorAll('button[role="tab"]');
        allTabs.forEach(tab => {
          if (!tab.textContent?.includes('AI') && !tab.textContent?.includes('Retouch') && !tab.hasAttribute('data-restore-listener-added')) {
            tab.setAttribute('data-restore-listener-added', 'true');
            tab.addEventListener('click', () => {
              // Restore original AI content when switching away
              const retouchPanel = document.querySelector('.PinturaUtilPanel[data-util="retouch"]');
              if (retouchPanel) {
                const retouchFooter = retouchPanel.querySelector('.PinturaUtilFooter');
                if (retouchFooter && retouchFooter.hasAttribute('data-original-html')) {
                  const originalHtml = retouchFooter.getAttribute('data-original-html');
                  if (originalHtml) {
                    retouchFooter.innerHTML = originalHtml;
                  }
                }
              }
            });
          }
        });
      };

      // Try multiple times with delays
      const attempts = [100, 300, 500, 1000, 2000];
      attempts.forEach((delay, index) => {
        setTimeout(() => {
          console.log(`🔄 Attempt ${index + 1} to set up AI interface (delay: ${delay}ms)`);
          renameRetouchToAI(); // Rename the tab first
          addRetouchTabListener();
          modifyRetouchTab(); // Also try immediate modification if AI is already active
        }, delay);
      });

      // Use MutationObserver to catch dynamic changes
      const observer = new MutationObserver(() => {
        renameRetouchToAI(); // Keep renaming any new Retouch tabs
        addRetouchTabListener();
        // Check if AI tab is currently active and modify if needed
        const retouchTab = Array.from(document.querySelectorAll('button[role="tab"]')).find(btn => 
          btn.textContent?.includes('AI') || btn.textContent?.includes('Retouch')
        );
        if (retouchTab && retouchTab.getAttribute('aria-selected') === 'true') {
          setTimeout(modifyRetouchTab, 100);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-selected', 'data-util']
      });

      // Clean up observer after 5 seconds
      setTimeout(() => {
        observer.disconnect();
      }, 5000);
    };

    // Start the injection process
    injectAIPromptIntoRetouch();
  };

  if (!isVisible) {
    console.log('🎨 Editor not visible, returning null');
    return null;
  }

  console.log('🎨 Editor IS visible, rendering PinturaEditorModal');

  return (
    <PinturaEditorModalComponent
      {...editorDefaults}
      src={currentImageSrc}
      onLoad={handleLoad}
      onHide={handleHide}
      onProcess={handleProcess}
    />
  );
}