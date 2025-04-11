import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export default (editor, opts = {}) => {
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

  const imageModalContent = `
  <div id="image-prompt-creation-modal" class="p-4">
    <div class="absolute top-0 right-0 p-4 z-10">
      <button class="text-2xl" onclick="editor.Modal.close()">&times;</button>
    </div>
    <h2 class="text-xl font-bold mb-4">Generate Image with AI</h2>
    <div class="flex flex-col mb-3">
      <label for="image-prompt" class="mb-1 font-semibold">Image Prompt:</label>
      <textarea id="image-prompt" rows="4" placeholder="Describe the image you want to create..." class="border p-1 rounded"></textarea>
    </div>
    <div class="flex flex-col mb-3">
      <label for="image-size" class="mb-1 font-semibold">Image Size:</label>
      <select id="image-size" class="border p-1 rounded bg-white">
        <option value="1024x1024">1024x1024 (Default)</option>
        <option value="1024x1792">1024x1792</option>
        <option value="1792x1024">1792x1024</option>
        <option value="512x512">512x512 (Older models)</option>
        <option value="256x256">256x256 (Older models)</option>
      </select>
    </div>
    <div class="mt-6 text-right">
      <div id="image-spinner" style="display: none;" class="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-3"></div>
      <button class="rounded-md bg-purple-600 hover:bg-purple-700 text-white px-5 py-2" id="generate-image-btn">Generate Image</button>
    </div>
  </div>
  `;

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


  async function generateImage() {
      console.log('generateImage function called'); // Debug log
    const promptInput = document.getElementById('image-prompt');
    const sizeSelect = document.getElementById('image-size');
    const spinner = document.getElementById('image-spinner');
    const generateBtn = document.getElementById('generate-image-btn');
    const component = editor.getSelected(); // Should be the image component

    if (!promptInput || !sizeSelect || !component || component.get('type') !== 'image') {
      editor.log('Error: Could not find prompt input, size select, or valid selected image component.', { level: 'error' });
      return;
    }

    const prompt = promptInput.value.trim();
    const size = sizeSelect.value;

    if (!prompt) {
      editor.log('Please enter an image prompt.', { level: 'warning' });
      return;
    }

      // --- Get surrounding text context ---
      let surroundingText = '';
      const parent = component.parent();
      if (parent) {
        parent.components().forEach(sibling => {
          // Check if sibling is a text node or has text content
          if (sibling.get('type') === 'text' || sibling.is('textnode')) {
            surroundingText += sibling.toHTML() + ' ';
          } else if (sibling.components().length > 0) {
             // Basic check for text in children of siblings (might need deeper recursion)
             sibling.components().forEach(child => {
                if (child.get('type') === 'text' || child.is('textnode')) {
                    surroundingText += child.toHTML() + ' ';
                }
             });
          }
        });
      }
      // Basic cleaning
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = surroundingText;
      surroundingText = tempDiv.textContent || tempDiv.innerText || '';
      surroundingText = surroundingText.replace(/\s+/g, ' ').trim();
      // --- End context gathering ---

      // Combine prompt and context
      const finalPrompt = surroundingText 
        ? `${prompt}\n\n[Surrounding Text Context: ${surroundingText}]`
        : prompt;


    try {
      // Show spinner, disable button
      if (spinner) spinner.style.display = 'inline-block';
      if (generateBtn) generateBtn.disabled = true;

      // Make API call to OpenAI Image Generation endpoint
      const response = await axios.post('https://api.openai.com/v1/images/generations', {
        model: "dall-e-3", // Or specify another model like dall-e-2
        prompt: finalPrompt, // Use prompt with context
        n: 1, // Generate one image
        size: size,
        response_format: 'url' // Get URL directly
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,

  // Removed TraitManager definition from inside generateImage function's axios call

          'Content-Type': 'application/json'
        }
      });

      if (!response?.data?.data?.[0]?.url) {
        console.error('Invalid response format from OpenAI Image API:', response?.data);
        throw new Error('Invalid response format from OpenAI Image API');
      }

      const imageUrl = response.data.data[0].url;

      // Update the selected image component's src
      component.addAttributes({ src: imageUrl });
      // Optionally update alt text too?
      // component.addAttributes({ alt: prompt });

      modal.close();

    } catch (error) {
      console.error('Error generating image with OpenAI:', error);
      let errorMsg = 'Failed to generate image.';
      if (error.response?.data?.error?.message) {
        errorMsg += ` ${error.response.data.error.message}`;
      }
      editor.log(errorMsg, { level: 'error' });
    } finally {
      // Hide spinner, enable button
      if (spinner) spinner.style.display = 'none';
      if (generateBtn) generateBtn.disabled = false;
    }
  }

  // Removed toggleHtmlInputMode helper function

  function openImageModal() {
      // Define the handler function once
      const imageModalClickHandler = (event) => {
        // Check if the click is on the generate button AND the modal is still open
        if (event.target && event.target.id === 'generate-image-btn' && modal.isOpen()) {
          console.log('Generate Image button clicked (delegated), calling generateImage...'); // Debug log
          generateImage();
        }
      };
  
      // Function to remove the listener
      const removeImageModalListener = () => {
        document.body.removeEventListener('click', imageModalClickHandler);
        // Also remove the listener for the modal close event itself
        editor.off('modal:close', removeImageModalListener);
      };
  
      // Add the delegated listener to the body BEFORE opening
      document.body.addEventListener('click', imageModalClickHandler);
  
      // Add a listener to remove the body listener when the modal closes
      editor.on('modal:close', removeImageModalListener);
  
      // Set content and open
      modal.setContent(imageModalContent);
      modal.open();
      // No listener setup needed inside 'modal:open' anymore
    }

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
  
      // Generate button listener (clone/replace)
      const generateBtn = modalContentEl.querySelector('#generate-html-btn');
      if (generateBtn) {
        const newGenBtn = generateBtn.cloneNode(true);
        generateBtn.parentNode.replaceChild(newGenBtn, generateBtn);
        newGenBtn.addEventListener('click', generateHTML);
      } else console.error('Generate HTML button not found.');
  
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
              plainSection.style.display = 'block';
              newToggleBtn.textContent = 'Switch to Structured Input';
              modalContainer.setAttribute('data-input-mode', 'plain');
            }
        });

  // Define custom trait type for AI buttons
  editor.TraitManager.addType('ai-button', {
    // Expects 'command' option
    createInput({ trait }) {
      const el = document.createElement('div');
      const commandId = trait.get('command');
      el.innerHTML = `
        <button type="button" class="gjs-trt-button" style="width: 100%; margin-top: 10px;">
          ${trait.get('label') || 'Run Command'}
        </button>
      `;
      const button = el.querySelector('button');
      // Use mousedown to trigger command, as click might be prevented by GrapesJS
      button.addEventListener('mousedown', (e) => {
         e.stopPropagation(); // Prevent GrapesJS from interfering
         editor.runCommand(commandId);
      });
      return el;
    },
    // Prevent GrapesJS from handling value updates for this button
    onUpdate() {},
    onEvent() {},
  });

      } else console.error('Could not find elements for HTML input mode toggle.');
    });
  }


  // Removed stray closing div tags
`


  // Removed htmlModelContent template literal (moved to src/html-modal.html)

  // Removed old openImageModal definition

    // Removed stray closing div tags that were here
  `

  // Removed old openModal definition


  // Removed old openHtmlModal definition

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
  loadBlocks(editor, options);

  // Extend the built-in image component by defining a new type that inherits from it
    const defaultImageType = editor.Components.getType('image'); // Get default type first
    if (!defaultImageType || !defaultImageType.model || !defaultImageType.model.prototype || !defaultImageType.model.prototype.defaults || !Array.isArray(defaultImageType.model.prototype.defaults.traits)) {
        console.error("Could not get default image type traits. Cannot add AI button.");
    } else {
        editor.Components.addType('image', { // Redefine 'image' type
          extend: 'image',
          model: {
            defaults: {
              // Combine default traits with our custom one
              traits: [
                ...defaultImageType.model.prototype.defaults.traits,
                {
                  type: 'ai-button', // Use the custom trait type
                  name: 'generate-image-button',
                  label: 'Generate Image with AI',
                  command: 'open-image-prompt-modal',
                  full: true,
                }
              ]
            }
          }
        });
    }
  // Removed editor.on('load') wrapper, addType should handle timing if default type exists

  // Command to open the image generation modal
  editor.Commands.add('open-image-prompt-modal', {
    run: (editor, sender) => {
      const selectedComponent = editor.getSelected();
      if (!selectedComponent || selectedComponent.get('type') !== 'image') {
        editor.log('Please select an image component first.', { level: 'warning' });
        return;
      }
      // Logic to set modal content and open will go here
      // Need to define imageModalContent and generateImage function first
      openImageModal(); // Placeholder for the function that will handle modal setup
    }
  });


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

  // Removed duplicate async/fetch-based openHtmlModal and toggleHtmlInputMode definitions


      // Open the prompt creation UI
      openHtmlModal();
    }
  });
  editor.Panels.addButton('options', {
    id: 'openai-html-button',
    className: 'fa fa-code',
    command: 'get-openai-html', // The command you've added
    attributes: { title: 'Get HTML from OpenAI' }
  });

}
