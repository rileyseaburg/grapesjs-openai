import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export default (editor, opts = {}) => {

  // --- Inject CSS for Loading State ---
  const css = editor.CssComposer;
  css.addRules(`
    .ai-image-loading::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(0,0,0,0.5);
      z-index: 1;
      border-radius: inherit; /* Optional: match component border-radius */
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

  // Function to construct a detailed prompt for HTML generation based on landing page inputs
  function constructHtmlPromptBasedOnUserInput() {
      const modalContainer = document.getElementById('html-prompt-creation-modal');
      const currentMode = modalContainer ? modalContainer.getAttribute('data-input-mode') : 'plain'; // Default to plain if container not found
      let prompt = {};
  
      if (currentMode === 'plain') {
        // Use plain language description
        const plainDescription = document.getElementById('html-plain-description').value.trim();
        prompt = {
          description: plainDescription || 'A simple hero section.', // Add a default if empty
          stylingPreference: document.getElementById('html-styling-preference').value || 'Tailwind CSS',
          instructions: "Generate HTML based on the description. Respond ONLY with JSON containing the HTML under 'html_content'."
        };
      } else {
        // Use structured fields
        const pageGoal = document.getElementById('html-page-goal').value;
        const targetAudience = document.getElementById('html-target-audience').value;
        const keyMessage = document.getElementById('html-key-message').value;
        const cta = document.getElementById('html-cta').value;
        const desiredElements = document.getElementById('html-desired-elements').value;
        const toneStyle = document.getElementById('html-tone-style').value;
        const stylingPreference = document.getElementById('html-styling-preference').value;
  
        prompt = {
          goal: pageGoal || 'Not specified',
          targetAudience: targetAudience || 'Not specified',
          keyMessage: keyMessage || 'Not specified',
          desiredElements: desiredElements || 'Not specified',
          primaryCTA: cta || null,
          toneStyle: toneStyle || 'Default',
          stylingPreference: stylingPreference || 'Tailwind CSS',
          instructions: "Generate HTML based on these specifications. Respond ONLY with JSON containing the HTML under 'html_content'."
        };
      }
  
      return JSON.stringify(prompt, null, 2);
    }

  // Function to construct a detailed prompt based on user input
  function constructDetailedPromptBasedOnUserInput() {
      const instructions = document.getElementById('text-instructions').value.trim();
      const toneStyle = document.getElementById('text-tone-style').value.trim();
  
      if (!instructions) {
        // Handle case where instructions are empty, maybe return a default prompt or throw an error
        // For now, let's return a generic prompt.
        return "Generate a short paragraph of placeholder text.";
      }
  
      let prompt = instructions;
      if (toneStyle) {
        prompt += `\n\nPlease write this in a ${toneStyle} tone.`;
      }
  
      // Add instruction for the AI about its role
      prompt = `You are a copywriting assistant. Fulfill the following request:\n\n${prompt}`;
  
      return prompt;
    }


  async function generateText() {
    // when generate text button is loaded in the dom

    const detailedPrompt = constructDetailedPromptBasedOnUserInput();
    // Close the modal

    // Proceed with the API call
    // ... [Rest of your API call logic here]

    // Assume 'openaiText' is the text received from OpenAI
    // Show this text to the user for preview and editing
    // Then update the component with the final text
    try {
      let component = editor.getSelected();

      if (!component || !component.is('text')) {
        console.error('No text component selected.');
        return;
      }
      // Check if the selected component is a text block
      if (component.get('type') !== 'text') {
        console.error('Selected component is not a text block');
        return;
      }

      // Removed preText calculation logic as context is no longer sent

      const selectedModel = document.getElementById('text-model-select').value;
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        "model": selectedModel,
        "messages": [
          // The detailedPrompt now includes the system role instruction
          {
            "role": "user", // Send the constructed prompt as user input
            "content": detailedPrompt
          }
        ],
        // Removed max_tokens and preText message
        "temperature": 1,
        "top_p": 1,
        "n": 1,
        "stream": false,
        "logprobs": null,
        "stop": "\n"
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const openaiText = response.data.choices[0].message.content;

      let classes = component.getClasses();

      // Update the selected component with the OpenAI text
      component.replaceWith({
        type: 'text',
        content: openaiText,
        classes: classes
      });
      component.setId(uuidv4());
      component.view.render();

      // close the modal
      modal.close();

    } catch (error) {
      console.error('Error getting text from OpenAI:', error);
    }
  }

  // Get the Modal module from the editor
  const modal = editor.Modal;

  // [Removed incorrect event delegation code]

  async function generateHTML() {
      const detailedPrompt = constructHtmlPromptBasedOnUserInput();
      let response = null;
      let component = null;
      const spinner = document.getElementById('html-spinner');
      const generateBtn = document.getElementById('generate-html-btn');
  
      try {
        // Show spinner, disable button
        if (spinner) spinner.style.display = 'inline-block';
        if (generateBtn) generateBtn.disabled = true;
  
        component = editor.getSelected();


      // Removed obsolete preHTML context calculation logic

      const selectedModel = document.getElementById('html-model-select').value;
      // Prepare messages for the API call
      const messages = [
        {
          "role": "system",
          "content": "You are a web development assistant. Generate a SINGLE version of HTML based on the user's specifications. Do NOT provide multiple variations or options. Respond ONLY with a valid JSON object containing the single generated HTML under a key named 'html_content'. Example: {\"html_content\": \"<div>Example HTML</div>\"}"
        },
        {
          "role": "user",
          "content": detailedPrompt // User specifications (already stringified JSON)
        }
      ];
      
      // Add existing component HTML as context if available
      if (component) {
        try {
          const existingHtml = component.toHTML();
          if (existingHtml) {
            messages.push({
              "role": "user",
              "content": `Existing HTML context to consider (modify or replace based on other instructions):\n\`\`\`html\n${existingHtml}\n\`\`\``
            });
          }
        } catch (htmlError) {
          console.warn('Could not get HTML from selected component:', htmlError);
        }
      }
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          "model": selectedModel,
          "messages": messages, // Use the dynamically constructed messages array
          // "max_tokens" removed to use model default
          "temperature": 1,
          "top_p": 1,
          "n": 1,
          "stream": false, // Disable streaming
          "logprobs": null,
          "stop": "\n",
          "response_format": { "type": "json_object" }
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
            // Removed Accept header and responseType
          }
        });
      
      // Handle the complete JSON response directly
      if (!response?.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response format from OpenAI API:', response?.data);
        throw new Error('Invalid response format from OpenAI API');
      }
      
      let parsedContent;
      try {
        // The content itself should be the JSON string
        parsedContent = JSON.parse(response.data.choices[0].message.content);
      } catch (e) {
        console.error('Error parsing response content JSON:', e, 'Content:', response.data.choices[0].message.content);
        throw new Error('Failed to parse JSON content from OpenAI response.');
      }
      
      if (!parsedContent?.html_content) {
        console.error('Parsed response content missing html_content:', parsedContent);
        throw new Error('Invalid JSON structure in response content from OpenAI API. Expected "html_content" key.');
      }
      
      const openaiHTML = parsedContent.html_content;
      
      // Parse and add the generated HTML string directly to the editor
      if (component) {
        // If a component is selected, replace it directly using replaceWith
        try {
          // replaceWith might return the new component(s) or the original (now removed) one depending on version/context
          const replacedResult = component.replaceWith(openaiHTML);
          // Basic check if replacement seemed to happen
          if (!replacedResult) {
               console.warn('component.replaceWith did not return a component.');
          }
           // Potentially select the newly added component(s) if needed, though replaceWith might handle focus
           // const newComponents = Array.isArray(replacedResult) ? replacedResult : [replacedResult];
           // if (newComponents.length > 0) editor.select(newComponents[0]);
      
        } catch (replaceError) {
            console.error('Error replacing component:', replaceError, 'HTML:', openaiHTML);
            // Fallback: try adding to the end if replacement fails? Or just throw?
            throw new Error('Failed to replace component with generated HTML.');
        }
      } else {
        // If no component is selected, add to the end
        const addedComponents = editor.addComponents(openaiHTML);
        if (!addedComponents || (Array.isArray(addedComponents) && addedComponents.length === 0)) {
          console.error('Failed to add components from generated HTML:', openaiHTML);
          throw new Error('Component creation failed from generated HTML.');
        }
      }
      
      // Optional: Select the first added component if needed
      // if (Array.isArray(addedComponents) && addedComponents.length > 0) {
      //   editor.select(addedComponents[0]);
      // } else if (addedComponents) {
      //   editor.select(addedComponents); // If it returns a single component
      // }
      // No need to manually set ID or render, addComponents handles it.
      modal.close();
      
          } catch (error) {
            console.error('Error in generateHTML:', {
              error: error.message,
              // Avoid logging potentially large response object on error
                componentId: component?.getId() // Log component ID instead of full attributes
              });
      editor.log(`Failed to generate HTML: ${error.message}`, { level: 'error' });
    }
  }

  function rerenderHTML() {
    try {
      let component = editor.getSelected();

      if (!component || !component.is('html')) {
        console.error('No HTML component selected.');
        return;
      }

      component.view.render();

    } catch (error) {
      console.error('Error rerendering HTML:', error);
    }
  }

  const modelContent = `
  <div id="prompt-creation-modal">
    <div class="absolute top-0 right-0 p-4 z-10">
      <button class="text-2xl" onclick="editor.Modal.close()">&times;</button>
    </div>
    <div class="flex flex-col mb-3">
        <label for="text-instructions" class="mb-1 font-semibold">Instructions:</label>
        <textarea id="text-instructions" rows="4" placeholder="Describe the text you want to generate..." class="border p-1 rounded"></textarea>
      </div>
      <div class="flex flex-col mb-3">
        <label for="text-tone-style" class="mb-1 font-semibold">Tone/Style:</label>
        <input type="text" id="text-tone-style" placeholder="e.g., professional, friendly" class="border p-1 rounded">
    <div class="flex flex-col mt-4">
      <label for="text-model-select">OpenAI Model:</label>
      <select id="text-model-select">
        <option value="gpt-4o">GPT-4o</option>
        <option value="gpt-4o-mini">GPT-4o Mini</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        <option value="o1">O1</option>
        <option value="o1-mini">O1 Mini</option>
      </select>
    </div>
    <div class="mt-6">
      <button class="rounded-md bg-blue-500 text-white px-4 py-2" id="generate-text-btn">Generate Text</button>
    </div>
  </div>
  `;

  // Removed imageModalContent definition (No longer needed)

  const htmlModelContent = `
<div id="html-prompt-creation-modal" class="p-4">
  <div class="absolute top-0 right-0 p-4 z-10">
    <button class="text-2xl" onclick="editor.Modal.close()">&times;</button>
  </div>
  <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Generate Landing Page HTML</h2>
        <button id="toggle-input-mode" class="text-sm text-blue-600 hover:underline">Switch to Structured Input</button>
      </div>
  
      <div id="plain-language-section">
        <div class="flex flex-col mb-3">
          <label for="html-plain-description" class="mb-1 font-semibold">Describe what you want (Plain Language):</label>
          <textarea id="html-plain-description" rows="4" placeholder="e.g., A hero section..." class="border p-1 rounded"></textarea>
        </div>
      </div>
  
      <div id="structured-fields-section" style="display: none;">
        <hr class="my-4">
        <p class="text-center text-gray-600 mb-3">Fill out the details:</p>
        <div class="flex flex-col mb-3">
          <label for="html-page-goal" class="mb-1 font-semibold">Page/Section Goal:</label>
          <input type="text" id="html-page-goal" placeholder="e.g., Lead capture" class="border p-1 rounded">
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-target-audience" class="mb-1 font-semibold">Target Audience:</label>
          <input type="text" id="html-target-audience" placeholder="e.g., Developers" class="border p-1 rounded">
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-key-message" class="mb-1 font-semibold">Key Message/Offer:</label>
          <textarea id="html-key-message" rows="3" placeholder="Core value proposition..." class="border p-1 rounded"></textarea>
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-cta" class="mb-1 font-semibold">Call to Action (Button Text):</label>
          <input type="text" id="html-cta" placeholder="e.g., Get Started Free" class="border p-1 rounded">
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-desired-elements" class="mb-1 font-semibold">Desired Elements:</label>
          <textarea id="html-desired-elements" rows="2" placeholder="e.g., Hero image, features" class="border p-1 rounded"></textarea>
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-tone-style" class="mb-1 font-semibold">Tone/Style:</label>
          <input type="text" id="html-tone-style" placeholder="e.g., Professional" class="border p-1 rounded">
        </div>
        <div class="flex flex-col mb-3">
          <label for="html-styling-preference" class="mb-1 font-semibold">Styling Preference:</label>
          <input type="text" id="html-styling-preference" placeholder="e.g., Tailwind CSS" class="border p-1 rounded">
        </div>
        <div class="flex flex-col mb-4">
          <label for="html-model-select" class="mb-1 font-semibold">OpenAI Model:</label>
          <select id="html-model-select" class="border p-1 rounded bg-white">
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="o1">O1</option>
            <option value="o1-mini">O1 Mini</option>
          </select>
        </div>
      </div> <!-- Close structured-fields-section -->
      <div id="html-spinner" style="display: none;" class="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
    <div class="mt-6 text-right">
      <button class="rounded-md bg-green-600 hover:bg-green-700 text-white px-5 py-2" id="generate-html-btn">Generate HTML</button>
    </div>
</div>
`;


  // Removed generateImage function (will be part of custom component)

  // Removed toggleHtmlInputMode helper function (No longer needed)

  // Removed openImageModal function (No longer needed)

  function openModal() { // Text Modal
    modal.setContent(modelContent);
    modal.open();
    editor.once('modal:open', () => {
      const modalContentEl = modal.getContentEl();
      if (!modalContentEl) return console.error('Text modal content element not found.');
      const generateBtn = modalContentEl.querySelector('#generate-text-btn');
      if (generateBtn) {
        // Clone/replace to ensure no old listeners
        const newBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newBtn, generateBtn);
        newBtn.addEventListener('click', generateText);
      } else console.error('Generate Text button not found.');
    });
  }

  function openHtmlModal() {
    modal.setContent(htmlModelContent);
    modal.open();
    editor.once('modal:open', () => {
      const modalContentEl = modal.getContentEl();
      if (!modalContentEl) return console.error('HTML modal content element not found.');
  
      // Generate button listener - simplified approach
      const generateBtn = modalContentEl.querySelector('#generate-html-btn');
      if (generateBtn) {
        console.log('Generate HTML button found, attaching event listener');
        generateBtn.addEventListener('click', generateHTML);
      } else {
        console.error('Generate HTML button not found in modal content');
      }
  
      // Toggle button listener (clone/replace)
      const toggleBtn = modalContentEl.querySelector('#toggle-input-mode');
      const plainSection = modalContentEl.querySelector('#plain-language-section');
      const structuredSection = modalContentEl.querySelector('#structured-fields-section');
      const modalContainer = modalContentEl.querySelector('#html-prompt-creation-modal');
  
      if (toggleBtn && plainSection && structuredSection && modalContainer) {
        // Set initial state
        modalContainer.setAttribute('data-input-mode', 'plain');
        structuredSection.style.display = 'none';
        plainSection.style.display = 'block';
        toggleBtn.textContent = 'Switch to Structured Input';
  
        // Clone/replace toggle button to manage listener
        const newToggleBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
  
        newToggleBtn.addEventListener('click', () => { // Inline toggle logic again
            const currentMode = modalContainer.getAttribute('data-input-mode');
            if (currentMode === 'plain') {
              plainSection.style.display = 'none';
              structuredSection.style.display = 'block';
              newToggleBtn.textContent = 'Switch to Plain Language Input';
              modalContainer.setAttribute('data-input-mode', 'structured');
            } else {
              structuredSection.style.display = 'none';

  // Define custom trait type for AI buttons
  editor.TraitManager.addType('ai-button', {
    // Expects 'command' option
    createInput({ trait }) {
      const el = document.createElement('div');
      const commandId = trait.get('command');
      const label = trait.get('label') || 'Run Command';
      el.innerHTML = `
        <button type="button" class="gjs-trt-button" style="width: 100%; margin-top: 10px;">
          ${label}
        </button>
      `;
      const button = el.querySelector('button');
      // Use mousedown to trigger command, as click might be prevented by GrapesJS
      button.addEventListener('mousedown', (e) => {
         e.stopPropagation(); // Prevent GrapesJS from interfering
         console.log(`AI Button Trait clicked, running command: ${commandId}`); // Debug log
         editor.runCommand(commandId, { component: trait.target }); // Pass component context
      });
      return el;
    },
    // Prevent GrapesJS from handling value updates for this button
    onUpdate() {},
    onEvent() {},
  });

              plainSection.style.display = 'block';
              newToggleBtn.textContent = 'Switch to Structured Input';
              modalContainer.setAttribute('data-input-mode', 'plain');
            }
        });

  // Removed TraitManager definition (Using custom component approach)

      } else console.error('Could not find elements for HTML input mode toggle.');
    });
  }


  // Removed stray closing div tags
// Removed stray backtick


  // Removed htmlModelContent placeholder comment

  // Removed old openImageModal placeholder comment

    // Removed stray backtick and placeholder comment

  // Removed old openModal placeholder comment


  // Removed old openHtmlModal placeholder comment

  var wordCount = 0;
  var contextCount = 0;
  const options = {
    ...{

      // default options
    }, ...opts
  };

  const apiKey = options.apiKey;

  // Add components
  loadComponents(editor, options);
  // Add blocks

  // --- Custom AI Image Component ---

  // 1. Define the generation function (modified from previous generateImage)
  async function generateAiImageForComponent(component) {
    if (!component || component.get('type') !== 'ai-image') {
      editor.log('No ai-image component provided.', { level: 'warning' });
      return;
    }

    const prompt = component.get('ai-prompt') || ''; // Get trait property directly
        const size = component.get('ai-size') || '1024x1024'; // Get trait property directly

    if (!prompt) {
      editor.log('Please enter an image prompt in the component settings.', { level: 'warning' });
      return;
    }

    // Indicate loading state (e.g., add a class, change placeholder?)
    // Simple approach: just log
    editor.log('Generating AI image...', { level: 'info' });
    component.addClass('ai-image-loading'); // Add class to trigger CSS

    try {
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
        response_format: 'url'
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response?.data?.data?.[0]?.url) {
        throw new Error('Invalid response format from OpenAI Image API');
      }
      const imageUrl = response.data.data[0].url;
      component.addAttributes({ src: imageUrl });
      editor.log('AI image generated successfully!', { level: 'info' });

    } catch (error) {
      console.error('Error generating AI image:', error);
      let errorMsg = 'Failed to generate AI image.';
      if (error.response?.data?.error?.message) {
        errorMsg += ` ${error.response.data.error.message}`;
      }
      editor.log(errorMsg, { level: 'error' });
    } finally {
       component.removeClass('ai-image-loading'); // Remove class
    }
  }

  // 2. Define the new component type
  editor.Components.addType('ai-image', {
    extend: 'image',
    model: {
      defaults: {
        // Default attributes for prompt and size
        attributes: { 'ai-prompt': '', 'ai-size': '1024x1024' },
        // Define traits for the settings panel
        traits: [
          {
            name: 'ai-prompt',
            label: 'AI Prompt',
            type: 'text', // Text input for the prompt
            changeProp: true, // Update attribute on change
          },
          {
            name: 'ai-size',
            label: 'AI Image Size',
            type: 'select',
            options: [
              { value: '1024x1024', name: '1024x1024' },
              { value: '1024x1792', name: '1024x1792' },
              { value: '1792x1024', name: '1792x1024' },
            ],
            changeProp: true,
          },
          {
            type: 'button',
            name: 'generate-ai-image-button',
            label: 'Generate Image from Prompt',
            command: 'trigger-ai-image-generation',
            full: true,
          },
          // Include default image traits AFTER custom ones
          // Need to get default traits safely
          ...(editor.Components.getType('image')?.model.prototype.defaults.traits || []).filter(t => t.name !== 'src') // Exclude default src trait if needed
        ]
      }
    }
  });

  // 3. Define the command triggered by the button trait
  editor.Commands.add('trigger-ai-image-generation', {
    run: (editor, sender, options) => {
      const component = options?.component || editor.getSelected(); // Get component from options or selection
      if (component && component.get('type') === 'ai-image') {
        generateAiImageForComponent(component);
      } else {
        editor.log('Please select an AI Image component.', { level: 'warning' });
      }
    }
  });

  // 4. Add the block for the new component
  editor.Blocks.add('ai-image-block', {
    label: 'AI Image',
    category: 'AI Tools', // Or any category you prefer
    content: { type: 'ai-image' }, // Specifies the component type to create
    media: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" /></svg>` // Simple image icon
  });

  loadBlocks(editor, options);

  // Removed image component extension placeholder comment
  
    // Command to open the image generation modal (Now unused, remove?)
    // editor.Commands.add('open-image-prompt-modal', {
    //   run: (editor, sender) => {
    //     const selectedComponent = editor.getSelected();
    //     if (!selectedComponent || selectedComponent.get('type') !== 'image') {
    //       editor.log('Please select an image component first.', { level: 'warning' });
    //       return;
    //     }
    //     openImageModal();
    //   }
    // });
  // Removed open-image-prompt-modal command definition


  // This function will open the prompt creation UI
  function openPromptCreationUI() {
    openModal(); // Corrected: This should open the text modal
  }

  // [Helper function definitions moved earlier in the code]
  editor.Commands.add('get-openai-text', {
    run: async (editor, sender) => {
      sender && sender.set('active', false); // Deactivate the button

      // Open the prompt creation UI
      openPromptCreationUI();
    }
  });
  editor.Panels.addButton('options', {
    id: 'openai-button',
    className: 'fa fa-rocket',
    command: 'get-openai-text', // The command you've added
    attributes: { title: 'Get text from OpenAI' }
  });

  editor.Commands.add('get-openai-html', {
    run: async (editor, sender) => {
      sender && sender.set('active', false); // Deactivate the button


  // Removed placeholder comments

      // Open the prompt creation UI
            openHtmlModal(); // This call remains for the HTML generation button
    }
  });
  editor.Panels.addButton('options', {
    id: 'openai-html-button',
    className: 'fa fa-code',
    command: 'get-openai-html', // The command you've added
    attributes: { title: 'Get HTML from OpenAI' }
  });

}
