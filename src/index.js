import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';

export default (editor, opts = {}) => {
  window.generateText = async () => { 
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

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        "model": "gpt-3.5-turbo-1106",
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
      component.setId(Math.random().toString(36).substring(7));
      component.view.render();

      // close the modal
      modal.close();

    } catch (error) {
      console.error('Error getting text from OpenAI:', error);
    }
  }

  // Get the Modal module from the editor
  const modal = editor.Modal;

  window.generateHTML = async () => {
    const detailedPrompt = constructDetailedPromptBasedOnUserInput();
    try {
      let component = editor.getSelected();

      if (!component || !component.is('html')) {
        console.error('No HTML component selected.');
        return;
      }

      const selectedHTML = component.getInnerHTML();

      let preHTML = '';
      let html = editor.getHtml();
      let parser = new DOMParser();
      let doc = parser.parseFromString(html, 'text/html');
      let rawHTML = doc.body.innerHTML;
      let selectedIndex = rawHTML.indexOf(selectedHTML);

      preHTML = rawHTML.substring(selectedIndex - contextCount, selectedIndex);
      rawHTML = rawHTML.replace(/\s{2,}/g, ' ');

      if (selectedIndex === -1) {
        console.error('Selected HTML not found in raw HTML');
        return;
      }

      preHTML = preHTML + '[Insert Here]';

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        "model": "gpt-3.5-turbo-1106",
        "messages": [
          {
            "role": "system",
            "content": "You are a web development assistant."
          },
          {
            "role": "system",
            "content": detailedPrompt
          },
          {
            "role": "user",
            "content": preHTML
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

      const openaiHTML = response.data.choices[0].message.content;

      let classes = component.getClasses();

      component.replaceWith({
        type: 'html',
        content: openaiHTML,
        classes: classes
      });
      component.setId(Math.random().toString(36).substring(7));
      component.view.render();

      modal.close();

    } catch (error) {
      console.error('Error getting HTML from OpenAI:', error);
    }
  }

  window.rerenderHTML = () => {
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
  <div class="mt-6">
    <button
    onclick="generateText()"
    class="rounded-md bg-blue-500 text-white px-4 py-2" id="generate-text-btn">Generate Text</button>
  </div>
</div>
`

  const openModal = () => {
    modal.setContent(modelContent);
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
    openModal();
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
      openModal();
    }
  });
  editor.Panels.addButton('options', {
    id: 'openai-html-button',
    className: 'fa fa-code',
    command: 'get-openai-html', // The command you've added
    attributes: { title: 'Get HTML from OpenAI' }
  });

}
