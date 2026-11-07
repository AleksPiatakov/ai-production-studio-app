function inspectContinuity(project) {
  const assets = new Map((project.assets || []).map(asset => [asset.id, asset]));
  const characters = new Map((project.bibles?.characters || []).map(character => [character.id, character]));
  const issues = [];
  const scenes = (project.scenes || []).map(scene => {
    const usedAssets = [...new Set((scene.shots || []).flatMap(shot => shot.referenceAssetIds || []))];
    const characterChecks = (scene.characterIds || []).map(characterId => {
      const character = characters.get(characterId);
      const linkedAssets = [...assets.values()].filter(asset => asset.linkedCharacterId === characterId && asset.status === 'approved');
      const referenced = linkedAssets.some(asset => usedAssets.includes(asset.id));
      if (!linkedAssets.length) issues.push({ severity: 'warning', code: 'CHARACTER_ASSET_UNLINKED', sceneId: scene.id, message: `Для персонажа «${character?.name || characterId}» немає затвердженого пов’язаного asset.` });
      else if (!referenced) issues.push({ severity: 'warning', code: 'CHARACTER_REFERENCE_NOT_USED', sceneId: scene.id, message: `Шот сцени «${scene.title}» не використовує затверджений asset персонажа «${character?.name || characterId}».` });
      return { characterId, characterName: character?.name || characterId, linkedAssetCount: linkedAssets.length, referenced };
    });
    return { sceneId: scene.id, title: scene.title, usedAssetIds: usedAssets, characterChecks };
  });
  return { checkedAt: new Date().toISOString(), sceneCount: scenes.length, issues, scenes };
}
module.exports = { inspectContinuity };
