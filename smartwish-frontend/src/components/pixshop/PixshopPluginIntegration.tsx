'use client'

import React from 'react';
import { createRoot } from 'react-dom/client';
import PixshopPlugin from './PixshopPlugin';

interface PixshopPluginIntegrationProps {
  currentImageSrc: string;
  setCurrentImageSrc: (src: string) => void;
  onProcess: (result: any) => void;
  onHide: () => void;
  onOpenPixshop: () => void;
}

export class PixshopPluginIntegration {
  private props: PixshopPluginIntegrationProps;
  private observer: MutationObserver | null = null;
  private reactRoot: any = null;

  constructor(props: PixshopPluginIntegrationProps) {
    this.props = props;
  }

  initialize(editorInstance: any) {
    console.log('🎯 Initializing Pixshop Plugin Integration');

    // Replace Retouch tab with Pixshop functionality
    this.replaceRetouchWithPixshop(editorInstance);

    // Set up mutation observer to handle dynamic changes
    this.setupMutationObserver(editorInstance);
  }



  private replaceRetouchWithPixshop(editorInstance: any) {
    const setupPixshopTab = () => {
      // Find the Retouch tab
      const retouchTab = Array.from(
        document.querySelectorAll('button[role="tab"]')
      ).find((btn) => btn.textContent?.includes('Retouch'));

      if (retouchTab && !retouchTab.hasAttribute('data-renamed-to-pixshop')) {
        // Rename tab to "Pixshop"
        const walker = document.createTreeWalker(
          retouchTab,
          NodeFilter.SHOW_TEXT
        );

        let textNode;
        while ((textNode = walker.nextNode())) {
          if (
            textNode.textContent &&
            textNode.textContent.includes('Retouch')
          ) {
            textNode.textContent = textNode.textContent.replace(
              'Retouch',
              'Pixshop'
            );
          }
        }

        retouchTab.setAttribute('data-renamed-to-pixshop', 'true');
        console.log('✅ Renamed Retouch tab to Pixshop');
      }

      // Set up tab click listener
      if (retouchTab && !retouchTab.hasAttribute('data-pixshop-listener-added')) {
        retouchTab.setAttribute('data-pixshop-listener-added', 'true');
        retouchTab.addEventListener('click', () => {
          console.log('🎯 Pixshop tab clicked, opening Pixshop modal');
          // Instead of DOM injection, trigger the modal
          setTimeout(() => this.props.onOpenPixshop(), 200);
        });
      }

      // Add listeners to other tabs to restore original content
      const allTabs = document.querySelectorAll('button[role="tab"]');
      allTabs.forEach((tab) => {
        if (
          !tab.textContent?.includes('Pixshop') &&
          !tab.textContent?.includes('Retouch') &&
          !tab.hasAttribute('data-restore-listener-added')
        ) {
          tab.setAttribute('data-restore-listener-added', 'true');
          tab.addEventListener('click', () => {
            this.restoreOriginalRetouchContent();
          });
        }
      });

      // Check if Retouch/Pixshop tab is currently active
      if (retouchTab && retouchTab.getAttribute('aria-selected') === 'true') {
        // Don't auto-open Pixshop modal when tab is initially active
        console.log('🎯 Pixshop tab is initially active, but not auto-opening modal');
      }
    };

    // Try multiple times with delays
    const attempts = [100, 300, 500, 1000, 2000];
    attempts.forEach((delay) => {
      setTimeout(setupPixshopTab, delay);
    });
  }

  private injectPixshopInterface(editorInstance: any) {
    console.log('🔍 Attempting to inject Pixshop interface...');

    // Find the retouch panel with more detailed logging
    const retouchPanel =
      document.querySelector('.PinturaUtilPanel[data-util="retouch"]') ||
      document.querySelector('[data-util="retouch"]');

    console.log('🔍 Retouch panel search result:', retouchPanel);
    console.log('🔍 All panels found:', document.querySelectorAll('.PinturaUtilPanel'));
    console.log('🔍 All data-util elements:', document.querySelectorAll('[data-util]'));

    if (!retouchPanel) {
      console.log('❌ Pixshop panel not found - trying alternative selectors');

      // Try alternative selectors
      const alternativePanel = document.querySelector('.PinturaUtil') ||
        document.querySelector('[class*="retouch"]') ||
        document.querySelector('[class*="Retouch"]');

      console.log('🔍 Alternative panel found:', alternativePanel);

      if (!alternativePanel) {
        return false;
      }
    }

    // Use the found panel (either retouchPanel or alternativePanel)
    const targetPanel = retouchPanel || document.querySelector('.PinturaUtil') ||
      document.querySelector('[class*="retouch"]') ||
      document.querySelector('[class*="Retouch"]');

    if (!targetPanel) {
      console.log('❌ No suitable panel found for injection');
      return false;
    }

    console.log('🎯 Using target panel:', targetPanel);

    // Find the footer area
    const retouchFooter =
      targetPanel.querySelector('.PinturaUtilFooter') ||
      targetPanel.querySelector('[class*="Footer"]') ||
      targetPanel.querySelector('div:last-child') ||
      targetPanel; // Fallback to the panel itself

    console.log('🔍 Footer search result:', retouchFooter);

    if (!retouchFooter) {
      console.log('❌ Pixshop footer not found');
      return false;
    }

    // Check if Pixshop interface already exists
    if (retouchFooter.querySelector('.pixshop-plugin-container')) {
      console.log('✅ Pixshop interface already exists');
      return true;
    }

    console.log('🎯 Found Pixshop footer, injecting Pixshop interface');

    // Store original content
    if (!retouchFooter.hasAttribute('data-original-content-stored')) {
      retouchFooter.setAttribute(
        'data-original-html',
        retouchFooter.innerHTML
      );
      retouchFooter.setAttribute('data-original-content-stored', 'true');
    }

    // Clear the footer content
    retouchFooter.innerHTML = '';

    // Create container for React component
    const pixshopContainer = document.createElement('div');
    pixshopContainer.className = 'pixshop-plugin-container';
    retouchFooter.appendChild(pixshopContainer);

    // Mount React component
    this.reactRoot = createRoot(pixshopContainer);
    this.reactRoot.render(
      React.createElement(PixshopPlugin, {
        currentImageSrc: this.props.currentImageSrc,
        onImageUpdate: this.props.setCurrentImageSrc,
        editorInstance: editorInstance
      })
    );

    console.log('✅ Pixshop interface injected successfully');
    return true;
  }

  private restoreOriginalRetouchContent() {
    // Restore original retouch content when switching away
    const retouchPanel = document.querySelector(
      '.PinturaUtilPanel[data-util="retouch"]'
    );
    if (retouchPanel) {
      const retouchFooter = retouchPanel.querySelector('.PinturaUtilFooter');
      if (
        retouchFooter &&
        retouchFooter.hasAttribute('data-original-html')
      ) {
        // Unmount React component if it exists
        if (this.reactRoot) {
          this.reactRoot.unmount();
          this.reactRoot = null;
        }

        const originalHtml = retouchFooter.getAttribute('data-original-html');
        if (originalHtml) {
          retouchFooter.innerHTML = originalHtml;
        }
      }
    }
  }

  private setupMutationObserver(editorInstance: any) {
    // Use MutationObserver to catch dynamic changes
    this.observer = new MutationObserver(() => {
      this.replaceRetouchWithPixshop(editorInstance);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'data-util'],
    });

    // Clean up observer after 10 seconds
    setTimeout(() => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }, 10000);
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
  }
}

export default PixshopPluginIntegration;