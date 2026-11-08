/* P-14 Project Media Library.
   One project-scoped catalog for assets, versions and usage. Approved assets are immutable. */
let mediaLibraryQuery='';
let mediaLibraryType='all';
let mediaLibraryStatus='all';

function mediaTypeGroup(asset){
  if(['image','reference'].includes(asset.type))return 'visual';
  if(asset.type==='video')return 'video';
  if(asset.type==='audio')return 'voice';
  if(['music','ambient','sfx'].includes(asset.type))return 'sound';
  return 'other';
}
function mediaUsage(asset){
  const uses=[];
  const character=(active.bibles?.characters||[]).find(item=>item.id===asset.linkedCharacterId);
  if(character)uses.push('Персонаж: '+character.name);
  const linkedScene=(active.scenes||[]).find(scene=>scene.id===asset.linkedSceneId);
  if(linkedScene)uses.push('Сцена: '+linkedScene.title);
  for(const scene of active.scenes||[]){
    for(const shot of scene.shots||[]){
      if(shot.id===asset.linkedShotId||shot.keyImageAssetId===asset.id||(shot.referenceAssetIds||[]).includes(asset.id)){
        const shotIndex=(scene.shots||[]).findIndex(item=>item.id===shot.id)+1;
        const label='Кадр: '+scene.title+' · '+shotIndex;
        if(!uses.includes(label))uses.push(label);
      }
    }
  }
  return uses;
}
function assetVersions(assetId){return (active.assetVersions||[]).filter(version=>version.assetId===assetId).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))}
function mediaPlayableUri(uri,kind){
  const value=String(uri||'');
  if(value.startsWith('/')||value.startsWith('data:')||value.startsWith('blob:'))return value;
  return '';
}
function mediaPreview(asset){
  const uri=mediaPlayableUri(asset.uri,asset.type);
  if(['image','reference'].includes(asset.type)&&uri)return `<img src="${esc(uri)}" alt="${esc(asset.label)}">`;
  if(asset.type==='video'&&uri)return `<video muted controls preload="metadata" src="${esc(uri)}"></video>`;
  if(['audio','music','ambient','sfx'].includes(asset.type)&&uri)return `<div class="media-audio-preview"><span>♫</span><audio controls preload="metadata" src="${esc(uri)}"></audio></div>`;
  return `<div class="media-generic-preview"><span>${asset.type==='video'?'▶':['audio','music','ambient','sfx'].includes(asset.type)?'♫':'▧'}</span><small>${esc(label('asset',asset.type)||asset.type)}</small></div>`;
}
function mediaLibraryFiltered(){
  const q=mediaLibraryQuery.trim().toLowerCase();
  return (active.assets||[]).filter(asset=>{
    if(mediaLibraryType!=='all'&&mediaTypeGroup(asset)!==mediaLibraryType)return false;
    if(mediaLibraryStatus!=='all'&&asset.status!==mediaLibraryStatus)return false;
    if(q&&!String(asset.label+' '+(asset.notes||'')+' '+(asset.uri||'')).toLowerCase().includes(q))return false;
    return true;
  });
}
function mediaCard(asset){
  const versions=assetVersions(asset.id),uses=mediaUsage(asset),approved=asset.status==='approved',stale=asset.dependencyStatus==='needs-review';
  return `<article class="media-card ${stale?'needs-review':''}">
    <div class="media-preview">${mediaPreview(asset)}</div>
    <div class="media-card-body">
      <div class="media-card-title"><div><strong>${esc(asset.label)}</strong><span>${esc(label('asset',asset.type)||asset.type)}</span></div><span class="tag ${stale?'needs-review':''}">${stale?'Потрібна перевірка':esc(label('status',asset.status)||asset.status)}</span></div>
      <p>${stale?'Залежний затверджений сценарій змінено. Матеріал збережено без автоматичної регенерації.':esc(asset.notes||'Без нотатки')}</p>
      <div class="media-meta"><span>v${esc(asset.version||'0.1.0')}</span><span>${versions.length} версій</span><span>${uses.length} зв’язків</span></div>
      <div class="media-usage">${uses.length?uses.slice(0,3).map(item=>`<span>${esc(item)}</span>`).join(''):'<span>Не прив’язано до сцени/кадру</span>'}${uses.length>3?`<span>+${uses.length-3}</span>`:''}</div>
      <div class="media-card-actions"><button type="button" onclick="openMediaVersionHistory('${esc(asset.id)}')">Версії</button><button type="button" onclick="openNewAssetVersion('${esc(asset.id)}')">＋ Нова версія</button><button type="button" onclick="openAsset('${esc(asset.id)}')">${approved?'Переглянути':'Редагувати'}</button></div>
    </div>
  </article>`;
}
function mediaLibraryPanel(){
  const items=mediaLibraryFiltered(),all=active.assets||[],approved=all.filter(asset=>asset.status==='approved').length,drafts=all.filter(asset=>asset.status==='draft').length,versions=(active.assetVersions||[]).length;
  return `<section class="media-library"><header class="media-library-head"><div><p class="eyebrow">МЕДІАБІБЛІОТЕКА</p><h3>Матеріали поточного проєкту</h3><p>Зображення, відео, голоси, музика, SFX та інші файли з їхніми версіями й використанням.</p></div><button class="primary" type="button" onclick="openAsset()">＋ Додати ресурс</button></header>
    <div class="media-library-stats"><span><b>${all.length}</b> матеріалів</span><span><b>${approved}</b> затверджено</span><span><b>${drafts}</b> чернеток</span><span><b>${versions}</b> версій</span></div>
    <div class="media-library-filters"><label>Пошук<input type="search" value="${esc(mediaLibraryQuery)}" placeholder="Назва, нотатка або URI…" oninput="setMediaLibraryQuery(this.value)"></label><label>Тип<select onchange="setMediaLibraryType(this.value)"><option value="all">Усі типи</option><option value="visual" ${mediaLibraryType==='visual'?'selected':''}>Зображення / референси</option><option value="video" ${mediaLibraryType==='video'?'selected':''}>Відео</option><option value="voice" ${mediaLibraryType==='voice'?'selected':''}>Голос / аудіо</option><option value="sound" ${mediaLibraryType==='sound'?'selected':''}>Музика / атмосфера / SFX</option><option value="other" ${mediaLibraryType==='other'?'selected':''}>Інше</option></select></label><label>Статус<select onchange="setMediaLibraryStatus(this.value)"><option value="all">Усі статуси</option><option value="draft" ${mediaLibraryStatus==='draft'?'selected':''}>Чернетка</option><option value="approved" ${mediaLibraryStatus==='approved'?'selected':''}>Затверджено</option><option value="superseded" ${mediaLibraryStatus==='superseded'?'selected':''}>Замінено</option></select></label></div>
    <div class="media-grid">${items.length?items.map(mediaCard).join(''):'<p class="global-empty">За цими фільтрами матеріалів немає.</p>'}</div>
    <p class="media-library-rule">Затверджений матеріал не перезаписується. Будь-яка зміна оформлюється новою чернетковою версією.</p>
  </section>`;
}
function setMediaLibraryQuery(value){mediaLibraryQuery=value;render()}
function setMediaLibraryType(value){mediaLibraryType=value;render()}
function setMediaLibraryStatus(value){mediaLibraryStatus=value;render()}
function openMediaVersionHistory(assetId){
  const asset=(active.assets||[]).find(item=>item.id===assetId);if(!asset)return;
  const versions=assetVersions(asset.id);
  modal('Історія версій ресурсу',`<div class="media-version-head"><p class="eyebrow">РЕСУРС</p><h3>${esc(asset.label)}</h3><p>${esc(asset.uri)}</p></div><div class="media-version-list">${versions.length?versions.map(version=>`<article class="${version.id===asset.currentVersionId?'current':''}"><div><strong>${esc(version.version)}</strong><span class="tag">${esc(label('status',version.status)||version.status)}</span></div><p>${esc(version.notes||'Без нотатки')}</p><small>${esc(version.source||'manual')} · ${esc(version.model||'без моделі')} · ${esc(new Date(version.createdAt).toLocaleString('uk-UA'))}</small><code>${esc(version.uri||'')}</code>${version.parameters?.checksum?`<code>SHA-256 ${esc(version.parameters.checksum)}</code>`:''}${version.id===asset.currentVersionId?'<b>Поточна версія</b>':''}</article>`).join(''):'<p class="global-empty">Окремих записів версій ще немає.</p>'}</div>`,()=>Promise.resolve());
  const submit=document.querySelector('#modal-form button[type="submit"]');if(submit)submit.textContent='Закрити';
}
function openNewAssetVersion(assetId){
  const asset=(active.assets||[]).find(item=>item.id===assetId);if(!asset)return;
  const versions=assetVersions(asset.id),suggested='v'+(versions.length+2);
  modal('Нова чернеткова версія',`<p class="muted">Оригінальний ресурс і затверджені версії залишаться незмінними.</p><label>Позначення версії<input name="version" required value="${esc(suggested)}"></label><label>URI нового файла<input name="uri" required value="${esc(asset.uri||'')}"></label><label>Нотатка<textarea name="notes" placeholder="Що змінилося в цій версії?"></textarea></label>`,f=>api(`/api/projects/${encodeURIComponent(activeId)}/assets/${encodeURIComponent(asset.id)}/versions`,{method:'POST',body:JSON.stringify({version:String(f.get('version')||''),uri:String(f.get('uri')||''),notes:String(f.get('notes')||''),source:'manual',parentVersionId:asset.currentVersionId||null})}));
}
const mediaBasePageContent=pageContent;pageContent=function(){return view==='mediaLibrary'?mediaLibraryPanel():mediaBasePageContent()};
const mediaBaseViewTitle=viewTitle;viewTitle=function(){return view==='mediaLibrary'?'Медіабібліотека':mediaBaseViewTitle()};
const mediaBaseViewActions=viewActions;viewActions=function(){return view==='mediaLibrary'?'<button class="primary" onclick="openAsset()">＋ Ресурс</button>':mediaBaseViewActions()};
