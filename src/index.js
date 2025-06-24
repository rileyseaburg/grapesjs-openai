import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export default (editor, opts = {}) => {
  const { apiKey, uploadUrl = "/api/upload-image-from-url" } = opts;

  // --- Initial Check ---
  if (!apiKey) {
    editor.log('OpenAI API Key is missing from the plugin options. AI features will be disabled.', {
      level: 'error',
      ns: 'gjs-openai'
    });
    return;
  }

  // Get the Modal module from the editor
  const modal = editor.Modal;

  // --- Inject CSS for Loading States ---
  const css = editor.CssComposer;
  css.addRules(`
    .ai-image-loading::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(0,0,0,0.5);
      z-index: 1;
      border-radius: inherit;
    }
    .ai-image-loading::before {
      content: '';
      position: absolute;
      top: 50%; left: 50%;
      width: 30px; height: 30px;
      margin-top: -15px; margin-left: -15px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: ai-spinner 0.8s linear infinite;
      z-index: 2;
    }
    @keyframes ai-spinner {
      to { transform: rotate(360deg); }
    }
  `);

  // --- Trait Definitions ---
  // Define custom trait type for AI buttons, should be done only once at initialization.
  editor.TraitManager.addType('ai-button', {
    createInput({ trait }) {
      const el = document.createElement('div');
      const commandId = trait.get('command');
      const label = trait.get('label') || 'Run Command';
      el.innerHTML = `<button type="button" class="gjs-trt-button" style="width: 100%; margin-top: 10px;">${label}</button>`;
      const button = el.querySelector('button');
      button.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent GrapesJS from interfering
        editor.runCommand(commandId, {
          component: trait.target,
        });
      });
      return el;
    },
    onUpdate() {}, // Prevent GrapesJS from handling value updates
    onEvent() {},
  });


  // --- Helper Functions for Prompt Construction ---

  function constructHtmlPromptBasedOnUserInput() {
    const modalContainer = document.getElementById('html-prompt-creation-modal');
    const currentMode = modalContainer ? modalContainer.getAttribute('data-input-mode') : 'plain';
    let prompt = {};

    if (currentMode === 'plain') {
      prompt = {
        description: document.getElementById('html-plain-description').value.trim() || 'A simple hero section.',
        stylingPreference: 'Tailwind CSS',
        instructions: "Generate HTML based on the description. Respond ONLY with JSON containing the HTML under 'html_content'."
      };
    } else {
      prompt = {
        goal: document.getElementById('html-page-goal').value || 'Not specified',
        targetAudience: document.getElementById('html-target-audience').value || 'Not specified',
        keyMessage: document.getElementById('html-key-message').value || 'Not specified',
        desiredElements: document.getElementById('html-desired-elements').value || 'Not specified',
        primaryCTA: document.getElementById('html-cta').value || null,
        toneStyle: document.getElementById('html-tone-style').value || 'Default',
        stylingPreference: 'Tailwind CSS',
        instructions: "Generate HTML based on these specifications. Respond ONLY with JSON containing the HTML under 'html_content'."
      };
    }
    return JSON.stringify(prompt, null, 2);
  }

  function constructDetailedPromptBasedOnUserInput() {
    const instructions = document.getElementById('text-instructions').value.trim();
    if (!instructions) return "Generate a short paragraph of placeholder text.";

    let toneStyle = document.getElementById('text-tone-style').value.trim();
    let prompt = `You are a copywriting assistant. Fulfill the following request:\n\n${instructions}`;
    if (toneStyle) {
      prompt += `\n\nPlease write this in a ${toneStyle} tone.`;
    }
    return prompt;
  }

  function constructAudioPromptBasedOnUserInput() {
    return document.getElementById('audio-instructions').value.trim() || "Hello, this is a test audio message.";
  }

  // --- Core AI Generation Functions ---

  async function generateText() {
    const detailedPrompt = constructDetailedPromptBasedOnUserInput();
    let component = editor.getSelected();

    if (!component || !component.is('text')) {
      editor.log('No text component selected.', { level: 'error' });
      return;
    }

    try {
      const selectedModel = document.getElementById('text-model-select').value;
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: selectedModel,
        messages: [{
          role: "user",
          content: detailedPrompt
        }],
        temperature: 1,
        top_p: 1,
        n: 1,
        stream: false,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const openaiText = response.data.choices[0].message.content;
      component.replaceWith({
        type: 'text',
        content: openaiText,
        classes: component.getClasses()
      });
      modal.close();
    } catch (error) {
      editor.log('Error getting text from OpenAI:', { level: 'error', ns: 'gjs-openai', error });
    }
  }

  async function generateHTML() {
    const detailedPrompt = constructHtmlPromptBasedOnUserInput();
    const spinner = document.getElementById('html-spinner');
    const generateBtn = document.getElementById('generate-html-btn');

    try {
      if (spinner) spinner.style.display = 'inline-block';
      if (generateBtn) generateBtn.disabled = true;

      const component = editor.getSelected();
      const selectedModel = document.getElementById('html-model-select').value;

      const messages = [{
        role: "system",
        content: `You are a web development assistant for Spotless Bin Co. Generate a SINGLE version of HTML based on the user's specifications. Do NOT provide multiple variations or options. You are required to create fully responsive components that are mobile first and responsive for all screen sizes including ultra wide. You must create components that use Tailwind CSS with the following custom theme for Spotless Bin Co:
        
        // Spotless Bin Co Theme
        theme: {
          extend: {
            colors: {
              spotlessBlue: { 500: '#009cff' },
              spotlessGreen: { 500: '#00c853' },
              grayNeutral: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
            },
            fontFamily: { sans: ['Inter', 'sans-serif'] },
            boxShadow: { 'spotless': '0 10px 15px -3px rgba(0, 156, 255, 0.1), 0 4px 6px -2px rgba(0, 156, 255, 0.05)' },
          },
        }

        You MUST use these brand colors in your HTML:
        - Use spotlessBlue-500 (#009cff) as the primary color.
        - Use spotlessGreen-500 (#00c853) for secondary actions/highlights.
        - Use grayNeutral shades for text and backgrounds.
        - Components must be dark and light mode responsive using dark: variants.
        - Use font-sans to apply the Inter font.
        - Apply boxShadow-spotless for elevation.
        - Respond ONLY with a valid JSON object containing the HTML under a key named 'html_content'. Example: {\"html_content\": \"<div>Example</div>\"}`
      }, {
        role: "user",
        content: detailedPrompt
      }];

      if (component) {
        const existingHtml = component.toHTML();
        if (existingHtml) {
          messages.push({
            role: "user",
            content: `Existing HTML context to consider (modify or replace based on other instructions):\n\`\`\`html\n${existingHtml}\n\`\`\``
          });
        }
      }

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: selectedModel,
        messages: messages,
        temperature: 1,
        top_p: 1,
        response_format: { "type": "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response?.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from OpenAI API');
      }

      const parsedContent = JSON.parse(response.data.choices[0].message.content);
      const openaiHTML = parsedContent.html_content;

      if (!openaiHTML) {
        throw new Error('Response content missing "html_content" key.');
      }

      if (component) {
        const parent = component.parent();
        const index = component.index();
        parent.components().add(openaiHTML, { at: index });
        component.remove();
      } else {
        editor.addComponents(openaiHTML);
      }
      modal.close();

    } catch (error) {
      editor.log(`Failed to generate HTML: ${error.message}`, { level: 'error', ns: 'gjs-openai' });
    } finally {
        if(spinner) spinner.style.display = 'none';
        if(generateBtn) generateBtn.disabled = false;
    }
  }

  /**
   * Generates an image, sends it to a backend for processing into multiple sizes,
   * and updates the component with src and srcset attributes.
   * @param {object} editor The GrapesJS editor instance.
   * @param {object} component The GrapesJS component ('ai-image').
   * @param {string} currentApiKey The OpenAI API Key.
   * @param {string} currentUploadUrl The backend endpoint for processing and uploading.
   */
  async function generateAiImageForComponent(editor, component, currentApiKey, currentUploadUrl) {
    if (!component || component.get('type') !== 'ai-image') {
      editor.log("Please select an 'ai-image' component.", { level: 'warning' });
      return;
    }

    // GrapesJS stores attributes in a nested object.
    const prompt = component.getAttributes()['ai-prompt'] || '';
    const size = component.getAttributes()['ai-size'] || '1024x1024';

    if (!prompt) {
      editor.log('Please enter an image prompt in the component settings.', { level: 'warning' });
      return;
    }

    editor.log('Generating AI image...', { level: 'info', ns: 'ai-image-generator' });
    component.addClass('ai-image-loading');

    try {
      // Step 1: Generate the initial image with DALL-E
      const dallEResponse = await axios.post('https://api.openai.com/v1/images/generations', {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        style: "natural",
        quality: "hd",
        response_format: 'url'
      }, {
        headers: {
          'Authorization': `Bearer ${currentApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const imageUrl = dallEResponse?.data?.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL found in OpenAI response.');
      }

      // Step 2: Send the generated image URL to our backend for processing (creating variants)
      editor.log('Sending image to backend for processing variants...', { ns: 'ai-image-generator' });
      const uploadResp = await fetch(currentUploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl })
      });

      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        throw new Error(`Backend processing failed (Status: ${uploadResp.status}): ${errorText}`);
      }

      const uploadData = await uploadResp.json();

      // Step 3: Handle the backend response to build srcset
      const originalUrl = uploadData.original_url;
      const variants = uploadData.variants;

      if (originalUrl && Array.isArray(variants) && variants.length > 0) {
        // --- NEW: Build srcset and Update Component ---
        const srcset = variants
          .map((v) => `${v.url} ${v.width}w`)
          .join(', ');

        component.addAttributes({
          src: originalUrl,
          srcset: srcset,
          // A good default 'sizes' attribute is crucial for performance.
          // This tells the browser the image is 100% of viewport width up to 480px,
          // 50% of viewport width up to 1024px, and 800px otherwise.
          // This should be customized based on your website's CSS.
          sizes: '(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 800px'
        });

        editor.log('AI image generated with srcset successfully!', { level: 'info' });
      } else {
         // --- FALLBACK: Handle old response format ---
        const fallbackUrl = uploadData.public_url || uploadData.url || uploadData.data?.url;
        if(fallbackUrl) {
            component.addAttributes({ src: fallbackUrl });
            editor.log('AI image generated (no variants).', { level: 'info' });
        } else {
             throw new Error('Invalid response from backend: Missing "original_url" and "variants".');
        }
      }

    } catch (error) {
      const userMessage = `Failed to generate or upload AI image. Details: ${error.message}`;
      editor.log(userMessage, { level: 'error', ns: 'ai-image-generator' });
    } finally {
      component.removeClass('ai-image-loading');
    }
  }
  
  async function generateAudio() {
    const textContent = constructAudioPromptBasedOnUserInput();
    const voice = document.getElementById('audio-voice').value;
    const format = document.getElementById('audio-format').value;
    const selectedModel = document.getElementById('audio-model-select').value;
    const spinner = document.getElementById('audio-spinner');
    const generateBtn = document.getElementById('generate-audio-btn');

    let component = editor.getSelected();
    if (!component || component.get('type') !== 'audio-response-component') {
      editor.log('No audio response component selected.', { level: 'error' });
      return;
    }

    try {
        if (spinner) spinner.style.display = 'inline-block';
        if (generateBtn) generateBtn.disabled = true;

        const response = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: selectedModel,
            input: textContent,
            voice: voice,
            response_format: format
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        const audioBlob = new Blob([response.data], { type: `audio/${format}` });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audioElement = component.view.el.querySelector('.generated-audio');
        const placeholder = component.view.el.querySelector('.audio-placeholder');
        
        if (audioElement) {
            audioElement.src = audioUrl;
            audioElement.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        }

        modal.close();
    } catch (error) {
        editor.log('Error generating audio from OpenAI.', { level: 'error', ns: 'gjs-openai', error});
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (generateBtn) generateBtn.disabled = false;
    }
}


  // --- Modal Content Definitions ---

  const textModalContent = `
    <div id="prompt-creation-modal" class="p-4">
      <div class="flex flex-col mb-3">
        <label for="text-instructions" class="mb-1 font-semibold">Instructions:</label>
        <textarea id="text-instructions" rows="4" placeholder="Describe the text you want to generate..." class="border p-1 rounded"></textarea>
      </div>
      <div class="flex flex-col mb-3">
        <label for="text-tone-style" class="mb-1 font-semibold">Tone/Style:</label>
        <input type="text" id="text-tone-style" placeholder="e.g., professional, friendly" class="border p-1 rounded">
      </div>
      <div class="flex flex-col mt-4">
        <label for="text-model-select" class="mb-1 font-semibold">OpenAI Model:</label>
        <select id="text-model-select" class="border p-1 rounded bg-white">
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o-mini</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
        </select>
      </div>
      <div class="mt-6 text-right">
        <button class="rounded-md bg-blue-500 text-white px-4 py-2" id="generate-text-btn">Generate Text</button>
      </div>
    </div>`;

  const htmlModalContent = `
    <div id="html-prompt-creation-modal" class="p-4" data-input-mode="plain">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Generate Spotless Bin Co. HTML</h2>
        <button id="toggle-input-mode" class="text-sm text-blue-600 hover:underline">Switch to Structured Input</button>
      </div>
      <div id="plain-language-section">
        <div class="flex flex-col mb-3">
          <label for="html-plain-description" class="mb-1 font-semibold">Describe what you want (Plain Language):</label>
          <textarea id="html-plain-description" rows="4" placeholder="e.g., A hero section with a large image on the left, headline, subheadline, and a 'Learn More' button..." class="border p-1 rounded"></textarea>
        </div>
      </div>
      <div id="structured-fields-section" style="display: none;">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col mb-3"><label for="html-page-goal" class="mb-1 font-semibold">Page/Section Goal:</label><input type="text" id="html-page-goal" placeholder="e.g., Lead capture" class="border p-1 rounded"></div>
          <div class="flex flex-col mb-3"><label for="html-target-audience" class="mb-1 font-semibold">Target Audience:</label><input type="text" id="html-target-audience" placeholder="e.g., Homeowners" class="border p-1 rounded"></div>
          <div class="flex flex-col mb-3"><label for="html-key-message" class="mb-1 font-semibold">Key Message/Offer:</label><textarea id="html-key-message" rows="2" placeholder="Core value proposition..." class="border p-1 rounded"></textarea></div>
          <div class="flex flex-col mb-3"><label for="html-cta" class="mb-1 font-semibold">Call to Action (Button Text):</label><input type="text" id="html-cta" placeholder="e.g., Get a Quote" class="border p-1 rounded"></div>
          <div class="flex flex-col mb-3"><label for="html-desired-elements" class="mb-1 font-semibold">Desired Elements:</label><textarea id="html-desired-elements" rows="2" placeholder="e.g., Hero image, features" class="border p-1 rounded"></textarea></div>
          <div class="flex flex-col mb-3"><label for="html-tone-style" class="mb-1 font-semibold">Tone/Style:</label><input type="text" id="html-tone-style" placeholder="e.g., Professional" class="border p-1 rounded"></div>
        </div>
      </div>
      <div class="flex flex-col my-4">
          <label for="html-model-select" class="mb-1 font-semibold">OpenAI Model:</label>
          <select id="html-model-select" class="border p-1 rounded bg-white">
            <option value="gpt-4o">GPT-4o (Recommended)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
      </div>
      <div class="mt-6 text-right flex items-center justify-end">
        <div id="html-spinner" style="display: none;" class="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
        <button class="rounded-md bg-green-600 hover:bg-green-700 text-white px-5 py-2" id="generate-html-btn">Generate HTML</button>
      </div>
    </div>`;

    const audioModalContent = `
    <div id="audio-prompt-modal" class="p-4">
      <div class="flex flex-col mb-3">
        <label for="audio-instructions" class="mb-1 font-semibold">Text to convert to speech:</label>
        <textarea id="audio-instructions" rows="4" placeholder="Enter the text for the audio..." class="border p-1 rounded"></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="flex flex-col">
            <label for="audio-voice" class="mb-1 font-semibold">Voice:</label>
            <select id="audio-voice" class="border p-1 rounded bg-white">
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
            </select>
          </div>
          <div class="flex flex-col">
            <label for="audio-format" class="mb-1 font-semibold">Format:</label>
            <select id="audio-format" class="border p-1 rounded bg-white">
                <option value="mp3">MP3</option>
                <option value="opus">Opus</option>
                <option value="aac">AAC</option>
                <option value="flac">FLAC</option>
            </select>
          </div>
      </div>
      <div class="flex flex-col mt-4">
        <label for="audio-model-select" class="mb-1 font-semibold">OpenAI Model:</label>
        <select id="audio-model-select" class="border p-1 rounded bg-white">
          <option value="tts-1">TTS-1</option>
          <option value="tts-1-hd">TTS-1-HD</option>
        </select>
      </div>
      <div class="mt-6 text-right flex items-center justify-end">
        <div id="audio-spinner" style="display: none;" class="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
        <button class="rounded-md bg-blue-500 text-white px-4 py-2" id="generate-audio-btn">Generate Audio</button>
      </div>
    </div>`;

  // --- Modal Opening Functions ---

  function attachModalListeners(modalEl, handlers) {
      for (const selector in handlers) {
          const el = modalEl.querySelector(selector);
          if (el) {
              // Clone to remove previous listeners and re-add
              const newEl = el.cloneNode(true);
              el.parentNode.replaceChild(newEl, el);
              newEl.addEventListener('click', handlers[selector]);
          }
      }
  }

  function openTextModal() {
    modal.setContent(textModalContent).open();
    const modalContentEl = modal.getContentEl();
    attachModalListeners(modalContentEl, {
      '#generate-text-btn': generateText
    });
  }

  function openHtmlModal() {
    modal.setContent(htmlModalContent).open();
    const modalContentEl = modal.getContentEl();
    attachModalListeners(modalContentEl, {
      '#generate-html-btn': generateHTML,
      '#toggle-input-mode': () => {
        const container = modalContentEl.querySelector('#html-prompt-creation-modal');
        const plainSection = modalContentEl.querySelector('#plain-language-section');
        const structuredSection = modalContentEl.querySelector('#structured-fields-section');
        const toggleBtn = modalContentEl.querySelector('#toggle-input-mode');
        const isPlain = container.getAttribute('data-input-mode') === 'plain';

        plainSection.style.display = isPlain ? 'none' : 'block';
        structuredSection.style.display = isPlain ? 'block' : 'none';
        toggleBtn.textContent = isPlain ? 'Switch to Plain Language' : 'Switch to Structured Input';
        container.setAttribute('data-input-mode', isPlain ? 'structured' : 'plain');
      }
    });
  }
  
  function openAudioModal() {
      modal.setContent(audioModalContent).open();
      const modalContentEl = modal.getContentEl();
      attachModalListeners(modalContentEl, {
          '#generate-audio-btn': generateAudio
      });
  }

  // --- GrapesJS Component & Block Definitions ---

  // AI Image Component
  editor.Components.addType('ai-image', {
    extend: 'image',
    model: {
      defaults: {
        attributes: { 'ai-prompt': '', 'ai-size': '1024x1024' },
        traits: [{
          name: 'ai-prompt',
          label: 'AI Prompt',
          type: 'text',
          changeProp: true,
        }, {
          name: 'ai-size',
          label: 'AI Image Size',
          type: 'select',
          options: [
            { value: '1024x1024', name: 'Square (1024x1024)' },
            { value: '1024x1792', name: 'Portrait (1024x1792)' },
            { value: '1792x1024', name: 'Landscape (1792x1024)' },
          ],
          changeProp: true,
        }, {
          type: 'button',
          name: 'generate-ai-image-button',
          label: 'Generate Image',
          command: 'trigger-ai-image-generation',
          full: true,
        },
        // We filter the default traits from the 'image' component to avoid duplicating them
        ...(editor.Components.getType('image')?.model.prototype.defaults.traits || []).filter(t => t.name !== 'src')
        ]
      }
    }
  });

  editor.Blocks.add('ai-image-block', {
    label: 'AI Image',
    category: 'AI Tools',
    content: { type: 'ai-image' },
    media: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" /></svg>`
  });
  
  // Note: 'audio-response-component' is defined in './components.js' which is imported.
  // Make sure it has '.generated-audio' and '.audio-placeholder' classes in its view.

  // --- GrapesJS Command Definitions ---

  editor.Commands.add('get-openai-text', {
    run: (editor, sender) => {
      sender && sender.set('active', false);
      openTextModal();
    }
  });

  editor.Commands.add('get-openai-html', {
    run: (editor, sender) => {
      sender && sender.set('active', false);
      openHtmlModal();
    }
  });

  editor.Commands.add('get-openai-audio', {
    run: (editor, sender) => {
      // This command will likely be triggered by a button on a custom audio component
      sender && sender.set('active', false);
      openAudioModal();
    }
  });

  editor.Commands.add('trigger-ai-image-generation', {
    run: (editor, sender, options = {}) => {
      const component = options.component || editor.getSelected();
      generateAiImageForComponent(editor, component, apiKey, uploadUrl);
    }
  });

  // --- GrapesJS Panel Button Definitions ---

  editor.Panels.addButton('options', {
    id: 'openai-text-button',
    className: 'fa fa-robot',
    command: 'get-openai-text',
    attributes: { title: 'Generate Text with AI' }
  });

  editor.Panels.addButton('options', {
    id: 'openai-html-button',
    className: 'fa fa-code',
    command: 'get-openai-html',
    attributes: { title: 'Generate HTML with AI' }
  });

  // --- Load External Components & Blocks ---
  loadComponents(editor, opts);
  loadBlocks(editor, opts);
};
