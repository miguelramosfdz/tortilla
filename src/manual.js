const Fs = require('fs-extra');
const Minimist = require('minimist');
const Path = require('path');
const Git = require('./git');
const Paths = require('./paths');
const Renderer = require('./renderer');
const Step = require('./step');
const Translator = require('./translator');
const Utils = require('./utils');

/**
  Contains manual related utilities.
 */

(function () {
  if (require.main !== module) {
    return;
  }

  const argv = Minimist(process.argv.slice(2), {
    string: ['_'],
    boolean: ['all', 'root'],
  });

  const method = argv._[0];
  let step = argv._[1];
  const all = argv.all;
  const root = argv.root;

  if (!step && all) {
    step = 'all';
  }
  if (!step && root) {
    step = 'root';
  }

  switch (method) {
    case 'render': return renderManual(step);
  }
}());

// Converts manual into the opposite format
function renderManual(step) {
  if (step) {
    const isSuperStep = !step.split('.')[1];
    if (!isSuperStep) {
      throw TypeError('Provided step must be a super step');
    }
  } else { // Grab recent super step by default
    const superMessage = Step.recentSuperCommit('%s');
    step = superMessage ? Step.descriptor(superMessage).number : 'root';
  }

  // Convert all manuals since the beginning of history
  if (step == 'all') {
    return Git.print(['rebase', '-i', '--root', '--keep-empty'], {
      env: {
        GIT_SEQUENCE_EDITOR: `node ${Paths.tortilla.editor} render`,
      },
    });
  }

  // Indicates whether we should continue rebasing at the end of the invocation.
  // If this script is not run by the git editor we should continue rebasing
  const shouldContinue = !Git.rebasing();

  // Enter rebase, after all this is what rebase-continue is all about
  if (shouldContinue) {
    Utils.scopeEnv(Step.edit.bind(Step, step), {
      TORTILLA_STDIO: 'ignore',
    });
  }

  const localesDir = `${Paths.manuals.templates}/locales`;
  let locales = [''];

  if (Utils.exists(localesDir)) {
    locales = locales.concat(Fs.readdirSync(localesDir));
  }

  // Render manual for each locale
  locales.forEach((locale) => {
    // Fetch the current manual and other useful models
    const manualTemplatePath = getManualTemplatePath(step, locale);
    const manualTemplate = Fs.readFileSync(manualTemplatePath, 'utf8');
    const manualViewPath = getManualViewPath(step, locale);
    const commitMessage = getStepCommitMessage(step);

    const manualView = renderManualView(manualTemplate, {
      step,
      commitMessage,
      templatePath: manualTemplatePath,
      viewPath: manualViewPath,
      language: locale,
    });

    // Rewrite manual
    Fs.ensureDir(Paths.manuals.views);

    // In case a custom render target is specified, ensure its dir exists
    const target = process.env.TORTILLA_RENDER_TARGET;
    if (target) {
      const customTargetDir = Path.resolve(Paths.manuals.views, target);
      Fs.ensureDir(customTargetDir);
    }

    Fs.ensureDirSync(Path.dirname(manualViewPath));
    Fs.writeFileSync(manualViewPath, manualView);

    // Amend changes
    Git(['add', manualViewPath]);

    // The following code is dedicated for locale-free manuals
    if (locale) {
      return;
    }

    const symlinkPath = Path.resolve(Paths.manuals.views, 'root.md');

    // If this is the root step, create a symlink to README.md if not yet exists
    if (step != 'root' || Utils.exists(symlinkPath)) {
      return;
    }

    const relativeSymlink = Path.relative(Path.dirname(symlinkPath), manualViewPath);
    Fs.symlinkSync(relativeSymlink, symlinkPath);
    Git(['add', symlinkPath]);
  });

  Git.print(['commit', '--amend'], {
    env: {
      GIT_EDITOR: true,
    },
  });

  // Continue if should
  if (shouldContinue) {
    Git.print(['rebase', '--continue']);
  }
}

// Renders manual template into informative view
function renderManualView(manual, scope) {
  let header,
    body,
    footer;

  Translator.scopeLanguage(scope.language, () => {
    header = Renderer.renderTemplateFile('header', scope);
    body = Renderer.renderTemplate(manual, scope);
    footer = Renderer.renderTemplateFile('footer', scope);
  });

  return [header, body, footer].join('\n');
}

// Gets the manual template belonging to the given step
function getManualTemplatePath(step, locale) {
  locale = locale ? (`locales/${locale}`) : '';

  const baseDir = Path.resolve(Paths.manuals.templates, locale);
  const fileName = step == 'root' ? 'root.tmpl' : (`step${step}.tmpl`);

  return Path.resolve(baseDir, fileName);
}

// Gets the manual view belonging to the given step
function getManualViewPath(step, locale) {
  locale = locale ? (`locales/${locale}`) : '';

  // The sub-dir of our views in case a custom render target is specified
  const subDir = process.env.TORTILLA_RENDER_TARGET || '';
  const fileName = step == 'root' ? 'root.md' : (`step${step}.md`);

  // If sub-dir exists, return its path e.g. manuals/view/medium
  if (subDir) {
    return Path.resolve(Paths.manuals.views, subDir, locale, fileName);
  }
  // If we're trying to render root step, return README.md
  if (step == 'root' && !locale) {
    return Paths.readme;
  }
  // Resolve normally e.g. manuals/views/step1.md
  return Path.resolve(Paths.manuals.views, locale, fileName);
}

// Gets the commit message belonging to the given step
function getStepCommitMessage(step) {
  if (step == 'root') {
    const rootHash = Git.rootHash();
    return Git(['log', '-1', rootHash, '--format=%s']);
  }

  return Git(['log', '-1', '--grep', `^Step ${step}:`, '--format=%s']);
}


module.exports = {
  render: renderManual,
  manualTemplatePath: getManualTemplatePath,
  manualViewPath: getManualViewPath,
};
