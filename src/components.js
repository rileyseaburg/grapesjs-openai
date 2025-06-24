export default (editor, opts = {}) => {
  const domc = editor.DomComponents;

  domc.addType('html', {
    model: {
      defaults: {
        droppable: true,
        draggable: true,
        removable: true,
        copyable: true,
        content: '',
        traits: [],
      },
    },
    view: {
      events: {
        dblclick: 'onActive',
      },
    },
    isComponent: (el) => el.tagName === 'DIV',
  });

  domc.addType('audio-response-component', {
    model: {
      defaults: {
        tagName: 'div',
        droppable: false,
        draggable: true,
        copyable: true,
        removable: true,
        content: `
          <div class="audio-response-wrapper p-4 border rounded-lg bg-gray-50">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold">AI Audio Generator</h3>
              <button class="generate-audio-btn bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded">
                🎵 Generate Audio
              </button>
            </div>
            <div class="audio-player-container">
              <audio controls class="generated-audio w-full" style="display: none;">
                Your browser does not support the audio element.
              </audio>
              <div class="audio-placeholder text-center text-gray-500 py-8">
                Click "Generate Audio" to create speech from text
              </div>
            </div>
          </div>
        `,
        traits: [
          {
            type: 'text',
            label: 'Placeholder Text',
            name: 'placeholder-text',
          }
        ],
      },
    },
    view: {
      events: {
        'click .generate-audio-btn': 'onActive',
      },
      onActive() {
        const modal = editor.Modal;
        // Load the audio modal content
        fetch('./src/audio-modal.html')
          .then(response => response.text())
          .then(html => {
            modal.setTitle('Generate Audio Response');
            modal.setContent(html);
            modal.open();
            
            // Add event listener for the generate button inside the modal
            const generateBtn = modal.getContentEl().querySelector('#generate-audio-btn');
            if (generateBtn) {
              generateBtn.addEventListener('click', () => {
                this.generateAudio();
              });
            }
          })
          .catch(error => {
            console.error('Error loading audio modal:', error);
          });
      },
    },
    isComponent: (el) => el.classList?.contains('audio-response-component'),
  });
};
