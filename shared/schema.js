const allowedAgeBands = ['child', 'teen', 'young-adult', 'adult', 'elder'];
const supportedLanguages = ['uk', 'en'];
const projectTypes = ['general', 'science', 'animated-series'];
const bibleStatuses = ['draft', 'approved', 'superseded'];
const workflowStages = ['strategy', 'script', 'assets', 'storyboard', 'voice', 'animation', 'assembly', 'export'];
const workflowStatuses = ['not-started', 'in-progress', 'ready', 'blocked'];

function defaultWorkflow() {
  return workflowStages.map(id => ({ id, status: 'not-started', note: '', updatedAt: null }));
}

function defaultProfile() {
  return { audience: '', format: '', tone: '', mission: '', gospelFoundation: '', creativeApproach: '', audiencePromise: '', editorialRules: '', exclusions: '', seasonArc: '', approvalOwner: '' };
}

function projectTemplate({ id, name, type, defaultLanguage, targetMinutes, description }) {
  return { id, name, type, description, defaultLanguage, targetMinutes, createdAt: new Date().toISOString(),
    languages: supportedLanguages.map(code => ({ code, status: code === defaultLanguage ? 'original' : 'planned' })),
    profile: defaultProfile(), workflow: defaultWorkflow(),
    bibles: { style: [], characters: [] }, episodes: [], scripts: [], voiceProfiles: [], localizations: [], assets: [], assetVersions: [], scenes: [], productions: [], renderJobs: [],
    storage: { layoutVersion: 2, root: `data/projects/${id}`, manifest: `data/projects/${id}/Project_Data/project.json`, database: `data/projects/${id}/Project_Data/project.sqlite`, assetDirectories: ['Assets/Images', 'Assets/Video', 'Assets/Voices', 'Assets/Music', 'Assets/SFX'], exportDirectory: 'Exports', backupDirectory: 'Backups' },
    assistantWorkspace: { id: `project-assistant-${id}`, scope: 'project-only', autonomy: 'suggestions-only', memory: [], actions: [] } };
}

module.exports = { allowedAgeBands, supportedLanguages, projectTypes, bibleStatuses, workflowStages, workflowStatuses, defaultWorkflow, defaultProfile, projectTemplate };
