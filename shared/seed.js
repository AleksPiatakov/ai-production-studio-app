const { projectTemplate } = require('./schema');

function seed() {
  const neuro = projectTemplate({ id: 'neurocore-science', name: 'NeuroCore Science', type: 'science', defaultLanguage: 'en', targetMinutes: 9, description: 'English popular-science videos, 8–10 minutes.' });
  neuro.bibles.style.push({ id: 'style-neuro-1', version: '1.0.0', status: 'approved', name: 'NeuroCore clarity', rules: 'Clean editorial motion design, evidence-first tone, accessible diagrams.', references: [] });
  neuro.bibles.characters.push({ id: 'host-neuro-1', version: '1.0.0', status: 'approved', name: 'NeuroCore Narrator', ageBand: 'adult', identityKey: 'neurocore-narrator-v1', rules: 'Calm adult English narration.', references: [] });

  const faith = projectTemplate({ id: 'animated-faith-stories', name: 'Animated Faith Stories', type: 'animated-series', defaultLanguage: 'uk', targetMinutes: 10, description: 'Original cinematic 3D stories; each episode stands alone within a 12-episode seasonal arc.' });
  faith.bibles.style.push({ id: 'style-faith-1', version: '1.0.0', status: 'approved', name: 'Cinematic fable 3D', rules: 'Warm cinematic 3D; stable proportions, materials, locations; no language-dependent on-screen text.', references: ['asset://references/cinematic-fable-style'] });
  faith.bibles.characters.push({ id: 'character-luma-1', version: '1.0.0', status: 'approved', name: 'Лума', ageBand: 'teen', identityKey: 'luma-rig-v1', rules: 'Original young fox explorer; locked rig, amber fur material, blue scarf.', references: ['asset://characters/luma/turnaround-v1'] });
  faith.assets.push({ id: 'asset-luma-rig', type: 'blender-rig', label: 'Luma rig v1', uri: 'asset://characters/luma/rig-v1.blend', version: '1.0.0', status: 'approved' });
  return { version: 1, projects: [neuro, faith] };
}
module.exports = { seed };
