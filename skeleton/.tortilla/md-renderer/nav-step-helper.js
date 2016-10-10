var MDRenderer = require('.');
var Git = require('../git');
var Step = require('../step');

/*
  Provides a navigation bar between steps. The navigation bar should be rendered
  dynamically based on the current step we're currently in.
 */

MDRenderer.registerHelper('nav_step', function() {
  var step = this.step || getStep();
  // If there is no belonging step, don't render anything
  if (!step) return '';

  // Editing root
  if (step == 'root') {
    var anySteps = !!Git(['tag', '-l', 'step1']);
    // If there are no any steps yet, don't show nav bar
    if (!anySteps) return '';

    return MDRenderer.renderTemplateFile('next-button-template.md', {
      text: 'Begin Tutorial',
      ref: 'steps/step1.md'
    });
  }

  // Convert to number just in case, so we can run arbitrary operations
  var step = Number(step);

  var stepTags = Git(['tag', '-l', 'step*'])
    .split('\n')
    .filter(Boolean);

  // If this is the only step or there are no steps at all
  if ((stepTags.length - 2) < 0) return '';

  // If this is the first step
  if (step == 1)
    return MDRenderer.renderTemplateFile('next-button-template.md', {
      text: 'Next Step',
      ref: 'steps/step2.md'
    });

  var currentTag = 'step' + step;
  var recentTag = stepTags[stepTags.length - 1];

  // If this is the last step
  if (currentTag == recentTag)
    return MDRenderer.renderTemplateFile('prev-button-template.md', {
      text: 'Previous Step',
      ref: 'steps/step' + (step - 1) + '.md'
    });

  // Any other case
  return MDRenderer.renderTemplateFile('nav-buttons-template.md', {
    next_text: 'Next Step',
    next_ref: 'steps/step' + (step + 1) + '.md',
    prev_text: 'Previous Step',
    prev_ref: 'steps/step' + (step - 1) + '.md'
  });
});

function getStep() {
  // If no steps found then we're at the root commit
  var stepCommitMessage = Step.recentCommit('%s');
  if (!stepCommitMessage) return 'root';

  // Only super steps are allowed
  var stepDescriptor = Step.superDescriptor(stepCommitMessage);
  if (!stepDescriptor) return;

  return stepDescriptor.number;
}