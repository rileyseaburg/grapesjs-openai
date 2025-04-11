import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export default (editor, opts = {}) => {
  // Function to construct a detailed prompt for HTML generation based on landing page inputs
  function constructHtmlPromptBasedOnUserInput() {
      const pageGoal = document.getElementById('html-page-goal').value;
      const targetAudience = document.getElementById('html-target-audience').value;
      const keyMessage = document.getElementById('html-key-message').value;
      const cta = document.getElementById('html-cta').value;
      const desiredElements = document.getElementById('html-desired-elements').value;
      const toneStyle = document.getElementById('html-tone-style').value;
      const stylingPreference = document.getElementById('html-styling-preference').value;
  
      // Construct a structured JSON prompt
      const prompt = {
        goal: pageGoal || 'Not specified',
        targetAudience: targetAudience || 'Not specified',
        keyMessage: keyMessage || 'Not specified',
        desiredElements: desiredElements || 'Not specified',
        primaryCTA: cta || null,
        toneStyle: toneStyle || 'Default',
        stylingPreference: stylingPreference || 'Clean HTML with minimal inline styles',
        instructions: "Please provide only the raw HTML code for this section, suitable for embedding directly."
      };
  
      return JSON.stringify(prompt, null, 2);
    }

  // Function to construct a detailed prompt based on user input
  function constructDetailedPromptBasedOnUserInput() {
    const sectionType = document.getElementById('section-type').value;
    const contentFocus = document.getElementById('content-focus').value;
    const toneStyle = document.getElementById('tone-style').value;
    wordCount = document.getElementById('word-count').value;
    contextCount = document.getElementById('context-count').value;

    let prompt = "";
    if (wordCount < 1) {
      prompt = `Generate a ${sectionType} section text focusing on ${contentFocus} with a ${toneStyle} tone.`;
    } else {
      prompt = `Generate a ${sectionType} section text focusing on ${contentFocus} with a ${toneStyle} tone. The text should be around ${wordCount} words long.`;
    }

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

      const selectedText = component.getInnerHTML();

      // clean up the HTML to get the raw text
      selectedText.replace(/<[^>]+>/g, '');

      // remove /n from the text
      selectedText.replace(/\n/g, '');
      let preText = '';
      let html = editor.getHtml();
      let parser = new DOMParser();
      let doc = parser.parseFromString(html, 'text/html');
      let rawText = doc.body.textContent;
      let selectedIndex = rawText.indexOf(selectedText);

      preText = rawText.substring(selectedIndex - contextCount, selectedIndex);
      rawText = rawText.replace(/\s{2,}/g, ' ');



      // trim the text to isolate the context to be sent to match the number of words requested in the contextCount
      let words = rawText.split(' ');
      words = words.filter(word => word.trim() !== '' && isNaN(word));

      if (selectedIndex === -1) {
        console.error('Selected text not found in raw text');
        return;
      }
      // push [Insert Here] to the preText
      preText = preText + '[Insert Here]';

      const selectedModel = document.getElementById('text-model-select').value;
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        "model": selectedModel,
        "messages": [
          {
            "role": "system",
            "content": "You are a copywriting assistant."
          },
          {
            "role": "system",
            "content": detailedPrompt
          },
          {
            "role": "user",
            "content": preText
          },
        ],
        "max_tokens": wordCount < 1 ? 256 : wordCount * 2,
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
    try {
      component = editor.getSelected();


      // Removed obsolete preHTML context calculation logic

      const selectedModel = document.getElementById('html-model-select').value;
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          "model": selectedModel,
          "messages": [
            {
              "role": "system",
              "content": "You are a web development assistant. Generate HTML based on the user's specifications. Respond ONLY with a valid JSON object containing the generated HTML under a key named 'html_content'. Example: {\"html_content\": \"<div>Example HTML</div>\"}" // Clearer instructions + example
            },
            {
              "role": "user", // Changed from system to user
              "content": detailedPrompt // User specifications (already stringified JSON)
            }
            // Removed user message sending preHTML
          ],
          "max_tokens": 2048, // Set fixed max_tokens for HTML generation
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
      let addOptions = {};
      if (component) {
        // If replacing an existing component, get its index first
        addOptions.at = component.index();
        // Remove the old component
        component.remove();
      }
      
      // Add the HTML string; GrapesJS will parse it and create editable components
      const addedComponents = editor.addComponents(openaiHTML, addOptions);
      
      if (!addedComponents || (Array.isArray(addedComponents) && addedComponents.length === 0)) {
        // Handle cases where addComponents might return null, undefined, or empty array
        console.error('Failed to add components from generated HTML:', openaiHTML);
        throw new Error('Component creation failed from generated HTML.');
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
        response: response?.data,
        component: component?.getAttributes()
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
  
<!-- Add this HTML inside your GrapesJS editor page -->

<div  id="prompt-creation-modal">
  <!-- close button -->
  <div class="absolute top-0 right-0 p-4 z-10">
    <button class="text-2xl" onclick="document.getElementById('prompt-creation-modal').style.display = 'none';">&times;</button>
  </div>
  <div class="flex flex-col">
    <label for="section-type">Section Type:</label>
    <select id="section-type">
      <option value="header">Header</option>
      <option value="product-description">Product Description</option>
      <option value="testimonial">Testimonial</option>
      <option value="feature">Feature</option>
      <option value="benefit">Benefit</option>
      <option value="call-to-action">Call to Action</option>
    </select>
  </div>
  <div class="flex flex-col">
    <label for="content-focus">Content Focus:</label>
    <input type="text" id="content-focus" placeholder="e.g., features, benefits">
  </div>
  <div class="flex flex-col">
    <label for="tone-style">Tone/Style:</label>
    <input type="text" id="tone-style" placeholder="e.g., professional, friendly">
  </div>
  <div class="flex flex-col">
    <label for="word-count">Word Count:</label>
    <sub>(Optional)</sub>
    <input class="mt-5" type="number" id="word-count" placeholder="e.g., 100">
  </div>
  <div class="flex flex-col">
    <label for="context-count">Previous Text To Include:</label>
    <sub class="text-label text-red-500">Required</sub>
    <input class="mt-5" type="number" id="context-count" placeholder="e.g., 1">
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
    <button
    class="rounded-md bg-blue-500 text-white px-4 py-2" id="generate-text-btn">Generate Text</button>
  </div>
</div>
`


  const htmlModelContent = `
  <div id="html-prompt-creation-modal" class="p-4">
    <!-- close button -->
    <div class="absolute top-0 right-0 p-4 z-10">
      <button class="text-2xl" onclick="editor.Modal.close()">&times;</button>
    </div>
    <h2 class="text-xl font-bold mb-4">Generate Landing Page HTML</h2>

    <div class="flex flex-col mb-3">
      <label for="html-page-goal" class="mb-1 font-semibold">Page/Section Goal:</label>
      <input type="text" id="html-page-goal" placeholder="e.g., Lead capture, Product info" class="border p-1 rounded">
    </div>

    <div class="flex flex-col mb-3">
      <label for="html-target-audience" class="mb-1 font-semibold">Target Audience:</label>
      <input type="text" id="html-target-audience" placeholder="e.g., Developers, Marketers" class="border p-1 rounded">
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
      <label for="html-desired-elements" class="mb-1 font-semibold">Desired Elements (comma-separated):</label>
      <textarea id="html-desired-elements" rows="2" placeholder="e.g., Hero image, feature list, testimonials" class="border p-1 rounded"></textarea>
    </div>

    <div class="flex flex-col mb-3">
      <label for="html-tone-style" class="mb-1 font-semibold">Tone/Style:</label>
      <input type="text" id="html-tone-style" placeholder="e.g., Professional, Modern, Playful" class="border p-1 rounded">
    </div>

    <div class="flex flex-col mb-3">
      <label for="html-styling-preference" class="mb-1 font-semibold">Styling Preference:</label>
      <input type="text" id="html-styling-preference" placeholder="e.g., Tailwind CSS, Bootstrap, Minimal CSS" class="border p-1 rounded">
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

    <div class="mt-6 text-right">
      <button
        class="rounded-md bg-green-600 hover:bg-green-700 text-white px-5 py-2" id="generate-html-btn">Generate HTML</button>
    </div>
  </div>
  `

  function openModal() {
    // Set up listener *before* opening
    editor.once('modal:open', () => {
      const modalContentEl = modal.getContentEl();
      if (!modalContentEl) {
        console.error('Modal content element not found after modal:open.');
        return;
      }
      // Attach a delegated listener to the content element
      modalContentEl.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'generate-text-btn') {
          generateText();
        }
      });
    });

    // Now set content and open
    modal.setContent(modelContent);
    modal.open();
  }


  function openHtmlModal() {
    // Set up listener *before* opening
    editor.once('modal:open', () => {
      const modalContentEl = modal.getContentEl();
      if (!modalContentEl) {
        console.error('Modal content element not found after modal:open.');
        return;
      }
      // Attach a delegated listener to the content element
      modalContentEl.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'generate-html-btn') {
          generateHTML();
        }
      });
    });

    // Now set content and open
    modal.setContent(htmlModelContent);
    modal.open();
  }

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
