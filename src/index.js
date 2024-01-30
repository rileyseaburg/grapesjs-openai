import loadComponents from './components';
import loadBlocks from './blocks';
import axios from 'axios';

export default (editor, opts = {}) => {
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


  // Add a new command that fetches text from OpenAI and inserts it at the cursor position
  editor.Commands.add('get-openai-text', {
    run: async (editor, sender) => {
      sender && sender.set('active', false); // Deactivate the button

      try {
        let component = editor.getSelected();
        if (!component || !component.is('text')) {
          console.error('No text component selected.');
          return;
        }

        console.log('Selected component:', component.getInnerHTML());

        // Check if the selected component is a text block
        if (component.get('type') !== 'text') {
          console.error('Selected component is not a text block');
          return;
        }

        const selectedText = component.getInnerHTML();
        console.log('Selected text:', selectedText);

        let html = editor.getHtml();
        let parser = new DOMParser();
        let doc = parser.parseFromString(html, 'text/html');
        let rawText = doc.body.textContent;

        // Find the start index of the selected text
        let selectedIndex = rawText.indexOf(selectedText);

        // Extract text before the selected text
        let preText = rawText.substring(0, selectedIndex);

        // Extract text after the selected text
        let postText = rawText.substring(selectedIndex + selectedText.length);

        console.log('Text before selected text:', preText);
        console.log('Text after selected text:', postText);


        if (selectedIndex === -1) {
          console.error('Selected text not found in raw text');
          return;
        }

        console.log('Pre text:', preText);
        console.log('Post text:', postText);

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          "model": "gpt-3.5-turbo-1106",
          "messages": [
            {
              "role": "system",
              "content": "You are a helpful assistant copywriter."
            },
            {
              "role": "user",
              "content": "Please insert the sales copy in the [Insert Here] section. Only include the sales copy for the section, do not include the messages from the text before or after."
            },
            {
              "role": "system",
              "content": "Here is the sales copy:"
            },
            {
              "role": "user",
              "content": preText
            },
            {
              "role": "user",
              "content": postText
            }
          ],
          "max_tokens": 256,
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
        console.log(openaiText);

        // Update the selected component with the OpenAI text
        component.replaceWith(`<div>${openaiText}</div>`);
        component.setId(Math.random().toString(36).substring(7));
        component.view.render();

      } catch (error) {
        console.error('Error getting text from OpenAI:', error);
      }
    }
  });

  editor.Panels.addButton('options', {
    id: 'openai-button',
    className: 'fa fa-rocket',
    command: 'get-openai-text', // The command you've added
    attributes: { title: 'Get text from OpenAI' }
  });
};