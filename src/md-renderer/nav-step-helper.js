var MDRenderer = require('.');
var Git = require('../git');
var Step = require('../step');

/*
  Provides a navigation bar between steps. The navigation bar should be rendered
  dynamically based on the current step we're currently in.
 */

MDRenderer.registerHelper('nav_step', function() {
  var step = this.step || Step.currentSuper();
  // If there is no belonging step, don't render anything
  if (!step) return '';

  // Editing root
  if (step == 'root') {
    var anySuperStep = !!Git(['log', 'ORIG_HEAD', '-1', '--grep', '^Step [0-9]\\+:']);
    // If there are no any steps yet, don't show nav bar
    if (!anySuperStep) return '';

    return MDRenderer.renderTemplateFile('next-button-template.md', {
      text: 'Begin Tutorial',
      ref: 'manuals/dist/step1.md'
    });
  }

  // Convert to number just in case, so we can run arbitrary operations
  var step = Number(step);

  // Get an array of all super steps in the current tutorial
  var superSteps = Git([
    'log', 'ORIG_HEAD',
    '--grep', '^Step [0-9]\\+:',
    '--format=%s'
  ]).split('\n')
    .filter(Boolean)
    .map(function (commitMessage) { return commitMessage.match(/^Step (\d+)/)[1] })
    .map(Number);

  // If there are no super steps at all
  if (superSteps.length == 0) return '';

  // If this is the first super step
  if (step == 1)
    return MDRenderer.renderTemplateFile('nav-buttons-template.md', {
      next_text: 'Next Step',
      next_ref: 'step2.md',
      prev_text: 'Intro',
      prev_ref: '../../README.md'
    });

  // The order is the other way around, this way we save ourselves the sorting
  var recentSuperStep = superSteps[0];

  // If this is the last step
  if (step == recentSuperStep)
    return MDRenderer.renderTemplateFile('prev-button-template.md', {
      text: 'Previous Step',
      ref: 'step' + (step - 1) + '.md'
    });

  // Any other case
  return MDRenderer.renderTemplateFile('nav-buttons-template.md', {
    next_text: 'Next Step',
    next_ref: 'step' + (step + 1) + '.md',
    prev_text: 'Previous Step',
    prev_ref: 'step' + (step - 1) + '.md'
  });
});